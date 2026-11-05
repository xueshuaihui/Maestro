import fs from 'node:fs';
import path from 'node:path';
const words=['task-loop','researcher','writer','reviewer','研究员','撰写者','审核者'];
function walk(d,out=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,out);else if(e.name.endsWith('.js')||e.name.endsWith('.mjs'))out.push(p);}return out;}
const files=[...walk('src/core'),...walk('src/daemon')];
let hits=0;
for(const f of files){
  const lines=fs.readFileSync(f,'utf8').split(/\r?\n/);
  lines.forEach((l,i)=>{for(const w of words){if(l.includes(w)){hits++;console.log(`${f}:${i+1}: [${w}] ${l.trim().slice(0,160)}`);}}});
}
console.log('hits',hits);
