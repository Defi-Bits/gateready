/**
 * GateReady™ Embed Widget v1
 * Drop this script into any page to embed the Gate Check tool
 */
(function() {
  'use strict';

  const BASE_URL = 'https://begateready.com';

  function init() {
    const scriptEl = document.currentScript || document.querySelector('script[data-gr][src*="gateready"]');
    const apiKey  = scriptEl?.getAttribute('data-key')   || '';
    const theme   = scriptEl?.getAttribute('data-theme') || 'dark';
    const containerId = scriptEl?.getAttribute('data-container') || 'gr-embed';

    const wrap = document.getElementById(containerId);
    if (!wrap) { console.warn('[GateReady] Container not found: ' + containerId); return; }

    const isDark = theme === 'dark';
    wrap.innerHTML = `
      <style>
        .gr-widget { font-family: -apple-system, sans-serif; border-radius: 8px; padding: 24px; max-width: 600px; }
        .gr-widget-dark { background: #0e0e16; border: 1px solid #1e1e28; }
        .gr-widget-light { background: #fafafa; border: 1px solid #e0e0e0; }
        .gr-widget-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .gr-widget-logo { font-family: 'Arial Narrow', 'Helvetica Neue', sans-serif; font-weight: 900; font-size: 15px; letter-spacing: 0.15em; text-transform: uppercase; }
        .gr-logo-r2 { color: #C41230; }
        .gr-widget-input-row { display: flex; gap: 8px; margin-bottom: 12px; }
        .gr-widget-input { flex: 1; padding: 10px14px; border-radius: 4px; font-size: 14px; outline: none; }
        .gr-widget-dark .gr-widget-input { background: #141420; border: 1px solid #2a2a3e; color: #eee; }
        .gr-widget-light .gr-widget-input { background: #fff; border: 1px solid #ddd; color: #111; }
        .gr-widget-btn { background: #C41230; color: #fff; border: none; border-radius: 4px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .gr-widget-btn:hover { background: #a30f27; }
        .gr-widget-result { margin-top: 12px; padding: 14px 16px; border-radius: 4px; font-size: 13px; line-height: 1.55; }
        .gr-result-hit { background: rgba(34,197,94,0.05); border: 1px solid rgba(34,197,94,0.15); }
        .gr-widget-badge { font-size: 12px; color: #22c55e; margin-top: 6px; font-weight: 600; }
        .gr-widget-lang { font-size: 11px; color: #555; margin-top: 12px; }
        .gr-widget-powered { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 12px; }
        .gr-powered-link { font-size: 11px; color: #C41894; text-decoration: none; font-weight: 600; }
      </style>
      <div class="gr-widget gr-widget-${theme}">
        <div class="gr-widget-head">
          <div class="gr-widget-logo">GATE<span class="gr-logo-r2">READY&trade;</span></div>
          <div style="font-size:11px;color:#555;">Bag Policy Lookup</div>
        </div>
        <div class="gr-widget-input-row">
          <input id="gr-embed-input" class="gr-widget-input" placeholder="Enter stadium or team name..." type="text" />
          <button id="gr-embed-btn" class="gr-widget-btn">Check</button>
        </div>
        <div id="gr-embed-result"></div>
        <div class="gr-widget-powered">
          <span style="font-size:10px;color:#444;">Powered by</span>
          <a href="https://begateready.com" target="_blank" class="gr-powered-link">GateReady™</a>
        </div>
      </div>
    `;

    document.getElementById('gr-embed-btn').addEventListener('click', runCheck);
    document.getElementById('gr-embed-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') runCheck();
    });

    async function runCheck() {
      const query = document.getElementById('gr-embed-input').value.trim();
      if (!query) return;
      const resultEl = document.getElementById('gr-embed-result');
      resultEl.innerHTML = '<div style="font-size:13px;color:#666;">Checking...</div>';
      try {
        const res = await fetch(BASE_URL + '/api/gate-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, embed_key: apiKey })
        });
        const data = await res.json();
        if (data.policy) {
          resultEl.innerHTML = `
      <div class="gr-widget-result gr-result-hit">
            <div style="font-weight:600;margin-bottom:6px;">${data.venue || query}</div>
            <div style="color:#666;">${data.policy}</div>
            <div class="gr-widget-badge">✅ GateReady Passes</div>
          </div>
        `;
        } else {
          resultEl.innerHTML = `<div style="font-size:13px;color:#666;margin-top:8px;">Policy not found. <a href="${BASE_URL}/gate-check" target="_blank" style="color:#C41230;">Try full Gate Check</a></div>`;
        }
      } catch (e) {
        resultEl.innerHTML = `<div style="font-size:12px;color:#aaa;">Unable to reach GateReady API.</div>`;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
