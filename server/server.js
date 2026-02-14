require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = 5000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey || apiKey.trim() === "") {
  console.error("ERROR: GROQ_API_KEY is missing in .env");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey,
  baseURL: "https://api.groq.com/openai/v1",
});

const GROQ_MODEL = "llama-3.1-8b-instant";

// --- Generate: strict intent priority, no hallucination ---

const SYSTEM_PROMPT = `You are an AI reply assistant.

PRIORITY RULES:
1. The user's raw intent is the highest priority.
2. Conversation context is secondary and only used for tone alignment.
3. Do NOT override the user's intent.
4. Do NOT invent new facts or interests.
5. If context is insufficient, ask a short clarification question.
6. Keep replies natural and under 2 sentences unless explicitly asked otherwise.
7. Never hallucinate events, hobbies, or history.

If the user's request conflicts with chat context, follow the user's request.

Output rules:
- No emojis unless the detected tone is "playful".
- Reply must align with user intent; use context only for tone.

You MUST respond with valid JSON only, no other text:
{
  "topicDetected": "one short phrase for the current topic",
  "intentAligned": true or false,
  "riskLevel": "low" or "medium" or "high",
  "suggestedStrategy": "one short sentence of strategy for the user",
  "explanation": "one short sentence why this reply fits, e.g. Aligned with Valentine topic and playful tone.",
  "reply": "final message only, 1-2 sentences, no JSON inside"
}`;

// --- Rewrite mode: polish existing draft ---

const REWRITE_SYSTEM_PROMPT = `You are rewriting an existing message to make it more socially intelligent, confident, and natural.
Do not change the intent.
Do not introduce new topics.
Keep it aligned with the conversation.

If the draft is already high quality (natural, clear, socially appropriate), return it unchanged and set "qualityUnchanged": true.

Output rules:
- Maximum 2 sentences. No over-explaining.
- No emojis unless the detected tone is "playful".

You MUST respond with valid JSON only, no other text:
{
  "topicDetected": "one short phrase for the current topic",
  "intentAligned": true or false,
  "qualityUnchanged": true only if you returned the draft unchanged, else false,
  "explanation": "one short sentence why this reply fits",
  "reply": "rewritten message only, or original draft if qualityUnchanged is true, 1-2 sentences, no JSON inside"
}`;

// --- Summary mode ---

const SUMMARY_SYSTEM_PROMPT = `Summarize this WhatsApp conversation.
Focus on:
- Key topics discussed
- Emotional tone progression
- Important facts about the contact
- Current state of conversation

Limit summary to 120 words.
Be factual. Do not invent information.

You MUST respond with valid JSON only, no other text:
{
  "summary": "the summary text, up to 120 words",
  "toneTrend": "e.g. warming up / cooling / stable / mixed",
  "engagementLevel": "e.g. high / moderate / low"
}`;

// --- Memory ---

const memoryStore = Object.create(null);

function getMemorySummary(contactName) {
  const entry = memoryStore[contactName];
  if (!entry || !entry.summary) return "None yet.";
  return entry.summary;
}

async function updateMemoryWithSummarization(contactName, conversationContext, newMessage, reply) {
  const key = (contactName || "").trim() || "Unknown";
  const messages = conversationContext || [];
  const snippet = messages
    .slice(-15)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Summarize important long-term traits about this contact in under 100 words. Only factual info mentioned in the conversation. No inventions. Output plain text only.",
        },
        {
          role: "user",
          content: `Conversation snippet:\n${snippet}\n\nLast user intent: ${(newMessage || "").slice(0, 100)}\nReply sent: ${(reply || "").slice(0, 100)}`,
        },
      ],
      max_tokens: 120,
      temperature: 0.3,
    });

    const summary =
      completion.choices?.[0]?.message?.content?.trim() || "No long-term facts yet.";
    memoryStore[key] = {
      summary,
      lastInteraction: Date.now(),
    };
  } catch (_) {
    const fallback = `Last exchange: "${(newMessage || "").slice(0, 30)}..." → reply sent.`;
    memoryStore[key] = {
      summary: (memoryStore[key]?.summary || "") ? `${memoryStore[key].summary.slice(0, 200)} ${fallback}` : fallback,
      lastInteraction: Date.now(),
    };
  }
}

