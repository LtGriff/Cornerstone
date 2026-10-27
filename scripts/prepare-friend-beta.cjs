// Mechanical packaging only: the development dist remains unchanged.
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../dist');
const publisher=path.resolve(__dirname,'../../cornerstone-pages-publish');
const docs=path.join(publisher,'docs');
if(!fs.existsSync(path.join(publisher,'.git'))||!fs.existsSync(path.join(docs,'.nojekyll')))throw new Error('Expected Cornerstone publishing worktree was not found.');
for(const name of ['index.html','core.js','studio.js','studio.css','beta-ui.js'])fs.copyFileSync(path.join(source,name),path.join(docs,name));
fs.writeFileSync(path.join(docs,'beta-config.js'),"window.CornerstoneConfig=Object.freeze({release:'friend-beta'});document.documentElement.classList.add('friend-beta');\n");
fs.writeFileSync(path.join(docs,'top-songs.js'),'window.TOP_SONGS=[]; // No third-party chart artwork in the shared beta.\n');
fs.writeFileSync(path.join(docs,'wallpaper.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>Cornerstone</title><meta http-equiv="refresh" content="0;url=index.html"><script>location.replace("index.html")</script></html>\n');
for(const name of ['tres-desktop.jpg','tres-phone.jpg']){
  const target=path.join(docs,'assets',name);
  if(fs.existsSync(target))fs.rmSync(target);
}
for(const name of ['BETA-TESTER-GUIDE.md','BETA-RELEASE-CHECKLIST.md'])fs.copyFileSync(path.resolve(__dirname,'..',name),path.join(publisher,name));
console.log('Prepared original-visual friend beta in '+docs);
