import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const audit=JSON.parse(readFileSync(resolve(root,'renders/delivery-audit.json'),'utf8').replace(/^\uFEFF/,''));
const ffmpeg=resolve(root,'node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
const folder=resolve(root,'renders/verification');mkdirSync(folder,{recursive:true});
const shots=[{time:2.8,name:'encoded-hook.png',reference:'frame-00-at-2.8s.png'},{time:48.8,name:'encoded-close.png',reference:'frame-22-at-48.792s.png'}];
for(const shot of shots){
 const destination=resolve(folder,shot.name);
 let result=spawnSync(ffmpeg,['-v','error','-y','-ss',String(shot.time),'-i',audit.output,'-frames:v','1',destination],{encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr);
 result=spawnSync(ffmpeg,['-hide_banner','-i',resolve(root,'snapshots',shot.reference),'-i',destination,'-lavfi','ssim','-f','null','NUL'],{encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr);
 const match=result.stderr.match(/All:([\d.]+)/);
 shot.ssim=match?Number(match[1]):null;
 if(shot.ssim===null||shot.ssim<.97)throw Error('Encoded image differs from reviewed composition: '+JSON.stringify(shot));
}
const desktopHash=createHash('sha256').update(readFileSync(audit.desktop)).digest('hex').toUpperCase();
if(desktopHash!==audit.sha256)throw Error('Desktop artifact changed');
const report={version:'0.1',last_updated:'2026-10-08',desktop:audit.desktop,desktop_bytes:statSync(audit.desktop).size,desktop_sha256:desktopHash,reviewed_shots:shots,accepted:true};
writeFileSync(resolve(folder,'encoded-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
