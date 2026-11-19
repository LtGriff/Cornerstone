// Cornerstone stage: a blurred mosaic of your own covers behind the glass, plus a tidy dock for the side tools.
(function () {
  'use strict';
  const grid = document.getElementById('grid'), actions = document.querySelector('.controls .actions');
  const wide = matchMedia('(min-width: 761px)').matches;

  // ---- cover glow behind everything (desktop only) ----
  const bg = document.createElement('div'); bg.className = 'stage-bg'; bg.setAttribute('aria-hidden', 'true');
  if (wide) document.body.prepend(bg);
  let timer = null;
  function sync() {
    const seen = new Set(), urls = [];
    grid?.querySelectorAll('.tile img').forEach(img => { const src = img.currentSrc || img.src; if (src && !img.hidden && !seen.has(src) && !src.startsWith('data:image/svg')) { seen.add(src); urls.push(src); } });
    document.documentElement.classList.toggle('has-stage-bg', urls.length >= 6);
    if (urls.length < 6) { bg.replaceChildren(); return; }
    const pick = urls.slice(0, 30), cells = [];
    for (let i = 0; i < 30; i++) { const im = new Image(); im.alt = ''; im.decoding = 'async'; im.src = pick[i % pick.length]; cells.push(im); }
    bg.replaceChildren(...cells);
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(sync, 700); };
  if (grid && wide) { new MutationObserver(later).observe(grid, { childList: true }); later(); }

  // ---- tool dock ----
  if (actions) {
    const ids = [['shuffle', '⇄'], ['puzzleBtn', '▦'], ['moodBtn', '✦'], ['posterBtn', '▭'], ['shareWall', '↗']];
    const dock = document.createElement('div'); dock.className = 'dock';
    ids.forEach(([id, glyph]) => {
      const button = document.getElementById(id); if (!button) return;
      const icon = document.createElement('i'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = glyph;
      button.prepend(icon); dock.append(button);
    });
    const install = document.getElementById('installApp');
    install ? install.before(dock) : actions.append(dock);
  }
})();
