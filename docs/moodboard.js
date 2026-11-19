// Cornerstone moodboard: lift one album off the wall, slide everything freely like a puzzle, then put it back.
// The four cornerstones stay locked. "Apply to wall" saves the result as the wall's manual arrangement.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const App = () => window.CornerstoneApp, C = () => window.CornerstoneCore, R = () => window.CornerstonePuzzleRules;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dialog, area, boardEl, hintEl, trayEl, btnLift, btnBack, btnUndo, btnApply, btnReset;
  let items = [], tiles = [], board = null, shape = null, tray = -1, picking = false, history = [], startKey = '', startOrder = [];

  const note = text => { const el = $('studioToast'); if (!el) return; el.textContent = text; el.hidden = false; setTimeout(() => { el.hidden = true; }, 4200); };
  const say = text => { hintEl.textContent = text; };
  const key = () => board.cells.join(',') + '|' + tray;

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'puzzle-dialog mood-dialog'; dialog.setAttribute('aria-label', 'Moodboard');
    dialog.innerHTML = `
      <div class="pz-head">
        <button type="button" class="pz-back" data-mb="close"><span aria-hidden="true">←</span> Back</button>
        <strong class="mb-title">Moodboard</strong>
        <button type="button" class="mb-apply" data-mb="apply" disabled>Apply to wall</button>
      </div>
      <div class="pz-area"><div class="pz-board" role="group" aria-label="Moodboard"></div></div>
      <div class="mb-foot">
        <div class="mb-tray" aria-live="polite"><span class="mb-tray-empty">Nothing lifted out</span></div>
        <p class="pz-hint" id="mbHint"></p>
        <div class="mb-buttons">
          <button type="button" data-mb="lift" class="mb-lift"><span aria-hidden="true">🔒</span> Lift one out</button>
          <button type="button" data-mb="back" hidden>Put it back</button>
          <button type="button" data-mb="undo" disabled>Undo</button>
          <button type="button" data-mb="reset" disabled>Reset</button>
        </div>
      </div>`;
    document.body.append(dialog);
    area = dialog.querySelector('.pz-area'); boardEl = dialog.querySelector('.pz-board'); hintEl = dialog.querySelector('#mbHint'); trayEl = dialog.querySelector('.mb-tray');
    btnLift = dialog.querySelector('[data-mb=lift]'); btnBack = dialog.querySelector('[data-mb=back]'); btnUndo = dialog.querySelector('[data-mb=undo]'); btnApply = dialog.querySelector('[data-mb=apply]'); btnReset = dialog.querySelector('[data-mb=reset]');
    dialog.addEventListener('click', event => {
      const action = event.target.closest('[data-mb]')?.dataset.mb, tile = event.target.closest('.pz-tile');
      if (action === 'close') dialog.close();
      else if (action === 'lift') { if (tray >= 0) return; picking = !picking; refresh(); }
      else if (action === 'back') putBack();
      else if (action === 'undo') undo();
      else if (action === 'reset') reset();
      else if (action === 'apply') apply();
      else if (tile && boardEl.contains(tile)) press(Number(tile.dataset.id));
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (picking) { picking = false; refresh(); } else dialog.close(); });
    new ResizeObserver(layout).observe(area);
  }

  function makeTile(id) {
    const C0 = C(), item = items[id], tile = document.createElement('button');
    tile.type = 'button'; tile.className = 'pz-tile'; tile.dataset.id = String(id);
    const image = new Image(), shown = C0.displayArt(item), backups = [item.art, C0.generatedCover(item).art].filter(url => url && url !== shown);
    image.alt = ''; image.draggable = false; image.decoding = 'async'; image.src = shown;
    image.addEventListener('error', () => { const next = backups.shift(); if (next) image.src = next; else image.hidden = true; }, { passive: true });
    tile.append(image); tile.dataset.label = `${item.title} by ${item.artist}`;
    return tile;
  }

  function layout() {
    if (!shape || !area) return;
    const box = area.getBoundingClientRect(), pad = 10;
    const size = Math.floor(Math.min(Math.max(0, box.width - pad * 2) / shape.cols, Math.max(0, box.height - pad * 2) / shape.rows)) || 0;
    boardEl.style.setProperty('--s', `${size}px`); boardEl.style.width = `${size * shape.cols}px`; boardEl.style.height = `${size * shape.rows}px`;
  }

  function place() {
    const { cols, locked } = board;
    tiles.forEach((tile, id) => {
      const pos = board.cells.indexOf(id), out = id === tray;
      tile.style.setProperty('--r', Math.floor(Math.max(pos, 0) / cols)); tile.style.setProperty('--c', Math.max(pos, 0) % cols);
      tile.classList.toggle('is-gap', out);
      tile.classList.toggle('is-locked', pos >= 0 && locked.has(pos));
      tile.classList.toggle('is-pickable', picking && pos >= 0 && !locked.has(pos));
      tile.tabIndex = out ? -1 : 0;
      tile.setAttribute('aria-label', out ? `${tile.dataset.label}, lifted out` : `${tile.dataset.label}, row ${Math.floor(pos / cols) + 1} column ${pos % cols + 1}${locked.has(pos) ? ', locked cornerstone' : ''}`);
    });
  }

  function refresh() {
    place();
    boardEl.classList.toggle('is-picking', picking);
    btnLift.hidden = tray >= 0; btnLift.classList.toggle('is-on', picking); btnLift.innerHTML = picking ? 'Cancel' : '<span aria-hidden="true">🔒</span> Lift one out';
    btnBack.hidden = tray < 0;
    btnUndo.disabled = !history.length; btnReset.disabled = key() === startKey && !history.length;
    btnApply.disabled = tray >= 0 || board.cells.join(',') === startKey.split('|')[0];
    if (tray >= 0) {
      const item = items[tray], image = new Image(); image.alt = ''; image.src = C().displayArt(item); image.addEventListener('error', () => { image.src = item.art; }, { once: true });
      const label = document.createElement('span'); label.textContent = `${item.title} · ${item.artist}`;
      trayEl.replaceChildren(image, label); trayEl.classList.add('has-album');
      say('Slide tiles into the gap in any row or column. Corners stay locked. When you like it, put the album back in the gap.');
    } else {
      trayEl.replaceChildren(Object.assign(document.createElement('span'), { className: 'mb-tray-empty', textContent: 'Nothing lifted out' })); trayEl.classList.remove('has-album');
      say(picking ? 'Pick the album to lift off the wall.' : 'Tap Lift one out, pick an album, then slide the rest around.');
    }
  }

  const remember = () => { history.push({ cells: board.cells.slice(), gap: board.gap, tray }); if (history.length > 200) history.shift(); };

  function press(id) {
    const pos = board.cells.indexOf(id);
    if (picking) {
      if (pos < 0 || board.locked.has(pos)) { say('The four cornerstones stay on the wall. Pick another album.'); return; }
      remember(); tray = id; board.cells[pos] = -1; board.gap = pos; picking = false; refresh(); return;
    }
    if (tray < 0) { say('Tap Lift one out first, so there is a gap to slide into.'); return; }
    if (id === tray) return;
    const snapshot = { cells: board.cells.slice(), gap: board.gap, tray };
    if (!R().slide(board, pos)) {
      const tile = tiles[id]; tile.classList.remove('is-nope'); void tile.offsetWidth; tile.classList.add('is-nope');
      say(board.locked.has(pos) ? 'Cornerstones are locked. Build around them.' : 'Slide a tile that sits in line with the gap.'); return;
    }
    history.push(snapshot); refresh();
  }

  function putBack() {
    if (tray < 0) return;
    remember(); board.cells[board.gap] = tray; tray = -1; board.gap = -1; refresh();
    say('Back on the wall. Lift another one out, or apply your new layout.');
  }

  function undo() {
    const last = history.pop(); if (!last) return;
    board.cells = last.cells; board.gap = last.gap; tray = last.tray; picking = false; refresh();
  }

  function reset() { setup(); }

  function setup() {
    const app = App(), s = app.state;
    shape = { cols: s.columns, rows: s.rows, count: s.count };
    items = app.arrangedItems(shape.count, shape.cols);
    board = R().createBoard(shape.cols, shape.rows, 0); board.cells = items.map((_, i) => i); board.gap = -1; board.gapHome = -1; board.locked = new Set(R().cornerCells(shape.cols, shape.rows));
    tray = -1; picking = false; history = [];
    startKey = key();
    boardEl.replaceChildren(); tiles = items.map((_, id) => makeTile(id)); boardEl.append(...tiles);
    layout(); refresh();
  }

  function apply() {
    if (tray >= 0 || !board) return;
    const app = App(), s = app.state, C0 = C(), locked = board.locked;
    const placed = board.cells.map((id, pos) => ({ id, pos })).filter(entry => !locked.has(entry.pos)).map(entry => C0.identity(items[entry.id]));
    const before = items.map((item, pos) => ({ item, pos })).filter(entry => !locked.has(entry.pos)).map(entry => C0.identity(entry.item));
    const shown = new Set(placed);
    const rest = s.albums.slice(4).map(C0.identity).filter(id => !shown.has(id));
    const wasManual = s.arrangement === 'manual';
    s.manualBaseline = wasManual && s.manualBaseline ? s.manualBaseline : { mode: 'manual', ids: before.concat(rest) };
    s.manualOrder = { mode: 'manual', ids: placed.concat(rest) };
    s.arrangement = 'manual'; s.placementOrder = null;
    const select = $('arrangement'); if (select) select.value = 'manual';
    app.clearEditHistory(); app.renderGrid({ wave: false });
    window.CornerstoneStudio?.updateManualControls?.(); void window.CornerstoneStudio?.save?.();
    dialog.close(); note('Moodboard applied. Your four cornerstones stayed put.');
  }

  function open() {
    const app = App(); if (!app) return;
    if (app.state.mode !== 'albums' || app.state.albums.length < 12) { note('Moodboard needs an album wall of at least 12 albums. Choose your albums first.'); return; }
    if (!dialog) build();
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(setup);
  }

  const actions = document.querySelector('.controls .actions');
  if (actions) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'action'; button.id = 'moodBtn'; button.textContent = 'Moodboard';
    const puzzle = $('puzzleBtn'); if (puzzle) puzzle.after(button); else actions.append(button);
    button.addEventListener('click', () => { open(); });
  }
  window.CornerstoneMoodboard = { open, _state: () => ({ board, tray, history }) };
})();
