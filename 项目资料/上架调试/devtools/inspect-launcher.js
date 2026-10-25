const fs=require('fs');
const f='D:/UserFolders/Desktop/qingchuang-pinpin/项目资料/上架调试/devtools/node_modules/miniprogram-automator/out/Launcher.js';
const s=fs.readFileSync(f,'utf8');
console.log('LEN',s.length);
console.log(s);
