const test=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/core.js');
const album=(i,artist='Artist')=>({id:String(i),title:'Album '+i,artist,art:'https://example.com/'+i+'.jpg',color:[(i*37)%255,(i*71)%255,(i*21)%255]});
test('deduplicates IDs, artwork and edition variants across catalogs',()=>{assert.equal(C.unique([album(1),{...album(1),id:'else'},album(2),{...album(2),id:'third',art:'https://else/2.jpg',title:'Album 2 (Deluxe Edition)'}]).length,2);});
test('deduplicates dash-style deluxe releases across distinct IDs',()=>{assert.equal(C.unique([album(1),{...album(1),id:'deluxe',art:'https://else/deluxe.jpg',title:'Album 1 - Deluxe Edition'}]).length,1);});
test('MusicBrainz release types keep studio albums, EPs and special releases distinct',()=>{
 assert.equal(C.releaseCategory({'primary-type':'Album','secondary-types':[]}), 'albums');
 assert.equal(C.releaseCategory({'primary-type':'EP','secondary-types':[]}), 'eps');
 for(const type of ['Compilation','Live','Mixtape/Street','Soundtrack'])assert.equal(C.releaseCategory({'primary-type':'Album','secondary-types':[type]}), 'more');
 assert.equal(C.releaseCategory({'primary-type':'Single'}), 'more');
});
test('artwork fallback accepts only official releases of the same album and prefers the exact title',()=>{
 const target={title:'Good Album'}, releases=[
  {id:'fan',title:'Good Album',status:'Bootleg','cover-art-archive':{front:true}},
  {id:'wrong',title:'Other Album',status:'Official','cover-art-archive':{front:true}},
  {id:'deluxe',title:'Good Album (Deluxe Edition)',status:'Official','cover-art-archive':{front:true}},
  {id:'plain',title:'Good Album',status:'Official','cover-art-archive':{front:true}},
  {id:'back-only',title:'Good Album',status:'Official','cover-art-archive':{front:false}}
 ];
 assert.deepEqual(C.officialReleaseCandidates(releases,target).map(r=>r.id),['plain','deluxe']);
});
test('visible corner order maps to legacy clockwise storage without moving saved albums',()=>{const saved=[album(1),album(2),album(3),album(4)];assert.deepEqual(C.cornerToStorage,[0,1,3,2]);assert.deepEqual(C.cornerToStorage.map(index=>saved[index].id),['1','2','4','3']);for(const columns of [2,5,10]){const positions=C.corners(columns*6,columns);assert.deepEqual([positions[0],positions[1],positions[3],positions[2]],[0,columns-1,columns*5,columns*6-1]);}assert.deepEqual(saved.map(a=>a.id),['1','2','3','4']);});
test('60 albums fill desktop, portrait and ultrawide grids without blank slots',()=>{for(const aspect of [16/9,1290/2796,21/9,32/9,1]){const s=C.shape(aspect,60,60);assert.equal(s.count,60);assert.equal(s.rows*s.columns,60);for(const mode of ['original','color','gradient','alternating','random']){const input=Array.from({length:60},(_,i)=>album(i)),out=C.arrange(input,s.count,s.columns,mode,'#d78c56',42);assert.equal(new Set(out.map(a=>a.id)).size,60);C.corners(60,s.columns).forEach((pos,i)=>assert.equal(out[pos].id,input[i].id));assert.equal(input[4].id,'4');}}});
test('smaller collections use only available albums without duplication',()=>{for(let n=4;n<=60;n++){const s=C.shape(16/9,n,60);assert.ok(s.count<=n);assert.equal(C.arrange(Array.from({length:n},(_,i)=>album(i)),s.count,s.columns).filter(Boolean).length,s.count);}});
test('a replacement keeps every other album in place across arrangements and export shapes',()=>{
 for(const size of [8,60])for(const mode of ['original','color','gradient','alternating','random']){
  const before=Array.from({length:size},(_,i)=>album(i)),ordered=C.ordered(before,mode,'#d78c56',42),target=ordered[5],replacement=album(90);
  const after=before.map(a=>a.id===target.id?replacement:a),ids=ordered.slice(4).map(a=>a.id===target.id?C.identity(replacement):C.identity(a));
  const placementOrder={mode,ids};
  for(const aspect of [16/9,1290/2796]){const shape=C.shape(aspect,size,size);const oldWall=C.arrange(before,shape.count,shape.columns,mode,'#d78c56',42),newWall=C.arrange(after,shape.count,shape.columns,mode,'#d78c56',42,placementOrder);assert.deepEqual(newWall.map(C.identity),oldWall.map(a=>a.id===target.id?C.identity(replacement):C.identity(a)));}
  assert.deepEqual(C.ordered(after,mode,'#d78c56',42,placementOrder).slice(0,4).map(a=>a.id),['0','1','2','3']);
 }
});
test('recommendations weight artists, redistribute exhausted catalogs and exclude duplicates',()=>{const existing=Array.from({length:45},(_,i)=>album(i));const artists=[{name:'A',weight:8},{name:'B',weight:4},{name:'C',weight:3}],pools=[Array.from({length:12},(_,i)=>album(100+i,'A')),Array.from({length:8},(_,i)=>album(200+i,'B')),Array.from({length:8},(_,i)=>album(300+i,'C'))];let r=C.recommend(artists,pools,existing,15);assert.equal(r.length,15);assert.deepEqual(artists.map(a=>r.filter(x=>x.suggestedBy===a.name).length),[8,4,3]);pools[0]=[pools[0][0],existing[0]];r=C.recommend(artists,pools,existing,15);assert.equal(r.length,15);assert.equal(r.filter(x=>x.suggestedBy==='A').length,1);assert.equal(C.unique(existing.concat(r)).length,60);});
const track=i=>({id:'t'+i,artists:[{id:'a',name:'Artist'}],album:{id:'a'+i,name:'Album '+i,artists:[{id:'a',name:'Artist'}],images:[{url:'https://example.com/'+i+'.jpg',width:640}]}});
test('Spotify follows next pages and stops at 60 distinct albums',async()=>{let calls=[];const fetch=async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('offset=50')?{items:Array.from({length:20},(_,i)=>track(50+i)),next:null}:{items:Array.from({length:50},(_,i)=>track(i)),next:'https://api.spotify.com/v1/me/top/tracks?offset=50'}};};const r=await C.importSpotify('test','long_term',true,()=>{},fetch);assert.equal(r.albums.length,60);assert.equal(calls.length,2);assert.equal(r.stats.pages,2);});
test('Spotify combines top tracks and top artists without inventing play counts or requesting artist albums',async()=>{let calls=[];const fetch=async url=>{calls.push(url);return{ok:true,json:async()=>url.includes('/top/artists')?{items:[{id:'a',name:'Artist A'},{id:'b',name:'Artist B'}],next:null}:{items:Array.from({length:50},(_,i)=>track(i%45)),next:null}};};const r=await C.importSpotify('test','long_term',true,()=>{},fetch);assert.equal(r.albums.length,45);assert.equal(r.stats.pages,3);assert.equal(r.stats.artistPages,3);assert.equal(r.stats.tracks,45);assert.ok(r.artists[0].weight>r.artists[1].weight);assert.equal(r.suggestions.length,0);assert.ok(calls.every(url=>!url.includes('/artists/a/albums')));assert.equal(r.pools.length,r.artists.length);});
test('Spotify keeps 20 unique albums and a smaller-than-four collection without padding either one',async()=>{for(const size of [20,3]){const fetch=async url=>({ok:true,json:async()=>url.includes('/top/artists')?{items:[],next:null}:{items:Array.from({length:size},(_,i)=>track(i)),next:null}});const r=await C.importSpotify('test','short_term',false,()=>{},fetch);assert.equal(r.albums.length,size);assert.equal(r.stats.pages,1);assert.equal(r.stats.artistPages,1);}});
test('duplicate tracks, repeated albums and missing artwork do not inflate import counts',async()=>{const duplicate=track(1),sameAlbum={...track(2),album:duplicate.album},noArt={...track(3),album:{...track(3).album,images:[]}};const fetch=async url=>({ok:true,json:async()=>url.includes('/top/artists')?{items:[],next:null}:{items:[duplicate,duplicate,sameAlbum,noArt],next:null}});const r=await C.importSpotify('test','long_term',false,()=>{},fetch);assert.equal(r.albums.length,1);assert.equal(r.stats.tracks,3);assert.equal(r.stats.missingArtwork,1);});
test('Spotify quota and rate-limit errors are distinguished while preserving partial results',async()=>{for(const [reason,kind] of [['QUOTA_EXCEEDED','quota'],[null,'rate_limit']]){let calls=0;const fetch=async url=>{if(url.includes('/top/artists'))return{ok:true,json:async()=>({items:[],next:null})};if(++calls===1)return{ok:true,json:async()=>({items:[track(1),track(2),track(3),track(4)],next:'https://api.spotify.com/v1/me/top/tracks?offset=50'})};return{ok:false,status:429,headers:{get:()=>null},json:async()=>({error:{reason}})};};const r=await C.importSpotify('test','long_term',true,()=>{},fetch);assert.equal(r.albums.length,4);assert.equal(r.stats.limitReason,kind);assert.ok(r.stats.limited);}});
test('Spotify partial data survives a later service limit',async()=>{let n=0;const fetch=async()=>++n===1?{ok:true,json:async()=>({items:[track(1),track(2),track(3),track(4)],next:'https://api.spotify.com/v1/me/top/tracks?offset=50'})}:{ok:false,status:429};const r=await C.importSpotify('test','long_term',true,()=>{},fetch);assert.equal(r.albums.length,4);assert.ok(r.stats.limited);});
test('artist catalog recommendations verify covers and exclude special releases with progressive results',async()=>{
 const originalFetch=global.fetch,OriginalImage=global.Image,calls=[];
 global.fetch=async url=>{calls.push(url);const data=url.includes('/artist/?')?{artists:[{id:'mb-person',name:'Test Catalog Artist',score:100}]}:url.includes('/release-group?')?{'release-groups':[
  {id:'good-album',title:'Official Album','primary-type':'Album','secondary-types':[]},
  {id:'good-ep',title:'Official EP','primary-type':'EP','secondary-types':[]},
  {id:'compilation',title:'Compilation','primary-type':'Album','secondary-types':['Compilation']},
  {id:'no-cover',title:'Missing Cover','primary-type':'Album','secondary-types':[]}
 ],'release-group-count':4}:{releases:[]};return{ok:true,json:async()=>data};};
 global.Image=class{set src(url){queueMicrotask(()=>url.includes('no-cover')?this.onerror?.():this.onload?.());}};
 try{const progress=[],found=await C.discoverArtistAlbums({id:'spotify-person',name:'Test Catalog Artist',weight:8},items=>progress.push(items.length));assert.deepEqual(found.map(a=>a.title).sort(),['Official Album','Official EP']);assert.ok(progress.length>=2);assert.ok(calls.some(url=>url.includes('/release?release-group=no-cover')));}
 finally{global.fetch=originalFetch;global.Image=OriginalImage;}
});
