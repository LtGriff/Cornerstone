/* Shared collection, layout, catalog and persistence services. No private credentials. */
(function (root) {
  'use strict';
  const normal = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\([^)]*(?:deluxe|remaster|expanded|anniversary|edition|explicit|clean)[^)]*\)|\[[^\]]*(?:deluxe|remaster|edition)[^\]]*\]/g, '').replace(/\s*[-–—:]\s*(?:deluxe|expanded|remaster(?:ed)?|anniversary|special|bonus)\b.*$/i,'').replace(/[^a-z0-9]/g, '');
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
  // Saved collections are clockwise (TL, TR, BR, BL); the picker and color frame read TL, TR, BL, BR.
  const cornerToStorage = Object.freeze([0, 1, 3, 2]);
  const vividColor = rgb => { const middle=(rgb[0]+rgb[1]+rgb[2])/3; return rgb.map(channel=>Math.max(0,Math.min(255,Math.round(middle+(channel-middle)*1.4+12)))); };
  const corners = (count, columns) => [0, columns - 1, count - 1, count - columns]; // existing clockwise order
  function colorValues(rgb = [125, 128, 143]) {
    const [r,g,b] = rgb.map(v => v/255), max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    let h = d === 0 ? 0 : max===r ? ((g-b)/d)%6 : max===g ? (b-r)/d+2 : (r-g)/d+4;
    return { h:(h*60+360)%360, s:max ? d/max:0, l:(max+min)/2 };
  }
  function ordered(items, mode='original', color='#df8b52', seed=1, placementOrder=null) {
    const fixed=items.slice(0,4), rest=items.slice(4);
    if(placementOrder?.mode===mode&&Array.isArray(placementOrder.ids)&&placementOrder.ids.length===rest.length){
      const byIdentity=new Map(rest.map(album=>[identity(album),album]));
      const placed=placementOrder.ids.map(id=>byIdentity.get(id));
      if(placed.every(Boolean)&&new Set(placementOrder.ids).size===rest.length)return fixed.concat(placed);
    }
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
  function arrange(items,count,columns,mode,color,seed,placementOrder) {
    const source=ordered(items,mode,color,seed,placementOrder), out=Array(count), pinned=corners(count,columns);
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
    const wanted=normal(term);
    return (data.artists||[]).map(a=>({id:a.id,name:a.name,country:a.country,type:a.type,disambiguation:a.disambiguation,score:Number(a.score)||0}))
      .sort((a,b)=>Number(normal(b.name)===wanted)-Number(normal(a.name)===wanted)||Number(normal(b.name).startsWith(wanted))-Number(normal(a.name).startsWith(wanted))||b.score-a.score);
  }
  function releaseCategory(group){
    const secondary=group['secondary-types']||[];
    if(secondary.length)return 'more';
    if(group['primary-type']==='Album')return 'albums';
    if(group['primary-type']==='EP')return 'eps';
    return 'more';
  }
  const releaseOrder={albums:0,eps:1,more:2};
  function albumOrder(a,b){return releaseOrder[a.category]-releaseOrder[b.category]||String(b.year||'').localeCompare(String(a.year||''))||a.title.localeCompare(b.title);}
  async function albums(artist,signal,onPage=()=>{},options={}){
    const result=options.previous?.slice()||[];let offset=options.offset||0;
    for(let page=0;page<3;page++){
      const data=await catalog(`https://musicbrainz.org/ws/2/release-group?artist=${encodeURIComponent(artist.id)}&release-group-status=website-default&fmt=json&limit=100&offset=${offset}`,signal);
      const groups=data['release-groups']||[];
      result.push(...groups.map(g=>({id:g.id,title:g.title,artist:artist.name,artistId:artist.id,year:g['first-release-date']?.slice(0,4),category:releaseCategory(g),releaseType:[g['primary-type'],...(g['secondary-types']||[])].filter(Boolean).join(' · '),art:`https://coverartarchive.org/release-group/${g.id}/front-500`,thumb:`https://coverartarchive.org/release-group/${g.id}/front-250`,url:`https://musicbrainz.org/release-group/${g.id}`,source:'musicbrainz'})));
      offset+=groups.length;
      const visible=unique(result,10000).sort(albumOrder);
      visible.nextOffset=groups.length&&offset<(data['release-group-count']||groups.length)?offset:null;
      onPage(visible);
      if(visible.nextOffset===null)return visible;
    }
    const visible=unique(result,10000).sort(albumOrder);
    visible.nextOffset=offset;
    return visible;
  }
  const imageCache=new Map();
  function loadImage(url){
    const cached=imageCache.get(url);
    if(cached&&(!cached.failedAt||Date.now()-cached.failedAt<21600000))return cached.promise;
    const entry={promise:new Promise((resolve,reject)=>{const im=new Image();const timer=setTimeout(()=>{im.src='';reject(new Error('Artwork timed out'));},12000);im.crossOrigin='anonymous';im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(new Error('Artwork unavailable'));};im.src=url;})};
    entry.promise=entry.promise.catch(e=>{entry.failedAt=Date.now();throw e;});imageCache.set(url,entry);return entry.promise;
  }
  const artworkJobs=new Map();
  function officialReleaseCandidates(releases,album){
    const plain=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    return releases.filter(r=>r.status==='Official'&&normal(r.title)===normal(album.title)&&r['cover-art-archive']?.front!==false)
      .sort((a,b)=>Number(plain(a.title)!==plain(album.title))-Number(plain(b.title)!==plain(album.title))||Number(a['cover-art-archive']?.front!==true)-Number(b['cover-art-archive']?.front!==true)||String(a.date||'').localeCompare(String(b.date||''))).slice(0,6);
  }
  async function resolveArtwork(album,signal){
    if(album.source!=='musicbrainz'||!album.id)return null;
    if(!artworkJobs.has(album.id))artworkJobs.set(album.id,(async()=>{
      const key='artwork:'+album.id,stored=await get(key).catch(()=>null);
      if(stored&&Date.now()-stored.time<(stored.art?2592000000:21600000))return stored.art?stored:null;
      const data=await catalog(`https://musicbrainz.org/ws/2/release?release-group=${encodeURIComponent(album.id)}&status=official&fmt=json&limit=100`,signal);
      let found=null;
      for(const release of officialReleaseCandidates(data.releases||[],album)){
        if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
        const thumb=`https://coverartarchive.org/release/${release.id}/front-250`;
        try{await loadImage(thumb);found={art:`https://coverartarchive.org/release/${release.id}/front-500`,thumb};break;}catch(_){}
      }
      void put(key,{time:Date.now(),...found}).catch(()=>{});
      return found;
    })().finally(()=>artworkJobs.delete(album.id)));
    const found=await artworkJobs.get(album.id);
    if(found){album.art=found.art;album.thumb=found.thumb;}
    return found?.art||null;
  }
  async function discoverArtistAlbums(familiarArtist,onProgress=()=>{},signal){
    const matches=await artists(familiarArtist.name,signal);
    const match=matches.find(a=>normal(a.name)===normal(familiarArtist.name));
    if(!match)return [];
    const releases=(await albums(match,signal)).filter(a=>a.category==='albums'||a.category==='eps').slice(0,40);
    const verified=[];let cursor=0;
    await Promise.all(Array.from({length:4},async()=>{
      while(cursor<releases.length){
        if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
        const candidate=releases[cursor++];
        try{await loadImage(candidate.thumb);}catch(_){try{if(!await resolveArtwork(candidate,signal))continue;}catch(e){if(e.name==='AbortError')throw e;continue;}}
        verified.push(candidate);
        onProgress(unique(verified,100));
      }
    }));
    return unique(verified,100);
  }
  async function analyze(album){
    if(album.color)return album.color;
    const stored=await get('color:'+album.art).catch(()=>null);if(stored){album.color=stored;return stored;}
    try{const im=await loadImage(album.thumb||album.art), c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,24,24);const p=ctx.getImageData(0,0,24,24).data;let sums=[0,0,0],total=0;for(let i=0;i<p.length;i+=4){const rgb=[p[i],p[i+1],p[i+2]],v=colorValues(rgb),w=(v.s+.15)*(v.l>.08&&v.l<.94?1:.15);rgb.forEach((x,j)=>sums[j]+=x*w);total+=w;}album.color=sums.map(x=>Math.round(x/total));void put('color:'+album.art,album.color).catch(()=>{});return album.color;}catch(_){return null;}
  }
  async function analyzeAll(items){let i=0;await Promise.all(Array.from({length:4},async()=>{while(i<items.length)await analyze(items[i++]);}));return items;}
  function spotifyAlbum(a){const images=a.images||[];return {id:'spotify-'+a.id,title:a.name,artist:(a.artists||[]).map(x=>x.name).join(' & '),artistIds:a.artists||[],year:a.release_date?.slice(0,4),art:images[0]?.url,thumb:images.find(x=>x.width>=250&&x.width<500)?.url||images[0]?.url,url:a.external_urls?.spotify,source:'spotify',provenance:'history'};}
  async function importSpotify(token,range,otherRanges=true,onProgress=()=>{},request=fetch){
    const headers={Authorization:'Bearer '+token};let collection=[],trackIds=new Set(),weights=new Map(),pages=0,artistPages=0,missingArtwork=0,limitReason=null;
    const read=async url=>{
      if(new URL(url).origin!=='https://api.spotify.com')throw new Error('Invalid Spotify page');
      for(let attempt=0;attempt<2;attempt++){
        const r=await request(url,{headers});
        if(r.ok)return r.json();
        const body=await r.json().catch(()=>({}));
        const reason=body?.error?.reason;
        if(r.status===429&&reason!=='QUOTA_EXCEEDED'&&attempt===0){const seconds=Number(r.headers?.get?.('Retry-After'));if(Number.isFinite(seconds)&&seconds>=0&&seconds<=3){await wait(seconds*1000);continue;}}
        const kind=r.status===429?(reason==='QUOTA_EXCEEDED'?'quota':'rate_limit'):r.status===401?'auth':r.status===403?'access':'service';
        const e=new Error(kind==='quota'?'Spotify’s beta request quota is temporarily exhausted. Try again later.':kind==='rate_limit'?'Spotify is rate-limiting requests. Try again later.':kind==='access'?'Spotify has not approved this account for this beta. Ask the owner to add your Spotify email.':kind==='auth'?'Spotify sign-in expired. Please reconnect.':'Spotify could not finish the import. Please reconnect.');
        e.status=r.status;e.kind=kind;throw e;
      }
    };
    const addWeight=(artist,amount)=>{if(!artist?.id)return;const old=weights.get(artist.id);weights.set(artist.id,{id:artist.id,name:artist.name||old?.name||'Artist',weight:(old?.weight||0)+amount});};
    const ranges=otherRanges?[range,...['long_term','medium_term','short_term'].filter(x=>x!==range)]:[range];
    outer:for(const period of ranges){let next=`https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=${period}`,visited=new Set(),n=0;
      while(next&&n<3){if(visited.has(next)){limitReason='incomplete';break;}visited.add(next);let data;try{data=await read(next);}catch(e){if(!collection.length)throw e;limitReason=e.kind||'service';break outer;}
        if(!Array.isArray(data?.items)){limitReason='incomplete';break outer;}
        pages++;n++;data.items.forEach((entry,index)=>{const t=entry.item||entry;if(!t?.album)return;
          (t.artists||[]).slice(0,2).forEach((artist,i)=>addWeight(artist,(i?0.3:1)*(period===range?1.2:1)/(1+((n-1)*50+index)/20)));
          if(t.id&&trackIds.has(t.id))return;if(t.id)trackIds.add(t.id);
          const album=spotifyAlbum(t.album);if(!album.art){missingArtwork++;return;}
          collection=unique(collection.concat(album),60);
        });
        onProgress(collection.length);if(collection.length>=60)break outer;next=data.next;if(n===3&&next)limitReason='page_window';
      }
    }
    if(collection.length<60&&!['quota','rate_limit','auth','access'].includes(limitReason))for(const period of ranges){
      try{const data=await read(`https://api.spotify.com/v1/me/top/artists?limit=20&time_range=${period}`);if(!Array.isArray(data?.items)){limitReason='incomplete';break;}artistPages++;data.items.forEach((artist,index)=>addWeight(artist,(period===range?1.2:1)*2/(1+index/5)));}
      catch(e){limitReason=e.kind||'service';break;}
    }
    const top=[...weights.values()].sort((a,b)=>b.weight-a.weight).slice(0,8);
    return {albums:collection,artists:top,pools:top.map(()=>[]),suggestions:[],stats:{pages,artistPages,tracks:trackIds.size,ranges,limited:!!limitReason,limitReason,missingArtwork}};
  }
  const api={normal,identity,unique,shape,corners,cornerToStorage,vividColor,ordered,arrange,recommend,get,put,artists,albums,releaseCategory,officialReleaseCandidates,resolveArtwork,discoverArtistAlbums,loadImage,analyze,analyzeAll,colorValues,importSpotify};
  root.CornerstoneCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
