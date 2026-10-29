// Controlled runtime/visual fixtures, separate from legal-input full campaign play.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const[k,...v]=a.replace(/^--/,'').split('=');return[k,v.join('=')];}));
const out=path.resolve(args.out);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto((args.url||'http://127.0.0.1:5173/')+'?skipOpening=1&skipRunEntry=1',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.gameManager,null,{timeout:90000});
  await page.locator('#start-game-button').click();await page.waitForFunction(()=>gameManager.gameState===1);await page.locator('[data-action="pause"]').click();
  const result=await page.evaluate(()=>{
    const g=gameManager,checks=[];
    const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
    g.initializeRun();g.player.level=35;g.enterFinalBossArena();g.changeState(GAME_STATE.PAUSED,{reason:'fixture'});
    const b=g.enemies.find(e=>e.isFinalBoss);b.update(20);
    check('dormant-boss-does-not-fire',g.projectiles.length===0&&b.hp===b.maxHp);
    g.activateFinalBossBattle(b);g.enemies=[b];g.pendingTigerGuardSpawn=null;g.projectiles=[];
    b.x=600;b.y=450;g.player.x=600;g.player.y=650;b.castRemaining=1.1;b.lockedAbilityTarget={x:600,y:650};
    b.update(.55);check('no-shot-before-warning-finishes',g.projectiles.length===0);
    g.player.x=850;b.update(.56);
    const first=[...g.projectiles];check('first-phase-three-committed-arrows',first.length===3&&first.every(p=>p.isFinalVolley&&p.trackingRemaining===0&&p.damage<=16.8),first.map(p=>({dx:p.dx,dy:p.dy,damage:p.damage})));
    check('aim-lock-survives-player-movement',Math.abs(first[1].dx)<1e-9&&Math.abs(first[1].dy-1)<1e-9);
    const directions=first.map(p=>({dx:p.dx,dy:p.dy}));for(const p of first)p.update(.2,1254,1254);
    check('fan-keeps-dodge-lanes',first.every((p,i)=>p.dx===directions[i].dx&&p.dy===directions[i].dy));
    check('arrows-expire',first.every(p=>p.update(3.3,1254,1254)===false));
    g.projectiles=[];b.hp=b.maxHp*.49;b.castRemaining=0;b.abilityTimer=0;b.update(.01);
    const wait=b.finalPhaseWarningRemaining;
    check('half-health-starts-warning-without-instant-summons',wait>=.6&&g.enemies.length===1);
    b.update(wait-.05);check('reinforcement-waits-for-warning',g.enemies.length===1);
    b.update(.06);check('half-health-summons-four',g.enemies.filter(e=>e.isQinqiPhantom).length===4);
    check('reinforcements-spawn-clear',g.enemies.every(e=>!g.isTerrainBlockedAt(e.x,e.y,g.getEnemyTerrainRadius(e),e)));
    g.enemies=[b];b.update(.01);check('half-health-wave-does-not-repeat',g.enemies.length===1);
    g.projectiles=[];b.lockedAbilityTarget={x:600,y:650};b.useAbility();
    check('second-phase-five-arrows',g.projectiles.length===5&&g.projectiles.every(p=>p.damage<=16.8));
    // A player standing in the visual overlap takes the strongest pool once.
    g.projectiles=[];g.enemies=[];g.fireTornados=[];g.specialAreas=[];g.player.hp=100;g.player.isInvincible=false;
    const apply=g.applyPlayerDamage,amounts=[];g.applyPlayerDamage=function(amount){amounts.push(amount);return apply.call(this,amount);};
    const pool=dps=>({x:g.player.x,y:g.player.y,radius:60,damagePerSecond:dps,lifetime:10});
    g.fireAreas=[pool(21),pool(21),pool(10)];g.updateDamageSystem(.5);
    check('overlapping-fires-use-strongest-once',amounts.length===1&&Math.abs(amounts[0]-10.5)<1e-9,{amounts,hp:g.player.hp});
    amounts.length=0;g.fireAreas=[{...pool(21),lifetime:.1}];g.updateDamageSystem(.5);
    check('expired-fire-does-not-hurt',amounts.length===0&&g.fireAreas.length===0);
    g.applyPlayerDamage=apply;g.enemies=[b];
    return {checks};
  });
  await page.evaluate(()=>{const g=gameManager,b=g.enemies.find(e=>e.isFinalBoss);g.projectiles=[];b.hp=b.maxHp*.8;b.halfHealthTriggered=false;b.finalPhaseWarningRemaining=0;b.castRemaining=1.1;b.lockedAbilityTarget={x:g.player.x,y:g.player.y};g.changeState(GAME_STATE.PLAYING,{reason:'visual-fixture'});});
  await page.screenshot({path:path.join(out,'final-volley-telegraph.png')});
  await page.evaluate(()=>{const g=gameManager,b=g.enemies.find(e=>e.isFinalBoss);b.hp=b.maxHp*.49;b.halfHealthTriggered=false;b.castRemaining=0;b.update(.01);});
  await page.screenshot({path:path.join(out,'final-phase-warning.png')});
  if(errors.length)throw new Error(errors.join('\n'));
  await fs.writeFile(path.join(out,'final-boss-scenarios.json'),JSON.stringify({at:new Date().toISOString(),url:page.url(),method:'Explicit state fixtures; functional and visual proof, not a normal campaign clear.',...result,errors},null,2));
  console.log(JSON.stringify(result));
}catch(e){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:e.message,errors},null,2));throw e;}finally{await browser.close();}
