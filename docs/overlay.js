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
  let previous = 0;
  function render() {
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
        if (i === items.length - 1 && items.length > previous) slot.classList.add('is-new');
        slot.addEventListener('click', () => item.click());
      } else slot.setAttribute('aria-hidden', 'true');
      wall.append(slot);
    }
    previous = items.length;
    count.textContent = `${items.length} / 60`;
    bar.style.width = `${(items.length / 60) * 100}%`;
  }
  new MutationObserver(render).observe(shelf, { childList: true });
  render();

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
