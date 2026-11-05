import fs from 'node:fs';
const p='docs/iterations/iteration-3/requirement.md';
const txt=fs.readFileSync(p,'utf8');
const lines=txt.split(/\r?\n/);
// AC headings
const acHead=[...txt.matchAll(/^#### AC-(\d+) /gm)].map(m=>Number(m[1]));
console.log('AC headings count',acHead.length,'first',acHead[0],'last',acHead.at(-1));
const missing=[];for(let i=1;i<=45;i++)if(!acHead.includes(i))missing.push(i);
console.log('missing AC',missing);
const dup=acHead.filter((v,i)=>acHead.indexOf(v)!==i);console.log('dup AC',dup);
// all refs
const refs={};
for(const kind of ['AC','BR','M','C','D','R','B','A','NFR']){
  const re=new RegExp(`\\b${kind}-(\\d+)\\b`,'g');
  const set=new Set();let m;
  while((m=re.exec(txt)))set.add(Number(m[1]));
  refs[kind]=[...set].sort((a,b)=>a-b);
  const max=Math.max(...refs[kind]);
  const miss=[];for(let i=1;i<=max;i++)if(!set.has(i))miss.push(i);
  console.log(kind,'max',max,'missing',miss.join(',')||'none','count',set.size);
}
// scenario list in 3.3 line
const line33=lines.find(l=>l.includes('`doc-pass`、`doc-backflow-once`'));
const scen33=[...line33.matchAll(/`([a-z0-9-]+)`/g)].map(m=>m[1]);
console.log('scen33',scen33.length,scen33.join(','));
// D-9 table rows
const d9start=lines.findIndex(l=>l.includes('**场景表（29 个）**'));
const d9rows=[];
for(let i=d9start+2;i<lines.length;i++){
  const l=lines[i];
  if(l.startsWith('| `')) { d9rows.push(/^\| `([^`]+)`/.exec(l)[1]); }
  else if(l.startsWith('**必须同步')) break;
}
console.log('d9',d9rows.length,d9rows.join(','));
console.log('only33',scen33.filter(s=>!d9rows.includes(s)));
console.log('onlyD9',d9rows.filter(s=>!scen33.includes(s)));
// order diff
console.log('sameOrder',JSON.stringify(scen33)===JSON.stringify(d9rows));
// scenario names referenced in AC
const referenced=new Set([...txt.matchAll(/场景 ?`?([a-z]+-[a-z-]+)/g)].map(m=>m[1]));
console.log('refs not in list',[...referenced].filter(s=>!scen33.includes(s)&&s.includes('-')).join(','));
fs.writeFileSync('probe/rv3-stats.json',JSON.stringify({acHead,refs,scen33,d9rows},null,1));
