import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const name of readdirSync(resolve(root,'compositions/frames'))){
 if(!/^\d\d-.*\.html$/.test(name))continue;
 const id=name.slice(0,-5),p=resolve(root,'compositions/frames',name);
 let html=readFileSync(p,'utf8');
 if(!html.includes('id="f'+id+'-'))html=html.replaceAll(id+'-','f'+id+'-');
 html=html.replace(/<style>([\s\S]*?)<\/style>/,(_,css)=>'<style>'+css.replace(/\[id="(f[\w-]+)"\]/g,(_,key)=>'#'+key).replace(/z-index:\s*-1/g,'z-index: 0')+'</style>');
 html=html.replace(/<div class="clip (f\d-ground)"/g,`<div id="f${id}-ground" class="clip $1"`);
 html=html.replace(/<div class="clip (f\d-stage)"/g,`<div id="f${id}-stage" class="clip $1"`);
 if(id==='01-hook')html=html.replace('<div class="clip f01-hook-ground"','<div id="f01-hook-ground" class="clip f01-hook-ground"');
 writeFileSync(p,html);
}
const p=resolve(root,'index.html');
let index=readFileSync(p,'utf8').replace('id="el-captions"','id="el-captions" data-track-kind="captions"');
writeFileSync(p,index);
console.log('Stable letter-prefixed selectors and caption-track semantics applied.');
