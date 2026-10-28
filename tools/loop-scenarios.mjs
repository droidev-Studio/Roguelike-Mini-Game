// Controlled runtime fixtures. These checks deliberately place state; they are NOT normal campaign play.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const out=path.resolve(process.argv[2]||'project-materials/quality/loop-scenarios');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5173/?skipOpening=1&skipRunEntry=1');await page.locator('#start-game-button').click();await page.waitForFunction(()=>gameManager.gameState===1);
  await page.locator('[data-action="pause"]').click();
  const xp=await page.evaluate(()=>{
    const g=gameManager,p=g.player;g.enemies=[];g.pickups=[];p.exp=0;
    const old=DROP_RULE_CONFIG.normal;DROP_RULE_CONFIG.normal=[{type:'EXP',kind:'exp',weight:1}];
    const mob=new Enemy(p.x,p.y,10);mob.expValue=7;g.trySpawnPickup(mob);const pickup=g.pickups.find(p=>p.type===PICKUP_TYPES.EXP);const value=pickup.expValue;pickup.onPickup(g);const gained=p.exp;
    DROP_RULE_CONFIG.normal=old;g.pickups=[];
    g.changeState(GAME_STATE.PLAYING,{reason:'fixture'});const level=p.level;p.addExp(1000);const first=p.level;p.addExp(1000);const second=p.level;const before=g.levelUpOptions.length;
    let choices=0;while(g.gameState===GAME_STATE.LEVEL_UP&&choices<30){g.selectLevelUpOption(0);choices++;g.updateLevelProgressionSystem();}
    const duplicate=g.selectLevelUpOption(0);
    g.changeState(GAME_STATE.PAUSED,{reason:'fixture'});
    return {value,gained,first,second,level,before,choices,finalLevel:p.level,duplicate};
  });
  if(xp.value!==7||xp.gained!==7||xp.first!==xp.level+1||xp.second!==xp.first||xp.choices!==xp.finalLevel-xp.level||xp.duplicate!==false)throw Error('XP conservation/choice queue failed '+JSON.stringify(xp));
  checks.push({name:'XP values applied once; pickups during a choice bank XP; each subsequent level receives a choice; duplicate choice is ignored',result:xp});
  const sequence=await page.evaluate(()=>{
    const g=gameManager;g.initializeRun();g.changeState(GAME_STATE.PLAYING,{reason:'fixture'});g.gameTime=600;g.updateSpawnSystem(0);
    g.updateMapSystem(0);
    const names=[],maps=[],spawnDistances=[];let maxBosses=0;
    for(let i=0;i<4;i++){
      const boss=g.enemies.find(e=>e.isBoss);if(!boss||boss.stageIndex!==i)throw Error('Skipped guard '+i);
      g.updateMapSystem(0);
      names.push(boss.stageData.boss);maps.push(g.getCurrentStaticStageMapId());spawnDistances.push(Math.hypot(boss.x-g.player.x,boss.y-g.player.y));
      g.spawnTimelineBoss(i);maxBosses=Math.max(maxBosses,g.enemies.filter(e=>e.isBoss).length);
      boss.invulnerableOnce=true;boss.hp=0;g.handleEnemyDeath(boss,g.enemies.indexOf(boss));g.updateSpawnSystem(0);
      if(g.enemies.some(e=>e.isBoss))throw Error('Skipped recovery');
      g.gameTime+=8.01;g.updateSpawnSystem(0);
    }
    const finalCutscene=g.gameState;g.enterFinalBossArena();const boss=g.enemies.find(e=>e.isFinalBoss);names.push(boss.stageData.boss);maps.push(g.getCurrentStaticStageMapId());g.wakeFinalBoss?.();
    g.spawnQinqiPhantoms(boss);g.spawnQinqiPhantoms(boss);const phantomCount=g.enemies.filter(e=>e.isQinqiPhantom).length;
    g.changeState(GAME_STATE.PAUSED,{reason:'fixture'});return {names,maps,maxBosses,spawnDistances,finalCutscene,phantomCount,cleared:[...g.defeatedStageBosses]};
  });
  if(sequence.names.join(',')!=='孔秀,韩福,卞喜,王植,秦琪'||sequence.maxBosses!==1||sequence.finalCutscene!==7||sequence.phantomCount!==4||sequence.spawnDistances.some(d=>d<200||d>500))throw Error('Sequence failed '+JSON.stringify(sequence));
  checks.push({name:'Late timestamp still requires all guards in order; recovery gate; safe entry; final arena and one living phantom per identity',result:sequence});
  const encounter=await page.evaluate(()=>{
    const g=gameManager;g.initializeRun();g.currentStage=1;const boss=g.spawnTimelineBoss(1);boss.abilityTimer=boss.abilityCooldown;boss.update(.01);
    const locked={...boss.lockedAbilityTarget};const before=g.projectiles.length;g.player.x+=100;boss.update(.2);const warned=boss.castRemaining>0&&g.projectiles.length===before;
    boss.update(1.2);const shot=g.projectiles.find(p=>p instanceof BossProjectile);const fired=!!shot;const initialTracking=shot.trackingRemaining;
    shot.update(1.2,g.getWorldWidth(),g.getWorldHeight());const expiredTracking=shot.trackingRemaining<=0;const lifeEnds=shot.update(5,g.getWorldWidth(),g.getWorldHeight())===false;
    g.currentStage=0;g.enemies=[];g.stageOrderProgress=[14,0,0,0,0];g.completedStageOrders.clear();const soldier={type:'normal'};g.updateStageOrder(soldier);const currency=g.currentResonance;g.updateStageOrder(soldier);const once=g.currentResonance===currency;
    const hp=g.player.hp;const level=g.player.level;g.player.level=33;const fireBoss=new Boss(STAGES[3],3);fireBoss.useAbility();const cappedFire=g.fireAreas.at(-1).damagePerSecond;g.player.level=level;g.fireAreas=[];
    g.changeState(GAME_STATE.PAUSED,{reason:'fixture'});return {locked,warned,fired,initialTracking,expiredTracking,lifeEnds,currency,once,hp,cappedFire};
  });
  if(!encounter.warned||!encounter.fired||!encounter.expiredTracking||!encounter.lifeEnds||encounter.currency!==8||!encounter.once||encounter.cappedFire!==21)throw Error('Encounter failed '+JSON.stringify(encounter));
  checks.push({name:'Boss windup precedes shot; homing ends and projectile expires; optional order rewards once',result:encounter});
  const victory=await page.evaluate(()=>{
    const g=gameManager;g.initializeRun();g.changeState(GAME_STATE.PLAYING,{reason:'fixture'});const boss=g.spawnTimelineBoss(4);boss.isDormantFinalBoss=false;boss.x=g.player.x+80;boss.y=g.player.y;boss.hp=1;
    g.player.addExp(g.player.expToNextLevel);const state=g.gameState,currency=g.totalResonance;g.victory();g.gameOver();const unchanged=g.gameState===state&&g.totalResonance===currency;
    return {state,unchanged,cleared:[...g.defeatedStageBosses]};
  });
  if(victory.state!==5||!victory.unchanged)throw Error('Victory overwritten by nova '+JSON.stringify(victory));
  checks.push({name:'Level-up nova killing final boss preserves victory; repeated result calls cannot duplicate rewards',result:victory});
  const population=await page.evaluate(()=>{
    const g=gameManager;g.initializeRun();g.currentStage=1;const cap=CampaignRules.director(GAME_SETTINGS.CAMPAIGN.DIRECTOR,1,120,0,getCombatRuleMultipliers().game,false).cap;
    g.enemies=Array.from({length:cap-1},()=>new Enemy(100,100,10));for(let i=0;i<20;i++)g.spawnEnemy();const normal=g.enemies.length;
    g.spawnSpearmanSwarm(9);g.spawnNextSwarmLayer();const full=g.enemies.length;g.enemies.splice(0,3);g.spawnNextSwarmLayer();const released=g.enemies.length;
    g.enemies=[];g.pendingSwarm=null;g.changeState(GAME_STATE.PAUSED,{reason:'fixture'});return {cap,normal,full,released};
  });
  if(population.normal>population.cap||population.full>population.cap||population.released>population.cap)throw Error('Population overflow '+JSON.stringify(population));
  checks.push({name:'Actual normal/archer spawning and deferred swarm batches share the population limit',result:population});
  await page.evaluate(()=>{const g=gameManager;g.initializeRun();g.gameTime=121;g.spawnedStageBosses.add(0);const boss=g.spawnTimelineBoss(0);boss.castRemaining=1.1;boss.lockedAbilityTarget={x:g.player.x+180,y:g.player.y};g.changeState(GAME_STATE.PLAYING,{reason:'fixture'});g.render();});
  await page.screenshot({path:path.join(out,'boss-telegraph-fixture.png')});
  await page.locator('[data-action="pause"]').click();
  await page.setViewportSize({width:1100,height:760});await page.screenshot({path:path.join(out,'desktop-1100-fixture.png')});
  if(errors.length)throw Error(errors.join('\n'));
  const result={at:new Date().toISOString(),method:'Controlled browser runtime fixtures using explicit state placement and forced enemy death. Functional regression only; not proof of normal campaign completion or win rate.',checks,errors};
  await fs.writeFile(path.join(out,'controlled-scenarios.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await page.screenshot({path:path.join(out,'scenario-failure.png')});throw e;}finally{await browser.close();}
