// Build lightweight copies of the user's supplied examples without changing their composition.
const path=require('node:path');
const sharp=require(process.env.CORNERSTONE_NODE_MODULES ? path.join(process.env.CORNERSTONE_NODE_MODULES,'sharp') : 'sharp');
const fs=require('node:fs');
(async()=>{for(const [name,width]of [['desktop',1920],['phone',645]]){
  const source=path.join('source-assets',`tres-${name}.png`);
  const filename=path.join('dist','assets',`tres-${name}`);
  await sharp(source).resize({width,withoutEnlargement:true}).jpeg({quality:84,mozjpeg:true}).toFile(filename+'.jpg');
  console.log(name,fs.statSync(filename+'.jpg').size);
}})().catch(e=>{console.error(e);process.exitCode=1;});
