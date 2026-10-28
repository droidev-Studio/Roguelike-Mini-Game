import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.resolve(process.argv[2]||path.join(root,'project-materials/quality/loop-validation'));
await fs.mkdir(out,{recursive:true});
const checks=[
  {name:'syntax',args:['--check','game.js']},
  {name:'typecheck',args:['node_modules/typescript/bin/tsc','--noEmit']},
  {name:'campaign-rules',args:['--test','tools/campaign-rules.test.mjs']},
  {name:'assets',args:['tools/validate-assets.js']},
  {name:'p0-gameplay',args:['tools/p0-gameplay-smoke.js']},
];
const results=[];
for(const c of checks){
  const r=spawnSync(process.execPath,c.args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:12*1024*1024,timeout:180000});
  console.log(`${c.name}: exit ${r.status}`);if(r.status!==0)console.log(r.stdout+'\n'+r.stderr);
  results.push({name:c.name,exitCode:r.status,error:r.error?.message,output:r.stdout,stderr:r.stderr});
}
const hashes={};for(const name of ['game.js','index.html','GameSettings.js','src/rules/CampaignRules.js','src/spec/stages.json','src/spec/waves.json','src/spec/progression.json','src/ui/UIBridge.js','src/ui/game-ui.css'])hashes[name]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex');
const result={at:new Date().toISOString(),root,node:process.version,ok:results.every(c=>c.exitCode===0),checks:results,sha256:hashes};
await fs.writeFile(path.join(out,'validation.json'),JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
