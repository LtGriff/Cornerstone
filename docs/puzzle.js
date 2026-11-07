// Cornerstone sliding puzzle.
// Your wall, scrambled: slide tiles into the one gap to put every album back. The four cornerstones are locked
// and the gap never sits on a corner, so they stay put and anchor the board.
// Game rules live in plain functions (testable in Node); the board UI below only runs in a browser.
(function () {
  'use strict';

  // ---------- rules ----------
  const cornerCells = (cols, rows) => [0, cols - 1, (rows - 1) * cols, rows * cols - 1];

  // Board: cells[position] = tile id (its home position), or -1 for the gap.
  function createBoard(cols, rows, gapHome) {
    const cells = Array.from({ length: cols * rows }, (_, i) => i);
    cells[gapHome] = -1;
    return { cols, rows, cells, gap: gapHome, gapHome, locked: new Set(cornerCells(cols, rows)), moves: 0 };
  }

  function pickGapHome(cols, rows, rng = Math.random) {
    const locked = new Set(cornerCells(cols, rows));
    const open = [];
    for (let i = 0; i < cols * rows; i++) if (!locked.has(i)) open.push(i);
    return open[Math.floor(rng() * open.length)];
  }

  function neighbors(pos, cols, rows) {
    const r = Math.floor(pos / cols), c = pos % cols, list = [];
    if (r > 0) list.push(pos - cols);
    if (r < rows - 1) list.push(pos + cols);
    if (c > 0) list.push(pos - 1);
    if (c < cols - 1) list.push(pos + 1);
    return list;
  }

  const isSolved = board => board.cells.every((id, pos) => id === (pos === board.gapHome ? -1 : pos));
  const displaced = board => board.cells.filter((id, pos) => id !== -1 && id !== pos).length;

  // Slide the tile at `pos` (and any tiles between it and the gap, in the same row or column) toward the gap.
  // Returns how many tiles moved; 0 means the move is not allowed (not in line with the gap, or a corner is in the way).
  function slide(board, pos) {
    const { cols, cells } = board;
    if (pos === board.gap || board.locked.has(pos)) return 0;
    const gr = Math.floor(board.gap / cols), gc = board.gap % cols, r = Math.floor(pos / cols), c = pos % cols;
    if (r !== gr && c !== gc) return 0;
    const step = r === gr ? (c > gc ? 1 : -1) : (r > gr ? cols : -cols);
    const path = [];
    for (let p = board.gap + step; ; p += step) { path.push(p); if (p === pos) break; }
    if (path.some(p => board.locked.has(p))) return 0;
    let hole = board.gap;
    for (const p of path) { cells[hole] = cells[p]; hole = p; }
    cells[hole] = -1;
    board.gap = hole;
    board.moves++;
    return path.length;
  }

  // Scramble with a random walk of legal moves from the solved board, so every shuffle is solvable.
  function shuffle(board, rng = Math.random) {
    const { cols, rows, cells, locked } = board, total = cols * rows;
    let previous = -1, steps = 0;
    const target = total * 14 + 40;
    const wanted = Math.ceil((total - 4) * 0.5);
    while ((steps < target || displaced(board) < wanted || isSolved(board)) && steps < 20000) {
      let options = neighbors(board.gap, cols, rows).filter(p => !locked.has(p) && p !== previous);
      if (!options.length) options = neighbors(board.gap, cols, rows).filter(p => !locked.has(p));
      const next = options[Math.floor(rng() * options.length)];
      cells[board.gap] = cells[next]; cells[next] = -1;
      previous = board.gap; board.gap = next; steps++;
    }
    board.moves = 0;
    return board;
  }

  // Closest cols x rows to the available space and the wanted number of tiles (never thinner than 3).
  function chooseShape(aspect, available, target) {
    target = Math.max(12, Math.min(target, available));
    let best = null;
    for (let rows = 3; rows <= 12; rows++) for (let cols = 3; cols <= 12; cols++) {
      const count = rows * cols;
      if (count > available || count < 12) continue;
      const score = Math.abs(Math.log(cols / rows / aspect)) * 1.8 + Math.abs(count - target) / target;
      if (!best || score < best.score) best = { rows, cols, count, score };
    }
    return best;
  }

  const rules = { cornerCells, createBoard, pickGapHome, neighbors, slide, shuffle, isSolved, displaced, chooseShape };
  if (typeof module !== 'undefined' && module.exports) { module.exports = rules; }
  if (typeof document === 'undefined') return;
  window.CornerstonePuzzleRules = rules;

  // ---------- board UI ----------
  const LEVELS = { easy: 12, medium: 24, hard: 40 };
  let dialog, area, boardEl, movesEl, timeEl, winEl, winText, hintEl, options, board, shape, tiles = [], items = [], size = 0;
  let level = 'easy', started = 0, ticker = null, peeking = false, won = false;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('cornerstone-puzzle') || '{}'); } catch (_) { return {}; } },
    set(value) { try { localStorage.setItem('cornerstone-puzzle', JSON.stringify(value)); } catch (_) {} }
  };

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'puzzle-dialog';
    dialog.setAttribute('aria-label', 'Cornerstone puzzle');
    dialog.innerHTML = `
      <div class="pz-head">
        <button type="button" class="pz-back" data-pz="close"><span aria-hidden="true">←</span> Back</button>
        <div class="pz-stats" role="status" aria-live="off"><span>Moves <b id="pzMoves">0</b></span><span>Time <b id="pzTime">0:00</b></span></div>
        <button type="button" class="pz-icon" data-pz="shuffle" aria-label="Shuffle again">↻</button>
      </div>
      <div class="pz-levels" role="group" aria-label="Difficulty">
        <button type="button" data-level="easy">Easy</button><button type="button" data-level="medium">Medium</button><button type="button" data-level="hard">Hard</button>
      </div>
      <div class="pz-area"><div class="pz-board" role="group" aria-label="Puzzle board"></div></div>
      <div class="pz-foot">
        <p class="pz-hint" id="pzHint">Slide tiles into the gap. The four corners are locked.</p>
        <button type="button" class="pz-peek" data-pz="peek">Hold to peek</button>
      </div>
      <div class="pz-win" hidden role="dialog" aria-live="assertive"><div class="pz-win-card">
        <h2>Solved!</h2><p id="pzWinText"></p>
        <div class="pz-win-actions"><button type="button" data-pz="again">Play again</button><button type="button" data-pz="close" class="pz-ghost">Back to wall</button></div>
      </div></div>`;
    document.body.append(dialog);
    area = dialog.querySelector('.pz-area'); boardEl = dialog.querySelector('.pz-board');
    movesEl = dialog.querySelector('#pzMoves'); timeEl = dialog.querySelector('#pzTime');
    winEl = dialog.querySelector('.pz-win'); winText = dialog.querySelector('#pzWinText'); hintEl = dialog.querySelector('#pzHint');

    dialog.addEventListener('click', event => {
      const action = event.target.closest('[data-pz]')?.dataset.pz;
      const levelButton = event.target.closest('[data-level]');
      const tile = event.target.closest('.pz-tile');
      if (levelButton) { level = levelButton.dataset.level; const saved = store.get(); saved.level = level; store.set(saved); newGame(); }
      else if (action === 'close') close();
      else if (action === 'shuffle' || action === 'again') newGame();
      else if (tile && boardEl.contains(tile)) press(Number(tile.dataset.id));
    });
    const peekButton = dialog.querySelector('.pz-peek');
    ['pointerdown'].forEach(name => peekButton.addEventListener(name, event => { event.preventDefault(); peek(true); }));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(name => peekButton.addEventListener(name, () => peek(false)));
    peekButton.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); peek(true); } });
    peekButton.addEventListener('keyup', () => peek(false));
    peekButton.addEventListener('contextmenu', event => event.preventDefault());
    dialog.addEventListener('keydown', event => {
      const arrows = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: shape?.cols, ArrowDown: -shape?.cols }; // the tile that moves into the gap
      if (!(event.key in arrows) || !board) return;
      const from = board.gap + arrows[event.key];
      const sameRow = Math.floor(from / board.cols) === Math.floor(board.gap / board.cols);
      if (from < 0 || from >= board.cells.length || ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !sameRow)) return;
      event.preventDefault(); if (board.cells[from] >= 0) press(board.cells[from]);
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', stopClock);
    new ResizeObserver(layout).observe(area);
  }

  function makeTile(id) {
    const item = items[id], look = options.describe(item), tile = document.createElement('button');
    tile.type = 'button'; tile.className = 'pz-tile'; tile.dataset.id = String(id);
    if (look.color) tile.style.setProperty('--bg', look.color);
    else {
      const image = new Image();
      image.alt = ''; image.draggable = false; image.decoding = 'async'; image.src = look.src;
      const backups = (look.fallbacks || []).filter(Boolean).slice();
      image.addEventListener('error', () => { const next = backups.shift(); if (next) image.src = next; else image.hidden = true; }, { passive: true });
      tile.append(image);
    }
    tile.dataset.label = look.alt || `Tile ${id + 1}`;
    return tile;
  }

  function layout() {
    if (!shape || !area) return;
    const box = area.getBoundingClientRect(), pad = 10;
    const width = Math.max(0, box.width - pad * 2), height = Math.max(0, box.height - pad * 2);
    size = Math.floor(Math.min(width / shape.cols, height / shape.rows)) || 0;
    boardEl.style.setProperty('--s', `${size}px`);
    boardEl.style.width = `${size * shape.cols}px`; boardEl.style.height = `${size * shape.rows}px`;
  }

  function place() {
    const locked = board.locked;
    tiles.forEach((tile, id) => {
      const pos = peeking ? id : id === board.gapHome ? board.gap : board.cells.indexOf(id);
      const isGap = id === board.gapHome;
      tile.dataset.pos = String(pos);
      tile.style.setProperty('--r', Math.floor(pos / board.cols)); tile.style.setProperty('--c', pos % board.cols);
      tile.classList.toggle('is-gap', isGap && !won && !peeking);
      tile.classList.toggle('is-peek-gap', isGap && peeking && !won);
      tile.classList.toggle('is-locked', locked.has(id));
      tile.tabIndex = isGap && !won ? -1 : 0;
      tile.setAttribute('aria-label', `${tile.dataset.label}, row ${Math.floor(pos / board.cols) + 1} column ${pos % board.cols + 1}${locked.has(id) ? ', locked cornerstone' : ''}`);
    });
    movesEl.textContent = String(board.moves);
  }

  function peek(on) {
    if (!board || won || peeking === on) return;
    peeking = on; boardEl.classList.toggle('is-peeking', on); place();
  }

  function startClock() {
    if (started) return;
    started = Date.now();
    ticker = setInterval(() => { timeEl.textContent = clock(Date.now() - started); }, 250);
  }
  function stopClock() { clearInterval(ticker); ticker = null; }

  function press(id) {
    if (won || peeking) return;
    if (id === board.gapHome) return;
    const tile = tiles[id], pos = board.cells.indexOf(id);
    const moved = slide(board, pos);
    if (!moved) {
      tile.classList.remove('is-nope'); void tile.offsetWidth; tile.classList.add('is-nope');
      hintEl.textContent = board.locked.has(pos) ? 'Cornerstones are locked. Build around them.' : 'Slide a tile that sits in line with the gap.';
      return;
    }
    hintEl.textContent = 'Slide tiles into the gap. The four corners are locked.';
    startClock(); place();
    if (isSolved(board)) win();
  }

  function win() {
    won = true; stopClock();
    const ms = Date.now() - started, saved = store.get(), best = saved[level];
    const record = !best || board.moves < best.moves;
    if (record) { saved[level] = { moves: board.moves, ms }; store.set(saved); }
    place(); boardEl.classList.add('is-solved');
    tiles.forEach((tile, id) => tile.style.setProperty('--d', `${(Math.floor(id / board.cols) + id % board.cols) * 45}ms`));
    winText.textContent = `${board.moves} moves in ${clock(ms)}.${record ? ' New best!' : best ? ` Best: ${best.moves} moves.` : ''}`;
    setTimeout(() => { winEl.hidden = false; winEl.querySelector('button')?.focus(); }, reduceMotion() ? 0 : 700);
  }

  function newGame() {
    stopClock(); started = 0; won = false; peeking = false;
    winEl.hidden = true; boardEl.classList.remove('is-solved', 'is-peeking'); timeEl.textContent = '0:00';
    dialog.querySelectorAll('[data-level]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.level === level)));
    const box = area.getBoundingClientRect(), aspect = Math.max(.2, (box.width - 20) / Math.max(1, box.height - 20));
    shape = chooseShape(aspect, options.available, LEVELS[level]);
    if (!shape) { boardEl.replaceChildren(); hintEl.textContent = 'Add at least 12 albums to play the puzzle.'; board = null; return; }
    items = options.arrange(shape.count, shape.cols);
    board = shuffle(createBoard(shape.cols, shape.rows, pickGapHome(shape.cols, shape.rows)));
    boardEl.replaceChildren(); tiles = items.map((_, id) => makeTile(id)); boardEl.append(...tiles);
    hintEl.textContent = 'Slide tiles into the gap. The four corners are locked.';
    boardEl.style.setProperty('--cols', shape.cols);
    layout(); place();
  }

  function close() { stopClock(); dialog?.open && dialog.close(); }

  window.CornerstonePuzzle = {
    // options: { available, arrange(count, columns) -> items, describe(item) -> {color} | {src, fallbacks[], alt} }
    open(opts) {
      options = opts;
      if (!dialog) build();
      level = LEVELS[store.get().level] ? store.get().level : 'easy';
      if (!dialog.open) dialog.showModal();
      requestAnimationFrame(() => { layout(); newGame(); });
    },
    close,
    _state: () => ({ board, tiles }) // for tests
  };
})();
