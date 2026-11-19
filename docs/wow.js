// Cornerstone delight: confetti the first time, a ripple after, poster view, optional click sounds.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = fn => { try { return fn(); } catch (_) { return null; } };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- sounds (off until switched on) ----------
  let ctx = null, soundOn = safe(() => localStorage.getItem('cornerstone-sound')) === '1';
  function tone(freq, start, length, gain, type = 'sine') {
    if (!soundOn) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') void ctx.resume();
      const t0 = ctx.currentTime + start, osc = ctx.createOscillator(), amp = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t0);
      amp.gain.setValueAtTime(0.0001, t0); amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.005); amp.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
      osc.connect(amp).connect(ctx.destination); osc.start(t0); osc.stop(t0 + length + 0.02);
    } catch (_) {}
  }
  const tick = () => { tone(1250, 0, 0.05, 0.05, 'triangle'); tone(420, 0.006, 0.07, 0.04); };
  const chime = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.05));
  const pop = $('appearancePopover');
  if (pop) {
    const row = document.createElement('label');
    row.className = 'switch-row'; row.innerHTML = '<span>Click sounds</span><input id="soundToggle" type="checkbox">';
    const box = row.querySelector('input'); box.checked = soundOn; pop.append(row);
    box.addEventListener('change', () => { soundOn = box.checked; safe(() => localStorage.setItem('cornerstone-sound', soundOn ? '1' : '0')); if (soundOn) tick(); });
  }
  const shelf = $('selectedShelf'); let shelfCount = 0;
  if (shelf) new MutationObserver(() => { const n = shelf.querySelectorAll('.selected-mini').length; if (n > shelfCount) tick(); shelfCount = n; }).observe(shelf, { childList: true });

  // ---------- celebration ----------
  function confetti() {
    if (reduce.matches) return;
    const canvas = document.createElement('canvas'); canvas.className = 'confetti'; canvas.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(2, devicePixelRatio || 1); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    document.body.append(canvas);
    const g = canvas.getContext('2d'); g.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const colors = [1, 2, 3, 4, 5].map(i => css.getPropertyValue(`--ambient-${i}`).trim()).filter(Boolean).concat(['#ffffff']);
    const parts = Array.from({ length: 170 }, (_, i) => ({ x: innerWidth * (i % 2 ? 0.2 : 0.8), y: innerHeight * 0.75, vx: (Math.random() - 0.5) * 14 + (i % 2 ? 5 : -5), vy: -Math.random() * 16 - 8, w: 6 + Math.random() * 7, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length] }));
    const start = performance.now();
    (function frame(now) {
      const t = now - start; g.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(p => { p.vy += 0.42; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - t / 3200); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); });
      if (t < 3200) requestAnimationFrame(frame); else canvas.remove();
    })(start);
  }
  function ripple() {
    const grid = $('grid'); if (!grid || reduce.matches) return;
    const tiles = [...grid.children]; if (!tiles.length) return;
    const boxes = tiles.map(tile => tile.getBoundingClientRect());
    const cx = (Math.min(...boxes.map(b => b.left)) + Math.max(...boxes.map(b => b.right))) / 2, cy = (Math.min(...boxes.map(b => b.top)) + Math.max(...boxes.map(b => b.bottom))) / 2;
    const far = Math.max(...boxes.map(b => Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy))) || 1;
    tiles.forEach((tile, i) => { const b = boxes[i], d = Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) / far; tile.animate([{ scale: 1 }, { scale: 1.14, offset: 0.4 }, { scale: 1 }], { duration: 650, delay: d * 700, easing: 'ease-in-out' }); });
  }
  $('applyAlbums')?.addEventListener('click', () => {
    if ($('applyAlbums').disabled) return;
    setTimeout(() => {
      const first = safe(() => localStorage.getItem('cornerstone-celebrated')) !== '1';
      if (first) { safe(() => localStorage.setItem('cornerstone-celebrated', '1')); confetti(); chime(); } else { ripple(); tick(); }
    }, 1400);
  }, true);

  // ---------- poster view ----------
  const actions = document.querySelector('.controls .actions');
  const dialog = document.createElement('dialog');
  dialog.className = 'poster-dialog'; dialog.setAttribute('aria-label', 'Wall poster');
  dialog.innerHTML = '<button class="poster-close" type="button">Close</button><div class="poster-frame"><div class="poster-mat"><div class="poster-grid"></div><p class="poster-caption"><strong>My Cornerstone wall</strong><span></span></p></div></div>';
  document.body.append(dialog);
  dialog.querySelector('.poster-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  if (actions) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'action'; button.id = 'posterBtn'; button.textContent = 'Poster view';
    const install = document.getElementById('installApp'); if (install) install.before(button); else actions.append(button);
    button.addEventListener('click', () => {
      const grid = $('grid'); const tiles = [...(grid?.children || [])];
      const imgs = tiles.map(tile => tile.querySelector('img')).filter(Boolean);
      if (!tiles.length || imgs.length < tiles.length) { const note = $('studioToast'); if (note) { note.textContent = 'Poster view needs an album wall. Choose your albums first.'; note.hidden = false; setTimeout(() => { note.hidden = true; }, 4000); } return; }
      const cols = Number(grid.style.getPropertyValue('--columns')) || 4, rows = Math.ceil(tiles.length / cols);
      const holder = dialog.querySelector('.poster-grid'); holder.style.setProperty('--cols', cols); holder.style.setProperty('--rows', rows);
      holder.replaceChildren(...imgs.map(img => { const copy = new Image(); copy.alt = img.alt || ''; copy.src = img.currentSrc || img.src; return copy; }));
      const A = window.CornerstoneApp?.state?.albums || [], C = window.CornerstoneCore;
      const names = [...grid.querySelectorAll('.cornerstone')].map(tile => A.find(a => C?.identity(a) === tile.dataset.albumId)).filter(Boolean).map(a => a.artist);
      dialog.querySelector('.poster-caption span').textContent = `${tiles.length} albums${names.length ? ` · anchored by ${[...new Set(names)].join(', ')}` : ''}`;
      dialog.showModal();
    });
  }
})();
