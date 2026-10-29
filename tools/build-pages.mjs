// Bundle Vite modules and retain the classic-script runtime/spec/asset paths.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build as viteBuild} from 'vite';
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
let webProfile;
if(process.argv.includes('--optimize-web')){
  execFileSync('python',[path.join(root,'tools/optimize-web-assets.py'),out],{cwd:root,stdio:'inherit'});
  const bundle=await viteBuild({configFile:false,root,publicDir:false,logLevel:'silent',build:{write:false,lib:{entry:path.join(root,'src/core/SpecLoader.ts'),formats:['es']},minify:false}});
  const output=(Array.isArray(bundle)?bundle[0]:bundle).output.find(o=>o.type==='chunk'&&o.isEntry);
  if(!output)throw new Error('Spec loader bundle missing');
  await fs.writeFile(path.join(out,'src/core/SpecLoader.ts'),output.code);
  webProfile={assets:'web-optimization.json',compiledModules:['src/core/SpecLoader.ts']};
}
const files={};
for(const file of [...runtime,'src/ui/UIBridge.js','src/rules/CampaignRules.js','assets/manifest.json',...(webProfile?['src/core/SpecLoader.ts','web-optimization.json']:[])]){
  const bytes=await fs.readFile(path.join(out,file));
  files[file]=crypto.createHash('sha256').update(bytes).digest('hex');
}
let html=await fs.readFile(path.join(out,'index.html'),'utf8');
for(const [file,hash]of Object.entries(files)){
  if(file.endsWith('.js'))html=html.replaceAll(`src="${file}"`,`src="${file}?v=${hash.slice(0,12)}"`);
}
await fs.writeFile(path.join(out,'index.html'),html);
files['index.html']=crypto.createHash('sha256').update(html).digest('hex');
const commit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
await fs.writeFile(path.join(out,'release.json'),JSON.stringify({commit,builtAt:new Date().toISOString(),files,...(webProfile?{webProfile}:{})},null,2));
console.log('Pages artifact ready: '+out);
