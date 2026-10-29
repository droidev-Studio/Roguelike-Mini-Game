// Static release / deployed-site acceptance through actual browser controls.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {chromium} from 'playwright-core';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return [k,v.join('=')];}));
const out=path.resolve(args.out);await fs.mkdir(out,{recursive:true});
let server;
if(args.dir){
  const root=path.resolve(args.dir);
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg'};
  const release=JSON.parse(await fs.readFile(path.join(root,'release.json'),'utf8'));
  if(release.webProfile?.compiledModules?.length)types['.ts']='text/javascript';
  server=http.createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
}
const base=args.url||`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const errors=[],failedResponses=[],checks=[];let documentRequests=0;
page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame()&&++documentRequests>4){errors.push('Repeated document navigation');page.close().catch(()=>{});}});
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status()});});
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
let release;
try{
  const response=await fetch(new URL('release.json?check='+Date.now(),base));check('release-manifest',response.ok,response.status);release=await response.json();
  if(args.commit)check('deployed-commit',release.commit===args.commit,{expected:args.commit,actual:release.commit});
  for(const [file,expected]of Object.entries(release.files)){
    const r=await fetch(new URL(file+'?release='+release.commit,base));const data=Buffer.from(await r.arrayBuffer());
    check('file-integrity:'+file,r.ok&&crypto.createHash('sha256').update(data).digest('hex')===expected,{status:r.status});
  }
  const documentResponse=await page.goto(base+'?skipOpening=1&skipRunEntry=1&seed=2912',{waitUntil:'domcontentloaded',timeout:90000});
  check('document-http',documentResponse?.ok(),{status:documentResponse?.status(),retryAfter:documentResponse?.headers()['retry-after']});
  await page.waitForFunction(()=>window.gameManager&&window.CampaignRules&&window.SaveManager,null,{timeout:90000});
  check('single-document-startup',documentRequests===1,{documentRequests});
  const scripts=await page.evaluate(()=>Array.from(document.scripts).filter(s=>s.src).map(s=>s.getAttribute('src')));
  check('classic-scripts-match-release',Object.entries(release.files).filter(([file])=>file.endsWith('.js')).every(([file,hash])=>scripts.includes(file+'?v='+hash.slice(0,12))),scripts);
  await page.locator('#start-game-button').click();await page.waitForFunction(()=>gameManager.gameState===1);
  const before=await page.evaluate(()=>({x:gameManager.player.x,y:gameManager.player.y,time:gameManager.gameTime}));
  await page.keyboard.down('d');await page.waitForTimeout(700);await page.keyboard.up('d');
  await page.keyboard.down('s');await page.waitForTimeout(700);await page.keyboard.up('s');
  const after=await page.evaluate(()=>({x:gameManager.player.x,y:gameManager.player.y,time:gameManager.gameTime}));
  check('start-and-movement',after.time>before.time&&Math.hypot(after.x-before.x,after.y-before.y)>10,{before,after});
  await page.locator('[data-action="pause"]').click();
  const time=await page.evaluate(()=>gameManager.gameTime);await page.waitForTimeout(400);
  check('pause',await page.evaluate(t=>gameManager.gameState===2&&gameManager.gameTime===t,time));
  await page.locator('#gameEditorToggle').click();
  await page.locator('#gameEditorSidebar [data-setting="playerHealth"]').waitFor();
  check('editor-module-loads',await page.locator('#gameEditorSidebar').innerText().then(s=>!s.startsWith('Loading editor data')));
  await page.locator('#gameEditorToggle').click();await page.locator('[data-action="resume"]').click();
  await page.waitForTimeout(3000);
  const snapshot=await page.evaluate(()=>({state:gameManager.gameState,time:gameManager.gameTime,enemies:gameManager.enemies.length,embedded:gameManager.enemies.filter(e=>gameManager.isTerrainBlockedAt(e.x,e.y,gameManager.getEnemyTerrainRadius(e),e)).length}));
  check('resumes-and-spawns',snapshot.state===1&&snapshot.time>after.time&&snapshot.enemies>0,snapshot);
  check('no-embedded-enemies',snapshot.embedded===0,snapshot);
  // Controlled births on the actual deployed map, separate from the legal-input smoke.
  await page.locator('[data-action="pause"]').click();
  const births=await page.evaluate(()=>{
    const g=gameManager,results=[];
    for(const obstacle of g.mapObstacles.filter(o=>o.collisionType==='block'&&g.doesTerrainObstacleApplyToEntity(o,{}))){
      const e=new Enemy(obstacle.x,obstacle.y,10);e.x=obstacle.x;e.y=obstacle.y;
      const added=g.addEnemySafely(e),radius=g.getEnemyTerrainRadius(e);
      const clear=added&&!g.isTerrainBlockedAt(e.x,e.y,radius,e);
      const before={x:e.x,y:e.y};if(added)g.moveEnemyWithTerrain(e,1,1);
      results.push({id:obstacle.id,added,clear,moved:Math.hypot(e.x-before.x,e.y-before.y)>.01});
      const index=g.enemies.indexOf(e);if(index>=0)g.enemies.splice(index,1);
    }
    return results;
  });
  check('deployed-terrain-birth-fixture',births.length>0&&births.every(b=>b.added&&b.clear&&b.moved),births);
  await page.locator('[data-action="resume"]').click();
  await page.screenshot({path:path.join(out,'pages-smoke.png')});
  check('browser-errors',errors.length===0,errors);check('http-errors',failedResponses.length===0,failedResponses);
}catch(error){errors.push(error.message);process.exitCode=1;await page.screenshot({path:path.join(out,'pages-failure.png')}).catch(()=>{});}
finally{
  const report={date:new Date().toISOString(),base,release,checks,errors,failedResponses,documentRequests};
  await fs.writeFile(path.join(out,'pages-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
}
