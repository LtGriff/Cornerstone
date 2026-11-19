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
})();
