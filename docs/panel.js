// Cornerstone control panel: a floating glass panel on desktop, a bottom sheet on phones.
// It reorganises the existing controls (same elements, same ids) into collapsible rows that show their current value,
// so nothing in the app's own scripts has to change.
(function () {
  'use strict';
  const controls = document.querySelector('.app .controls');
  if (!controls || controls.dataset.panel) return;
  controls.dataset.panel = 'ready';
  const root = document.documentElement;
  const phone = matchMedia('(max-width: 760px)');
  const el = (tag, cls, html) => { const node = document.createElement(tag); if (cls) node.className = cls; if (html != null) node.innerHTML = html; return node; };
  const svg = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    fill: svg('<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>'),
    size: svg('<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>'),
    frame: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><rect x="8" y="8" width="8" height="8" rx="1.5"/>'),
    motion: svg('<path d="M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5"/>'),
    more: svg('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>')
  };
  const CHEVRON = svg('<path d="m7 10 5 5 5-5"/>');
  const $ = id => document.getElementById(id);

  // ----- structure -----
  const brand = controls.querySelector(':scope > .brand');
  const heading = controls.querySelector(':scope > h1');
  controls.querySelector(':scope > .intro')?.remove();
  const actions = controls.querySelector(':scope > .actions');
  const questions = [...controls.querySelectorAll(':scope > .question')];
  const extras = [...controls.querySelectorAll(':scope > .studio-controls, :scope > .corner-color-controls')];
  const notes = [...controls.querySelectorAll(':scope > .tip')];

  const handle = el('button', 'sheet-handle', '<span></span>');
  handle.type = 'button'; handle.setAttribute('aria-label', 'Show controls'); handle.setAttribute('aria-expanded', 'false');
  const collapse = el('button', 'panel-collapse', svg('<path d="m15 6-6 6 6 6"/>'));
  collapse.type = 'button'; collapse.setAttribute('aria-label', 'Hide controls');
  const head = el('div', 'panel-head');
  head.append(brand, collapse);
  heading.classList.add('panel-title');
  const scroll = el('div', 'panel-scroll');
  scroll.id = 'panelScroll';

  const reopen = el('button', 'panel-reopen', `${ICONS.size}<span>Controls</span>`);
  reopen.type = 'button'; reopen.setAttribute('aria-label', 'Show controls'); reopen.hidden = true;
  document.body.append(reopen);

  // ----- collapsible rows -----
  const rows = [];
  function enhance(q, { title, icon, summary, id }) {
    const headEl = q.querySelector(':scope > .question-head');
    const h2 = headEl.querySelector('h2');
    headEl.querySelector('.step')?.remove();
    const body = el('div', 'q-body'), inner = el('div', 'q-inner');
    body.id = `q-body-${id}`;
    [...q.children].filter(child => child !== headEl).forEach(child => inner.append(child));
    body.append(inner); q.append(body);
    const label = title || h2.textContent;
    const button = el('button', 'q-toggle', `<span class="q-icon">${icon}</span><span class="q-label">${label}</span><span class="q-sum"></span><span class="q-chev">${CHEVRON}</span>`);
    button.type = 'button'; button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', body.id);
    h2.replaceChildren(button);
    q.classList.add('q-row');
    const row = { q, button, body, summary, sum: button.querySelector('.q-sum') };
    button.addEventListener('click', () => {
      const wasOpen = q.classList.contains('is-open');
      if (phone.matches && !controls.classList.contains('sheet-open')) { setSheet(true); setOpen(row, true); return; }
      setOpen(row, !wasOpen);
    });
    rows.push(row);
    return row;
  }
  function setOpen(row, open) {
    if (open) rows.forEach(other => { if (other !== row) setOpen(other, false); });
    row.q.classList.toggle('is-open', open);
    row.button.setAttribute('aria-expanded', String(open));
    if (open && phone.matches) requestAnimationFrame(() => row.q.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  const text = id => $(id)?.textContent.trim() || '';
  const pressed = id => document.querySelector(`#${id} [aria-pressed="true"]`)?.textContent.trim() || '';
  const spec = [
    { title: 'Fill', icon: ICONS.fill, id: 'fill', summary: () => pressed('fillChoices') },
    { title: 'Detail', icon: ICONS.size, id: 'count', summary: () => `${text('countValue')} tiles` },
    { title: 'Frame', icon: ICONS.frame, id: 'frame', summary: () => { const f = pressed('frameChoices'); return f && f !== 'None' ? `${f} · ${text('frameValue')}` : f; } },
    { title: 'Flip', icon: ICONS.motion, id: 'motion', summary: () => ($('motionToggle')?.getAttribute('aria-checked') === 'true' ? `On · ${text('speedValue')}` : 'Off') }
  ];
  questions.forEach((q, i) => spec[i] && enhance(q, spec[i]));
  // Arrange / project / cornerstone colours were added by studio.js; gather them in one "More" row.
  if (extras.length) {
    const more = el('section', 'question');
    more.innerHTML = '<div class="question-head"><h2>More</h2></div>';
    const holder = el('div', 'more-holder'); extras.forEach(node => holder.append(node)); more.append(holder);
    enhance(more, { title: 'Arrange & project', icon: ICONS.more, id: 'more', summary: () => { const s = $('arrangement'); return s ? s.options[s.selectedIndex]?.text || '' : ''; } });
    questions.push(more);
  }
  // inline widths the old layout needed
  ['frameSize', 'speed'].forEach(id => { if ($(id)) $(id).removeAttribute('style'); });

  // ----- assemble -----
  const rowList = questions;
  controls.replaceChildren(handle, head, heading, scroll, actions);
  scroll.append(...rowList, ...notes);
  rows.find(r => r.q === questions[0]) && setOpen(rows[0], true);

  // ----- summaries -----
  let refreshing = false;
  const observer = new MutationObserver(() => refresh());
  function refresh() {
    if (refreshing) return; refreshing = true; observer.disconnect();
    rows.forEach(row => { row.sum.textContent = row.summary(); });
    observer.observe(controls, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['aria-pressed', 'aria-checked', 'hidden', 'class'] });
    refreshing = false;
  }
  controls.addEventListener('input', refresh); controls.addEventListener('change', refresh); controls.addEventListener('click', () => setTimeout(refresh, 0));
  refresh(); setTimeout(refresh, 600);

  // ----- desktop collapse and phone sheet -----
  function setPanel(open) {
    root.classList.toggle('panel-closed', !open);
    reopen.hidden = open || phone.matches;
    collapse.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem('cornerstone-panel', open ? 'open' : 'closed'); } catch (_) {}
    window.dispatchEvent(new Event('resize'));
  }
  function setSheet(open) {
    controls.classList.toggle('sheet-open', open);
    handle.setAttribute('aria-expanded', String(open));
    handle.setAttribute('aria-label', open ? 'Hide controls' : 'Show controls');
    if (!open) scroll.scrollTop = 0;
  }
  collapse.addEventListener('click', () => setPanel(false));
  reopen.addEventListener('click', () => setPanel(true));
  handle.addEventListener('click', () => setSheet(!controls.classList.contains('sheet-open')));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && phone.matches && controls.classList.contains('sheet-open') && !document.querySelector('dialog[open]')) setSheet(false); });
  // dragging the handle: swipe up to open, down to close
  let startY = null;
  handle.addEventListener('pointerdown', event => { startY = event.clientY; });
  handle.addEventListener('pointerup', event => {
    if (startY == null) return;
    const dy = event.clientY - startY; startY = null;
    if (Math.abs(dy) > 24) { setSheet(dy < 0); event.preventDefault(); handle.dataset.dragged = '1'; setTimeout(() => delete handle.dataset.dragged, 50); }
  });
  handle.addEventListener('click', event => { if (handle.dataset.dragged) { event.stopImmediatePropagation(); } }, true);

  function layoutMode() {
    if (phone.matches) { root.classList.remove('panel-closed'); reopen.hidden = true; }
    else { let saved = 'open'; try { saved = localStorage.getItem('cornerstone-panel') || 'open'; } catch (_) {} setPanel(saved !== 'closed'); setSheet(false); }
  }
  phone.addEventListener('change', layoutMode); layoutMode();

  // the wall needs to know how tall the closed sheet is
  const measure = () => { if (phone.matches && !controls.classList.contains('sheet-open')) root.style.setProperty('--sheet-h', `${controls.offsetHeight}px`); };
  new ResizeObserver(measure).observe(controls); measure();
  // starting something that needs the full screen should tuck the sheet away
  ['puzzleBtn', 'fullscreen'].forEach(id => $(id)?.addEventListener('click', () => setSheet(false)));
})();
