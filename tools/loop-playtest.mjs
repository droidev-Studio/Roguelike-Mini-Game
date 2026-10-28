// Browser playtest: real time and legal inputs only. No HP, time, XP or entity injection.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return [k,v.join('=')||true];}));
const out=path.resolve(String(args.out||'project-materials/quality/loop-playtest'));
const duration=Number(args.seconds||180),label=String(args.label||'play'),seed=String(args.seed||'2901');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:960}});
const errors=[],abortedRequests=[],samples=[],actions=[];let held=new Set(),lastSample=-10,lastStage=-1,lastState=-1;
page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{const message=r.url()+': '+r.failure()?.errorText;if(r.failure()?.errorText==='net::ERR_ABORTED')abortedRequests.push(message);else errors.push(message);});
async function keys(next){for(const k of held)if(!next.includes(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=new Set(next);}
const observe=()=>page.evaluate(()=>{
  const g=window.gameManager,p=g?.player;
  return {state:g?.gameState,time:g?.gameTime||0,stage:g?.currentStage,stageSpec:window.__RUNTIME_SPEC_CONFIG__?.stages?.stages?.[g?.currentStage],
    player:p?{x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,speed:p.speed,level:p.level,exp:p.exp,next:p.expToNextLevel,skills:p.inGameSkills,weapons:p.weapons.map(w=>({type:w.type,level:w.level,damage:w.damage}))}:null,
    enemies:(g?.enemies||[]).map(e=>({x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,size:e.size,isBoss:e.isBoss,isFinalBoss:e.isFinalBoss,isMiniBoss:e.isMiniBoss,isProp:e.isProp,type:e.type,bossIndex:e.stageIndex,state:e.state,lockedDirX:e.lockedDirX,lockedDirY:e.lockedDirY,castRemaining:e.castRemaining,lockedAbilityTarget:e.lockedAbilityTarget})),
    projectiles:(g?.projectiles||[]).filter(p=>p.isEnemyProjectile).map(p=>({x:p.x,y:p.y,dx:p.dx,dy:p.dy,speed:p.speed})),fire:(g?.fireAreas||[]).map(f=>({x:f.x,y:f.y,radius:f.radius})),
    pickups:(g?.pickups||[]).map(p=>({x:p.x,y:p.y,type:p.type,value:p.expValue})),
    options:(g?.levelUpOptions||[]).map(o=>({type:o.type,title:o.title,description:o.desc,weaponType:o.weaponType,weaponLevel:o.weaponLevel,key:o.skillKey})),
    world:{width:g?.getWorldWidth(),height:g?.getWorldHeight(),left:g?.getViewportLeft(),top:g?.getViewportTop()},canvas:{width:g?.canvas.width,height:g?.canvas.height,rect:g?.canvas.getBoundingClientRect().toJSON()},
    obstacles:(g?.mapObstacles||[]).filter(o=>o.collisionType==='block'&&g.doesTerrainObstacleApplyToEntity(o,p)).map(o=>({shape:o.shape,x:o.x,y:o.y,radius:o.radius,radiusX:o.radiusX,radiusY:o.radiusY,width:o.width,height:o.height})),
    terrainViolations:(g?.enemies||[]).filter(e=>!e.isProp&&g.isTerrainBlockedAt(e.x,e.y,g.getEnemyTerrainRadius(e),e)).map(e=>({type:e.type,x:e.x,y:e.y,size:e.size})),
    ui:document.body.innerText.slice(0,900),specs:window.__SPEC_CONFIG_APPLIED__};
});
function direction(s){
  const p=s.player,foes=s.enemies.filter(e=>!e.isProp&&e.hp>0),loot=s.pickups;
  const options=[[0,0,[]],[1,0,['d']],[-1,0,['a']],[0,1,['s']],[0,-1,['w']],[.707,.707,['d','s']],[.707,-.707,['d','w']],[-.707,.707,['a','s']],[-.707,-.707,['a','w']]];
  let best={score:-Infinity,keys:[]};
  const speed=Number.isFinite(p.speed)?p.speed:200;
  for(const [dx,dy,k]of options){const x=p.x+dx*speed*.28,y=p.y+dy*speed*.28;let score=0;
    if(x<40||y<40||x>s.world.width-40||y>s.world.height-40)score-=1000;
    for(const e of foes){const d=Math.hypot(x-e.x,y-e.y),safe=(e.size||20)*.5+24;score-=Math.max(0,65-d)*.15;if(d<safe)score-=(safe-d)*4+20;}
    for(const o of s.obstacles){let blocked;
      if(o.shape==='circle')blocked=Math.hypot(x-o.x,y-o.y)<(o.radius||40)+22;
      else if(o.shape==='ellipse')blocked=((x-o.x)/((o.radiusX||80)+22))**2+((y-o.y)/((o.radiusY||40)+22))**2<=1;
      else {const qx=Math.max(o.x-(o.width||80)/2,Math.min(x,o.x+(o.width||80)/2)),qy=Math.max(o.y-(o.height||60)/2,Math.min(y,o.y+(o.height||60)/2));blocked=Math.hypot(x-qx,y-qy)<=22;}
      if(blocked)score-=160;
    }
    for(const q of s.projectiles){const dist=Math.hypot(x-q.x-q.dx*q.speed*.16,y-q.y-q.dy*q.speed*.16);score-=Math.max(0,65-dist)*2;}
    for(const f of s.fire)if(Math.hypot(x-f.x,y-f.y)<f.radius+15)score-=200;
    for(const e of foes){if(e.castRemaining>0&&e.lockedAbilityTarget&&Math.hypot(x-e.lockedAbilityTarget.x,y-e.lockedAbilityTarget.y)<75)score-=120;
      if(['windup','cast'].includes(e.state)&&e.lockedDirX!==undefined){const px=x-e.x,py=y-e.y,forward=px*e.lockedDirX+py*e.lockedDirY,side=Math.abs(px*e.lockedDirY-py*e.lockedDirX);if(forward>0&&forward<600&&side<55)score-=200;}}
    if(loot.length){const nearest=Math.min(...loot.map(q=>Math.hypot(x-q.x,y-q.y)));score-=nearest*.14;}
    else if(foes.length){const nearest=Math.min(...foes.map(e=>Math.hypot(x-e.x,y-e.y)));const desired=p.weapons.some(w=>w.type==='crossbow')?140:72;score-=Math.abs(nearest-desired)*.28;}
    score-=Math.hypot(x-s.world.width/2,y-s.world.height/2)*.0003;
    if(score>best.score)best={score,keys:k};
  }return best.keys;
}
function choice(s){return s.options.map((o,i)=>{
  let score=0;const t=o.title||'',has=s.player.weapons.some(w=>w.type===o.weaponType);
  if(o.weaponType)score+=has?45: s.player.weapons.length<3?35:4;
  if(/青釭|弩|太平/.test(t))score+=8;
  if(/伤害|冷却|会心|破军/.test(t))score+=18;
  if(/生命|青囊|回血/.test(t))score+=s.player.hp/s.player.maxHp<.65?100:4;
  if(/吸附|经验|移速/.test(t))score+=10;
  return {i,score};}).sort((a,b)=>b.score-a.score)[0]?.i||0;}
try{
  await page.goto(String(args.url||'http://127.0.0.1:5173/')+`?seed=${seed}&skipOpening=1`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2500);
  await page.waitForFunction(()=>!!window.gameManager&&!!document.querySelector('#start-game-button'),{timeout:30000});
  if(args.difficulty==='easy'){
    await page.locator('#gameEditorToggle').click();
    for(const key of ['playerIntensity','gameHard','drops','level'])await page.locator(`[data-setting="${key}"][data-choice="easy"]`).click();
    await page.locator('#gameEditorToggle').click();actions.push({type:'difficulty',value:'easy',method:'existing visible editor controls; health unchanged'});
  }
  await page.screenshot({path:path.join(out,label+'-menu.png')});
  await page.locator('#start-game-button').click();await page.waitForFunction(()=>gameManager.gameState===1,null,{timeout:15000});
  await page.screenshot({path:path.join(out,label+'-start.png')});
  await page.locator('[data-action="pause"]').click();await page.waitForFunction(()=>gameManager.gameState===2);const paused=await observe();await page.waitForTimeout(500);const after=await observe();actions.push({type:'pause',frozen:Math.abs(paused.time-after.time)<.001});await page.locator('[data-action="resume"]').click();
  const start=Date.now();
  while(Date.now()-start<duration*1000){
    const s=await observe();
    if(s.time-lastSample>=10||s.stage!==lastStage||s.state!==lastState){samples.push(s);lastSample=s.time;lastStage=s.stage;lastState=s.state;console.log(JSON.stringify({label,time:+s.time.toFixed(1),state:s.state,stage:s.stage,hp:s.player?.hp,level:s.player?.level,enemies:s.enemies.length,options:s.options}));await fs.writeFile(path.join(out,label+'-live.json'),JSON.stringify({samples,actions,errors,abortedRequests},null,2));if(s.stage!==samples.at(-2)?.stage)await page.screenshot({path:path.join(out,label+'-stage-'+(s.stage+1)+'.png')});}
    if([4,5].includes(s.state)){await keys([]);await page.screenshot({path:path.join(out,label+'-outcome.png')});break;}
    if(s.state===3){await keys([]);const i=choice(s);actions.push({time:s.time,type:'upgrade',index:i,option:s.options[i]});await page.keyboard.press(String(i+1),{delay:100});await page.waitForTimeout(100);continue;}
    if(s.state===1){
      await keys(direction(s));
      const target=s.enemies.filter(e=>!e.isProp).sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];
      if(target){const r=s.canvas.rect,x=r.x+(target.x-s.world.left)/s.canvas.width*r.width,y=r.y+(target.y-s.world.top)/s.canvas.height*r.height;if(x>r.x&&x<r.right&&y>r.y&&y<r.bottom)await page.mouse.move(x,y);}
    }else await keys([]);
    await page.waitForTimeout(120);
  }
  await keys([]);const final=await observe();if(final.state===1)await page.keyboard.press('p');await page.screenshot({path:path.join(out,label+'-final.png')});
  await fs.writeFile(path.join(out,label+'-result.json'),JSON.stringify({method:'Real-time Chrome, fresh profile, normal HP/XP/weapon levels. Only start, movement, mouse aiming, pause and offered upgrade keys. No state injection. Seed is supplied but real frame scheduling can change random call order; not a matched deterministic comparison. Opening cinematic skipped by existing URL option.',wallSeconds:duration,samples,actions,final,errors,abortedRequests},null,2));console.log(JSON.stringify({done:true,label,state:final.state,time:final.time,hp:final.player?.hp,errors,abortedRequests:abortedRequests.length}));
}finally{await browser.close();}
