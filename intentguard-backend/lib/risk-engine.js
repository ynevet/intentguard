const OpenAI = require('openai');
const logger = require('./logger');
const { getSlackClient, getBotToken } = require('./slack-client');
const { getSetting } = require('./db');
const { extractText, canExtract } = require('./extractors');
const { preScan } = require('./pre-scan');

let openai;
function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const IMAGE_MIMETYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp',
]);

// OpenAI vision API limit for base64-encoded images
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB
// Max images to send via vision (each costs 85 tokens at detail:low)
const MAX_VISION_IMAGES = 5;

async function getChannelContext(channel, workspaceId = 'default') {
  try {
    const client = await getSlackClient(workspaceId);
    if (!client) throw new Error('No Slack client available');
    const info = await client.conversations.info({ channel });
    const ch = info.channel;
    const context = {
      name: ch.name || ch.id,
      isPrivate: ch.is_private || false,
      isShared: ch.is_shared || ch.is_ext_shared || ch.is_org_shared || false,
      isIm: ch.is_im || false,
      isMpim: ch.is_mpim || false,
      purpose: ch.purpose?.value || '',
      topic: ch.topic?.value || '',
      numMembers: ch.num_members || 0,
    };

    // Check for external guests in the channel
    if (context.isShared) {
      context.hasExternalMembers = true;
    }

    return context;
  } catch (err) {
    logger.warn({ channel, err: err.message }, 'Failed to fetch channel context, using channel ID only');
    return { name: channel, isPrivate: false, isShared: false, isIm: false, isMpim: false, purpose: '', topic: '', numMembers: 0 };
  }
}

function getSystemPrompt(strictAudienceBlocking = false) {
  const audienceRules = strictAudienceBlocking
    ? `Audience rules:
- Public channels: sensitive content (financials, PII, credentials, health, legal) = mismatch even if description is accurate
- Shared/external channels (Slack Connect): any internal content = mismatch (data leak)
- Large channels (50+ members): sensitive content = higher confidence
- Private/DM: lower risk, still check intent vs content`
    : `Audience rules:
- CORE PRINCIPLE: intent vs content is the primary check. If the user accurately describes the file, it is "match" — even in public channels
- Public channels: only flag if intent DOESN'T match content. Set contextRisk based on audience size/visibility but do NOT override a clear intent-content match
- Shared/external channels (Slack Connect): any internal/confidential content = mismatch (data leak to outsiders), regardless of intent
- Credentials/secrets (API keys, passwords, tokens) in ANY channel = mismatch
- Large channels (50+ members): raise contextRisk but do NOT change the match verdict if intent matches content
- Private/DM: lowest risk, still check intent vs content`;

  const mismatchExamples = strictAudienceBlocking
    ? `Mismatch examples:
- "Demo slides" → actual financials
- "Anonymized report" → raw PII/customer emails
- "Project mockup" → credentials or API keys
- PII/financials in a public or shared channel`
    : `Mismatch examples:
- "Demo slides" → actual financials
- "Anonymized report" → raw PII/customer emails
- "Project mockup" → credentials or API keys
- PII/financials in a shared/external channel (Slack Connect)`;

  return `You are IntentGuard, a DLP system. Verify files shared in messages by checking:
1. Intent — what the user claims the file is
2. Content — what's actually inside
3. Context — whether this is appropriate for the channel/audience

Verdicts:
- "match": content consistent with stated intent, appropriate for channel
- "mismatch": content contradicts intent, or sensitive data in wrong channel
- "uncertain": cannot confidently determine

${mismatchExamples}

${audienceRules}

Key rules:
- Vague messages ("check this out", "fyi") lean toward "match"
- Be conservative — only flag clear mismatches; borderline = "match" or "uncertain"
- Multiple files: if ANY file is a clear mismatch, overall = "mismatch"
- Text-extracted files: use the extracted text content for high-confidence analysis
- Metadata-only files: use filename/type/size, lower confidence

Output JSON:
{"match":"match"|"mismatch"|"uncertain","confidence":0.0-1.0,"reasoning":"One sentence","contextRisk":"none"|"low"|"medium"|"high","mismatchType":"none"|"intent_vs_content"|"wrong_audience"|"pii_exposure"|"credential_leak"|"sensitive_in_public"|"external_leak","intentLabel":"short label for user's claim","riskSummary":"One sentence using category labels only, never quote message text or file contents","files":[{"name":"filename","finding":"One sentence","classificationLabel":"financial_report"|"medical_record"|"credentials"|"pii_document"|"legal_document"|"internal_strategy"|"source_code"|"general_document"|"image_screenshot"|"unknown"}]}`;
}

