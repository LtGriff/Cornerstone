// Cornerstone share links: a wall (its albums, corners and look) packed into the page address after the #.
// Nothing is uploaded anywhere. The link itself holds the album list; covers load from the usual place.
(function () {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const FRAMES = ['none', 'frost', 'smoke'];
  const clamp = (value, low, high, fallback) => { const n = Number(value); return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback; };
  const text = (value, max) => String(value ?? '').slice(0, max);

  // ----- packing -----
  const toBase64Url = bytes => { let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const fromBase64Url = value => { const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(binary, char => char.charCodeAt(0)); };
  async function pipe(bytes, stream) {
    const result = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await result.arrayBuffer());
  }
  async function pack(object) {
    const bytes = new TextEncoder().encode(JSON.stringify(object));
    if (typeof CompressionStream === 'function') { try { return 'z' + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch (_) {} }
    return 'j' + toBase64Url(bytes);
  }
  async function unpack(code) {
    const kind = code[0], bytes = fromBase64Url(code.slice(1));
    if (kind === 'z') return JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw'))));
    if (kind === 'j') return JSON.parse(new TextDecoder().decode(bytes));
    throw new Error('unknown');
  }

  // ----- wall <-> link -----
  function shareable(albums) {
    // Only albums with a MusicBrainz id can be rebuilt from a link (their cover comes from the Cover Art Archive).
    return (albums || []).filter(album => UUID.test(String(album?.id || '')) && album.title && album.artist);
  }
  async function encode(state) {
    const albums = shareable(state.albums).slice(0, 60);
    if (albums.length < 4) return null;
    const code = await pack({
      v: 1,
      a: albums.map(album => [album.id.toLowerCase(), text(album.title, 120), text(album.artist, 120), album.year ? String(album.year).slice(0, 4) : '']),
      d: state.detail, f: state.frame, i: state.frameInches, m: state.motion ? 1 : 0, s: state.speed
    });
    return { code, count: albums.length, dropped: (state.albums || []).length - albums.length };
  }
  async function decode(code) {
    const data = await unpack(code);
    if (data?.v !== 1 || !Array.isArray(data.a)) throw new Error('version');
    const C = window.CornerstoneCore;
    const albums = data.a.slice(0, 60).filter(row => Array.isArray(row) && UUID.test(String(row[0])) && row[1] && row[2])
      .map(([id, title, artist, year]) => C.releaseRecord({ id: String(id).toLowerCase(), title: text(title, 120) }, text(artist, 120), undefined, year ? text(year, 4) : undefined));
    if (albums.length < 4) throw new Error('too few');
    return {
      albums,
      detail: Math.round(clamp(data.d, 1, 5, 5)),
      frame: FRAMES.includes(data.f) ? data.f : 'frost',
      frameInches: clamp(data.i, 0, 4, 1),
      motion: data.m !== 0,
      speed: Math.round(clamp(data.s, 1, 5, 2))
    };
  }
  const linkFor = code => `${location.origin}${location.pathname}#w=${code}`;
  const hasLink = () => /^#w=/.test(location.hash);

  // ----- small UI helpers -----
  function say(message) {
    let node = document.getElementById('studioToast');
    if (!node) { node = document.createElement('div'); node.id = 'studioToast'; node.className = 'toast'; node.setAttribute('role', 'status'); document.body.append(node); }
    node.textContent = message; node.hidden = false;
    clearTimeout(say.timer); say.timer = setTimeout(() => { node.hidden = true; }, 5500);
  }
  function ask(message, yes, no) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'phone-picker share-ask';
      dialog.innerHTML = `<div class="pp-head"><span></span><h2 id="shareAskTitle">${message}</h2><span></span></div><div class="pp-pills"><button type="button" class="glass-pill" data-answer="yes">${yes}</button><button type="button" class="glass-pill" data-answer="no">${no}</button></div>`;
      dialog.setAttribute('aria-labelledby', 'shareAskTitle');
      dialog.addEventListener('click', event => { const answer = event.target.closest('[data-answer]')?.dataset.answer; if (answer) { dialog.close(); resolve(answer === 'yes'); } });
      dialog.addEventListener('cancel', () => resolve(false));
      dialog.addEventListener('close', () => { dialog.remove(); });
      document.body.append(dialog); dialog.showModal();
    });
  }
  const clearHash = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {} };

  // Called by the studio at start-up when the address carries a wall. Returns true when a wall was opened.
  async function open(hasProject) {
    let shared;
    try { shared = await decode(location.hash.slice(3)); }
    catch (_) { clearHash(); say('That wall link is incomplete or damaged. Ask your friend to send it again.'); return false; }
    if (hasProject && !(await ask('Open this shared wall? It replaces the wall saved on this device.', 'Open shared wall', 'Keep my wall'))) { clearHash(); return false; }
    const A = window.CornerstoneApp;
    A.setAlbums(shared.albums);
    Object.assign(A.state, { detail: shared.detail, frame: shared.frame, frameInches: shared.frameInches, motion: shared.motion, speed: shared.speed });
    clearHash();
    window.CornerstoneStudio.enterEditor({ reveal: true });
    say(`Shared wall opened · ${shared.albums.length} albums. Change anything you like; it stays on this device.`);
    return true;
  }

  // Wallpaper mode (Wallpaper Engine, kiosk screens): apply the wall in the link without asking or opening the editor.
  async function applyQuiet() {
    const shared = await decode(location.hash.slice(3));
    const A = window.CornerstoneApp;
    A.setAlbums(shared.albums);
    Object.assign(A.state, { mode: 'albums', detail: shared.detail, frame: shared.frame, frameInches: shared.frameInches, motion: shared.motion, speed: shared.speed });
    return true;
  }
  const wallpaperLinkFor = code => `${location.origin}${location.pathname}?wallpaper#w=${code}`;
  async function wallpaperLink() {
    const A = window.CornerstoneApp;
    if (A.state.mode !== 'albums') { say('Wallpaper links need an album wall. Switch Fill to Albums first.'); return; }
    const packed = await encode(A.state);
    if (!packed) { say('Pick at least 4 albums from search or Browse first.'); return; }
    const url = wallpaperLinkFor(packed.code);
    try { await navigator.clipboard.writeText(url); say(`Wallpaper link copied. In Wallpaper Engine: Change Wallpaper → Open From URL → paste${packed.dropped ? ` · ${packed.dropped} imported albums can't be included` : ''}.`); }
    catch (_) { window.prompt('Copy this link, then paste it into Wallpaper Engine (Open From URL)', url); }
  }
  document.addEventListener('click', event => { if (event.target.closest('#wallpaperLink')) void wallpaperLink(); });

  async function share(button) {
    const A = window.CornerstoneApp;
    if (A.state.mode !== 'albums') { say('Sharing works with album walls. Switch Fill to Albums first.'); return; }
    const packed = await encode(A.state);
    if (!packed) { say('Pick at least 4 albums from search or Browse to share a wall.'); return; }
    const url = linkFor(packed.code);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'My Cornerstone wall', text: 'Here is my album wall', url }); return; }
    } catch (error) { if (error?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); say(`Link copied${packed.dropped ? ` · ${packed.dropped} imported albums can't be shared` : ''}.`); }
    catch (_) { window.prompt('Copy this link', url); }
  }
  document.addEventListener('click', event => { const button = event.target.closest('#shareWall'); if (button) void share(button); });

  window.CornerstoneShare = { encode, decode, hasLink, open, linkFor, applyQuiet, wallpaperLinkFor };
})();
