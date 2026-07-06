// ---------------------------------------------------------------------------
// Elias Web Console — Homepage (greeting only)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Greeting
// ---------------------------------------------------------------------------

async function loadGreeting(persona) {
  const el = document.getElementById('home-greeting');
  if (!el) return;
  const textEl = el.querySelector('.home-greeting-text');
  const personaEl = el.querySelector('.home-greeting-persona');
  if (!textEl) return;

  try {
    const data = await fetch(`/api/home/greeting?persona=${encodeURIComponent(persona)}`).then(r => r.json());
    textEl.textContent = data.greeting || '嗯，来了。';
    if (personaEl) personaEl.textContent = `— ${persona}`;
  } catch {
    textEl.textContent = '嗯，来了。';
    if (personaEl) personaEl.textContent = '';
  }

  el.classList.add('loaded');
}

// ---------------------------------------------------------------------------
// Entry point — called from app.js when rendering the home tab
// ---------------------------------------------------------------------------

export async function renderHome(persona) {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="home-container">
      <div class="home-greeting-wrapper">
        <div class="home-greeting-glow"></div>
        <div class="home-greeting" id="home-greeting">
          <div class="home-greeting-text">…</div>
          <div class="home-greeting-persona"></div>
        </div>
      </div>
    </div>
  `;

  await loadGreeting(persona);
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
