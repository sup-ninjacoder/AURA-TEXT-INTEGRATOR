// Aura Content Script - Injects the overlay into supported chat apps
(function () {
  "use strict";

  const isWhatsApp = window.location.hostname.includes("web.whatsapp.com");
  const isInstagram = window.location.hostname.includes("instagram.com");
  const isDatingApp =
    window.location.hostname.match(
      /(tinder|bumble|hinge|okcupid|pof)\.com/
    );

  if (!isWhatsApp && !isInstagram && !isDatingApp) return;

  const WHATSAPP_SELECTORS = {
    chatInput: 'div[contenteditable="true"][data-tab="3"]',
    chatContainer: "#main",
    chatTitle: 'span[title]:not([data-icon])',
    sendButton: 'button[aria-label="Send"]',
  };

  const auraContainer = document.createElement("div");
  auraContainer.id = "aura-extension-container";
  auraContainer.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const auraButton = document.createElement("button");
  auraButton.innerHTML = "🧠";
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

    <div id="aura-output" style="margin-top:12px;"></div>
  `;

  auraContainer.appendChild(auraButton);
  auraContainer.appendChild(auraPanel);
  document.body.appendChild(auraContainer);

  auraButton.addEventListener("click", () => {
    auraPanel.style.display =
      auraPanel.style.display === "none" ? "flex" : "none";
  });

  function getRandomInterest() {
    const interests = [
      "music",
      "coffee",
      "movies",
      "travel",
      "gaming",
      "books",
    ];
    return interests[Math.floor(Math.random() * interests.length)];
  }

  function generateResponse(intent) {
    const lower = intent.toLowerCase();

    if (lower.includes("shoe") || lower.includes("boot")) {
      return `Those boots look amazing 😌 Where did you get them?`;
    }

    if (lower.includes("hi") || lower.includes("hey")) {
      return `Hey! I noticed you're into ${getRandomInterest()} — what's your favorite part about it?`;
    }

    if (lower.includes("creep")) {
      return `I promise this doesn't sound creepy 😅 but your vibe is really cool.`;
    }

    return `I really liked what you said about ${getRandomInterest()}. Tell me more about that!`;
  }

  function insertIntoWhatsApp(message) {
    const chatInput = document.querySelector(
      WHATSAPP_SELECTORS.chatInput
    );

    if (!chatInput) {
      alert("Click inside the WhatsApp chat box first.");
      return;
    }

    chatInput.focus();
    chatInput.textContent = message;

    chatInput.dispatchEvent(
      new Event("input", { bubbles: true })
    );
  }

  document
    .getElementById("aura-generate-btn")
    .addEventListener("click", () => {
      const intent =
        document.getElementById("aura-intent-input").value;

      if (!intent.trim()) {
        alert("Enter something first.");
        return;
      }

      const output = generateResponse(intent);

      document.getElementById("aura-output").innerHTML = `
        <div style="margin-bottom:8px;">${output}</div>
        <button id="aura-insert-btn" 
          style="padding:8px;background:#22c55e;border:none;border-radius:6px;color:white;">
          Insert into Chat
        </button>
      `;

      document
        .getElementById("aura-insert-btn")
        .addEventListener("click", () => {
          if (isWhatsApp) insertIntoWhatsApp(output);
        });
    });

  console.log("🧠 Aura extension loaded successfully!");
})();
