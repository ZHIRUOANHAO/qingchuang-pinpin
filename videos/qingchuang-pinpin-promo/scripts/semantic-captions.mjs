import {readFileSync,writeFileSync} from 'node:fs';
const meta=JSON.parse(readFileSync('audio_meta.json','utf8'));
const plan=JSON.parse(readFileSync('story.json','utf8'));
let base=0;const groups=[];
const plain=s=>s.replace(/[\p{P}\p{Z}\s]/gu,'');
for(const voice of meta.voices){
  const scene=plan.scenes.find(s=>s.frame===voice.frame);
  const source=plain(scene.text), spoken=voice.words.map(w=>plain(w.text)).join('');
  if(source!==spoken)throw new Error('Caption alignment text mismatch: '+voice.frame);
  const phrases=scene.text.match(/[^，。？！]+[，。？！]?/g);
  let wi=0;
  for(const phrase of phrases){
    const wanted=plain(phrase);let got='';const words=[];
    while(got.length<wanted.length){
      const w=voice.words[wi++];if(!w)throw new Error('Missing boundary');
      got+=plain(w.text);words.push({...w,start:base+w.start,end:base+w.end});
    }
    if(got!==wanted)throw new Error('Boundary crossed caption phrase: '+phrase);
    groups.push({id:'caption-group-'+groups.length,frame:voice.frame,start:words[0].start,
      end:Math.min(base+voice.duration_s,words.at(-1).end+.18),text:phrase,words});
  }
  base+=voice.duration_s;
}
for(let i=0;i<groups.length-1;i++)groups[i].end=Math.min(groups[i].end,groups[i+1].start);
const output={version:'0.1',last_updated:'2026-10-08',total_duration_s:base,width:1080,height:1920,groups};
writeFileSync('caption_groups.json',JSON.stringify(output,null,2));
let html=readFileSync('compositions/captions.html','utf8');
html=html.replace(/var GROUPS = \[[\s\S]*?\];/,()=>`var GROUPS = ${JSON.stringify(groups)};`);
writeFileSync('compositions/captions.html',html);
console.log(`${groups.length} punctuation-aware Chinese captions, ${base.toFixed(3)}s; native provider word boundaries, no evenly-spaced timestamps.`);
