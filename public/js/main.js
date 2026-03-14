/**
 * GateReady™ -- main.js
 * Site-wide JS: nav, scroll anims, Gate Check form
 */

// ─── Navigation toggle (mobile) ----------------------------------
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navToggle.classList.toggle('active');
  });
}

// ─── Scroll reveal -------------------------------------------------
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── Gate Check form ----------------------------------------------
const gcQuery = document.getElementById('gcQuery');
const gcBtn   = document.getElementById('gcBtn');
const gcResult = document.getElementById('gcResult');

if (gcQuery && gcBtn) {
  async function runGateCheck() {
    const query = gcQuery.value.trim();
    if (!query) return;

    gcBtn.textContent = 'Checking...';
    gcBtn.disabled = true;
    if (gcResult) gcResult.innerHTML = '';

    try {
      const res = await fetch('/api/gate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();

      if (gcResult) {
        if (data.policy) {
          gcResult.innerHTML = `
            <div class="gc-result-card ${data.confidence > 0.65 ? 'gc-hit' : 'gc-low'}">
              <div class="gc-result-venue">${data.venue || query}</div>
              <div class="gc-result-policy">${data.policy}</div>
              ${data.confidence > 0.65 ? '<div class="gc-result-badge">🎍 GateReady Passes</div>' : ''}
            </div>
          `;
        } else if (data.needs_email) {
          gcResult.innerHTML = `
            <div class="gc-result-card gc-low">
              <div class="gc-result-venue">${query}</div>
              <div class="gc-result-policy">We'll look this up for you - enter your email:</div>
              <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
                <input id="gcEmail" type="email" placeholder="your@email.com" style="flex:1;min-width:200px;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:14px;" />
                <button onclick="runEmailLookup('${encodeURIComponent(query)}')" class="btn btn-primary">Get Policy</button>
              </div>
            </div>
          `;
        }
      }
    } catch (err) {
      if (gcResult) gcResult.innerHTML = '<p style="color:red;">Error checking policy. Please try again.</p>';
    } finally {
      gcBtn.textContent = 'Check It';
      gcBtn.disabled = false;
    }
  }

  gcBtn.addEventListener('click', runGateCheck);
  gcQuery.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runGateCheck();
  });
}

window.runEmailLookup = async function(encodedQuery) {
  const query  = decodeURIComponent(encodedQuery);
  const emailEl = document.getElementById('gcEmail');
  if (!emailEl) return;
  const email = emailEl.value.trim();
  if (!email) { emailEl.style.borderColor = 'red'; return; }
  try {
    const res = await fetch('/api/gate-check-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, email })
    });
    const data = await res.json();
    const gcResult = document.getElementById('gcResult');
    if (gcResult && data.policy) {
      gcResult.innerHTML = `
        <div class="gc-result-card gc-hit">
          <div class="gc-result-venue">${data.venue || query}</div>
          <div class="gc-result-policy">${data.policy}</div>
          <div class="gc-result-badge">🎍 GateReady Passes</div>
          <p style="font-size:12px;color:#888;margin-top:8px;">Results sent to ${email}</p>
        </div>
      `;
    }
  } catch (e) { console.error(e); }
}

// ─── Stripe checkout link ------------------------------------------
const STRIPE_LINK = '#'; // Replace with real Stripe payment link
document.querySelectorAll('.btn-buy-now').join && document.querySelectorAll('.btn-buy-now').forEach(btn => {
  btn.addEventListener('click', () => window.location.href = STRIPE_LINK);
});