function buildUserPrompt(payload) {
  const {
    message,
    contactName = "Unknown",
    conversationContext = [],
    detectedTone = "neutral",
    drynessScore = 0,
    isAutoSuggest = false,
  } = payload;

  const memorySummary = getMemorySummary(contactName);
  const formattedContext = (conversationContext || [])
    .map((m) => (m.role === "user" ? "You" : "Them") + ": " + (m.content || ""))
    .join("\n");

  let instruction = "Output only the required JSON.";
  if (drynessScore >= 50) {
    instruction +=
      " The conversation is quite dry; suggest an engaging question or a light topic to revive it. riskLevel may be high.";
  } else if (drynessScore >= 30) {
    instruction += " Keep the tone warm and slightly more engaging.";
  }
  if (isAutoSuggest) {
    instruction += " Keep reply short and ready to send as-is.";
  }

  return `USER INTENT (STRICT PRIORITY):
${message}

CONVERSATION CONTEXT (tone reference only):
${formattedContext || "(No messages yet)"}

Tone detected: ${detectedTone}
Dryness level: ${drynessScore}
Known about ${contactName}: ${memorySummary}

${instruction}`;
}

function buildRewriteUserPrompt(payload) {
  const {
    draft,
    contactName = "Unknown",
    conversationContext = [],
    detectedTone = "neutral",
    drynessScore = 0,
  } = payload;

  const memorySummary = getMemorySummary(contactName);
  const formattedConversation = (conversationContext || [])
    .map((m) => (m.role === "user" ? "You" : "Them") + ": " + (m.content || ""))
    .join("\n");

  return `Conversation with ${contactName}:
${formattedConversation || "(No messages yet)"}

Tone detected: ${detectedTone}
Dryness level: ${drynessScore}

Known information about ${contactName}: ${memorySummary}

Current draft to rewrite (keep intent, improve wording):
${draft}

Output only the required JSON.`;
}

function buildSummaryUserPrompt(contactName, conversationContext) {
  const formatted = (conversationContext || [])
    .map((m) => (m.role === "user" ? "You" : "Them") + ": " + (m.content || ""))
    .join("\n");

  return `Conversation with ${contactName}:\n\n${formatted || "(No messages)"}`;
}

function parseStructuredOutput(raw) {
  const str = (raw || "").trim();
  const jsonMatch = str.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (_) { }
  }
  return null;
}

/** Lightweight grammar cleanup before returning reply. */
function cleanReply(text) {
  if (!text) return text;
  let t = text.trim();
  t = t.replace(/\s+/g, " ");
  t = t.replace(/\s([?.!,])/g, "$1");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += ".";
  return t;
}

/**
 * Deterministic confidence: conversation depth and alignment.
 * If riskLevel is "high", dampen by 10-15 so high ghosting risk reduces confidence.
 */
function computeConfidence(intentAligned, conversationLength, drynessScore, riskLevel) {
  const a = intentAligned === true ? 40 : 0;
  const b = Math.min(30, conversationLength * 5);
  const c = drynessScore < 40 ? 20 : 5;
  let confidence = Math.min(100, Math.max(0, a + b + c));
  if (riskLevel === "high") {
    confidence = Math.max(0, confidence - 12);
  }
  return confidence;
}

/**
 * Smarter ghosting risk: response length ratio, question imbalance, last 3 from them.
 * Returns { riskLevel, riskReason } so judges see why the score.
 */
