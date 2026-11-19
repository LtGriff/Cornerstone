// Cornerstone look: background blobs, genre colors, pure-black option, heading type that reacts to the cursor.
(function () {
  'use strict';
  const root = document.documentElement;
  const safe = (fn) => { try { return fn(); } catch (_) { return null; } };

  // moving background
  const mesh = document.createElement('div');
  mesh.className = 'mesh'; mesh.setAttribute('aria-hidden', 'true'); mesh.innerHTML = '<i></i><i></i><i></i>';
  document.body.prepend(mesh);

  // pure-black option inside the appearance popover
  const pop = document.getElementById('appearancePopover');
  if (pop) {
    const row = document.createElement('label');
    row.className = 'switch-row';
    row.innerHTML = '<span>Pure black background</span><input id="pureBlack" type="checkbox">';
    pop.append(row);
    const box = row.querySelector('input');
    const apply = on => { root.classList.toggle('pure-black', on); box.checked = on; };
    apply(safe(() => localStorage.getItem('cornerstone-black')) === '1');
    box.addEventListener('change', () => { apply(box.checked); safe(() => localStorage.setItem('cornerstone-black', box.checked ? '1' : '0')); });
  }

  // genre colors: chips and the dialog take the color of the chosen genre
  const GENRES = { 'hip-hop & r&b': 'hh', pop: 'pop', 'rock & alt': 'rock', 'r&b & soul': 'rnb', country: 'country', latin: 'latin', 'electronic & dance': 'edm', 'k-pop': 'kpop' };
  const dialog = document.getElementById('albumDialog');
  const genres = document.getElementById('browseGenres');
  function paintGenres() {
    if (!genres || !dialog) return;
    let active = '';
    genres.querySelectorAll('.browse-chip').forEach(chip => {
      const key = GENRES[chip.textContent.trim().toLowerCase()];
      if (key && chip.dataset.g !== key) chip.dataset.g = key;
      if (key && chip.getAttribute('aria-pressed') === 'true') active = key;
    });
    const tab = document.querySelector('#pickerTabs [aria-selected=true]')?.dataset.tab;
    if (active && tab !== 'search') dialog.dataset.genre = active; else delete dialog.dataset.genre;
  }
  if (genres) { new MutationObserver(paintGenres).observe(genres, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed'] }); paintGenres(); }
  document.getElementById('pickerTabs')?.addEventListener('click', () => setTimeout(paintGenres, 0));

  // headings lean wider and bolder as the cursor comes near
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let pending = false, pointer = null;
  document.addEventListener('pointermove', event => {
    if (reduce.matches || event.pointerType === 'touch') return;
    pointer = event; if (pending) return; pending = true;
    requestAnimationFrame(() => {
      pending = false;
      document.querySelectorAll('.stage h1, #albumDialogTitle').forEach(node => {
        node.classList.add('kin');
        const box = node.getBoundingClientRect();
        if (!box.width) return;
        const dx = Math.max(box.left - pointer.clientX, 0, pointer.clientX - box.right), dy = Math.max(box.top - pointer.clientY, 0, pointer.clientY - box.bottom);
        const near = Math.max(0, 1 - Math.hypot(dx, dy) / 280);
        node.style.setProperty('--wght', String(Math.round(520 + near * 260)));
        node.style.setProperty('--wdth', String(Math.round(94 + near * 6)));
      });
    });
  }, { passive: true });

  // ---- carousel toggle, centered-card scaling ----
  const results = document.getElementById('albumResults');
  const filters = document.getElementById('releaseFilters');
  if (results && filters) {
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'view-toggle'; toggle.id = 'viewToggle';
    toggle.setAttribute('aria-pressed', 'false'); toggle.textContent = 'Carousel';
    results.before(toggle); toggle.hidden = true;
    const setView = on => { results.classList.toggle('view-carousel', on); toggle.setAttribute('aria-pressed', String(on)); toggle.textContent = on ? 'Grid' : 'Carousel'; if (on) requestAnimationFrame(scale); };
    toggle.addEventListener('click', () => setView(!results.classList.contains('view-carousel')));
    function scale() {
      if (!results.classList.contains('view-carousel')) return;
      const box = results.getBoundingClientRect(), mid = box.left + box.width / 2;
      results.querySelectorAll('.album-card').forEach(card => {
        const r = card.getBoundingClientRect(), d = Math.min(1, Math.abs(r.left + r.width / 2 - mid) / (box.width / 2));
        card.style.setProperty('--cs', (1 - d * 0.22).toFixed(3)); card.style.setProperty('--co', (1 - d * 0.55).toFixed(3));
      });
    }
    results.addEventListener('scroll', () => requestAnimationFrame(scale), { passive: true });
    new MutationObserver(() => { toggle.hidden = !results.querySelector('.album-card'); requestAnimationFrame(scale); }).observe(results, { childList: true });
  }

  // ---- peek: a bigger cover with a Spotify search link (desktop overlay only) ----
  if (dialog && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let peek = null, timer = null, over = null;
    const close = () => { clearTimeout(timer); timer = null; peek?.remove(); peek = null; };
    const wide = matchMedia('(min-width: 1100px) and (min-height: 640px)');
    dialog.addEventListener('pointerover', event => {
      const card = event.target.closest?.('.album-card');
      if (event.target.closest?.('.peek')) { clearTimeout(timer); return; }
      if (!card || !wide.matches || results.classList.contains('view-carousel')) { timer = setTimeout(close, 200); return; }
      if (card === over && peek) { clearTimeout(timer); return; }
      over = card; clearTimeout(timer);
      timer = setTimeout(() => {
        close();
        const img = card.querySelector('img'); if (!img || img.hidden) return;
        const title = card.querySelector('strong')?.textContent || '', by = card.querySelector('span')?.textContent || '';
        peek = document.createElement('div'); peek.className = 'peek';
        const link = document.createElement('a'); link.textContent = 'Open in Spotify'; link.target = '_blank'; link.rel = 'noreferrer';
        link.href = 'https://open.spotify.com/search/' + encodeURIComponent(`${title} ${by.split(' · ')[0]}`);
        const big = new Image(); big.alt = ''; big.src = img.currentSrc || img.src;
        const name = document.createElement('strong'); name.textContent = title;
        const sub = document.createElement('span'); sub.textContent = by;
        peek.append(big, name, sub, link); dialog.append(peek);
        const c = card.getBoundingClientRect(), d = dialog.getBoundingClientRect();
        const w = 252, h = peek.offsetHeight;
        let x = c.right - d.left + 10; if (x + w > d.width - 12) x = c.left - d.left - w - 10;
        const y = Math.max(12, Math.min(c.top - d.top - 6, d.height - h - 12));
        peek.style.left = `${Math.max(12, x)}px`; peek.style.top = `${y}px`;
      }, 420);
    });
    dialog.addEventListener('pointerleave', close);
    dialog.addEventListener('close', close);
    dialog.addEventListener('scroll', close, true);
  }
})();
