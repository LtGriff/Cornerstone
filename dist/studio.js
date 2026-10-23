(function () {
  'use strict';
  const A=window.CornerstoneApp, C=window.CornerstoneCore, $=id=>document.getElementById(id);
  const root=$('onboardingRoot'), cornerMap=C.cornerToStorage, labels=['Top left','Top right','Bottom left','Bottom right'];
  const outerFrame=$('outerWebsiteFrame');
  const screen=$('screen');
  let revealRevision=0,revealWaitTimer=0,revealEndTimer=0,revealListeners=[];
  function cancelReveal(){
    ++revealRevision;
    clearTimeout(revealWaitTimer);clearTimeout(revealEndTimer);
    revealListeners.forEach(off=>off());revealListeners=[];
    screen.querySelector('.wall-reveal')?.remove();
  }
  function startReveal(){
    cancelReveal();
    if(A.wallpaperMode||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const revision=revealRevision,overlay=document.createElement('div');
    overlay.className='wall-reveal';overlay.setAttribute('aria-hidden','true');screen.append(overlay);
    requestAnimationFrame(()=>{
      if(revision!==revealRevision)return;
      const images=[...screen.querySelectorAll('#grid .front img')];
      let settled=images.filter(image=>image.complete).length;
      const needed=Math.max(1,Math.ceil(images.length*.6));
      function clear(){
        if(revision!==revealRevision||overlay.classList.contains('is-clearing'))return;
        clearTimeout(revealWaitTimer);revealListeners.forEach(off=>off());revealListeners=[];
        if(typeof CSS!=='undefined'&&typeof CSS.registerProperty==='function'&&CSS.supports('mask-image','radial-gradient(circle farthest-corner at center,transparent 20%,#000 30%)'))overlay.classList.add('is-radial');
        overlay.classList.add('is-clearing');
        overlay.addEventListener('animationend',()=>{if(revision===revealRevision)cancelReveal();},{once:true});
        revealEndTimer=setTimeout(()=>{if(revision===revealRevision)cancelReveal();},1650);
      }
      if(!images.length||settled>=needed){clear();return;}
      for(const image of images){
        if(image.complete)continue;
        const done=()=>{if(++settled>=needed)clear();};
        image.addEventListener('load',done,{once:true});image.addEventListener('error',done,{once:true});
        revealListeners.push(()=>{image.removeEventListener('load',done);image.removeEventListener('error',done);});
      }
      // Slow or unavailable artwork must never leave a permanent frost layer.
      revealWaitTimer=setTimeout(clear,2600);
    });
  }
  const appearanceDock=$('appearanceDock'),themeToggle=$('themeToggle'),appearanceToggle=$('appearanceToggle'),appearancePopover=$('appearancePopover'),intensitySlider=$('outerIntensity'),intensityValue=$('outerIntensityValue');
  const setting=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch(_){return fallback;}};
  const remember=(key,value)=>{try{localStorage.setItem(key,String(value));}catch(_){}};
  function setTheme(theme){
    const day=theme==='day';
    if(day)document.documentElement.dataset.theme='day';else delete document.documentElement.dataset.theme;
    themeToggle.querySelector('span').textContent=day?'☾':'☀';
    themeToggle.setAttribute('aria-label',`Switch to ${day?'night':'day'} mode`);
    themeToggle.title=`Switch to ${day?'night':'day'} mode`;
    themeToggle.setAttribute('aria-pressed',String(day));
    document.querySelector('meta[name="theme-color"]').content=day?'#e9ecec':'#0b0b0d';
    remember('cornerstone-theme',day?'day':'night');
  }
  function setIntensity(value){
    const intensity=Math.max(0,Math.min(100,Number(value)||0));
    intensitySlider.value=String(intensity);
    intensityValue.textContent=`${intensity}%`;
    outerFrame.style.setProperty('--outer-intensity',`${intensity}%`);
    remember('cornerstone-outer-intensity',intensity);
  }
  function closeAppearance(){appearancePopover.hidden=true;appearanceToggle.setAttribute('aria-expanded','false');}
  setTheme(document.documentElement.dataset.theme==='day'?'day':'night');
  setIntensity(setting('cornerstone-outer-intensity','75'));
  themeToggle.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='day'?'night':'day'));
  appearanceToggle.addEventListener('click',()=>{const open=appearancePopover.hidden;appearancePopover.hidden=!open;appearanceToggle.setAttribute('aria-expanded',String(open));});
  intensitySlider.addEventListener('input',event=>setIntensity(event.target.value));
  document.addEventListener('pointerdown',event=>{if(!appearanceDock.contains(event.target))closeAppearance();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!appearancePopover.hidden){closeAppearance();appearanceToggle.focus();}});
  let outerRevision=0;
  function updateOuterFrame(items=[],slots){
    const revision=++outerRevision, chosen=Array.isArray(slots)?slots:cornerMap.map(index=>items[index]||null);
    outerFrame.dataset.activeCorners=String(chosen.filter(Boolean).length);
    for(let i=0;i<4;i++){
      const album=chosen[i];
      const property=`--outer-corner-${i+1}`;
      const paint=color=>outerFrame.style.setProperty(property,color?`rgba(${color.map(v=>Math.round(v)).join(',')},.92)`:'transparent');
      paint(Array.isArray(album?.color)?album.color:null);
      if(album&&!album.color)void C.analyze(album).then(color=>{if(revision===outerRevision)paint(color);});
    }
  }
  document.addEventListener('fullscreenchange',()=>{cancelReveal();const full=!!document.fullscreenElement;outerFrame.hidden=full;appearanceDock.hidden=full;if(full)closeAppearance();});
  window.addEventListener('pagehide',cancelReveal);
  let currentStep='landing', hasProject=false, ready=false, draft=null, draftCornerIndices=null, importData=null, dismissed=new Set(), saveTimer, saveQueue=Promise.resolve(), gradientRevision=0, toastTimer, recommendationTimer, recommendationRevision=0, recommendationController;
  let activeDraft=false;
  root.innerHTML='<div class="arrival"><div class="arrival-backdrop" aria-hidden="true"></div><section class="stage landing" id="stage" aria-label="Create your Cornerstone wall"></section></div>';
  const backdrop=root.querySelector('.arrival-backdrop');
  for(let i=0;i<60;i++){const tile=document.createElement('span');tile.className='arrival-tile';tile.style.setProperty('--bx',`${(i%10)/9*100}%`);tile.style.setProperty('--by',`${Math.floor(i/10)/5*100}%`);tile.style.setProperty('--delay',`${-(i%9)*2}s`);backdrop.append(tile);}
  function bind(id,fn){$(id)?.addEventListener('click',fn);}
  function show(markup,type='glass corner-glass'){
    cancelReveal();
    document.body.classList.add('onboarding');const stage=$('stage');stage.className='stage '+type;stage.innerHTML=markup;stage.style.animation='none';void stage.offsetWidth;stage.style.animation='';
    document.querySelector('.app').inert=true;
    requestAnimationFrame(()=>stage.querySelector('h1,h2')?.focus({preventScroll:true}));
    stage.querySelectorAll('.info-button').forEach(b=>b.addEventListener('click',()=>{const open=b.parentElement.classList.toggle('open');b.setAttribute('aria-expanded',String(open));}));
    stage.addEventListener('keydown',e=>{if(e.key==='Escape')stage.querySelectorAll('.info-wrap.open').forEach(el=>el.classList.remove('open'));},{once:true});
  }
  const info=(id,text)=>`<span class="info-wrap"><button class="info-button" type="button" aria-label="More information" aria-expanded="false" aria-describedby="${id}">i</button><span class="info-tooltip" id="${id}" role="tooltip">${text}</span></span>`;
  function landing(){currentStep='landing';show(`<button class="glass-pill start-pill" id="startCreating">Start creating <span aria-hidden="true">→</span></button>${hasProject?'<div class="return-note"><button class="quiet-button" id="resumeProject">Resume my project ↗</button></div>':''}`,'landing');bind('startCreating',example);bind('resumeProject',resume);}
  function example(){
    currentStep='example';setGradient([[141,149,94],[143,134,183],[49,110,134],[186,116,87]]);
    show(`<p class="eyebrow">Cornerstone · a little inspiration</p><h1 tabindex="-1">Tre’s Picks</h1><p class="subtitle">A personal music wallpaper.</p>
      <div class="examples"><figure><img src="assets/tres-desktop.jpg" width="1920" height="1080" alt="Tre’s desktop wallpaper: a grid of favorite album covers"><figcaption>On my desktop</figcaption></figure><figure><img src="assets/tres-phone.jpg" width="645" height="1398" alt="Tre’s phone wallpaper with the same personal album collection"><figcaption>In my pocket</figcaption></figure></div>
      <div class="cornerstone-heading">My Four Cornerstones ${info('cornerInfo','Your cornerstones are the four albums that define your wall. They stay in their chosen positions while the surrounding albums can change.')}</div>
      <div class="example-corners" aria-label="Four example album placeholders"><div class="example-cover" style="--sample:#777f4e" title="W — top left">W</div><div class="example-cover" style="--sample:#807499" title="X — top right">X</div><div class="example-cover" style="--sample:#356278" title="Y — bottom left">Y</div><div class="example-cover" style="--sample:#a3684f" title="Z — bottom right">Z</div></div>
      <p class="corner-copy">These are my four cornerstones — the albums I’ve been listening to most recently. They form the foundation of my wall.<br><small>W, X, Y and Z are placeholders for Tre’s four favorites.</small></p>
      <button class="glass-pill" id="createOwn">Create my own <span aria-hidden="true">→</span></button><button class="quiet-button skip-button" id="skipIntro" aria-label="Skip introduction"><span aria-hidden="true">⏩</span><span class="skip-label">Skip introduction</span></button>`,'example glass corner-glass');
    bind('createOwn',modes);bind('skipIntro',()=>{const b=$('skipIntro');if(matchMedia('(hover: none)').matches&&!b.classList.contains('revealed')){b.classList.add('revealed');return;}hasProject?resume():modes();});
  }
  function modes(){currentStep='modes';show(`<p class="eyebrow">Your music. Your space.</p><h2 tabindex="-1">Where do we begin?</h2><p class="subtitle">A few favorites. Four corners. A wall that feels like you.</p><div class="mode-list">
    <button class="mode-card" id="musicMode"><span class="mode-symbol" aria-hidden="true">♫</span><span><strong>Connect my music <span class="badge">BETA</span></strong><small>Bring your listening history into Cornerstone.</small></span><span aria-hidden="true">↗</span></button>
    <button class="mode-card" id="manualMode"><span class="mode-symbol" aria-hidden="true">▦</span><span><strong>Select my albums</strong><small>Can’t connect Spotify? Find your favorite albums here.</small></span><span aria-hidden="true">→</span></button>
    <button class="mode-card" id="colorMode"><span class="mode-symbol" aria-hidden="true">◐</span><span><strong>Create by color</strong><small>Build a music wall around the colors you love.</small></span><span aria-hidden="true">→</span></button></div><button class="quiet-button" id="modeBack">← Tre’s Picks</button>`);bind('musicMode',connect);bind('manualMode',()=>pick(draft||[]));bind('colorMode',palette);bind('modeBack',example);}
  function connect(){currentStep='connect';show(`<p class="eyebrow">An invitation to your listening world</p><h2 tabindex="-1">Bring your music.</h2><p class="subtitle">We’ll find albums in your top tracks, then help you complete your collection.</p><p class="beta-copy"><span class="badge">SPOTIFY PRIVATE BETA</span><br><br>Spotify currently limits this app to five approved accounts. Ask Tre to add the email you use for Spotify before connecting. Everyone can select albums manually.</p><p class="beta-copy">Apple Music account connection isn’t available yet.</p><div class="stage-actions"><button class="glass-pill" id="beginSpotify">Connect Spotify ↗</button><button class="quiet-button" id="insteadManual">Choose albums myself</button></div><button class="quiet-button" id="connectBack">← Back</button>`);bind('beginSpotify',()=>$('connectSpotify').click());bind('insteadManual',()=>pick(draft||[]));bind('connectBack',modes);}
  function palette(){currentStep='palette';show(`<p class="eyebrow">Find your atmosphere</p><h2 tabindex="-1">What color feels like you?</h2><p class="subtitle">Pick a direction, then choose albums you love. We’ll arrange your collection by its cover colors.</p><div class="palette-choices" id="paletteChoices"></div><label class="custom-color">Or choose your own <input type="color" id="customPalette" aria-label="Custom wall color" value="${A.state.colorPreference}"></label><div class="stage-actions"><button class="glass-pill" id="colorAlbums">Find my albums →</button><button class="quiet-button" id="plainColors">Just colors, no albums</button></div><button class="quiet-button" id="paletteBack">← Back</button>`);
    for(const [name,color]of [['Orange','#d78c56'],['Red','#b85261'],['Blue','#558ac1'],['Purple','#9879bf'],['Green','#719573'],['Neutral','#969896']]){const b=document.createElement('button');b.className='palette-choice';b.setAttribute('aria-pressed',String(A.state.colorPreference===color));b.innerHTML=`<i style="--swatch:${color}"></i><span>${name}</span>`;b.onclick=()=>selectColor(color);$('paletteChoices').append(b);}
    function selectColor(c){A.state.colorPreference=c;$('customPalette').value=c;root.querySelectorAll('.palette-choice').forEach(b=>b.setAttribute('aria-pressed',String(b.querySelector('i').style.getPropertyValue('--swatch')===c)));setGradient([hex(c),[93,107,149],[104,143,142],hex(c)]);}
    $('customPalette').oninput=e=>selectColor(e.target.value);
    bind('colorAlbums',()=>{A.state.arrangement='gradient';pick(draft||[]);});bind('plainColors',()=>{const rgb=hex(A.state.colorPreference);A.state.colors=Array.from({length:60},(_,i)=>`rgb(${rgb.map(v=>Math.max(0,Math.min(255,Math.round(v*(.6+(i%7)*.1))))).join(',')})`);A.state.mode='colors';A.state.detail=5;enterEditor();});bind('paletteBack',modes);
  }
  function hex(v){return (v.match(/[a-f\d]{2}/gi)||['80','80','80']).map(x=>parseInt(x,16));}
  function setGradient(colors){['w','x','y','z'].forEach((key,i)=>document.documentElement.style.setProperty('--corner-'+key,colors[i]?`rgb(${colors[i].join(',')})`:'#424550'));}
  async function gradient(items,slots){const chosen=Array.isArray(slots)?slots:cornerMap.map(index=>items[index]||null);updateOuterFrame(items,chosen);const rev=++gradientRevision;const colors=await Promise.all(chosen.map(album=>album?C.analyze(album):null));if(rev===gradientRevision)setGradient(colors);}
  function pick(items,cornerIndices=draftCornerIndices){currentStep='picker';activeDraft=true;draft=items.slice();draftCornerIndices=cornerIndices;show(`<p class="eyebrow">Made of your favorites</p><h2 tabindex="-1">Build your collection.</h2><p class="subtitle">Choose four cornerstones, then add more albums. Your choices stay on this device.</p><button class="glass-pill" id="reopenPicker">Choose albums →</button><button class="quiet-button" id="pickerBack">← Back</button>`);bind('reopenPicker',()=>A.openPicker(draft,draftCornerIndices));bind('pickerBack',modes);A.openPicker(draft,draftCornerIndices);}
  // Reuse the working picker, with four explicit replacement targets above its search.
  const guide=document.createElement('div');guide.className='corner-guide';guide.innerHTML='<div class="corner-guide-head"><div><h3 id="guideTitle">Choose your four cornerstones</h3><p id="guideCopy">Start with the albums that define your wall.</p></div><button class="edit-corners" id="editCorners" type="button">Edit 4 cornerstones</button></div><div class="corner-slots" id="cornerSlots"></div>';
  // Keep cornerstones outside the scrolling search pane so its heading cannot slide behind the fixed modal header.
  document.querySelector('#albumDialog .picker-head').after(guide);
  $('editCorners').onclick=()=>{const position=Math.max(0,Math.min(3,draftCornerIndices?.findIndex(index=>index<0)??0));$('cornerSlots').querySelectorAll('button').forEach((slot,index)=>slot.setAttribute('aria-pressed',String(index===position)));A.targetCorner(position);};
  function draftChanged(items,slots,{previewOnly=false}={}){
    if(!previewOnly){draft=items.slice(); activeDraft=true;}const slotContainer=$('cornerSlots');slotContainer.replaceChildren();
    const chosen=Array.isArray(slots)?slots:cornerMap.map(index=>items[index]||null);
    if(Array.isArray(slots)&&!previewOnly)draftCornerIndices=chosen.map(album=>album?items.findIndex(item=>C.identity(item)===C.identity(album)):-1);
    cornerMap.forEach((index,i)=>{const a=chosen[i],b=document.createElement('button');b.type='button';b.className='corner-slot';b.dataset.cornerPosition=String(i+1);b.dataset.albumIndex=String(index);b.setAttribute('aria-label',a?`Replace cornerstone ${i+1}, ${labels[i]}: ${a.title}`:`Choose cornerstone ${i+1}, ${labels[i]}`);if(a){const im=new Image();im.src=a.thumb||a.art;im.alt=a.title;b.append(im);const paint=color=>{if(color&&b.isConnected)b.style.setProperty('--slot-glow',`rgb(${color.map(Math.round).join(',')})`);};paint(a.color);if(!a.color)void C.analyze(a).then(paint);}else b.append(document.createTextNode('+'));const label=document.createElement('span');label.textContent=`${i+1} · ${labels[i]}`;b.append(label);b.onclick=()=>{slotContainer.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));A.targetCorner(i);};slotContainer.append(b);});
    const anchors=chosen.filter(Boolean).length;
    $('guideTitle').textContent=anchors<4?'Choose your four cornerstones':'Now make it your own';
    $('guideCopy').textContent=anchors<4?`${anchors} of 4 anchors chosen · tap a slot to replace its cover`:`${items.length} / 60 albums · keep adding, or create a smaller wall now`;
    $('applyAlbums').textContent=items.length>=60?'Create my wall →':`Use these ${items.length} albums →`;
    if(!previewOnly){void gradient(items,chosen);changed();}
  }
  function recommendationScreen(){
    currentStep='recommendations';
    show(`<p class="eyebrow">A little more of what you love</p><h2 tabindex="-1">Complete your collection.</h2><div class="completion-progress" id="completionProgress"></div><p class="subtitle"><span id="completionMessage"></span> ${info('importInfo','Top tracks reflect Spotify affinity, not exact play counts. Several tracks may belong to one album. Suggestions come from MusicBrainz artist catalogs; they are not proof you listened to those albums.')}</p><p class="beta-copy" id="importDetails"></p><div class="recommendations" id="suggestions" aria-live="polite"></div><div class="stage-actions"><button class="glass-pill" id="acceptAll">Accept all suggestions</button><button class="quiet-button" id="retryRecommendations" hidden>Retry suggestions</button><button class="quiet-button" id="manualCompletion">Search myself</button><button class="quiet-button" id="useCollection">Use my collection →</button></div>`);
    bind('acceptAll',()=>accept(currentSuggestions()));bind('retryRecommendations',()=>{importData.catalogComplete=false;importData.catalogError=false;void loadCatalogSuggestions();});bind('manualCompletion',()=>pick(A.state.albums));bind('useCollection',()=>{activeDraft=false;draft=A.state.albums.slice();enterEditor({reveal:true});});
    renderRecommendations();void save();
  }
  function currentSuggestions(){
    const pools=(importData?.pools||[]).map(p=>p.filter(a=>!dismissed.has(C.identity(a))));
    return C.recommend(importData?.artists||[],pools,A.state.albums,Math.max(0,60-A.state.albums.length));
  }
  function renderRecommendations(){
    if(currentStep!=='recommendations'||!$('suggestions'))return;
    const count=A.state.albums.length,need=Math.max(0,60-count),stats=importData?.stats;
    $('completionProgress').innerHTML=`${count} <small>/ 60${need?' → 60 / 60':''}</small>`;
    $('completionMessage').textContent=need?`We found ${count} unique albums in the top tracks available to Cornerstone. Several favorite tracks can belong to one album. Choose from these additional albums by familiar artists, or keep a smaller wall.`:'Your 60-album collection is ready.';
    const reason=stats?.limitReason;
    const limitCopy=reason==='page_window'?' Cornerstone scanned up to three track pages per listening period.':reason==='quota'?' Spotify’s beta request quota stopped this import early.':reason==='rate_limit'?' Spotify rate-limited the import; the albums received so far were kept.':reason==='auth'||reason==='access'?' Spotify access ended before all periods could be checked.':reason?' Some results were incomplete; the albums received so far were kept.':'';
    $('importDetails').textContent=stats?`${stats.tracks} distinct top tracks checked across ${stats.pages} pages${stats.artistPages?`, plus ${stats.artistPages} top-artist lists`:''}.${stats.missingArtwork?` ${stats.missingArtwork} albums without artwork could not be added.`:''}${limitCopy}${importData?.catalogError?' Some artist catalogs were unavailable; you can search manually.':''} ${importData?.loading?'Finding more albums from your leading artists…':'Suggestions are optional.'}`:'Suggestions are optional. Choose only albums you want.';
    const pools=(importData?.pools||[]).map(p=>p.filter(a=>!dismissed.has(C.identity(a))));
    const suggestions=C.recommend(importData?.artists||[],pools,A.state.albums,need);
    $('suggestions').replaceChildren();$('acceptAll').hidden=!suggestions.length;$('retryRecommendations').hidden=!importData?.catalogError||!!importData?.loading||!need;
    if(!suggestions.length)$('suggestions').textContent=need?(importData?.loading?'Looking for suitable albums with verified covers…':'No more suitable albums are available here. Search your favorites or keep a smaller, fully filled wall.'):'All 60 places are filled, without repeating an album.';
    for(const album of suggestions){const card=document.createElement('article');card.className='suggestion';const im=new Image();im.loading='lazy';im.decoding='async';im.src=album.thumb||album.art;im.alt=album.title;const title=document.createElement('strong');title.textContent=album.title;title.title=album.title;const artist=document.createElement('small');artist.textContent=album.suggestedBy;const badge=document.createElement('small');badge.textContent='Suggested · not listening history';const actions=document.createElement('div');actions.className='suggestion-actions';for(const [label,desc,fn]of [['+','Accept '+album.title,()=>accept([album])],['↻','Replace '+album.title,()=>{dismissed.add(C.identity(album));renderRecommendations();changed();}],['×','Dismiss '+album.title,()=>{dismissed.add(C.identity(album));renderRecommendations();changed();}]]){const b=document.createElement('button');b.textContent=label;b.title=desc;b.setAttribute('aria-label',desc);b.onclick=fn;actions.append(b);}im.onerror=()=>{im.hidden=true;card.classList.add('missing-art');actions.firstElementChild.disabled=true;};card.append(im,title,artist,badge,actions);$('suggestions').append(card);}
    $('useCollection').disabled=count<4;
  }
  function queueRecommendationRefresh(){clearTimeout(recommendationTimer);recommendationTimer=setTimeout(()=>{renderRecommendations();changed();},120);}
  async function loadCatalogSuggestions(){
    if(!importData||importData.catalogComplete||A.state.albums.length>=60)return;
    recommendationController?.abort();recommendationController=new AbortController();const signal=recommendationController.signal,revision=++recommendationRevision,data=importData;
    data.pools ||= (data.artists||[]).map(()=>[]);
    data.loading=true;renderRecommendations();
    for(let i=0;i<(data.artists||[]).length;i++){
      if(signal.aborted||revision!==recommendationRevision||A.state.albums.length>=60)break;
      if(i>=3&&currentSuggestions().length>=60-A.state.albums.length)break;
      if(!data.artists[i]?.name||!data.artists[i]?.id)continue;
      try{data.pools[i]=await C.discoverArtistAlbums(data.artists[i],pool=>{if(signal.aborted||revision!==recommendationRevision)return;data.pools[i]=pool;queueRecommendationRefresh();},signal);}
      catch(e){if(e.name==='AbortError')break;data.catalogError=true;}
      queueRecommendationRefresh();
    }
    if(!signal.aborted&&revision===recommendationRevision){data.loading=false;data.catalogComplete=true;renderRecommendations();void save();}
  }
  function accept(items){A.state.albums=C.unique(A.state.albums.concat(items),60);draft=A.state.albums.slice();activeDraft=false;void gradient(draft);renderRecommendations();void save();}
  function resume(){if(activeDraft&&draft?.length){pick(draft,draftCornerIndices);return;}updateOuterFrame(A.state.mode==='albums'?A.state.albums:[]);if(importData&&currentStep!=='editor'&&!importData.completed&&A.state.albums.length<60){recommendationScreen();if(!importData.catalogComplete)void loadCatalogSuggestions();return;}enterEditor();}
  function enterEditor({reveal=false}={}){
    recommendationController?.abort();
    if(importData)importData.completed=true;
    currentStep='editor';activeDraft=false;document.body.classList.remove('onboarding');document.querySelector('.app').inert=false;hasProject=true;
    $('detail').value=A.state.detail;$('frameSize').value=A.state.frameInches;$('speed').value=A.state.speed;
    if(reveal)startReveal();
    A.applySettings({mode:A.state.mode,detail:A.state.detail,frame:A.state.frame,motion:A.state.motion,wave:!reveal});
    $('arrangement').value=A.state.arrangement;void gradient(A.state.mode==='albums'?A.state.albums:[]);changed();
    if(A.state.mode==='albums')void analyzeCollection();
  }
  async function analyzeCollection(){const items=A.state.albums;await C.analyzeAll(items);if(A.state.albums!==items)return;if(!['original','manual'].includes(A.state.arrangement))A.renderGrid();void save();}
  function snapshot(){const s=A.state;return {version:3,updatedAt:Date.now(),state:{albums:s.albums,colors:s.colors,mode:s.mode,detail:s.detail,frame:s.frame,frameInches:s.frameInches,motion:s.motion,speed:s.speed,phone:s.phone,customAlbums:s.customAlbums,arrangement:s.arrangement,colorPreference:s.colorPreference,randomSeed:s.randomSeed,placementOrder:s.placementOrder,manualOrder:s.manualOrder,manualBaseline:s.manualBaseline},draft,draftCornerIndices,rackLatestId:A.getRackLatestId(),activeDraft,importData,dismissed:[...dismissed],step:currentStep};}
  function save(){
    if(!ready)return Promise.resolve();
    const data=structuredClone(snapshot());
    saveQueue=saveQueue.catch(()=>{}).then(()=>C.put('project',data)).then(()=>{hasProject=true;if($('saveStatus'))$('saveStatus').textContent='Saved on this device · no cloud account';}).catch(()=>{if($('saveStatus'))$('saveStatus').textContent='Device storage is unavailable. Download a project backup before leaving.';});
    return saveQueue;
  }
  function changed(){if(!ready)return;clearTimeout(saveTimer);saveTimer=setTimeout(save,350);}
  function toast(message){let el=$('studioToast');if(!el){el=document.createElement('div');el.id='studioToast';el.className='toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,5500);}
  function drawFrame(ctx,w,h){if(A.state.frame==='none')return;const fallback=hex(A.state.colorPreference),list=cornerMap.map(i=>C.vividColor(A.state.albums[i]?.color||fallback)),points=[[0,0],[w,0],[0,h],[w,h]];ctx.fillStyle=A.state.frame==='smoke'?'#252830':'#d9dde2';ctx.fillRect(0,0,w,h);points.forEach(([x,y],i)=>{const g=ctx.createRadialGradient(x,y,0,x,y,Math.max(w,h)*.75);g.addColorStop(0,`rgba(${list[i].join(',')},.94)`);g.addColorStop(.58,`rgba(${list[i].join(',')},.28)`);g.addColorStop(1,`rgba(${list[i].join(',')},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);});ctx.fillStyle=A.state.frame==='smoke'?'rgba(8,10,15,.12)':'rgba(248,250,255,.1)';ctx.fillRect(0,0,w,h);}
  const settings=document.createElement('section');settings.className='studio-controls';settings.innerHTML='<label for="arrangement">Arrange my albums</label><select id="arrangement"><option value="original">Original order</option><option value="color">By color</option><option value="gradient">Gradient</option><option value="alternating">Alternating</option><option value="random">Random</option><option value="manual">Manual</option></select><div class="manual-controls" id="manualControls" hidden><p>Drag albums to swap on desktop, or select two tiles on touch or keyboard. The four corners stay fixed.</p><div><button class="quiet-button" id="undoManualSwap" type="button" disabled>Undo swap</button><button class="quiet-button" id="resetManualOrder" type="button" disabled>Reset arrangement</button></div></div><div class="project-actions"><button class="quiet-button" id="editCorners">Edit cornerstones</button><button class="quiet-button" id="changePalette">Change palette</button><button class="quiet-button" id="backToStart">Start screen</button><button class="quiet-button" id="backupProject">Save project file</button><button class="quiet-button" id="restoreProject">Open project file</button></div><input id="projectFile" type="file" accept="application/json,.json" hidden><p class="local-status" id="saveStatus">Saved on this device · no cloud account</p>';
  document.querySelector('.controls .actions').before(settings);
  function updateManualControls(){const active=A.state.mode==='albums'&&A.state.arrangement==='manual';$('manualControls').hidden=!active;$('undoManualSwap').disabled=!active||!A.canUndoManual();$('resetManualOrder').disabled=!active||!A.manualIsCustomized();}
  $('arrangement').onchange=async e=>{const mode=e.target.value;if(mode==='manual')A.prepareManualOrder();A.clearEditHistory();A.state.arrangement=mode;A.state.randomSeed=Date.now();A.state.placementOrder=null;A.renderGrid({wave:mode!=='manual'});updateManualControls();if(mode==='manual'){toast('Manual layout ready. Select two albums or drag to swap.');return;}toast('Arranging your collection…');await analyzeCollection();toast('Arrangement updated. Your four corners stayed fixed.');};
  bind('undoManualSwap',()=>{if(A.undoManualSwap())toast('Last swap undone.');});
  bind('resetManualOrder',()=>{if(!A.manualIsCustomized()||!confirm('Reset your manual arrangement to the order you started with? Your albums will stay in your collection.'))return;if(A.resetManualOrder())toast('Manual arrangement reset.');});
  bind('editCorners',()=>A.openPicker(A.state.albums));bind('changePalette',palette);bind('backToStart',landing);
  bind('backupProject',()=>{const blob=new Blob([JSON.stringify(snapshot())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cornerstone-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);});
  bind('restoreProject',()=>$('projectFile').click());
  function validateProject(data){
    if(data?.version!==3||!data.state||!Array.isArray(data.state.albums))throw Error('That is not a Cornerstone project file.');
    const s=data.state, safeUrl=v=>typeof v==='string'&&(/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/).test(v);
    const albums=C.unique(s.albums.filter(a=>a&&typeof a.title==='string'&&typeof a.artist==='string'&&safeUrl(a.art)).map(a=>({id:String(a.id||C.identity(a)),title:a.title.slice(0,300),artist:a.artist.slice(0,300),art:a.art,thumb:safeUrl(a.thumb)?a.thumb:a.art,url:typeof a.url==='string'&&a.url.startsWith('https://')?a.url:undefined,source:String(a.source||'project'),color:Array.isArray(a.color)&&a.color.length===3&&a.color.every(v=>Number.isFinite(v)&&v>=0&&v<=255)?a.color:undefined,provenance:a.provenance==='suggested'?'suggested':'chosen'})));
    if(s.mode==='albums'&&albums.length<4)throw Error('This project needs at least four valid albums.');
    const colors=Array.isArray(s.colors)?s.colors.filter(v=>typeof v==='string'&&/^(#[a-f\d]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i.test(v)).slice(0,120):[];
    const validManual=order=>order?.mode==='manual'&&Array.isArray(order.ids)&&order.ids.length===Math.max(0,albums.length-4)&&new Set(order.ids).size===order.ids.length&&albums.slice(4).every(album=>order.ids.includes(C.identity(album)));
    data.state={albums,colors:colors.length?colors:A.state.colors,customAlbums:true,mode:s.mode==='albums'?'albums':'colors',arrangement:['original','color','gradient','alternating','random','manual'].includes(s.arrangement)?s.arrangement:'original',colorPreference:/^#[a-f\d]{6}$/i.test(s.colorPreference)?s.colorPreference:'#d78c56',detail:Math.round(Math.max(1,Math.min(5,Number(s.detail)||5))),frameInches:Math.max(0,Math.min(2,Number(s.frameInches)||0)),speed:Math.max(1,Math.min(3,Number(s.speed)||2)),frame:['none','frost','smoke'].includes(s.frame)?s.frame:'frost',motion:s.motion!==false,phone:!!s.phone,randomSeed:Number(s.randomSeed)||1,placementOrder:s.placementOrder?.mode===s.arrangement&&Array.isArray(s.placementOrder.ids)&&s.placementOrder.ids.length===Math.max(0,albums.length-4)&&s.placementOrder.ids.every(id=>typeof id==='string'&&id.length<650)?{mode:s.arrangement,ids:s.placementOrder.ids}:null,manualOrder:validManual(s.manualOrder)?{mode:'manual',ids:s.manualOrder.ids}:null,manualBaseline:validManual(s.manualBaseline)?{mode:'manual',ids:s.manualBaseline.ids}:null};
    return data;
  }
  $('projectFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>30000000)throw Error('This project file is too large.');const data=validateProject(JSON.parse(await file.text()));Object.assign(A.state,data.state);draft=A.state.albums.slice();draftCornerIndices=null;A.setRackLatestId(data.rackLatestId);importData=null;enterEditor();toast('Project opened.');}catch(err){toast(err.message);}e.target.value='';};
  document.querySelector('.controls').addEventListener('input',changed);document.querySelector('.controls').addEventListener('click',changed);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelReveal();void save();}});
  window.CornerstoneStudio={changed,draftChanged,save,enterEditor,drawFrame,startReveal,cancelReveal,updateManualControls,importProgress:count=>{const el=$('importProgress');if(el)el.textContent=`${count} unique albums found…`;},imported:async result=>{recommendationController?.abort();++recommendationRevision;importData=result;dismissed=new Set();draft=result.albums.slice();draftCornerIndices=null;activeDraft=false;A.state.detail=5;await save();void gradient(draft);recommendationScreen();if(result.albums.length<60&&!result.pools?.some(p=>p.length))void loadCatalogSuggestions();},importFailed:message=>{connect();toast(message);}};
  async function boot(){
    try{const project=await C.get('project');if(project?.version===3){Object.assign(A.state,project.state);A.state.albums=C.unique(A.state.albums||[]);draft=project.draft;draftCornerIndices=Array.isArray(project.draftCornerIndices)&&project.draftCornerIndices.length===4&&project.draftCornerIndices.every(index=>Number.isInteger(index)&&index>=-1&&index<(draft?.length||0))&&new Set(project.draftCornerIndices.filter(index=>index>=0)).size===project.draftCornerIndices.filter(index=>index>=0).length?project.draftCornerIndices:null;A.setRackLatestId(project.rackLatestId);activeDraft=project.activeDraft;importData=project.importData;dismissed=new Set(project.dismissed||[]);hasProject=true;}else if(A.state.customAlbums){A.state.albums=C.unique(A.state.albums);A.state.mode='albums';hasProject=true;}}catch(_){$('saveStatus').textContent='Browser storage is unavailable. Use Save project file to keep a copy.';}
    ready=true;
    if(A.wallpaperMode){document.body.classList.remove('onboarding');document.querySelector('.app').inert=false;A.renderGrid();return;}
    const callback=new URLSearchParams(location.search);
    if(callback.has('code')||callback.has('error')){show('<p class="eyebrow">Spotify → Cornerstone</p><h2 tabindex="-1">Gathering your albums.</h2><p class="subtitle" id="importProgress">Reading your selected listening periods…</p>');await A.finishSpotifyImport();if(callback.has('error')){connect();toast('Spotify connection was cancelled.');}}
    else landing();
  }
  void boot();
})();
