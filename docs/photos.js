// Artist pictures for the search list: Wikipedia thumbnail first, then one of the artist's album covers.
// Results are remembered on this device, so each artist is looked up once. Letters stay as the last fallback.
(function () {
  'use strict';
  const KEY = 'cornerstone-artist-photos-v1';
  let memo = {}; try { memo = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { memo = {}; }
  const save = () => { try { const keys = Object.keys(memo); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => delete memo[k]); localStorage.setItem(KEY, JSON.stringify(memo)); } catch (_) {} };
  const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function wikipedia(artist, signal) {
    const hint = artist.disambiguation || (artist.type === 'Group' ? 'band' : 'musician');
    const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=5&prop=pageimages&piprop=thumbnail&pithumbsize=200&gsrsearch=' + encodeURIComponent(`${artist.name} ${hint}`);
    const response = await fetch(url, { signal }); if (!response.ok) return '';
    const pages = Object.values((await response.json())?.query?.pages || {}).sort((a, b) => (a.index || 9) - (b.index || 9));
    const name = norm(artist.name);
    const hit = pages.find(page => page.thumbnail?.source && (norm(page.title) === name || norm(page.title).startsWith(name + ' ') || norm(page.title).includes(name)));
    return hit?.thumbnail?.source || '';
  }

  let lastMB = 0, chain = Promise.resolve();
  function albumCover(artist, signal) {
    // Musicbrainz allows about one request per second, so these run one at a time, spaced out.
    chain = chain.then(async () => {
      await wait(Math.max(0, 1300 - (Date.now() - lastMB))); lastMB = Date.now();
      if (signal?.aborted) return '';
      const response = await fetch(`https://musicbrainz.org/ws/2/release-group?artist=${encodeURIComponent(artist.id)}&type=album&limit=1&fmt=json`, { signal });
      if (!response.ok) return '';
      const group = (await response.json())['release-groups']?.[0];
      return group ? `https://coverartarchive.org/release-group/${group.id}/front-250` : '';
    }).catch(() => '');
    return chain;
  }

  async function lookup(artist, signal) {
    const key = artist.id || norm(artist.name);
    if (key in memo) return memo[key];
    let src = '';
    try { src = await wikipedia(artist, signal); } catch (e) { if (e.name === 'AbortError') return ''; }
    if (!src && artist.id) { try { src = await albumCover(artist, signal); } catch (e) { if (e.name === 'AbortError') return ''; } }
    memo[key] = src; save();
    return src;
  }

  function paint(avatar, src) {
    if (!src || !avatar.isConnected) return;
    const image = new Image();
    image.alt = ''; image.decoding = 'async';
    image.addEventListener('load', () => { if (!avatar.isConnected) return; avatar.classList.add('has-photo'); avatar.style.backgroundImage = `url("${src}")`; avatar.textContent = ''; }, { once: true });
    image.src = src;
  }

  let controller = null;
  window.CornerstonePhotos = {
    // Call once per artist-results render: pass the list of [avatarElement, artist] pairs.
    fill(pairs) {
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal;
      pairs.forEach(([avatar, artist]) => { const key = artist.id || norm(artist.name); if (memo[key]) paint(avatar, memo[key]); });
      (async () => { for (const [avatar, artist] of pairs) { if (signal.aborted) return; const key = artist.id || norm(artist.name); if (key in memo) continue; paint(avatar, await lookup(artist, signal)); } })();
    }
  };
})();
