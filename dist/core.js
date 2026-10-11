/* Shared collection, layout, catalog and persistence services. No private credentials. */
(function (root) {
  'use strict';
  const normal = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\([^)]*(?:deluxe|remaster|expanded|anniversary|edition|explicit|clean)[^)]*\)|\[[^\]]*(?:deluxe|remaster|edition)[^\]]*\]/g, '').replace(/[^a-z0-9]/g, '');
  const identity = a => `${normal(a.artist)}:${normal(a.title)}`;
  function unique(items, limit = 60) {
    const ids = new Set(), names = new Set(), arts = new Set();
    return items.filter(a => {
      if (!a?.art || !a.title || !a.artist) return false;
      const name = identity(a), art = a.art.replace(/\/(?:\d+x\d+bb|front-\d+)(?:\.jpg)?$/, '');
      if ((a.id && ids.has(a.id)) || names.has(name) || arts.has(art)) return false;
      if (a.id) ids.add(a.id); names.add(name); arts.add(art); return true;
    }).slice(0, limit);
  }
  function shape(aspect, available, target = 60) {
    target = Math.min(target, available); let best;
    for (let rows = 2; rows <= 30; rows++) for (let columns = 2; columns <= 30; columns++) {
      const count = rows * columns;
      if (count > available || (target === 60 && available >= 60 && count !== 60)) continue;
      const score = Math.abs(Math.log(columns / rows / aspect)) * 1.8 + Math.abs(count - target) / Math.max(target, 1);
      if (!best || score < best.score) best = { rows, columns, count, score };
    }
    return best || { rows: 2, columns: 2, count: 4 };
  }
  const corners = (count, columns) => [0, columns - 1, count - 1, count - columns]; // existing clockwise order
  function colorValues(rgb = [125, 128, 143]) {
    const [r,g,b] = rgb.map(v => v/255), max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    let h = d === 0 ? 0 : max===r ? ((g-b)/d)%6 : max===g ? (b-r)/d+2 : (r-g)/d+4;
    return { h:(h*60+360)%360, s:max ? d/max:0, l:(max+min)/2 };
  }
  function ordered(items, mode='original', color='#df8b52', seed=1) {
    const fixed=items.slice(0,4), rest=items.slice(4);
    if (mode==='original') return items.slice();
    if (mode==='random') {
      let n=seed|0;
      for(let i=rest.length-1;i>0;i--){ n=(Math.imul(1664525,n)+1013904223)|0; const j=(n>>>0)%(i+1); [rest[i],rest[j]]=[rest[j],rest[i]]; }
    } else {
      const start = colorValues((color.match(/[a-f\d]{2}/gi)||['80','80','80']).map(x=>parseInt(x,16))).h;
      const key=a=>{const c=colorValues(a.color);return c.s<.12 ? 400+c.l*80 : ((c.h-start+360)%360)+c.l*.1;};
      rest.sort((a,b)=>key(a)-key(b));
      if(mode==='color') rest.sort((a,b)=>Math.floor(key(a)/40)-Math.floor(key(b)/40)||colorValues(a.color).l-colorValues(b.color).l);
      if(mode==='alternating'){const copy=rest.splice(0);while(copy.length){rest.push(copy.shift());if(copy.length)rest.push(copy.pop());}}
    }
    return fixed.concat(rest);
  }
  function arrange(items,count,columns,mode,color,seed) {
    const source=ordered(items,mode,color,seed), out=Array(count), pinned=corners(count,columns);
    source.slice(0,4).forEach((a,i)=>out[pinned[i]]=a);
    let cursor=4;
    for(let i=0;i<count;i++)if(!out[i])out[i]=source[cursor++];
    return out;
  }
  // Weighted fair allocation, skipping exhausted catalogs and duplicate releases.
  function recommend(artists, pools, existing, missing) {
    const chosen=[], counts=artists.map(()=>0), candidates=artists.map((_,i)=>unique(pools[i]||[],200).filter(a=>unique(existing.concat(a),300).length>unique(existing,300).length));
    while(chosen.length<missing){
      const eligible=artists.map((a,i)=>({i,score:(counts[i]+1)/Math.max(a.weight,1)})).filter(({i})=>candidates[i].length).sort((a,b)=>a.score-b.score);
      if(!eligible.length)break;
      const i=eligible[0].i, a=candidates[i].shift();
      if(unique(existing.concat(chosen,a),300).length<=existing.length+chosen.length)continue;
      chosen.push({...a, provenance:'suggested', suggestedBy:artists[i].name}); counts[i]++;
    }
    return chosen;
  }
  let dbPromise;
  function db(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('cornerstone-studio',1);req.onupgradeneeded=()=>req.result.createObjectStore('kv');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    return dbPromise;
  }
  async function get(key){const d=await db();return new Promise((resolve,reject)=>{const q=d.transaction('kv').objectStore('kv').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function put(key,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('kv','readwrite');tx.objectStore('kv').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  const memory=new Map(); let queue=Promise.resolve(), lastRequest=0;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function catalog(url,signal){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    const cached=memory.get(url)||await get('catalog:'+url).catch(()=>null);
    if(cached&&Date.now()-cached.time<86400000){memory.set(url,cached);return cached.data;}
    const job=async()=>{
      await wait(Math.max(0,1100-(Date.now()-lastRequest)));
      if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
      let response;
      for(let attempt=0;attempt<2;attempt++){
        lastRequest=Date.now();
        const timeout=AbortSignal.timeout(14000);
        response=await fetch(url,{signal:signal ? AbortSignal.any([signal,timeout]):timeout});
        if(response.ok)break;
        if(![429,503].includes(response.status)||attempt)throw new Error('The catalog is busy. Please search again in a moment.');
        await wait(Math.min(30000,Math.max(1500,Number(response.headers.get('Retry-After')||2)*1000)));
      }
      const data=await response.json(), item={time:Date.now(),data};memory.set(url,item);void put('catalog:'+url,item).catch(()=>{});return data;
    };
    const result=queue.then(job);queue=result.catch(()=>{});return result;
  }
  async function artists(term,signal){
    const q='artist:"'+term.replace(/["\\]/g,'')+'"';
    const data=await catalog('https://musicbrainz.org/ws/2/artist/?query='+encodeURIComponent(q)+'&fmt=json&limit=8',signal);
    return (data.artists||[]).map(a=>({id:a.id,name:a.name,country:a.country,type:a.type,disambiguation:a.disambiguation}));
  }
  async function albums(artist,signal,onPage=()=>{}){
    const result=[];let offset=0;
    do {
      const data=await catalog(`https://musicbrainz.org/ws/2/release-group?artist=${encodeURIComponent(artist.id)}&type=album%7Cep&release-group-status=website-default&fmt=json&limit=25&offset=${offset}`,signal);
      const groups=data['release-groups']||[];
      result.push(...groups.filter(g=>['Album','EP'].includes(g['primary-type'])&&!(g['secondary-types']||[]).some(t=>['Compilation','Live','Remix','DJ-mix','Interview','Audiobook'].includes(t))).map(g=>({id:g.id,title:g.title,artist:artist.name,artistId:artist.id,year:g['first-release-date']?.slice(0,4),art:`https://coverartarchive.org/release-group/${g.id}/front-500`,thumb:`https://coverartarchive.org/release-group/${g.id}/front-250`,url:`https://musicbrainz.org/release-group/${g.id}`,source:'musicbrainz'})));
      onPage(unique(result,100).sort((a,b)=>String(b.year||'').localeCompare(String(a.year||''))));
      offset+=25;if(offset>=(data['release-group-count']||groups.length)||offset>=100)break;
    }while(true);
    return unique(result,100).sort((a,b)=>String(b.year||'').localeCompare(String(a.year||'')));
  }
  const imageCache=new Map();
  function loadImage(url){
    if(!imageCache.has(url))imageCache.set(url,new Promise((resolve,reject)=>{const im=new Image();const timer=setTimeout(()=>{im.src='';reject(new Error('Artwork timed out'));},16000);im.crossOrigin='anonymous';im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(new Error('Artwork unavailable'));};im.src=url;}).catch(e=>{imageCache.delete(url);throw e;}));
    return imageCache.get(url);
  }
  async function analyze(album){
    if(album.color)return album.color;
    const stored=await get('color:'+album.art).catch(()=>null);if(stored){album.color=stored;return stored;}
    try{const im=await loadImage(album.thumb||album.art), c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,24,24);const p=ctx.getImageData(0,0,24,24).data;let sums=[0,0,0],total=0;for(let i=0;i<p.length;i+=4){const rgb=[p[i],p[i+1],p[i+2]],v=colorValues(rgb),w=(v.s+.15)*(v.l>.08&&v.l<.94?1:.15);rgb.forEach((x,j)=>sums[j]+=x*w);total+=w;}album.color=sums.map(x=>Math.round(x/total));void put('color:'+album.art,album.color).catch(()=>{});return album.color;}catch(_){return null;}
  }
  async function analyzeAll(items){let i=0;await Promise.all(Array.from({length:4},async()=>{while(i<items.length)await analyze(items[i++]);}));return items;}
  function spotifyAlbum(a){const images=a.images||[];return {id:'spotify-'+a.id,title:a.name,artist:(a.artists||[]).map(x=>x.name).join(' & '),artistIds:a.artists||[],year:a.release_date?.slice(0,4),art:images[0]?.url,thumb:images.find(x=>x.width>=250&&x.width<500)?.url||images[0]?.url,url:a.external_urls?.spotify,source:'spotify',provenance:'history'};}
  async function importSpotify(token,range,otherRanges=true,onProgress=()=>{},request=fetch){
    const headers={Authorization:'Bearer '+token};let collection=[],trackIds=new Set(),weights=new Map(),pages=0,limited=false;
    const read=async url=>{if(new URL(url).origin!=='https://api.spotify.com')throw new Error('Invalid Spotify page');const r=await request(url,{headers});if(!r.ok){const e=new Error(r.status===403?'Spotify has not approved this account for this beta. Ask the owner to add your Spotify email.':r.status===429?'Spotify is busy. Try importing again later.':'Spotify could not finish the import. Please reconnect.');e.status=r.status;throw e;}return r.json();};
    const ranges=otherRanges?[range,...['long_term','medium_term','short_term'].filter(x=>x!==range)]:[range];
    outer:for(const period of ranges){let next=`https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=${period}`,visited=new Set(),n=0;
      while(next&&n<3){if(visited.has(next))break;visited.add(next);let data;try{data=await read(next);}catch(e){if(!collection.length)throw e;limited=true;break outer;}
        pages++;n++;for(const entry of data.items||[]){const t=entry.item||entry;if(!t.album||trackIds.has(t.id))continue;trackIds.add(t.id);const a=t.artists?.[0];if(a?.id)weights.set(a.id,{id:a.id,name:a.name,weight:(weights.get(a.id)?.weight||0)+1});collection=unique(collection.concat(spotifyAlbum(t.album)),60);}
        onProgress(collection.length);if(collection.length>=60)break outer;next=data.next;if(n===3&&next)limited=true;
      }
    }
    const top=[...weights.values()].sort((a,b)=>b.weight-a.weight).slice(0,3),pools=[];
    if(collection.length<60&&!limited)for(const artist of top){try{const data=await read(`https://api.spotify.com/v1/artists/${encodeURIComponent(artist.id)}/albums?include_groups=album&limit=50`);pools.push((data.items||[]).filter(a=>a.album_group!=='appears_on').map(spotifyAlbum));}catch(_){pools.push([]);}}
    return {albums:collection,artists:top,pools,suggestions:recommend(top,pools,collection,60-collection.length),stats:{pages,tracks:trackIds.size,ranges,limited}};
  }
  const api={normal,identity,unique,shape,corners,ordered,arrange,recommend,get,put,artists,albums,loadImage,analyze,analyzeAll,colorValues,importSpotify};
  root.CornerstoneCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
