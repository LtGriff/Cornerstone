// Cornerstone desktop picker preview (the wall fills up beside the results) and the "/" search shortcut.
(function () {
  'use strict';
  const shelf = document.getElementById('selectedShelf');
  const shell = document.querySelector('#albumDialog .picker-shell');
  if (!shelf || !shell) return;
  const aside = document.createElement('aside');
  aside.className = 'picker-preview';
  aside.setAttribute('aria-label', 'Your wall so far');
  aside.innerHTML = '<div class="pp-top"><h3>Your wall</h3><output id="ppCount" aria-live="polite">0 / 60</output></div><div class="pp-bar" aria-hidden="true"><i id="ppBar"></i></div><div class="pp-wall" id="ppWall"></div><p class="pp-hint">Click a cover here to take it off your wall.</p>';
  shell.append(aside);
  const wall = aside.querySelector('#ppWall'), count = aside.querySelector('#ppCount'), bar = aside.querySelector('#ppBar');
  let previous = 0, pending = null;
  const dialogEl = document.getElementById('albumDialog');
  const wide = matchMedia('(min-width: 1100px) and (min-height: 640px)');
  // remember which cover was just clicked so it can fly onto the wall
  dialogEl.addEventListener('click', event => {
    const card = event.target.closest('.album-card'); const img = card?.querySelector('img');
    if (card && img && !img.hidden) pending = { src: img.currentSrc || img.src, rect: img.getBoundingClientRect(), at: Date.now() };
  }, true);
  function drop(slot, info) {
    if (!wide.matches || matchMedia('(prefers-reduced-motion: reduce)').matches || !dialogEl.open) return;
    const to = slot.getBoundingClientRect(), box = dialogEl.getBoundingClientRect();
    if (!to.width) return;
    const flyer = new Image(); flyer.src = info.src; flyer.alt = '';
    Object.assign(flyer.style, { position: 'absolute', left: `${info.rect.left - box.left}px`, top: `${info.rect.top - box.top}px`, width: `${info.rect.width}px`, height: `${info.rect.height}px`, objectFit: 'cover', borderRadius: '12px', zIndex: 60, pointerEvents: 'none', boxShadow: '0 18px 40px rgba(0,0,0,.5)' });
    slot.style.opacity = '0'; dialogEl.append(flyer);
    const dx = to.left - info.rect.left, dy = to.top - info.rect.top, k = to.width / info.rect.width;
    const run = flyer.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 40}px) scale(${(1 + k) / 2 + 0.12})`, offset: 0.55 }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: 560, easing: 'cubic-bezier(.3,.7,.2,1)', transformOrigin: '0 0' });
    flyer.style.transformOrigin = '0 0';
    run.onfinish = run.oncancel = () => { flyer.remove(); slot.style.opacity = ''; slot.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' }); };
  }
  function render() {
    const fresh = pending && Date.now() - pending.at < 1500 ? pending : null; if (fresh) pending = null;
    const items = [...shelf.querySelectorAll('.selected-mini')];
    wall.replaceChildren();
    for (let i = 0; i < 60; i += 1) {
      const item = items[i];
      const slot = document.createElement(item ? 'button' : 'div');
      slot.className = 'pp-slot';
      if (item) {
        slot.type = 'button'; slot.classList.add('is-filled');
        const source = item.querySelector('img');
        const label = item.querySelector('span')?.textContent || '';
        slot.title = item.title; slot.setAttribute('aria-label', item.title);
        const image = new Image(); image.alt = ''; image.decoding = 'async';
        image.src = source?.currentSrc || source?.src || '';
        slot.append(image);
        if (/^C\d$/.test(label)) { const badge = document.createElement('b'); badge.textContent = label; slot.append(badge); }
        if (i === items.length - 1 && items.length > previous && !(fresh && wide.matches)) slot.classList.add('is-new');
        slot.addEventListener('click', () => item.click());
      } else slot.setAttribute('aria-hidden', 'true');
      wall.append(slot);
    }
    if (fresh) { const slot = wall.children[items.length - 1]; if (slot) drop(slot, fresh); }
    previous = items.length;
    count.textContent = `${items.length} / 60`;
    bar.style.width = `${(items.length / 60) * 100}%`;
  }
  new MutationObserver(render).observe(shelf, { childList: true });
  render();

  // gap hints: which decades the wall covers so far
  const hint = document.createElement('div');
  hint.innerHTML = '<div class="pp-years" id="ppYears"></div><p class="pp-gap" id="ppGap" hidden></p>';
  aside.querySelector('.pp-hint').before(hint);
  function gaps(albums) {
    const decades = { '2000s': 0, '2010s': 0, '2020s': 0 };
    (albums || []).forEach(album => { const y = parseInt(album.year, 10); if (y >= 2000) decades[`${Math.floor(y / 10) * 10}s`] = (decades[`${Math.floor(y / 10) * 10}s`] || 0) + 1; });
    hint.querySelector('#ppYears').replaceChildren(...Object.entries(decades).map(([label, n]) => { const b = document.createElement('b'); b.dataset.n = n; b.textContent = `${label} · ${n}`; return b; }));
    const empty = Object.entries(decades).filter(([, n]) => !n).map(([label]) => label);
    const gap = hint.querySelector('#ppGap');
    gap.hidden = !(albums || []).length || !empty.length;
    gap.textContent = empty.length ? `Nothing from the ${empty.join(' or ')} yet.` : '';
  }
  gaps([]);
  const studio = window.CornerstoneStudio;
  if (studio?.draftChanged) { const original = studio.draftChanged; studio.draftChanged = function (albums, ...rest) { try { gaps(albums); } catch (_) {} return original.call(this, albums, ...rest); }; }

  // "/" opens search from anywhere on the page
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (document.querySelector('dialog[open]')) return;
    const open = document.getElementById('chooseAlbums');
    if (!open || open.offsetParent === null) return;
    event.preventDefault(); open.click();
    setTimeout(() => { document.getElementById('tabSearch')?.click(); document.getElementById('albumSearch')?.focus(); }, 60);
  });
})();
