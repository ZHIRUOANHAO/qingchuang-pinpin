import {readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const audio=JSON.parse(readFileSync(resolve(root,'audio_meta.json'),'utf8'));
const duration=n=>audio.voices.find(v=>v.frame===n).duration_s;
const word=(n,text,fallback)=>audio.voices.find(v=>v.frame===n).words.find(w=>w.text===text)?.start??fallback;
// Repair CSS identifiers beginning with a digit without changing composition IDs.
const hookPath=resolve(root,'compositions/frames/01-hook.html');
let hook=readFileSync(hookPath,'utf8');
hook=hook.replace(/<style>([\s\S]*?)<\/style>/,(_,css)=>'<style>'+css.replace(/([.#])(01-hook-[\w-]+)/g,(_,sig,id)=>sig==='#'?`[id="${id}"]`:`[class~="${id}"]`)+'</style>');
hook=hook.replace(/'#(01-hook-[\w-]+)'/g,(_,id)=>`'[id="${id}"]'`);
writeFileSync(hookPath,hook);
const ids={5:'05-canvas',6:'06-experiment',7:'07-record',8:'08-close'};
function render(n,body,css,actions){
 const id=ids[n], d=duration(n), cls='f'+n;
 const common=`
 @font-face{font-family:'Promo CJK';src:url('assets/fonts/promo-cjk.ttf') format('truetype');font-weight:400 900;font-display:block}
 #root{position:relative;width:100%;height:100%;overflow:hidden;container-type:size;font-family:'Promo CJK';color:#243E3B}
 #root *{box-sizing:border-box}
 .${cls}-ground{position:absolute;inset:0;background:#FFF9EF}
 .${cls}-stage{position:absolute;inset:0}
 .${cls}-tag{position:absolute;left:7.4cqw;top:3.8cqh;padding:1.2cqw 2.2cqw;border:3px solid #243E3B;border-radius:100px;background:#2E7770;color:white;font-size:3.7cqw;line-height:1.2}
 .${cls}-title{position:absolute;left:7.4cqw;top:8.5cqh;margin:0;font-size:7.8cqw;line-height:1.15;font-weight:700;letter-spacing:.015em}
 .${cls}-provenance{position:absolute;left:7.4cqw;top:14.4cqh;margin:0;font-size:3.15cqw;line-height:1.25;color:#536D68}
 .${cls}-reader{position:absolute;overflow:hidden;border:3px solid #243E3B;border-radius:28px;background:#091019;box-shadow:6px 6px 0 #243E3B}
 .${cls}-reader img{display:block;width:100%;height:auto;max-width:none}
 .${cls}-paper{border:3px solid #243E3B;border-radius:20px;background:#F6E9C9;box-shadow:5px 5px 0 #243E3B}
 .${cls}-art{position:absolute;left:8.3cqw;top:18cqh;width:83.4cqw;height:83.4cqw;border:3px solid #243E3B;border-radius:28px;overflow:hidden;box-shadow:6px 6px 0 #243E3B}
 .${cls}-atlas{position:absolute;top:0;width:300%;max-width:none;height:100%;object-fit:fill}
 .${cls}-marker{position:absolute;left:-1cqw;bottom:0;width:calc(100% + 2cqw);height:2.3cqw;background:#E2B953;z-index:-1;transform-origin:left center;border-radius:4px}
 .${cls}-star{position:absolute;right:2.4cqw;top:4cqh;width:8.5cqw;height:8.5cqw}
 ${css}`;
 const html=`<template>
 <style>${common}</style>
 <div id="root" data-composition-id="${id}" data-duration="${d}" data-width="1080" data-height="1920">
 <div class="clip ${cls}-ground" data-start="0" data-duration="${d}" data-track-index="0"></div>
 <div class="clip ${cls}-stage" data-start="0" data-duration="${d}" data-track-index="1">
 <svg class="${cls}-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8Q55 43 92 50Q57 56 50 92Q44 57 8 50Q44 44 50 8Z" fill="#AEE0DB" stroke="#243E3B" stroke-width="3"/></svg>
 ${body.replaceAll('$ID',id).replaceAll('$CLS',cls)}
 </div></div>
 <script src="assets/gsap.min.js"></script>
 <script>(function(){
 const tl=gsap.timeline({paused:true});
 const el=name=>document.getElementById('${id}-'+name);
 const enter=(name,time,dx=0)=>tl.fromTo(el(name),{opacity:0,x:dx,y:20},{opacity:1,x:0,y:0,duration:.32,ease:'power3.out'},time);
 ${actions}
 window.__timelines=window.__timelines||{};window.__timelines['${id}']=tl;
 })();</script></template>`;
 writeFileSync(resolve(root,'compositions/frames',id+'.html'),html);
}
render(5,`
 <div class="$CLS-tag">03 / 画布</div><h1 class="$CLS-title" id="$ID-title">加入画布</h1>
 <p class="$CLS-provenance">本地产品演示 · 从案例到方案</p>
 <div id="$ID-reader" class="$CLS-reader"><img src="assets/04-canvas.png" alt="实际商业画布，七个节点与待实测状态"/></div>
 <svg id="$ID-lines" class="f5-lines" viewBox="0 0 870 110" aria-hidden="true"><path id="$ID-line-a" d="M230 55H330"/><path id="$ID-line-b" d="M540 55H640"/></svg>
 <div id="$ID-offer" class="f5-chip f5-a $CLS-paper">卖点</div><div id="$ID-acquire" class="f5-chip f5-b $CLS-paper">获客</div><div id="$ID-deliver" class="f5-chip f5-c $CLS-paper">交付</div>
 <div id="$ID-note" class="f5-note">方案待实测 <span class="f5-question">?</span></div>`,
 `.f5-reader{left:16.7cqw;top:18cqh;width:66.6cqw;height:49.8cqh}
 .f5-lines{position:absolute;left:10cqw;top:69cqh;width:80cqw;height:10cqw;overflow:visible}.f5-lines path{fill:none;stroke:#2E7770;stroke-width:6;stroke-linecap:round}
 .f5-chip{position:absolute;top:69cqh;width:20cqw;height:10cqw;display:grid;place-items:center;font-size:4.6cqw}.f5-a{left:10cqw}.f5-b{left:40cqw}.f5-c{left:70cqw}
 .f5-note{position:absolute;left:26cqw;top:77cqh;font-size:5cqw;line-height:1.25}.f5-question{display:inline-grid;place-items:center;width:6.5cqw;height:6.5cqw;background:#E2B953;border-radius:50%;border:3px solid #243E3B;font-size:4.5cqw}`,
 `enter('title',0);enter('reader',.12);
 enter('offer',${word(5,'卖点',2.35)},-25);enter('acquire',${word(5,'获客',3.11)},-25);enter('deliver',${word(5,'交付',3.68)},-25);
 ['line-a','line-b'].forEach((name,i)=>{const p=el(name),l=p.getTotalLength();p.style.strokeDasharray=l;tl.fromTo(p,{strokeDashoffset:l},{strokeDashoffset:0,duration:.32,ease:'power2.out'},i===0?3.1:3.67)});
 enter('note',4.34);`);
render(6,`
 <div class="$CLS-tag">04 / 小实验</div><h1 class="$CLS-title" id="$ID-title">一页原创样张</h1>
 <p class="$CLS-provenance">先把测试门槛降下来</p>
 <div id="$ID-art" class="$CLS-art"><img class="$CLS-atlas" style="left:-100%" src="assets/story-atlas.png" alt="同一短发卡通女性认真整理原创纸卡"/></div>
 <div id="$ID-three" class="f6-three $CLS-paper">3人试填</div><p id="$ID-sensitive" class="f6-sensitive">使用非敏感任务</p>
 <div class="f6-evidence"><span id="$ID-time">耗时</span><span id="$ID-block">卡点</span><span id="$ID-quote">原话</span></div>
 <p id="$ID-status" class="f6-status">实验建议 · 未执行</p>`,
 `.f6-three{position:absolute;left:8.3cqw;top:67.7cqh;width:39cqw;padding:1.6cqw 1cqw;text-align:center;font-size:5.5cqw;transform:rotate(-2deg)}
 .f6-sensitive{position:absolute;left:51cqw;top:68.5cqh;font-size:3.4cqw;line-height:1.3;margin:0}
 .f6-evidence{position:absolute;left:8.3cqw;top:74cqh;width:83.4cqw;display:flex;gap:2.5cqw}.f6-evidence span{flex:1;text-align:center;padding:1.7cqw;border:3px solid #243E3B;border-radius:20px;background:#AEE0DB;font-size:4.6cqw;box-shadow:4px 4px 0 #243E3B}
 .f6-status{position:absolute;left:8.3cqw;top:80cqh;margin:0;font-size:3.1cqw;color:#536D68;line-height:1.2}`,
 `enter('title',0);enter('art',.12);enter('three',2.46,-25);enter('sensitive',2.85);
 enter('time',${word(6,'耗时',3.92)},-18);enter('block',${word(6,'卡点',4.62)},-18);enter('quote',${word(6,'原话',5.15)},-18);enter('status',5.35);`);
render(7,`
 <div class="$CLS-tag">05 / 验证记录</div><h1 class="$CLS-title" id="$ID-title">存下计划</h1>
 <p class="$CLS-provenance">本地产品演示 · 计划尚未执行</p>
 <div id="$ID-reader" class="$CLS-reader"><img src="assets/06-plan-saved.png" alt="真实验证记录页，未执行计划和当前浏览器保存反馈"/></div>
 <div class="f7-decisions"><span id="$ID-continue">继续</span><span id="$ID-adjust">调整</span><span id="$ID-pause">暂停</span></div>
 <div id="$ID-proof" class="f7-proof">先找证据<span id="$ID-marker" class="$CLS-marker" aria-hidden="true"></span></div>
 <p id="$ID-local" class="f7-local">仅当前设备保存 · 试过以后再决定</p>`,
 `.f7-reader{left:18.7cqw;top:17.8cqh;width:62.6cqw;height:60.7cqw}
 .f7-reader img{transform:translateY(-45.2%)}
 .f7-decisions{position:absolute;left:9cqw;top:57.5cqh;width:82cqw;display:flex;gap:2cqw}.f7-decisions span{flex:1;font-size:4.4cqw;padding:1.9cqw;text-align:center;border:3px solid #243E3B;border-radius:18px;background:#FFF9EF;box-shadow:4px 4px 0 #243E3B}
 .f7-proof{position:absolute;left:20cqw;top:66.3cqh;font-size:9cqw;line-height:1.15;isolation:isolate}
 .f7-local{position:absolute;left:9cqw;top:77.4cqh;margin:0;font-size:3.3cqw;line-height:1.3}`,
 `enter('title',0);enter('reader',.1);enter('continue',${word(7,'继续',3.41)},-20);enter('adjust',${word(7,'调整',4.51)},-20);enter('pause',5.03,-20);
 enter('proof',6.64);tl.fromTo(el('marker'),{scaleX:0},{scaleX:1,duration:.42,ease:'power2.out'},7.05);enter('local',7.35);`);
render(8,`
 <div id="$ID-brand" class="f8-brand"><img src="assets/brand-mark.svg" alt="轻创拼拼品牌标记"/><h1>轻创拼拼</h1></div>
 <div id="$ID-art" class="$CLS-art"><img class="$CLS-atlas" style="left:-200%" src="assets/story-atlas.png" alt="同一人物微笑展示原创纸张，准备下一步"/></div>
 <div id="$ID-select" class="f8-select">选一个案例</div>
 <div id="$ID-next" class="f8-next $CLS-paper">拼出下一步</div>
 <p class="f8-disclaimer">产品演示 · 案例学习不构成收益承诺</p>`,
 `.f8-brand{position:absolute;left:17cqw;top:4.5cqh;display:flex;gap:2.8cqw;align-items:center}.f8-brand img{width:10cqw;height:10cqw}.f8-brand h1{font-size:8.8cqw;line-height:1.1;margin:0}
 .f8-art{top:14cqh}
 .f8-select{position:absolute;left:28cqw;top:65cqh;font-size:6.1cqw;line-height:1.2}
 .f8-next{position:absolute;left:17cqw;top:70.8cqh;width:66cqw;text-align:center;padding:2cqw;font-size:7cqw;line-height:1.25;background:#E2B953;transform:rotate(-2deg)}
 .f8-disclaimer{position:absolute;left:8cqw;top:79.8cqh;margin:0;font-size:3.1cqw;line-height:1.25}`,
 `enter('brand',0);enter('art',.12);enter('select',1.76);enter('next',3.18,-28);`);
// Quiet, licensed bundled punctuation; no music bed and no fake success sounds.
audio.sfx=[{frame:5,file:'.media/audio/sfx/sfx_001.mp3',offset_s:.98,duration_s:.4,volume:.13},{frame:8,file:'.media/audio/sfx/sfx_002.mp3',offset_s:.12,duration_s:2.5,volume:.07}];
writeFileSync(resolve(root,'audio_meta.json'),JSON.stringify(audio,null,2)+'\n');
const sbPath=resolve(root,'STORYBOARD.md');
const storyboard=readFileSync(sbPath,'utf8').replace(/duration: 50s/,'duration: 50.3s').replaceAll('- status: outline','- status: animated');
writeFileSync(sbPath,storyboard);
console.log('Frames 05–08 generated; frame 01 selectors repaired; eight frames marked built; audio cues mounted.');
