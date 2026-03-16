/**
 * GateReady™ AI Assistant — Gate.AI
 * Context-aware sales, navigation, and customer service intelligence
 * Built on Claude claude-sonnet-4-20250514 via Anthropic API
 */

(function () {
  'use strict';

  // ── CONFIG ───────────────────────────────────────────────────────
  const GR_ASSISTANT_VERSION = '1.0.0';
  const MAX_HISTORY = 12; // messages kept in context
  const TYPING_DELAY_MS = 600;

  // Page context detection
  function getPageContext() {
    const p = window.location.pathname;
    const contexts = {
      '/': 'homepage',
      '/shop': 'shop',
      '/gate-check': 'gate-check',
      '/game-day-guide': 'game-day-guide',
      '/wholesale': 'wholesale',
      '/vendor-portal': 'vendor-portal',
      '/about': 'about',
      '/embed': 'embed',
      '/world-cup': 'world-cup',
    };
    return contexts[p] || 'general';
  }

  function getPageIntent() {
    const ctx = getPageContext();
    const intentMap = {
      'homepage': 'browsing',
      'shop': 'purchase-ready',
      'gate-check': 'researching-policy',
      'game-day-guide': 'planning',
      'wholesale': 'vendor-interest',
      'vendor-portal': 'vendor',
      'world-cup': 'fifa-planning',
    };
    return intentMap[ctx] || 'browsing';
  }

  // ── SYSTEM PROMPT ────────────────────────────────────────────────
  function buildSystemPrompt() {
    const ctx = getPageContext();
    const intent = getPageIntent();
    const now = new Date();
    const daysTilFIFA = Math.floor((new Date('2026-06-11') - now) / 86400000);

    return `You are Gate.AI — the official AI assistant for GateReady™, the premier stadium-approved clear bag brand built in Atlanta, GA.

BRAND IDENTITY:
- Product: GateReady™ clear stadium tote bag — $25 retail, ships in 2 days
- Tagline: "Don't Get Stopped at the Gate."
- Brand voice: Confident, direct, utility-first. Zero fluff. You speak like someone who knows stadiums cold.
- Built in Atlanta. Sells nationwide. FIFA World Cup 2026 is ${daysTilFIFA} days away.

YOUR THREE ROLES (handle all simultaneously based on the conversation):

1. SALES CLOSER
- Your primary job is to remove friction between the fan and a purchase
- Know that the GateReady bag meets NFL, NBA, MLB, MLS, NCAA, and concert venue policies
- Dimensions: 12"×6"×12" — compliant at virtually every major US stadium
- When someone asks "will this work at [stadium]?" → YES (it will) → push to buy
- CTA always available: "Get yours at begateready.com/shop — $25, ships in 2 days"
- Handle objections: price ($25 is impulse buy), shipping (2 days), policy (it passes everywhere)

2. VENUE & POLICY EXPERT
- You know bag policies cold. Standard clear bag rule: 12"×6"×12" max, clear plastic/vinyl/PVC
- Small clutch exception: up to 4.5"×6.5" at most venues
- One-gallon zip-lock bag: allowed almost everywhere as alternative
- Key venues: Mercedes-Benz Stadium (Falcons/ATL United), State Farm Arena, Truist Park — all in Atlanta
- FIFA World Cup 2026: 11 US host cities. MetLife (FINAL), AT&T/Dallas (Semifinal), Mercedes-Benz/Atlanta (Semifinal), SoFi/LA (QF), Hard Rock/Miami, NRG/Houston, Arrowhead/KC, Lincoln Financial/Philly, Levi's/SF, Lumen/Seattle, Gillette/Boston
- If unsure of exact policy: direct them to /gate-check for the live lookup tool

3. VENDOR DEVELOPMENT ENGINE
- Detect vendor/business intent from language like: "bulk", "wholesale", "my store", "stadium near me", "sell", "distribute", "stock"
- Wholesale tiers: 10 bags@$16, 50 bags@$13 (most popular), 100 bags@$11, 250 bags@$10, 500+@$9 contact
- Profit angle: Buy 100 bags at $11, sell at $25 = $1,400 gross profit per event weekend
- CTA for vendors: /wholesale to see pricing, /vendor-portal to apply
- Embed widget for businesses: $49/mo (1 location) or $99/mo (3 locations + analytics)

NAVIGATION GUIDE:
- /shop → Buy the bag ($25)
- /gate-check → Live stadium bag policy lookup for any venue
- /game-day-guide → Full guide for game day prep
- /wholesale → Wholesale pricing & vendor info
- /vendor-portal → Vendor login / apply
- /world-cup → FIFA World Cup 2026 bag guide

CURRENT PAGE CONTEXT: ${ctx} (visitor intent: ${intent})
${ctx === 'shop' ? 'The visitor is on the shop page — they are close to buying. Be purchase-focused.' : ''}
${ctx === 'wholesale' ? 'The visitor is viewing wholesale info — treat them as a potential vendor. Lead with margin potential.' : ''}
${ctx === 'gate-check' ? 'The visitor is researching stadium policy — they need a bag. Bridge from policy to purchase naturally.' : ''}
${ctx === 'world-cup' ? `FIFA is ${daysTilFIFA} days away — urgency is real. International fans especially need clear bags.` : ''}

TONE RULES:
- Maximum 2-3 sentences per response unless they asked a detailed question
- Never say "I'd be happy to help" or "Great question!" — just answer
- Never hedge excessively — be authoritative on what you know
- Use "we" when referring to GateReady (you're part of the brand)
- Dollar amounts always with $ sign. Bag policy dimensions in inches.
- End with a clear next step when relevant (but don't force it every message)
- If someone is frustrated or got stopped at a gate without a bag: empathize briefly, then solve

WHAT YOU DON'T DO:
- You don't process orders or access personal data
- You don't know live inventory counts (always say "in stock" — it's accurate)
- For complex vendor deals (500+ bags), route to vendors@begateready.com
- For returns/shipping issues, route to policy@begateready.com`;
  }

  // ── SUGGESTED PROMPTS (context-aware) ───────────────────────────
  function getSuggestedPrompts() {
    const ctx = getPageContext();
    const base = [
      { text: "Will this bag work at my stadium?", icon: "🏟️" },
      { text: "What's the bag policy for NFL games?", icon: "🏈" },
      { text: "How fast does it ship?", icon: "📦" },
    ];
    const contextual = {
      'shop': [
        { text: "Does this meet NFL bag rules?", icon: "✅" },
        { text: "Can I return it if it doesn't work?", icon: "↩️" },
        { text: "What stadiums is this approved for?", icon: "🏟️" },
      ],
      'wholesale': [
        { text: "What's the margin on 100 bags?", icon: "💰" },
        { text: "How do I become a vendor?", icon: "🤝" },
        { text: "What's your best volume price?", icon: "📦" },
      ],
      'gate-check': [
        { text: "What if my stadium isn't listed?", icon: "🔍" },
        { text: "Will your bag pass any clear bag check?", icon: "✅" },
        { text: "What's the standard NFL bag size?", icon: "📏" },
      ],
      'world-cup': [
        { text: "What bags are allowed at FIFA venues?", icon: "⚽" },
        { text: "I'm flying in from abroad — what do I need?", icon: "✈️" },
        { text: "Which FIFA stadiums have the strictest rules?", icon: "🔒" },
      ],
      'vendor-portal': [
        { text: "How do I apply to be a vendor?", icon: "📝" },
        { text: "What's the minimum order quantity?", icon: "📦" },
        { text: "Do you have an embed widget for my site?", icon: "🔌" },
      ],
    };
    return contextual[ctx] || base;
  }

  // ── STATE ────────────────────────────────────────────────────────
  let isOpen = false;
  let isTyping = false;
  let conversationHistory = [];
  let hasInteracted = false;
  let autoOpenTimer = null;

  // ── DOM INJECTION ────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* ── Gate.AI WIDGET ─────────────────────────────────────── */
      :root {
        --gr-red: #C41230;
        --gr-black: #060609;
        --gr-surface: #0d0d16;
        --gr-border: rgba(255,255,255,0.07);
        --gr-text: #f0ece8;
        --gr-muted: #4a4a5a;
        --gr-green: #22c55e;
        --gr-font-d: 'Barlow Condensed', 'Impact', sans-serif;
        --gr-font-b: 'Barlow', 'Helvetica Neue', sans-serif;
        --gr-w: 380px;
        --gr-h: 560px;
        --gr-radius: 12px;
        --gr-z: 9999;
      }

      /* Launcher button */
      #gr-launcher {
        position: fixed;
        bottom: 28px;
        right: 28px;
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: var(--gr-red);
        border: none;
        cursor: pointer;
        z-index: var(--gr-z);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 24px rgba(196,18,48,0.45), 0 2px 8px rgba(0,0,0,0.4);
        transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
        outline: none;
      }
      #gr-launcher:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 32px rgba(196,18,48,0.55), 0 2px 10px rgba(0,0,0,0.5);
      }
      #gr-launcher:active { transform: scale(0.96); }
      #gr-launcher.open .gr-icon-chat { display: none; }
      #gr-launcher.open .gr-icon-close { display: flex; }
      #gr-launcher:not(.open) .gr-icon-chat { display: flex; }
      #gr-launcher:not(.open) .gr-icon-close { display: none; }

      .gr-icon-chat, .gr-icon-close {
        align-items: center;
        justify-content: center;
        color: white;
      }
      .gr-icon-chat svg, .gr-icon-close svg { width: 24px; height: 24px; }

      /* Unread badge */
      #gr-badge {
        position: absolute;
        top: -3px;
        right: -3px;
        width: 18px;
        height: 18px;
        background: var(--gr-green);
        border-radius: 50%;
        border: 2px solid var(--gr-black);
        display: none;
        animation: gr-pulse-badge 2s infinite;
      }
      #gr-badge.visible { display: block; }
      @keyframes gr-pulse-badge {
        0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
        50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
      }

      /* Chat window */
      #gr-window {
        position: fixed;
        bottom: 100px;
        right: 28px;
        width: var(--gr-w);
        height: var(--gr-h);
        background: var(--gr-black);
        border: 1px solid var(--gr-border);
        border-radius: var(--gr-radius);
        z-index: var(--gr-z);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow:
          0 24px 64px rgba(0,0,0,0.7),
          0 0 0 1px rgba(196,18,48,0.08),
          inset 0 1px 0 rgba(255,255,255,0.05);
        transform: translateY(16px) scale(0.97);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.22s cubic-bezier(0.34,1.2,0.64,1), opacity 0.18s ease;
      }
      #gr-window.open {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: all;
      }

      /* Header */
      .gr-header {
        background: linear-gradient(135deg, #0f0f1a 0%, #0d0814 100%);
        border-bottom: 1px solid var(--gr-border);
        padding: 16px 18px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
      }
      .gr-header::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, var(--gr-red), #ff4060, var(--gr-red));
        background-size: 200%;
        animation: gr-shimmer 3s linear infinite;
      }
      @keyframes gr-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .gr-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(196,18,48,0.15);
        border: 1.5px solid rgba(196,18,48,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 16px;
      }
      .gr-header-info { flex: 1; }
      .gr-header-name {
        font-family: var(--gr-font-d);
        font-weight: 900;
        font-size: 15px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--gr-text);
        line-height: 1;
      }
      .gr-header-status {
        font-size: 11px;
        color: var(--gr-green);
        margin-top: 3px;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .gr-status-dot {
        width: 6px;
        height: 6px;
        background: var(--gr-green);
        border-radius: 50%;
        animation: gr-pulse-status 2s infinite;
        flex-shrink: 0;
      }
      @keyframes gr-pulse-status {
        0%,100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .gr-header-close {
        background: none;
        border: none;
        color: var(--gr-muted);
        cursor: pointer;
        padding: 4px;
        line-height: 1;
        border-radius: 4px;
        transition: color 0.12s, background 0.12s;
        display: flex;
      }
      .gr-header-close:hover { color: var(--gr-text); background: rgba(255,255,255,0.05); }

      /* Messages area */
      .gr-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px 16px 8px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        scroll-behavior: smooth;
      }
      .gr-messages::-webkit-scrollbar { width: 3px; }
      .gr-messages::-webkit-scrollbar-track { background: transparent; }
      .gr-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

      /* Message bubbles */
      .gr-msg {
        display: flex;
        gap: 8px;
        animation: gr-msg-in 0.2s ease forwards;
      }
      @keyframes gr-msg-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .gr-msg.user { flex-direction: row-reverse; }
      .gr-msg-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        flex-shrink: 0;
        align-self: flex-end;
      }
      .gr-msg.ai .gr-msg-avatar {
        background: rgba(196,18,48,0.15);
        border: 1px solid rgba(196,18,48,0.3);
      }
      .gr-msg.user .gr-msg-avatar {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.1);
        font-size: 12px;
        color: var(--gr-muted);
      }
      .gr-bubble {
        max-width: 82%;
        padding: 10px 13px;
        border-radius: 12px;
        font-size: 13.5px;
        line-height: 1.55;
        font-family: var(--gr-font-b);
      }
      .gr-msg.ai .gr-bubble {
        background: var(--gr-surface);
        border: 1px solid var(--gr-border);
        color: var(--gr-text);
        border-bottom-left-radius: 4px;
      }
      .gr-msg.user .gr-bubble {
        background: var(--gr-red);
        color: white;
        border-bottom-right-radius: 4px;
      }
      .gr-bubble a {
        color: var(--gr-green);
        text-decoration: underline;
        text-decoration-color: rgba(34,197,94,0.4);
      }
      .gr-bubble strong { color: white; font-weight: 700; }

      /* CTA buttons inside messages */
      .gr-cta {
        display: inline-block;
        margin-top: 8px;
        padding: 7px 14px;
        background: var(--gr-red);
        color: white !important;
        text-decoration: none !important;
        border-radius: 4px;
        font-family: var(--gr-font-d);
        font-weight: 800;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        transition: background 0.12s;
      }
      .gr-cta:hover { background: #a01028; }
      .gr-cta.secondary {
        background: transparent;
        border: 1px solid rgba(196,18,48,0.4);
        color: var(--gr-red) !important;
        margin-left: 6px;
      }
      .gr-cta.secondary:hover { background: rgba(196,18,48,0.08); }

      /* Typing indicator */
      .gr-typing {
        display: flex;
        gap: 4px;
        padding: 10px 13px;
        background: var(--gr-surface);
        border: 1px solid var(--gr-border);
        border-radius: 12px;
        border-bottom-left-radius: 4px;
        width: fit-content;
        align-items: center;
      }
      .gr-typing span {
        width: 6px;
        height: 6px;
        background: var(--gr-muted);
        border-radius: 50%;
        animation: gr-typing-dot 1.2s infinite;
      }
      .gr-typing span:nth-child(2) { animation-delay: 0.2s; }
      .gr-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes gr-typing-dot {
        0%,60%,100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-4px); opacity: 1; }
      }

      /* Suggested prompts */
      .gr-suggestions {
        padding: 8px 16px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex-shrink: 0;
        border-top: 1px solid var(--gr-border);
      }
      .gr-suggestions-label {
        font-size: 10px;
        color: var(--gr-muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-family: var(--gr-font-d);
        font-weight: 700;
        margin-bottom: 2px;
      }
      .gr-sugg-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .gr-sugg-btn {
        background: rgba(255,255,255,0.04);
        border: 1px solid var(--gr-border);
        color: #888;
        padding: 6px 10px;
        border-radius: 20px;
        font-size: 11.5px;
        cursor: pointer;
        font-family: var(--gr-font-b);
        transition: all 0.12s;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .gr-sugg-btn:hover {
        border-color: rgba(196,18,48,0.4);
        color: var(--gr-text);
        background: rgba(196,18,48,0.06);
      }

      /* Input area */
      .gr-input-area {
        padding: 12px 14px 14px;
        border-top: 1px solid var(--gr-border);
        display: flex;
        gap: 8px;
        align-items: flex-end;
        flex-shrink: 0;
        background: var(--gr-black);
      }
      .gr-textarea {
        flex: 1;
        background: var(--gr-surface);
        border: 1px solid var(--gr-border);
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 13px;
        color: var(--gr-text);
        font-family: var(--gr-font-b);
        resize: none;
        min-height: 40px;
        max-height: 100px;
        line-height: 1.4;
        outline: none;
        transition: border-color 0.12s;
      }
      .gr-textarea::placeholder { color: var(--gr-muted); }
      .gr-textarea:focus { border-color: rgba(196,18,48,0.4); }
      .gr-send-btn {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: var(--gr-red);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.12s, transform 0.1s;
        flex-shrink: 0;
      }
      .gr-send-btn:hover { background: #a01028; }
      .gr-send-btn:active { transform: scale(0.92); }
      .gr-send-btn:disabled { background: #2a1018; cursor: not-allowed; }
      .gr-send-btn svg { width: 16px; height: 16px; color: white; }

      /* Welcome state */
      .gr-welcome {
        padding: 16px;
        text-align: center;
        animation: gr-msg-in 0.3s ease forwards;
      }
      .gr-welcome-icon {
        font-size: 32px;
        margin-bottom: 10px;
      }
      .gr-welcome-title {
        font-family: var(--gr-font-d);
        font-weight: 900;
        font-size: 18px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--gr-text);
        margin-bottom: 6px;
      }
      .gr-welcome-sub {
        font-size: 12.5px;
        color: #666;
        line-height: 1.5;
        margin-bottom: 14px;
      }

      /* Branding */
      .gr-powered {
        padding: 6px 14px 8px;
        text-align: center;
        font-size: 10px;
        color: #2a2a3a;
        font-family: var(--gr-font-b);
        flex-shrink: 0;
      }
      .gr-powered a { color: inherit; text-decoration: none; }

      /* Mobile */
      @media (max-width: 480px) {
        #gr-window {
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 90vh;
          border-radius: var(--gr-radius) var(--gr-radius) 0 0;
          border-left: none;
          border-right: none;
          border-bottom: none;
        }
        #gr-launcher { bottom: 20px; right: 20px; }
      }

      /* Notification popup */
      #gr-notif {
        position: fixed;
        bottom: 100px;
        right: 96px;
        background: var(--gr-surface);
        border: 1px solid var(--gr-border);
        border-radius: 10px;
        padding: 12px 16px;
        max-width: 240px;
        z-index: calc(var(--gr-z) - 1);
        font-size: 13px;
        color: var(--gr-text);
        font-family: var(--gr-font-b);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        opacity: 0;
        transform: translateX(8px);
        pointer-events: none;
        transition: opacity 0.2s, transform 0.2s;
      }
      #gr-notif.visible {
        opacity: 1;
        transform: translateX(0);
        pointer-events: all;
      }
      #gr-notif::after {
        content: '';
        position: absolute;
        bottom: 14px;
        right: -6px;
        width: 10px;
        height: 10px;
        background: var(--gr-surface);
        border-right: 1px solid var(--gr-border);
        border-top: 1px solid var(--gr-border);
        transform: rotate(45deg);
      }
      .gr-notif-close {
        position: absolute;
        top: 6px;
        right: 8px;
        background: none;
        border: none;
        color: var(--gr-muted);
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
      }
    `;
    document.head.appendChild(style);
  }

  function injectHTML() {
    // Launcher button
    const launcher = document.createElement('button');
    launcher.id = 'gr-launcher';
    launcher.setAttribute('aria-label', 'Open Gate.AI assistant');
    launcher.innerHTML = `
      <span class="gr-icon-chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </span>
      <span class="gr-icon-close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </span>
      <div id="gr-badge"></div>
    `;

    // Notification popup
    const notif = document.createElement('div');
    notif.id = 'gr-notif';
    notif.innerHTML = `
      <button class="gr-notif-close" aria-label="Dismiss">✕</button>
      <span id="gr-notif-text">Ask me anything about bag policies or wholesale orders. ⚡</span>
    `;

    // Chat window
    const win = document.createElement('div');
    win.id = 'gr-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Gate.AI Chat');
    win.innerHTML = `
      <div class="gr-header">
        <div class="gr-avatar">🏟️</div>
        <div class="gr-header-info">
          <div class="gr-header-name">Gate<span style="color:var(--gr-red);">AI</span></div>
          <div class="gr-header-status">
            <span class="gr-status-dot"></span>
            GateReady™ Intelligence — Always On
          </div>
        </div>
        <button class="gr-header-close" id="gr-close" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="gr-messages" id="gr-messages">
        <div class="gr-welcome">
          <div class="gr-welcome-icon">🏟️</div>
          <div class="gr-welcome-title">Gate.AI</div>
          <div class="gr-welcome-sub">Your GateReady™ expert. Ask me about bag policies, buying the bag, wholesale pricing, or anything stadium-related.</div>
        </div>
      </div>

      <div class="gr-suggestions" id="gr-suggestions">
        <div class="gr-suggestions-label">Quick questions</div>
        <div class="gr-sugg-row" id="gr-sugg-row"></div>
      </div>

      <div class="gr-input-area">
        <textarea
          class="gr-textarea"
          id="gr-input"
          placeholder="Ask about bag policies, wholesale, or anything..."
          rows="1"
          maxlength="500"
        ></textarea>
        <button class="gr-send-btn" id="gr-send" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      <div class="gr-powered">
        Gate.AI by <a href="https://begateready.com" target="_blank">GateReady™</a> · Powered by Claude
      </div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(notif);
    document.body.appendChild(win);
  }

  // ── RENDER HELPERS ───────────────────────────────────────────────
  function renderSuggestions() {
    const row = document.getElementById('gr-sugg-row');
    if (!row) return;
    const prompts = getSuggestedPrompts();
    row.innerHTML = prompts.map(p =>
      `<button class="gr-sugg-btn" data-text="${escHtml(p.text)}">
        <span>${p.icon}</span><span>${escHtml(p.text)}</span>
      </button>`
    ).join('');
    row.querySelectorAll('.gr-sugg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sendMessage(btn.dataset.text);
        document.getElementById('gr-suggestions').style.display = 'none';
      });
    });
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function appendMessage(role, text, withCTAs) {
    const msgs = document.getElementById('gr-messages');
    const el = document.createElement('div');
    el.className = `gr-msg ${role === 'assistant' ? 'ai' : 'user'}`;

    const avatarIcon = role === 'assistant' ? '🏟️' : '👤';
    const bubble = formatBubble(text, role === 'assistant', withCTAs);

    el.innerHTML = `
      <div class="gr-msg-avatar">${avatarIcon}</div>
      <div class="gr-bubble">${bubble}</div>
    `;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function formatBubble(text, isAI, withCTAs) {
    if (!isAI) return escHtml(text);

    // Convert markdown-ish formatting
    let html = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 5px;border-radius:3px;font-size:12px;">$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    // Auto-linkify URLs
    html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    // Auto-linkify /paths
    html = html.replace(/\b(\/[a-z-]+)\b/g, '<a href="$1">$1</a>');

    // Add CTAs if needed
    if (withCTAs) {
      html += withCTAs;
    }

    return html;
  }

  function showTyping() {
    const msgs = document.getElementById('gr-messages');
    const el = document.createElement('div');
    el.className = 'gr-msg ai';
    el.id = 'gr-typing-indicator';
    el.innerHTML = `
      <div class="gr-msg-avatar">🏟️</div>
      <div class="gr-typing"><span></span><span></span><span></span></div>
    `;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('gr-typing-indicator');
    if (el) el.remove();
  }

  // ── AI CALL (via server proxy — key never exposed client-side) ──
  async function callAI(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });
    if (conversationHistory.length > MAX_HISTORY) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY);
    }

    const response = await fetch('/api/gateai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: buildSystemPrompt(),
        messages: conversationHistory,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || "Something went wrong. Try again.";
    conversationHistory.push({ role: 'assistant', content: assistantMessage });
    return assistantMessage;
  }

  // ── CTA INJECTION ────────────────────────────────────────────────
  function detectAndInjectCTAs(message) {
    const lower = message.toLowerCase();
    const hasBuy = lower.includes('$25') || lower.includes('shop') || lower.includes('buy') || lower.includes('get yours') || lower.includes('purchase');
    const hasVendor = lower.includes('wholesale') || lower.includes('vendor') || lower.includes('bulk') || lower.includes('/wholesale');

    if (hasBuy && !hasVendor) {
      return `<br><a href="/shop" class="gr-cta">Buy Now — $25 →</a>`;
    }
    if (hasVendor) {
      return `<br><a href="/wholesale" class="gr-cta">View Wholesale Pricing →</a><a href="/vendor-portal" class="gr-cta secondary">Vendor Login</a>`;
    }
    if (lower.includes('gate check') || lower.includes('policy') || lower.includes('stadium')) {
      return `<br><a href="/gate-check" class="gr-cta">Check Any Stadium →</a>`;
    }
    return null;
  }

  // ── SEND MESSAGE ─────────────────────────────────────────────────
  async function sendMessage(text) {
    const input = document.getElementById('gr-input');
    const sendBtn = document.getElementById('gr-send');
    const suggestions = document.getElementById('gr-suggestions');

    const message = (text || input.value).trim();
    if (!message || isTyping) return;

    isTyping = true;
    hasInteracted = true;
    if (input) { input.value = ''; input.style.height = 'auto'; }
    if (sendBtn) sendBtn.disabled = true;
    if (suggestions) suggestions.style.display = 'none';

    // Clear welcome state on first real message
    const welcome = document.querySelector('.gr-welcome');
    if (welcome) welcome.remove();

    appendMessage('user', message);
    showTyping();

    try {
      await new Promise(r => setTimeout(r, TYPING_DELAY_MS));
      const reply = await callAI(message);
      hideTyping();
      const ctas = detectAndInjectCTAs(reply);
      appendMessage('assistant', reply, ctas);
    } catch (err) {
      hideTyping();
      const msg = err.message?.includes('503')
        ? "I'm in demo mode right now — but I can still help. Try asking about bag policies, wholesale pricing, or what stadiums we cover."
        : "I'm having trouble connecting. For immediate help, email **policy@begateready.com** or use /gate-check for stadium policies.";
      appendMessage('assistant', msg, null);
      console.error('[Gate.AI]', err);
    } finally {
      isTyping = false;
      if (sendBtn) sendBtn.disabled = false;
      if (input) input.focus();
    }
  }

  // ── OPEN / CLOSE ─────────────────────────────────────────────────
  function openChat() {
    isOpen = true;
    document.getElementById('gr-window').classList.add('open');
    document.getElementById('gr-launcher').classList.add('open');
    document.getElementById('gr-badge').classList.remove('visible');
    document.getElementById('gr-notif').classList.remove('visible');
    clearTimeout(autoOpenTimer);
    setTimeout(() => {
      const input = document.getElementById('gr-input');
      if (input) input.focus();
    }, 250);
  }

  function closeChat() {
    isOpen = false;
    document.getElementById('gr-window').classList.remove('open');
    document.getElementById('gr-launcher').classList.remove('open');
  }

  // ── AUTO OPEN (context-aware) ────────────────────────────────────
  function scheduleAutoNotif() {
    const ctx = getPageContext();
    const notifMessages = {
      'gate-check': "Found the policy? We've got the bag that passes every gate. 👇",
      'shop': "Questions about the bag? I know every stadium's rules. Ask me.",
      'wholesale': "Ready to stock the gate? I can walk you through wholesale pricing. 💰",
      'world-cup': `FIFA is ${Math.floor((new Date('2026-06-11')-new Date())/86400000)}d away. I'll help you pass every gate. ⚽`,
    };

    const msg = notifMessages[ctx];
    if (!msg) return;

    autoOpenTimer = setTimeout(() => {
      if (!hasInteracted && !isOpen) {
        const notif = document.getElementById('gr-notif');
        const notifText = document.getElementById('gr-notif-text');
        if (notif && notifText) {
          notifText.textContent = msg;
          notif.classList.add('visible');
          document.getElementById('gr-badge').classList.add('visible');
          setTimeout(() => notif.classList.remove('visible'), 6000);
        }
      }
    }, 8000);
  }

  // ── INIT ─────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    injectHTML();
    renderSuggestions();

    // Event listeners
    document.getElementById('gr-launcher').addEventListener('click', () => {
      isOpen ? closeChat() : openChat();
    });
    document.getElementById('gr-close').addEventListener('click', closeChat);

    const input = document.getElementById('gr-input');
    const sendBtn = document.getElementById('gr-send');

    sendBtn.addEventListener('click', () => sendMessage());

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    // Dismiss notif
    document.querySelector('.gr-notif-close').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('gr-notif').classList.remove('visible');
    });
    document.getElementById('gr-notif').addEventListener('click', openChat);

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (isOpen && !document.getElementById('gr-window').contains(e.target) && !document.getElementById('gr-launcher').contains(e.target)) {
        closeChat();
      }
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeChat();
    });

    // Schedule context-aware prompt
    scheduleAutoNotif();

    console.log(`[Gate.AI v${GR_ASSISTANT_VERSION}] Initialized on ${getPageContext()} page`);
  }

  // ── BOOT ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
