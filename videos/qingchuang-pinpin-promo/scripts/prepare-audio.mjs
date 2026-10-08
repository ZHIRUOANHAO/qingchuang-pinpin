import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const meta=JSON.parse(readFileSync('audio_meta.json','utf8'));
for(const v of meta.voices){
  const source=v.path;
  const target=source.replace('.mp3','.wav');
  const duration=Math.ceil((v.words.at(-1).end+.6)*30)/30;
  const r=spawnSync(ffmpegInstaller.path,['-hide_banner','-y','-i',source,'-af',`loudnorm=I=-16:TP=-1.5:LRA=7,apad,atrim=duration=${duration}`,'-ar','48000','-ac','2','-c:a','pcm_s16le',target],{encoding:'utf8'});
  if(r.status!==0)throw new Error(r.stderr);
  const probe=spawnSync(ffprobeInstaller.path,['-v','error','-show_entries','format=duration','-of','json',target],{encoding:'utf8'});
  if(probe.status!==0)throw new Error(probe.stderr);
  const measured=+JSON.parse(probe.stdout).format.duration;
  if(Math.abs(measured-duration)>.002)throw new Error('Unexpected length '+target);
  v.path=target;v.duration_s=+duration.toFixed(6);v.source='host';
}
meta.total_duration_s=meta.voices.reduce((s,v)=>s+v.duration_s,0);
writeFileSync('audio_meta.json',JSON.stringify(meta,null,2));
console.log(JSON.stringify({frames:meta.voices.length,duration:meta.total_duration_s,voices:meta.voices.map(v=>({frame:v.frame,duration:v.duration_s}))}));
