// Bundle Vite modules and retain the classic-script runtime/spec/asset paths.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.argv[2]||path.join(root,'_site'));
if(out===root || root.startsWith(out+path.sep))throw new Error('Release output must not contain the source project');
execFileSync(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build','--base=./','--outDir',out],{cwd:root,stdio:'inherit'});
const runtime=['game.js','game.css','GameSettings.js','AssetRuntime.js','AudioManager.js','SaveManager.js'];
for(const file of runtime)await fs.copyFile(path.join(root,file),path.join(out,file));
for(const dir of ['assets','src','vendor'])await fs.cp(path.join(root,dir),path.join(out,dir),{
  recursive:true,
  filter:source=>!path.relative(root,source).split(path.sep).includes('_archive'),
});
await fs.writeFile(path.join(out,'.nojekyll'),'');
const files={};
for(const file of ['index.html',...runtime,'src/ui/UIBridge.js','src/rules/CampaignRules.js','assets/manifest.json']){
  const bytes=await fs.readFile(path.join(out,file));
  files[file]=crypto.createHash('sha256').update(bytes).digest('hex');
}
const commit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
await fs.writeFile(path.join(out,'release.json'),JSON.stringify({commit,builtAt:new Date().toISOString(),files},null,2));
console.log('Pages artifact ready: '+out);