function computeGhostingRisk(conversationContext) {
  if (!Array.isArray(conversationContext) || conversationContext.length < 2) {
    return { riskLevel: "low", riskReason: "Not enough messages to assess." };
  }

  const user = conversationContext.filter((m) => m.role === "user");
  const them = conversationContext.filter((m) => m.role === "assistant");
  if (them.length === 0) {
    return { riskLevel: "low", riskReason: "No replies from them yet." };
  }

  const avgLenUser = user.length ? user.reduce((s, m) => s + (m.content || "").length, 0) / user.length : 0;
  const avgLenThem = them.reduce((s, m) => s + (m.content || "").length, 0) / them.length;
  const responseLengthRatio = avgLenUser > 0 ? avgLenThem / avgLenUser : 1;

  const questions = (str) => ((str || "").match(/\?/g) || []).length;
  const userQuestions = user.reduce((s, m) => s + questions(m.content), 0);
  const themQuestions = them.reduce((s, m) => s + questions(m.content), 0);
  const questionImbalance = userQuestions - themQuestions;

  const last3Them = them.slice(-3).map((m) => (m.content || "").trim().split(/\s+/).filter(Boolean).length);
  const allShort = last3Them.length >= 2 && last3Them.every((w) => w < 5);

  const reasons = [];
  if (responseLengthRatio < 0.4) reasons.push("their replies are much shorter than yours");
  else if (responseLengthRatio < 0.7) reasons.push("their replies tend to be shorter");
  if (questionImbalance >= 3) reasons.push("you ask many more questions than they do");
  else if (questionImbalance >= 1) reasons.push("they ask fewer questions back");
  if (allShort) reasons.push("their last few replies are very short");

  let score = 0;
  if (responseLengthRatio < 0.4) score += 2;
  else if (responseLengthRatio < 0.7) score += 1;
  if (questionImbalance >= 3) score += 2;
  else if (questionImbalance >= 1) score += 1;
  if (allShort) score += 2;

  let riskLevel = "low";
  if (score >= 4) riskLevel = "high";
  else if (score >= 2) riskLevel = "medium";

  const riskReason =
    reasons.length > 0
      ? reasons.join("; ").replace(/^./, (c) => c.toUpperCase()) + "."
      : "Conversation balance looks healthy.";

  return { riskLevel, riskReason };
}

/**
 * Conversation momentum: share of last 10 messages that contain a question.
 * High = flowing; low + high dryness = fragile.
 */
function computeMomentum(conversationContext) {
  if (!Array.isArray(conversationContext) || conversationContext.length === 0) return 0;
  const last10 = conversationContext.slice(-10);
  const withQuestion = last10.filter((m) => (m.content || "").includes("?")).length;
  return withQuestion / 10;
}

/**
 * Rewrite quality heuristic: skip API if draft is already high quality.
 * 15+ words, contains ?, no repeated punctuation, no slang spam (no all-caps).
 */
function draftHeuristicHighQuality(draft) {
  if (!draft || typeof draft !== "string") return false;
  const t = draft.trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 15) return false;
  if (!t.includes("?")) return false;
  if (/!!+|\?\?+|\.\.\.+|\.\.+/.test(t)) return false;
  const capsRatio = (t.replace(/\s/g, "").match(/[A-Z]/g) || []).length / (t.replace(/\s/g, "").length || 1);
  if (capsRatio > 0.8) return false;
  return true;
}

/**
 * POST /generate
 * Body: { mode?, message?, draft?, contactName?, conversationContext?, detectedTone?, drynessScore?, isAutoSuggest? }
 * Returns: generate/rewrite → { reply, confidence?, topicDetected?, intentAligned?, riskLevel?, suggestedStrategy? }
 *          summary → { summary, toneTrend, engagementLevel }
 */