function buildSkippedResult(reason) {
  return {
    match: 'skipped',
    confidence: 0,
    reasoning: reason,
    mismatchType: 'none',
    intentLabel: 'none',
    riskSummary: 'Skipped',
    contextRisk: 'none',
    filesAnalyzed: [],
    error: null,
  };
}

function buildErrorResult(error) {
  return {
    match: 'uncertain',
    confidence: 0,
    reasoning: 'Analysis could not be completed due to an error',
    mismatchType: 'none',
    intentLabel: 'unknown',
    riskSummary: 'Analysis error',
    contextRisk: 'none',
    filesAnalyzed: [],
    error: error.message || String(error),
  };
}

function buildPreScanResult(preScanResult, filesAnalyzed, contextRisk) {
  const findingTypes = [...new Set(preScanResult.findings.map((f) => f.type))];
  const findingSummary = findingTypes.join(', ');
  return {
    match: 'mismatch',
    confidence: preScanResult.confidence,
    reasoning: `Pre-scan detected: ${findingSummary}`,
    contextRisk: contextRisk || 'none',
    mismatchType: preScanResult.mismatchType,
    intentLabel: 'unknown',
    riskSummary: `Sensitive content detected by pre-scan: ${findingSummary}`,
    filesAnalyzed,
    error: null,
    analysisMethod: 'pre-scan',
    preScanFindings: preScanResult.findings,
  };
}

