// Aura Content Script - Injects the overlay into supported chat apps
(function () {
  "use strict";

  const isWhatsApp = window.location.hostname.includes("web.whatsapp.com");
  if (!isWhatsApp) return;

  const BACKEND_URL = "http://localhost:5000";
  const MAX_CONTEXT_MESSAGES = 30;
  const AUTO_SUGGEST_DEBOUNCE_MS = 800;
  const AUTO_SUGGEST_COOLDOWN_MS = 5000;
  const AUTO_SUGGEST_MIN_WORDS = 3;

  /* ---------------- UI ---------------- */

  const auraContainer = document.createElement("div");
  auraContainer.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const auraButton = document.createElement("button");
  auraButton.textContent = "🧠";
  auraButton.style.cssText = `
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    color: white;
    cursor: pointer;
    font-size: 22px;
  `;

  const auraPanel = document.createElement("div");
  auraPanel.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 20px;
    width: 380px;
    background: #1a1a2e;
    border-radius: 12px;
    display: none;
    flex-direction: column;
    padding: 16px;
    color: white;
    z-index: 999998;
  `;

  auraPanel.innerHTML = `
    <textarea id="aura-intent-input" placeholder="Type your raw thought..." 
      style="width:100%;min-height:80px;background:#111;color:white;border:1px solid #333;border-radius:8px;padding:8px;"></textarea>

    <button id="aura-generate-btn" 
      style="margin-top:8px;padding:10px;background:#6366f1;border:none;border-radius:6px;color:white;">
      Generate
    </button>

    <button id="aura-rewrite-btn" 
      style="margin-top:6px;padding:10px;background:#475569;border:none;border-radius:6px;color:white;">
      Rewrite Current Draft
    </button>

    <button id="aura-summary-btn" 
      style="margin-top:6px;padding:10px;background:#334155;border:none;border-radius:6px;color:white;">
      Summarize This Chat
    </button>

    <div id="aura-output" style="margin-top:12px;"></div>
  `;

  auraContainer.appendChild(auraButton);
  auraContainer.appendChild(auraPanel);
  document.body.appendChild(auraContainer);

  auraButton.onclick = () => {
    auraPanel.style.display =
      auraPanel.style.display === "none" ? "flex" : "none";
  };

  /* ---------------- Context Extraction ---------------- */

  function getConversationContext() {
    const main = document.querySelector("#main");
    if (!main) return null;

    const contactEl = main.querySelector("header span[title]");
    const contactName = contactEl?.getAttribute("title") || "Unknown";

    const bubbles = main.querySelectorAll('div[class*="message-"]');
    const messages = [];

    const start = Math.max(0, bubbles.length - MAX_CONTEXT_MESSAGES);

    for (let i = start; i < bubbles.length; i++) {
      const el = bubbles[i];
      const text = el.innerText?.trim();
      if (!text) continue;

      const isOut = el.className.includes("message-out");
      messages.push({
        role: isOut ? "user" : "assistant",
        content: text
      });
    }

    return { contactName, messages };
  }

  /* ---------------- Tone Detection ---------------- */

  function detectTone(messages) {
    if (!messages?.length) return "neutral";

    let totalLen = 0;
    let emojiCount = 0;

    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

    for (const m of messages) {
      totalLen += m.content.length;
      const match = m.content.match(emojiRegex);
      if (match) emojiCount += match.length;
    }

    const avg = totalLen / messages.length;

    if (emojiCount > 5) return "playful";
    if (avg < 15) return "dry";
    if (avg > 60) return "engaged";
    return "neutral";
  }

  function calculateDryness(messages) {
    if (!messages?.length) return 0;

    const avgWords =
      messages
        .map(m => m.content.split(/\s+/).length)
        .reduce((a, b) => a + b, 0) / messages.length;

    if (avgWords < 3) return 80;
    if (avgWords < 6) return 50;
    if (avgWords < 12) return 20;
    return 0;
  }

  /* ---------------- HARDENED INSERT (no search box, clear then set) ---------------- */

  function getActiveChatInput() {
    const main = document.querySelector("#main");
    if (!main) return null;

    const footer = main.querySelector("footer");
    if (!footer) return null;

    const input =
      footer.querySelector('div[contenteditable="true"][role="textbox"]') ||
      footer.querySelector('div[contenteditable="true"][data-tab]');

    if (!input) return null;

    const rect = input.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return input;
  }

  function getCurrentDraft() {
    const input = getActiveChatInput();
    if (!input) return null;
    return (input.textContent || "").trim();
  }

  function insertIntoWhatsApp(message) {
    const main = document.querySelector("#main");
    if (!main) {
      alert("Open a chat first.");
      return;
    }

    const input = main.querySelector("footer div[contenteditable='true'][role='textbox']");
    if (!input) {
      alert("Message input not found.");
      return;
    }

    input.focus();

    // Clear existing content
    input.innerHTML = "";

    // Use native setter to update content (important for React)
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      "innerText"
    ).set;

    nativeSetter.call(input, message);

    // Dispatch input event so WhatsApp detects change
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: message,
      })
    );
  }

  /* ---------------- Backend Call ---------------- */

  async function generateResponse(payload) {
    const res = await fetch(`${BACKEND_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data.details || data.reply || data.error || "Request failed";
      throw new Error(msg);
    }

    return data;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /* ---------------- Analyzer + Confidence Badge ---------------- */

  function renderAnalyzerPanel(tone, data) {
    const topic = data.topicDetected || "—";
    const aligned = data.intentAligned === true ? "Yes" : data.intentAligned === false ? "No" : "—";
    const risk = data.riskLevel || "—";
    const riskReason = data.riskReason || "";
    const strategy = data.suggestedStrategy || "—";
    const confidence = data.confidence != null ? data.confidence : null;
    const momentum = data.momentum != null ? Math.round(data.momentum * 100) : null;

    return `
      <div id="aura-analyzer" style="margin-bottom:10px;padding:10px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);border-radius:8px;font-size:12px;">
        <div style="font-weight:600;color:#a5b4fc;margin-bottom:6px;">🧠 Conversation Analyzer</div>
        <div style="display:grid;gap:4px;">
          <span><strong>Tone:</strong> ${escapeHtml(tone)}</span>
          <span><strong>Topic:</strong> ${escapeHtml(String(topic))}</span>
          <span><strong>Intent aligned:</strong> ${escapeHtml(String(aligned))}</span>
          <span><strong>Risk of ghosting:</strong> ${escapeHtml(String(risk))}${riskReason ? ` — ${escapeHtml(riskReason)}` : ""}</span>
          ${momentum != null ? `<span><strong>Momentum:</strong> ${momentum}% (questions in last 10 msgs)</span>` : ""}
          <span><strong>Strategy:</strong> ${escapeHtml(String(strategy))}</span>
        </div>
        ${confidence != null ? `<div style="margin-top:8px;font-size:11px;color:#94a3b8;">Confidence: <strong>${confidence}%</strong> (based on conversation depth and alignment)</div>` : ""}
      </div>
    `;
  }

  function renderWhyThisReply(explanation) {
    if (!explanation || !explanation.trim()) return "";
    const safe = escapeHtml(explanation.trim());
    return `
      <div style="margin-bottom:8px;">
        <button type="button" id="aura-why-toggle" style="background:none;border:none;color:#94a3b8;font-size:11px;cursor:pointer;padding:0;text-decoration:underline;">
          Why this suggestion?
        </button>
        <div id="aura-why-content" style="display:none;margin-top:4px;padding:6px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:11px;color:#cbd5e1;">${safe}</div>
      </div>
    `;
  }

  function renderConfidenceBadge(confidence) {
    if (confidence == null) return "";
    return `
      <div style="margin-bottom:8px;font-size:11px;color:#94a3b8;">
        Confidence: <strong>${escapeHtml(String(confidence))}%</strong>
      </div>
    `;
  }

  /* ---------------- Generate Button ---------------- */

  document.getElementById("aura-generate-btn").onclick = async () => {
    const intent =
      document.getElementById("aura-intent-input").value.trim();
    if (!intent) return alert("Enter something first.");

    const ctx = getConversationContext();
    if (!ctx) return alert("Open a chat first.");

    if (ctx.messages.length < 2) {
      document.getElementById("aura-output").innerHTML =
        '<div style="color:#f87171;">Conversation too short to generate contextual reply.</div>';
      return;
    }

    const tone = detectTone(ctx.messages);
    const dryness = calculateDryness(ctx.messages);

    const outputEl = document.getElementById("aura-output");
    outputEl.innerHTML = "Generating…";

    try {
      const data = await generateResponse({
        message: intent,
        contactName: ctx.contactName,
        conversationContext: ctx.messages,
        detectedTone: tone,
        drynessScore: dryness,
      });

      const reply = data.reply || "";

      outputEl.innerHTML = `
        ${renderAnalyzerPanel(tone, data)}
        ${renderWhyThisReply(data.explanation)}
        <div style="margin-bottom:8px;">${escapeHtml(reply)}</div>
        <button id="aura-insert-btn"
          style="padding:8px;background:#22c55e;border:none;border-radius:6px;color:white;">
          Insert into Chat
        </button>
      `;

      const whyToggle = document.getElementById("aura-why-toggle");
      const whyContent = document.getElementById("aura-why-content");
      if (whyToggle && whyContent) {
        whyToggle.onclick = () => {
          whyContent.style.display = whyContent.style.display === "none" ? "block" : "none";
        };
      }

      document.getElementById("aura-insert-btn").onclick = () =>
        insertIntoWhatsApp(reply);
    } catch (err) {
      outputEl.innerHTML = `<div style="color:#f87171;">${escapeHtml(
        err.message
      )}</div>`;
    }
  };

  /* ---------------- Rewrite Current Draft Button ---------------- */

  document.getElementById("aura-rewrite-btn").onclick = async () => {
    const draft = getCurrentDraft();
    if (!draft) {
      document.getElementById("aura-output").innerHTML =
        '<div style="color:#f87171;">Message box is empty. Type a draft first, then click Rewrite.</div>';
      return;
    }

    const ctx = getConversationContext();
    if (!ctx) return alert("Open a chat first.");

    if (ctx.messages.length < 2) {
      document.getElementById("aura-output").innerHTML =
        '<div style="color:#f87171;">Conversation too short. Need at least 2 messages for context.</div>';
      return;
    }

    const tone = detectTone(ctx.messages);
    const dryness = calculateDryness(ctx.messages);

    const outputEl = document.getElementById("aura-output");
    outputEl.innerHTML = "Rewriting…";

    try {
      const data = await generateResponse({
        mode: "rewrite",
        draft,
        contactName: ctx.contactName,
        conversationContext: ctx.messages,
        detectedTone: tone,
        drynessScore: dryness,
      });

      const reply = data.reply || draft;

      outputEl.innerHTML = `
        ${renderAnalyzerPanel(tone, { ...data, riskLevel: "—", suggestedStrategy: "—" })}
        ${renderConfidenceBadge(data.confidence)}
        ${renderWhyThisReply(data.explanation)}
        <div style="margin-bottom:8px;">${escapeHtml(reply)}</div>
        <button id="aura-insert-btn"
          style="padding:8px;background:#22c55e;border:none;border-radius:6px;color:white;">
          Insert into Chat
        </button>
      `;

      const whyToggle = document.getElementById("aura-why-toggle");
      const whyContent = document.getElementById("aura-why-content");
      if (whyToggle && whyContent) {
        whyToggle.onclick = () => {
          whyContent.style.display = whyContent.style.display === "none" ? "block" : "none";
        };
      }

      document.getElementById("aura-insert-btn").onclick = () =>
        insertIntoWhatsApp(reply);
    } catch (err) {
      outputEl.innerHTML = `<div style="color:#f87171;">${escapeHtml(
        err.message
      )}</div>`;
    }
  };

  /* ---------------- Summarize This Chat Button ---------------- */

  document.getElementById("aura-summary-btn").onclick = async () => {
    const ctx = getConversationContext();
    if (!ctx) return alert("Open a chat first.");

    if (ctx.messages.length === 0) {
      document.getElementById("aura-output").innerHTML =
        '<div style="color:#f87171;">No messages in this chat to summarize.</div>';
      return;
    }

    const outputEl = document.getElementById("aura-output");
    outputEl.innerHTML = "Summarizing…";

    try {
      const data = await generateResponse({
        mode: "summary",
        contactName: ctx.contactName,
        conversationContext: ctx.messages,
      });

      const summary = data.summary || "";
      const toneTrend = data.toneTrend || "—";
      const engagementLevel = data.engagementLevel || "—";

      outputEl.innerHTML = `
        <div id="aura-summary-card" style="padding:12px;background:rgba(51,65,85,0.5);border:1px solid rgba(71,85,105,0.6);border-radius:8px;font-size:13px;">
          <div style="font-weight:600;color:#94a3b8;margin-bottom:8px;">📋 Chat Summary</div>
          <div style="margin-bottom:8px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(summary)}</div>
          <div style="margin-top:8px;font-size:12px;color:#64748b;">
            <span><strong>Tone trend:</strong> ${escapeHtml(String(toneTrend))}</span>
            <span style="margin-left:12px;"><strong>Engagement:</strong> ${escapeHtml(String(engagementLevel))}</span>
          </div>
        </div>
      `;
    } catch (err) {
      outputEl.innerHTML = `<div style="color:#f87171;">${escapeHtml(
        err.message
      )}</div>`;
    }
  };

  /* ---------------- Auto Suggest (Debounced + 5s cooldown, min 3 words) ---------------- */

  let debounceTimer = null;
  let lastAutosuggestTimestamp = 0;

  function setupAutoSuggest() {
    const input = getActiveChatInput();
    if (!input || input.dataset.auraListener) return;

    input.dataset.auraListener = "true";

    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);

      const draft = input.textContent.trim();
      const wordCount = draft ? draft.split(/\s+/).filter(Boolean).length : 0;

      if (draft.length < 2) return;
      if (wordCount < AUTO_SUGGEST_MIN_WORDS) return;

      debounceTimer = setTimeout(async () => {
        const now = Date.now();
        if (now - lastAutosuggestTimestamp < AUTO_SUGGEST_COOLDOWN_MS) return;

        const ctx = getConversationContext();
        if (!ctx || ctx.messages.length < 2) return;

        const currentDraft = input.textContent.trim();
        const currentWords = currentDraft ? currentDraft.split(/\s+/).filter(Boolean).length : 0;
        if (currentWords < AUTO_SUGGEST_MIN_WORDS) return;

        const tone = detectTone(ctx.messages);
        const dryness = calculateDryness(ctx.messages);

        try {
          const data = await generateResponse({
            message: currentDraft,
            contactName: ctx.contactName,
            conversationContext: ctx.messages,
            detectedTone: tone,
            drynessScore: dryness,
            isAutoSuggest: true,
          });

          lastAutosuggestTimestamp = Date.now();

          const reply = data.reply;
          if (reply && input.textContent.trim() === currentDraft) {
            insertIntoWhatsApp(reply);
          }
        } catch { }
      }, AUTO_SUGGEST_DEBOUNCE_MS);
    });
  }

  const observer = new MutationObserver(setupAutoSuggest);
  observer.observe(document.body, { childList: true, subtree: true });

  /* ---------------- Popup ↔ Content Script Messaging ---------------- */

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "getChatContext") {
      const ctx = getConversationContext();
      sendResponse({
        contactName: ctx?.contactName || null,
        conversationContext: ctx?.messages || [],
        detectedTone: ctx ? detectTone(ctx.messages) : null,
        drynessScore: ctx ? calculateDryness(ctx.messages) : null,
      });
      return true;
    }

    if (request.action === "getDraft") {
      const input = getActiveChatInput();
      sendResponse({ draft: input ? (input.textContent || input.innerText || "") : "" });
      return true;
    }

    if (request.action === "insert") {
      const message = request.message || "";
      insertIntoWhatsApp(message);
      sendResponse({ ok: true });
      return true;
    }
  });

  console.log("🧠 Aura extension loaded successfully!");
})();
