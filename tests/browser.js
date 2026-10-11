const frame=document.getElementById('app'),result=document.getElementById('result');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function covers(){return Array.from({length:80},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=80;const x=c.getContext('2d');x.fillStyle=`hsl(${i*31%360} 48% 42%)`;x.fillRect(0,0,80,80);x.fillStyle='white';x.font='22px sans-serif';x.fillText(i+1,10,44);return{id:'qa-'+i,title:'Test Album '+(i+1),artist:'Test Artist '+(i%3),art:c.toDataURL(),color:[i*31%256,i*67%256,i*97%256]};});}
function fixture(w){const all=covers(),albums=all.slice(0,45),artists=[{name:'Test Artist 0',weight:8},{name:'Test Artist 1',weight:4},{name:'Test Artist 2',weight:3}];w.CornerstoneApp.setAlbums(albums);return{albums,artists,pools:artists.map((_,j)=>all.slice(45).filter((a,i)=>i%3===j)),stats:{tracks:72,pages:3,limited:false}};}
document.getElementById('recommend').onclick=async()=>{const w=frame.contentWindow;await w.CornerstoneStudio.imported(fixture(w));result.textContent='45 imported albums; 15 suggested albums shown. Use the real controls below.';};
document.getElementById('run').onclick=async()=>{
 result.textContent='';const log=s=>result.textContent+=s+'\n',assert=(ok,name)=>{if(!ok)throw Error(name);log('PASS '+name);};
 try{
 await new Promise(resolve=>{frame.onload=resolve;frame.src='/?qa-start='+Date.now();});
 let w=frame.contentWindow,d=w.document,A=w.CornerstoneApp,S=w.CornerstoneStudio,C=w.CornerstoneCore;
 assert(!!S,'Application and studio boot');
 const all=covers(),outer=d.getElementById('outerWebsiteFrame');
 assert(!!outer&&!outer.style.getPropertyValue('--outer-corner-1')&&!outer.dataset.activeCorners,'Opening website frame starts neutral');
 const theme=d.getElementById('themeToggle'),appearance=d.getElementById('appearanceToggle'),popover=d.getElementById('appearancePopover'),intensity=d.getElementById('outerIntensity');
 assert(!!theme&&!!appearance&&!!intensity&&popover.hidden,'Appearance controls start accessible and compact');
 appearance.click();assert(!popover.hidden&&appearance.getAttribute('aria-expanded')==='true','Appearance popover opens');
 intensity.value='0';intensity.dispatchEvent(new Event('input',{bubbles:true}));
 assert(outer.style.getPropertyValue('--outer-intensity')==='0%'&&d.getElementById('outerIntensityValue').textContent==='0%','Zero intensity keeps a neutral frame');
 intensity.value='35';intensity.dispatchEvent(new Event('input',{bubbles:true}));
 assert(outer.style.getPropertyValue('--outer-intensity')==='35%','Intensity changes immediately');
 d.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert(popover.hidden&&appearance.getAttribute('aria-expanded')==='false','Escape closes appearance settings');
 appearance.click();d.body.dispatchEvent(new Event('pointerdown',{bubbles:true}));
 assert(popover.hidden,'Clicking outside closes appearance settings');
 if(d.documentElement.dataset.theme==='day')theme.click();
 theme.click();assert(d.documentElement.dataset.theme==='day'&&theme.getAttribute('aria-label')==='Switch to night mode','Day mode switches without touching album covers');
 theme.click();assert(!d.documentElement.dataset.theme&&theme.getAttribute('aria-label')==='Switch to day mode','Night mode restores');
 theme.click();
 S.draftChanged(all.slice(0,1));
 assert(outer.dataset.activeCorners==='1'&&outer.style.getPropertyValue('--outer-corner-1')!=='transparent'&&[2,3,4].every(i=>outer.style.getPropertyValue(`--outer-corner-${i}`)==='transparent'),'First album colors only top left');
 S.draftChanged(all.slice(0,4));
 assert(outer.dataset.activeCorners==='4'&&[1,2,3,4].every(i=>outer.style.getPropertyValue(`--outer-corner-${i}`)!=='transparent'),'Four albums color all corners');
 await pause(900);
 assert(outer.style.getPropertyValue('--outer-corner-4')===`rgba(${all[3].color.join(',')},.92)`&&getComputedStyle(outer,'::before').backgroundImage.includes('radial-gradient'),'Selected colors appear in the visible frame gradient');
 const previous=outer.style.getPropertyValue('--outer-corner-3');
 S.draftChanged([all[0],all[1],all[12],all[3]]);
 assert(outer.style.getPropertyValue('--outer-corner-3')!==previous&&outer.style.getPropertyValue('--outer-corner-2')===`rgba(${all[1].color.join(',')},.92)`,'Replacing a cornerstone updates its assigned color');
 A.setAlbums(all.slice(0,60));S.enterEditor();A.state.motion=false;A.applySettings({motion:false});
 for(const mode of ['original','color','gradient','alternating','random']){A.state.arrangement=mode;A.renderGrid();assert(d.querySelectorAll('#grid .tile').length===60,mode+' renders 60 tiles');const pinned=[...d.querySelectorAll('#grid .cornerstone img')].map(im=>im.alt);assert(all.slice(0,4).every(a=>pinned.includes(`${a.title} by ${a.artist}`)),mode+' retains cornerstone covers');}
 const oldClick=w.HTMLAnchorElement.prototype.click,downloads=[];w.HTMLAnchorElement.prototype.click=function(){downloads.push({url:this.href,name:this.download});};
 for(const [label,width,height]of [['phone',1290,2796],['desktop',3840,2160]]){await A.saveWallpaper(d.getElementById(label==='phone'?'savePhone':'saveDesktop'),width,height,label);const saved=downloads.at(-1);assert(saved?.name.includes(label),label+' PNG generated');const blob=await(await fetch(saved.url)).blob(),bitmap=await createImageBitmap(blob);assert(bitmap.width===width&&bitmap.height===height,label+' exact pixel dimensions');const testCanvas=document.createElement('canvas');testCanvas.width=width;testCanvas.height=height;const ctx=testCanvas.getContext('2d');ctx.drawImage(bitmap,0,0);assert(ctx.getImageData(width/2,height/2,1,1).data[3]===255,label+' has no transparent center');bitmap.close();}
 w.HTMLAnchorElement.prototype.click=oldClick;
 await S.imported(fixture(w));assert(d.querySelectorAll('.suggestion').length===15,'45 imported → 15 relevant suggestions');
 d.querySelector('.suggestion-actions button:nth-child(2)').click();assert(d.querySelectorAll('.suggestion').length===15,'Replace suggestion replenishes grid');
 d.querySelector('.suggestion-actions button').click();assert(A.state.albums.length===46,'Individual acceptance preserves imported albums');
 d.getElementById('acceptAll').click();assert(A.state.albums.length===60,'Accept all completes exactly 60');assert(C.unique(A.state.albums).length===60,'Completion has no duplicate albums');
 d.getElementById('useCollection').click();await S.save();const stored=await C.get('project');assert(stored.state.albums.length===60&&stored.state.albums[0].art.startsWith('data:'),'IndexedDB retains uploaded artwork');
 await new Promise(resolve=>{frame.onload=resolve;frame.src='/?qa-reload=1';});await pause(250);w=frame.contentWindow;d=w.document;assert(!!d.getElementById('resumeProject'),'Returning visitor offered saved project');assert(!d.getElementById('outerWebsiteFrame').style.getPropertyValue('--outer-corner-1'),'Saved colors remain neutral before resume');assert(d.documentElement.dataset.theme==='day'&&d.getElementById('outerIntensity').value==='35','Theme and frame intensity survive reload');d.getElementById('resumeProject').click();assert(!d.body.classList.contains('onboarding'),'Returning completed collection opens editor');assert(w.CornerstoneApp.state.albums.length===60,'Reload keeps collection');assert(d.getElementById('outerWebsiteFrame').dataset.activeCorners==='4','Resume restores four frame colors');
 assert(d.getElementById('outerWebsiteFrame').style.getPropertyValue('--outer-intensity')==='35%','Saved intensity also applies after resume');
 assert(!d.documentElement.scrollWidth||d.documentElement.scrollWidth<=d.documentElement.clientWidth+1,'No horizontal overflow');
 await new Promise(resolve=>{frame.onload=resolve;frame.src='/?wallpaper=1&qa=1';});await pause(100);w=frame.contentWindow;d=w.document;
 assert(getComputedStyle(d.getElementById('appearanceDock')).display==='none'&&getComputedStyle(d.getElementById('outerWebsiteFrame')).display==='none','Wallpaper-only view hides website chrome');
 d.getElementById('themeToggle').click();d.getElementById('outerIntensity').value='75';d.getElementById('outerIntensity').dispatchEvent(new Event('input',{bubbles:true}));
 log('ALL INTEGRATED CHECKS PASSED');
 }catch(e){log('FAIL '+e.message);console.error(e);}
};