async function callOpenAIWithRetry(messages, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.2,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      });
    } catch (err) {
      if (attempt < maxRetries && (err.status === 429 || err.status >= 500)) {
        const delay = 1000 * Math.pow(2, attempt);
        logger.warn({ attempt, delay, status: err.status }, 'OpenAI call failed, retrying');
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

async function downloadSlackFileAsBuffer(file, workspaceId = 'default') {
  const url = file.url_private_download || file.url_private;
  if (!url) return null;

  const token = await getBotToken(workspaceId);
  if (!token) throw new Error('No bot token available for file download');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function downloadSlackFile(file, workspaceId = 'default') {
  const buffer = await downloadSlackFileAsBuffer(file, workspaceId);
  if (!buffer) return null;
  return buffer.toString('base64');
}

function categorizeFiles(files) {
  const images = [];
  const extractable = []; // PDFs, docs, spreadsheets, etc.
  const nonImages = [];

  for (const file of files) {
    if (IMAGE_MIMETYPES.has(file.mimetype) && file.size <= MAX_IMAGE_SIZE) {
      images.push(file);
    } else if (canExtract(file)) {
      extractable.push(file);
    } else {
      if (IMAGE_MIMETYPES.has(file.mimetype) && file.size > MAX_IMAGE_SIZE) {
        logger.info({ file: file.name, size: file.size, maxSize: MAX_IMAGE_SIZE }, 'Image exceeds 20 MB OpenAI limit, using metadata-only');
      }
      nonImages.push(file);
    }
  }

  return { images, extractable, nonImages };
}

function buildContextSection(channelCtx) {
  const lines = [];
  lines.push(`Channel: #${channelCtx.name}`);

  // Visibility
  if (channelCtx.isIm) {
    lines.push('Type: DM');
  } else if (channelCtx.isMpim) {
    lines.push('Type: group DM');
  } else if (channelCtx.isPrivate) {
    lines.push('Type: private');
  } else {
    lines.push('Type: public');
  }

  // External access — critical DLP signal
  if (channelCtx.isShared || channelCtx.hasExternalMembers) {
    lines.push('⚠️ SHARED/EXTERNAL (Slack Connect)');
  }

  // Audience size
  if (channelCtx.numMembers > 0) {
    lines.push(`Members: ${channelCtx.numMembers}`);
    if (channelCtx.numMembers >= 50) {
      lines.push('⚠️ LARGE AUDIENCE (50+ members)');
    }
  }

  // Channel purpose/topic
  if (channelCtx.purpose) {
    lines.push(`Purpose: ${channelCtx.purpose}`);
  }
  if (channelCtx.topic) {
    lines.push(`Topic: ${channelCtx.topic}`);
  }

  return lines.join('\n');
}

async function buildOpenAIMessages(text, files, channelCtx, strictAudienceBlocking = false, preScanHints = null, workspaceId = 'default') {
  const { images, extractable, nonImages } = categorizeFiles(files);

  // Cap vision images — extras analyzed as metadata-only (saves 85 tokens + download per image)
  const visionImages = images.slice(0, MAX_VISION_IMAGES);
  const overflowImages = images.slice(MAX_VISION_IMAGES);
  if (overflowImages.length > 0) {
    logger.info({ overflow: overflowImages.length, cap: MAX_VISION_IMAGES }, 'Vision image cap reached, extras treated as metadata-only');
  }

  // Download images in parallel, fall back to metadata-only on failure
  const downloadResults = await Promise.allSettled(
    visionImages.map(async (file) => {
      try {
        const base64 = await downloadSlackFile(file, workspaceId);
        return { file, base64, method: 'vision' };
      } catch (err) {
        logger.warn({ file: file.name, err: err.message }, 'Image download failed, falling back to metadata-only');
        return { file, base64: null, method: 'metadata-only' };
      }
    }),
  );

  const processedImages = downloadResults.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return { file: r.reason?.file, base64: null, method: 'metadata-only' };
  });

  // Download and extract text from extractable files in parallel
  const extractResults = await Promise.allSettled(
    extractable.map(async (file) => {
      try {
        const buffer = await downloadSlackFileAsBuffer(file, workspaceId);
        if (!buffer) return { file, text: null, method: 'metadata-only' };
        const extractedText = await extractText(buffer, file.mimetype);
        return { file, text: extractedText, method: extractedText ? 'text-extraction' : 'metadata-only' };
      } catch (err) {
        logger.warn({ file: file.name, err: err.message }, 'File extraction failed, falling back to metadata-only');
        return { file, text: null, method: 'metadata-only' };
      }
    }),
  );

  const processedExtracts = extractResults.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return { file: r.reason?.file, text: null, method: 'metadata-only' };
  });

  // Build user message content parts
  const content = [];

  const contextBlock = typeof channelCtx === 'object'
    ? buildContextSection(channelCtx)
    : `Channel: ${channelCtx || 'unknown'}`;

  content.push({
    type: 'text',
    text: `## Stated intent (message text)\n"${text}"\n\n## Channel context\n${contextBlock}\n\n## Attached files`,
  });

  // Add image files
  for (const { file, base64, method } of processedImages) {
    if (base64 && method === 'vision') {
      content.push({
        type: 'text',
        text: `### File: ${file.name} (${file.mimetype}, ${file.size} bytes) [analyzed via: vision]`,
      });
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${file.mimetype};base64,${base64}`,
          detail: 'low',
        },
      });
    } else {
      content.push({
        type: 'text',
        text: `### File: ${file.name} (${file.mimetype}, ${file.size} bytes) [analyzed via: metadata-only — image could not be downloaded]`,
      });
    }
  }

  // Add overflow images (past cap) as metadata-only
  for (const file of overflowImages) {
    content.push({
      type: 'text',
      text: `### File: ${file.name} (${file.mimetype}, ${file.size} bytes) [analyzed via: metadata-only — vision cap reached]`,
    });
  }

  // Add extractable files (PDFs, docs, spreadsheets, etc.)
  for (const { file, text: extractedText, method } of processedExtracts) {
    if (extractedText && method === 'text-extraction') {
      content.push({
        type: 'text',
        text: `### File: ${file.name} (${file.mimetype}, ${file.size} bytes) [analyzed via: text-extraction]\nExtracted text:\n${extractedText}`,
      });
    } else {
      content.push({
        type: 'text',
        text: `### File: ${file.name} (${file.mimetype}, ${file.size} bytes) [analyzed via: metadata-only — text extraction failed]`,
      });
    }
  }

  // Add non-extractable, non-image files as metadata-only
  for (const file of nonImages) {
    content.push({
      type: 'text',
      text: `### File: ${file.name} (${file.mimetype || file.filetype}, ${file.size} bytes) [analyzed via: metadata-only — unsupported file type]`,
    });
  }

  // Add pre-scan hints if available (signals_only verdict — help the LLM focus)
  if (preScanHints && preScanHints.length > 0) {
    const hintLines = preScanHints.map((h) => {
      const parts = [`- ${h.type}`];
      if (h.count) parts.push(`(${h.count} found)`);
      if (h.fileName) parts.push(`in ${h.fileName}`);
      if (h.severity) parts.push(`[${h.severity}]`);
      return parts.join(' ');
    });
    content.push({
      type: 'text',
      text: `\n## Pre-scan signals (automated pattern detection)\n${hintLines.join('\n')}\nNote: These are automated signals — use them as hints alongside your own analysis.`,
    });
  }

  return {
    messages: [
      { role: 'system', content: getSystemPrompt(strictAudienceBlocking) },
      { role: 'user', content },
    ],
    filesMeta: [
      ...processedImages.map(({ file, method }) => ({ name: file.name, method })),
      ...overflowImages.map((file) => ({ name: file.name, method: 'metadata-only' })),
      ...processedExtracts.map(({ file, method }) => ({ name: file.name, method })),
      ...nonImages.map((file) => ({ name: file.name, method: 'metadata-only' })),
    ],
    extractedFiles: processedExtracts,
  };
}