app.post("/generate", async (req, res) => {
  try {
    const mode = req.body.mode || "generate";
    const {
      message,
      draft,
      contactName,
      conversationContext = [],
      detectedTone = "neutral",
      drynessScore = 0,
      isAutoSuggest = false,
    } = req.body;

    // --- Mode: summary ---
    if (mode === "summary") {
      if (!Array.isArray(conversationContext) || conversationContext.length === 0) {
        return res.status(400).json({
          error: "Invalid request",
          details: "Summary requires conversationContext with at least one message.",
        });
      }

      const userContent = buildSummaryUserPrompt(contactName || "Unknown", conversationContext);

      const completion = await openai.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 280,
        temperature: 0.4,
      });

      const rawContent = completion.choices?.[0]?.message?.content?.trim() || "";
      const parsed = parseStructuredOutput(rawContent);

      return res.json({
        summary: parsed?.summary ?? rawContent.slice(0, 500),
        toneTrend: parsed?.toneTrend ?? "—",
        engagementLevel: parsed?.engagementLevel ?? "—",
      });
    }

    // --- Mode: rewrite ---
    if (mode === "rewrite") {
      const draftTrimmed = typeof draft === "string" ? draft.trim() : "";
      if (!draftTrimmed) {
        return res.status(400).json({
          error: "Invalid request",
          details: "Rewrite mode requires a non-empty 'draft'.",
        });
      }
      if (!Array.isArray(conversationContext) || conversationContext.length < 2) {
        return res.status(400).json({
          error: "Conversation too short",
          details: "Rewrite requires at least 2 messages for context.",
        });
      }

      if (draftHeuristicHighQuality(draftTrimmed)) {
        return res.json({
          reply: cleanReply(draftTrimmed),
          confidence: 95,
          topicDetected: null,
          intentAligned: null,
          explanation: "Draft passed quality check (length, question, clarity); left unchanged.",
        });
      }

      const userContent = buildRewriteUserPrompt({
        draft: draftTrimmed,
        contactName,
        conversationContext,
        detectedTone,
        drynessScore,
      });

      const completion = await openai.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: REWRITE_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 256,
        temperature: 0.5,
      });

      const rawContent = completion.choices?.[0]?.message?.content?.trim() || "";
      const parsed = parseStructuredOutput(rawContent);

      const qualityUnchanged = parsed?.qualityUnchanged === true;
      let reply =
        parsed?.reply ||
        rawContent.replace(/\{[\s\S]*\}/, "").trim() ||
        draftTrimmed;
      if (qualityUnchanged) reply = draftTrimmed;
      reply = cleanReply(reply);

      const intentAligned = parsed?.intentAligned;
      const confidence = qualityUnchanged
        ? 95
        : computeConfidence(intentAligned, conversationContext.length, drynessScore, "low");

      return res.json({
        reply,
        confidence,
        topicDetected: parsed?.topicDetected ?? null,
        intentAligned: intentAligned ?? null,
        explanation: parsed?.explanation ?? null,
      });
    }

    // --- Mode: generate (default) ---
    if (message == null || typeof message !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        details: "Body must include a string 'message'.",
      });
    }

    const trimmed = message.trim();
    if (!trimmed) {
      return res.status(400).json({
        error: "Invalid request",
        details: "'message' cannot be empty.",
      });
    }

    if (!Array.isArray(conversationContext) || conversationContext.length < 2) {
      return res.status(400).json({
        error: "Conversation too short",
        details: "Conversation too short to generate contextual reply.",
        reply: "Conversation too short to generate contextual reply.",
      });
    }

    const userContent = buildUserPrompt({
      message: trimmed,
      contactName,
      conversationContext,
      detectedTone,
      drynessScore,
      isAutoSuggest,
    });

    const completion = await openai.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      max_tokens: 320,
      temperature: 0.5,
    });

    const rawContent = completion.choices?.[0]?.message?.content?.trim() || "";
    const parsed = parseStructuredOutput(rawContent);

    let reply =
      parsed?.reply ||
      rawContent.replace(/\{[\s\S]*\}/, "").trim() ||
      "I couldn't think of a reply. Try rephrasing.";
    if (parsed?.reply) reply = parsed.reply;
    reply = cleanReply(reply);

    const { riskLevel, riskReason } = computeGhostingRisk(conversationContext);
    const momentum = computeMomentum(conversationContext);
    const confidence = computeConfidence(
      parsed?.intentAligned,
      conversationContext.length,
      drynessScore,
      riskLevel
    );

    const responsePayload = {
      reply,
      confidence,
      topicDetected: parsed?.topicDetected ?? null,
      intentAligned: parsed?.intentAligned ?? null,
      riskLevel,
      riskReason,
      momentum,
      suggestedStrategy: parsed?.suggestedStrategy ?? null,
      explanation: parsed?.explanation ?? null,
    };

    if (contactName) {
      await updateMemoryWithSummarization(
        contactName,
        conversationContext,
        trimmed,
        reply
      );
    }

    res.json(responsePayload);
  } catch (err) {
    console.error("Groq /generate error:", err);

    const status = err.status ?? err.statusCode ?? err.response?.status;
    if (status === 401) {
      return res.status(401).json({
        error: "Invalid API key",
        details: "Check GROQ_API_KEY in .env",
      });
    }
    if (status === 429) {
      return res.status(429).json({
        error: "Rate limited",
        details: "Too many requests. Please try again in a moment.",
      });
    }
    if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "Service unavailable",
        details: "Could not reach Groq. Check your connection.",
      });
    }

    res.status(500).json({
      error: "Generation failed",
      details: err.message || "An unexpected error occurred.",
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "aura-generate" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aura backend running at http://127.0.0.1:${PORT}`);
  console.log(
    "POST /generate ready. GROQ_API_KEY is loaded from .env (never sent to client)."
  );
});
