// ui/popup.js — Aura popup ↔ backend + content-script messaging
const BACKEND = "http://127.0.0.1:5000";

/* ---- Helpers ---- */

async function postJson(path, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details || err.error || err.reply || `Server error ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

function sendToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) return;
    chrome.tabs.sendMessage(tabs[0].id, message, () => {
      if (chrome.runtime.lastError) {
        console.warn("sendToActiveTab:", chrome.runtime.lastError.message);
      }
    });
  });
}

function getChatContextFromActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) return resolve({});
      chrome.tabs.sendMessage(tabs[0].id, { action: "getChatContext" }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn("getChatContext:", chrome.runtime.lastError.message);
          return resolve({});
        }
        resolve(resp || {});
      });
    });
  });
}

function getDraftFromActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) return resolve("");
      chrome.tabs.sendMessage(tabs[0].id, { action: "getDraft" }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn("getDraft:", chrome.runtime.lastError.message);
          return resolve("");
        }
        resolve(resp?.draft || "");
      });
    });
  });
}

/* ---- UI Helpers ---- */

let _currentReply = "";

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function showLoading(isLoading) {
  const btn = document.getElementById("generateBtn");
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Generating…" : "Generate";
  }
}

function showError(msg) {
  const el = document.getElementById("errorArea");
  if (!el) return;
  if (!msg) { el.style.display = "none"; el.textContent = ""; return; }
  el.textContent = msg;
  el.style.display = "block";
}

function getCurrentDisplayedReply() {
  return _currentReply;
}

function renderReplyAndAnalyzer(data) {
  showError(null);
  const out = document.getElementById("outputArea");
  if (!out) return;

  const reply = data.reply || "";
  _currentReply = reply;

  const tone = data.detectedTone || "—";
  const topic = data.topicDetected || "—";
  const aligned = data.intentAligned === true ? "Yes" : data.intentAligned === false ? "No" : "—";
  const risk = data.riskLevel || "—";
  const riskReason = data.riskReason || "";
  const strategy = data.suggestedStrategy || "—";
  const confidence = data.confidence != null ? data.confidence : null;
  const momentum = data.momentum != null ? Math.round(data.momentum * 100) : null;

  let html = `
    <div class="analyzer">
      <strong>🧠 Conversation Analyzer</strong>
      <div class="analyzer-grid">
        <span><strong>Tone:</strong> ${escapeHtml(String(tone))}</span>
        <span><strong>Topic:</strong> ${escapeHtml(String(topic))}</span>
        <span><strong>Intent aligned:</strong> ${escapeHtml(String(aligned))}</span>
        <span><strong>Risk of ghosting:</strong> ${escapeHtml(String(risk))}${riskReason ? " — " + escapeHtml(riskReason) : ""}</span>
        ${momentum != null ? `<span><strong>Momentum:</strong> ${momentum}%</span>` : ""}
        <span><strong>Strategy:</strong> ${escapeHtml(String(strategy))}</span>
        ${confidence != null ? `<span style="margin-top:4px;color:#94a3b8;">Confidence: <strong>${confidence}%</strong></span>` : ""}
      </div>
    </div>`;

  if (data.explanation) {
    html += `
    <button class="why-toggle" id="whyToggle">Why this suggestion?</button>
    <div class="why-content" id="whyContent">${escapeHtml(data.explanation)}</div>`;
  }

  html += `<div class="reply-box">${escapeHtml(reply)}</div>`;
  html += `<button id="insertBtn" class="btn btn-insert">Insert into Chat</button>`;

  out.innerHTML = html;

  // Wire toggle
  const toggle = document.getElementById("whyToggle");
  const content = document.getElementById("whyContent");
  if (toggle && content) {
    toggle.addEventListener("click", () => {
      content.style.display = content.style.display === "none" ? "block" : "none";
    });
  }

  // Wire insert
  document.getElementById("insertBtn")?.addEventListener("click", () => {
    sendToActiveTab({ action: "insert", message: _currentReply });
  });
}

function renderSummary(data) {
  showError(null);
  const out = document.getElementById("outputArea");
  if (!out) return;

  const summary = data.summary || "";
  const toneTrend = data.toneTrend || "—";
  const engagementLevel = data.engagementLevel || "—";

  out.innerHTML = `
    <div class="summary-card">
      <strong style="color:#94a3b8;">📋 Chat Summary</strong>
      <div style="margin-top:6px;">${escapeHtml(summary)}</div>
      <div class="meta-row">
        <strong>Tone trend:</strong> ${escapeHtml(String(toneTrend))}
        &nbsp;&nbsp;<strong>Engagement:</strong> ${escapeHtml(String(engagementLevel))}
      </div>
    </div>`;
}

/* ---- Button Handlers ---- */

document.getElementById("generateBtn").addEventListener("click", async () => {
  const message = document.getElementById("intentInput").value.trim();
  if (!message) { showError("Type something first."); return; }
  showError(null);

  const ctx = await getChatContextFromActiveTab();
  const payload = {
    message,
    contactName: ctx.contactName || null,
    conversationContext: ctx.conversationContext || [],
    detectedTone: ctx.detectedTone || null,
    drynessScore: ctx.drynessScore || null,
  };

  showLoading(true);
  try {
    const data = await postJson("/generate", payload);
    renderReplyAndAnalyzer(data);
  } catch (err) {
    showError(err.message || "Request failed.");
  } finally {
    showLoading(false);
  }
});

document.getElementById("rewriteBtn").addEventListener("click", async () => {
  showError(null);
  const draft = await getDraftFromActiveTab();
  if (!draft || draft.trim().length === 0) {
    showError("Message box is empty. Type a draft in the chat box first.");
    return;
  }

  const ctx = await getChatContextFromActiveTab();
  showLoading(true);
  try {
    const data = await postJson("/generate", {
      mode: "rewrite",
      draft,
      contactName: ctx.contactName || null,
      conversationContext: ctx.conversationContext || [],
      detectedTone: ctx.detectedTone || null,
      drynessScore: ctx.drynessScore || null,
    });
    renderReplyAndAnalyzer(data);
  } catch (err) {
    showError(err.message || "Rewrite failed.");
  } finally {
    showLoading(false);
  }
});

document.getElementById("summaryBtn").addEventListener("click", async () => {
  showError(null);
  const ctx = await getChatContextFromActiveTab();
  if (!ctx || !ctx.conversationContext || ctx.conversationContext.length < 1) {
    showError("No conversation found to summarize.");
    return;
  }

  showLoading(true);
  try {
    const data = await postJson("/generate", {
      mode: "summary",
      conversationContext: ctx.conversationContext,
      contactName: ctx.contactName || null,
    });
    renderSummary(data);
  } catch (err) {
    showError(err.message || "Summarize failed.");
  } finally {
    showLoading(false);
  }
});