// Subtypes that should be skipped (edits, deletions, bot messages, etc.)
const SKIP_SUBTYPES = new Set([
  'message_changed', 'message_deleted', 'message_replied',
  'bot_message', 'channel_join', 'channel_leave',
  'channel_topic', 'channel_purpose', 'channel_name',
]);

async function analyzeMessage(event, workspaceId = 'default') {
  // Guard: skip edits, deletions, bot messages — but allow file_share
  if (event.subtype && SKIP_SUBTYPES.has(event.subtype)) {
    const result = buildSkippedResult(`Message subtype "${event.subtype}" skipped`);
    logger.info({ match: result.match, user: event.user, channel: event.channel }, 'Risk engine: skipped');
    return result;
  }

  if (!event.text || !event.text.trim()) {
    const result = buildSkippedResult('No message text to analyze intent from');
    logger.info({ match: result.match, user: event.user, channel: event.channel }, 'Risk engine: skipped');
    return result;
  }

  // Skip messages that are only URLs/links — no real intent text to analyze
  const textWithoutUrls = event.text.replace(/<https?:\/\/[^>|]+(?:\|[^>]+)?>/g, '').replace(/https?:\/\/\S+/g, '').trim();
  if (!textWithoutUrls) {
    const result = buildSkippedResult('Message contains only URLs, no intent text');
    logger.info({ match: result.match, user: event.user, channel: event.channel }, 'Risk engine: skipped');
    return result;
  }

  if (!event.files || event.files.length === 0) {
    const result = buildSkippedResult('No files attached to message');
    logger.info({ match: result.match, user: event.user, channel: event.channel }, 'Risk engine: skipped');
    return result;
  }

  if (!process.env.OPENAI_API_KEY) {
    const result = buildSkippedResult('OPENAI_API_KEY not configured');
    logger.warn({ match: result.match }, 'Risk engine: skipped (no API key)');
    return result;
  }

  // Log analysis start — no user content, only metadata
  logger.info({
    user: event.user,
    channel: event.channel,
    ts: event.ts,
    hasText: true,
    textLength: event.text.length,
    fileCount: event.files.length,
    fileNames: event.files.map((f) => f.name),
  }, 'Risk engine: starting analysis');

  try {
    // Fetch channel context and audience blocking setting in parallel
    const [channelCtx, strictAudienceSetting] = await Promise.all([
      getChannelContext(event.channel, workspaceId),
      getSetting('slack.strict_audience_blocking', workspaceId),
    ]);
    const strictAudienceBlocking = (strictAudienceSetting || 'false') === 'true';
    logger.info({ channelCtx, strictAudienceBlocking }, 'Risk engine: channel context fetched');

    // Build messages (downloads + extracts files in parallel)
    const { messages, filesMeta, extractedFiles } = await buildOpenAIMessages(event.text, event.files, channelCtx, strictAudienceBlocking, null, workspaceId);

    // ── Pre-scan: regex/heuristic detection before LLM ──
    const extractedForPreScan = (extractedFiles || [])
      .filter((ef) => ef.text)
      .map((ef) => ({ name: ef.file.name, text: ef.text, mimetype: ef.file.mimetype }));

    const preScanResult = preScan(event.text, extractedForPreScan, event.files);

    // Determine context risk for pre-scan result
    const contextRisk = channelCtx.isShared ? 'high'
      : !channelCtx.isPrivate && !channelCtx.isIm ? (channelCtx.numMembers >= 50 ? 'high' : 'medium')
      : 'low';

    // If pre-scan detected high-confidence mismatch, skip the LLM entirely
    if (preScanResult.verdict === 'mismatch') {
      const filesAnalyzed = filesMeta.map((meta) => ({
        name: meta.name,
        method: 'pre-scan',
        finding: preScanResult.findings.find((f) => f.fileName === meta.name)?.type || 'Detected by pre-scan',
        classificationLabel: preScanResult.mismatchType === 'credential_leak' ? 'credentials' : 'pii_document',
      }));

      const result = buildPreScanResult(preScanResult, filesAnalyzed, contextRisk);

      logger.info({
        match: result.match,
        confidence: result.confidence,
        contextRisk: result.contextRisk,
        mismatchType: result.mismatchType,
        analysisMethod: 'pre-scan',
        preScanTypes: [...new Set(preScanResult.findings.map((f) => f.type))],
        user: event.user,
        channel: event.channel,
        ts: event.ts,
      }, 'Risk assessment completed (pre-scan short-circuit, LLM skipped)');

      return result;
    }

    // Pass pre-scan hints to LLM if signals were found
    const preScanHints = preScanResult.verdict === 'signals_only' ? preScanResult.findings : null;
    if (preScanHints) {
      // Append hints directly to existing user message content (avoid re-downloading files)
      const userMessage = messages.find((m) => m.role === 'user');
      if (userMessage && Array.isArray(userMessage.content)) {
        const hintLines = preScanHints.map((h) => {
          const parts = [`- ${h.type}`];
          if (h.count) parts.push(`(${h.count} found)`);
          if (h.fileName) parts.push(`in ${h.fileName}`);
          if (h.severity) parts.push(`[${h.severity}]`);
          return parts.join(' ');
        });
        userMessage.content.push({
          type: 'text',
          text: `\n## Pre-scan signals (automated pattern detection)\n${hintLines.join('\n')}\nNote: These are automated signals — use them as hints alongside your own analysis.`,
        });
      }
    }

    logger.info({
      filesMeta,
      imageCount: filesMeta.filter((f) => f.method === 'vision').length,
      textExtractionCount: filesMeta.filter((f) => f.method === 'text-extraction').length,
      metadataOnlyCount: filesMeta.filter((f) => f.method === 'metadata-only').length,
      preScanVerdict: preScanResult.verdict,
      preScanSignals: preScanHints ? preScanHints.length : 0,
      channelType: channelCtx.isPrivate ? 'private' : channelCtx.isShared ? 'shared' : channelCtx.isIm ? 'dm' : 'public',
      hasExternalMembers: channelCtx.hasExternalMembers || false,
    }, 'Risk engine: files processed, calling OpenAI');

    const response = await callOpenAIWithRetry(messages);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return buildErrorResult(new Error('Empty response from OpenAI'));
    }

    const assessment = JSON.parse(content);

    // Merge file-level findings with our download metadata
    // finding is kept in-memory for Slack messages but NOT persisted
    // classificationLabel is safe to persist
    const filesAnalyzed = filesMeta.map((meta) => {
      const aiFile = assessment.files?.find((f) => f.name === meta.name);
      return {
        name: meta.name,
        method: meta.method,
        finding: aiFile?.finding || 'No specific finding',
        classificationLabel: aiFile?.classificationLabel || 'unknown',
      };
    });

    const result = {
      match: assessment.match || 'uncertain',
      confidence: assessment.confidence ?? 0,
      reasoning: assessment.reasoning || 'No reasoning provided',
      contextRisk: assessment.contextRisk || 'none',
      mismatchType: assessment.mismatchType || 'none',
      intentLabel: assessment.intentLabel || 'unknown',
      riskSummary: assessment.riskSummary || '',
      filesAnalyzed,
      error: null,
      analysisMethod: 'llm',
      preScanFindings: preScanHints || [],
    };

    // Log assessment result — only structured labels, no user content or AI reasoning
    logger.info({
      match: result.match,
      confidence: result.confidence,
      contextRisk: result.contextRisk,
      mismatchType: result.mismatchType,
      intentLabel: result.intentLabel,
      analysisMethod: 'llm',
      filesAnalyzed: result.filesAnalyzed.map((f) => ({
        name: f.name, method: f.method, classificationLabel: f.classificationLabel,
      })),
      user: event.user,
      channel: event.channel,
      ts: event.ts,
    }, 'Risk assessment completed');

    return result;
  } catch (error) {
    logger.error({ err: error }, 'Risk engine analysis failed');
    return buildErrorResult(error);
  }
}

module.exports = { analyzeMessage };
