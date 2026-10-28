// Controlled browser fixtures: real spawning/collision code, not campaign play.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const out = path.resolve(args.out);
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome', headless:true});
const page = await browser.newPage({viewport:{width:1440,height:960}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(args.url || 'http://127.0.0.1:5173/?skipOpening=1&skipRunEntry=1&seed=2910');
  await page.locator('#start-game-button').click();
  await page.waitForFunction(() => gameManager.gameState === 1);
  await page.locator('[data-action="pause"]').click();
  const result = await page.evaluate((baseline) => {
    const g = gameManager, checks = [], maps = [];
    const check = (name, ok, detail) => { checks.push({name,ok,detail}); if (!ok && !baseline) throw new Error(name + ': ' + JSON.stringify(detail)); };
    const radius = e => Math.max(12,(e.size || 20)*.62);
    const valid = e => Number.isFinite(e.x) && Number.isFinite(e.y) && e.x >= radius(e) && e.y >= radius(e) && e.x <= g.getWorldWidth()-radius(e) && e.y <= g.getWorldHeight()-radius(e) && !g.isTerrainBlockedAt(e.x,e.y,radius(e),e);
    // Keep each fixture's actual manifest map, independent of the campaign clock.
    const ensure = g.ensureMapTerrainForCurrentStage;
    // Baseline replays the original unchecked insertion with the same creation code.
    if (baseline && g.addEnemySafely) g.addEnemySafely = e => {g.enemies.push(e);return true;};
    g.ensureMapTerrainForCurrentStage = () => {};
    for (const mapId of Object.keys(g.assets.manifest.map.main)) {
      const size = g.getStaticStartMapWorldSize(mapId);
      if (!size) continue;
      g.getWorldWidth = () => size.width; g.getWorldHeight = () => size.height;
      g.currentStaticStageMapId = mapId;
      g.refreshMapTerrainForStage('static:' + mapId);
      const obstacles = g.mapObstacles.filter(o => o.collisionType === 'block' && g.doesTerrainObstacleApplyToEntity(o, {}));
      let count = 0, invalid = 0, embedded = 0, outsideWorld = 0;
      for (let i=0;i<400;i++) {
        g.player.x = radius(g.player)+30 + GameRuntime.random()*(size.width-radius(g.player)*2-60);
        g.player.y = radius(g.player)+30 + GameRuntime.random()*(size.height-radius(g.player)*2-60);
        g.snapCameraToPlayer();g.enemies=[];g.spawnEnemy();
        for (const e of g.enemies) {
          count++;if(!valid(e)) invalid++;
          if(g.isTerrainBlockedAt(e.x,e.y,radius(e),e))embedded++;
          if(e.x<radius(e)||e.y<radius(e)||e.x>size.width-radius(e)||e.y>size.height-radius(e))outsideWorld++;
        }
      }
      maps.push({mapId,blockers:obstacles.length,count,invalid,embedded,outsideWorld});
    }
    check('ordinary-and-archer-spawns-on-all-maps', maps.every(m=>m.invalid===0),maps);
    if (baseline) return {maps,checks};
    // A rectangle over the entire viewport edge reproduces the old birth-in-wall bug.
    g.getWorldWidth = () => 2200;g.getWorldHeight = () => 1800;
    g.player.x=1100;g.player.y=900;g.snapCameraToPlayer();
    const shapes = [
      {shape:'circle',radius:125},
      {shape:'ellipse',radiusX:175,radiusY:95},
      {shape:'rect',width:300,height:240},
    ];
    for (const shape of shapes) {
      g.mapObstacles = [{...shape,x:800,y:700,collisionType:'block'}];
      for (const size of [20,48,100,180]) {
        const e = new Enemy(800,700,100);e.size=size;
        check('shape-and-full-radius',g.addEnemySafely(e) && valid(e),{shape:shape.shape,size,x:e.x,y:e.y});
        const before={x:e.x,y:e.y};g.moveEnemyWithTerrain(e,2,1);
        check('relocated-enemy-can-move',valid(e)&&Math.hypot(e.x-before.x,e.y-before.y)>.1,{shape:shape.shape,size});
      }
    }
    g.mapObstacles=[{shape:'rect',x:1100,y:900,width:2200,height:1800,collisionType:'block'}];g.enemies=[];
    check('fully-blocked-map-refuses-spawn',!g.addEnemySafely(new Enemy(800,700,100))&&g.enemies.length===0);
    g.mapObstacles=[{shape:'circle',x:800,y:700,radius:150,collisionType:'block',collisionScope:'playerOnly'}];
    const exempt=new Enemy(800,700,100);const original={x:exempt.x,y:exempt.y};
    check('player-only-blocker-keeps-enemy-position',g.addEnemySafely(exempt)&&exempt.x===original.x&&exempt.y===original.y);
    g.mapObstacles=[{shape:'circle',x:800,y:700,radius:150,collisionType:'slow'}];
    const slow=new Enemy(800,700,100), slowBefore={x:slow.x,y:slow.y};
    check('slow-area-remains-spawnable',g.addEnemySafely(slow)&&slow.x===slowBefore.x&&slow.y===slowBefore.y);
    // Force every creation route's original candidate inside a blocker.
    g.mapObstacles=[{shape:'rect',x:1100,y:900,width:1900,height:1400,collisionType:'block'}];
    const sync=g.syncStaticStageMap;g.syncStaticStageMap=()=>false;
    const routes=[];
    function route(name,fn){g.enemies=[];fn();routes.push({name,count:g.enemies.length,invalid:g.enemies.filter(e=>!valid(e)).length});}
    route('mini-boss',()=>g.spawnMiniBoss(1));
    route('timeline-boss',()=>g.spawnTimelineBoss(0));
    route('tiger-guard-batches',()=>{const b=new Boss(STAGES[0],0);g.spawnTigerGuards(b,2,{force:true,count:12,orbitRadius:300});for(let i=0;i<10;i++)g.spawnNextTigerGuardBatch();});
    const boss=new Boss(STAGES[2],2);boss.x=1100;boss.y=900;
    route('boss-summons',()=>boss.useAbility());
    route('affix-summons',()=>boss.summonAffixMinions());
    route('phantoms',()=>g.spawnQinqiPhantoms(boss));
    route('props',()=>g.spawnDestructibleProps(6));
    route('swarm',()=>{g.spawnSpearmanSwarm(1);for(let i=0;i<12;i++)g.spawnNextSwarmLayer();});
    check('all-spawn-routes',routes.every(r=>r.count>0&&r.invalid===0),routes);
    g.syncStaticStageMap=sync;
    // Transition repair keeps living enemy objects/HP and makes them movable.
    g.mapObstacles=[];g.enemies=[];const resident=new Enemy(800,700,123);g.addEnemySafely(resident);
    g.mapObstacles=[{shape:'rect',x:800,y:700,width:260,height:260,collisionType:'block'}];
    g.repairEnemyTerrainPositions();
    check('map-change-repairs-existing-enemy',g.enemies.includes(resident)&&resident.hp===123&&valid(resident));
    resident.x=800;resident.y=700;g.moveEnemyWithTerrain(resident,1,1);
    check('embedded-enemy-recovers-before-moving',valid(resident));
    g.ensureMapTerrainForCurrentStage=ensure;
    delete g.getWorldWidth;delete g.getWorldHeight;
    g.currentStage=0;g.spawnedStageBosses.clear();g.finalBossArenaActive=false;
    g.currentStaticStageMapId='grass';g.refreshMapTerrainForStage('static:grass');
    const transitionEnemy=new Enemy(330,305,123);transitionEnemy.x=330;transitionEnemy.y=305;g.enemies=[transitionEnemy];
    const expectedMap=g.getCurrentStaticStageMapId();
    g.syncStaticStageMap(true);
    check('actual-map-transition-repairs-enemies',g.currentStaticStageMapId===expectedMap&&g.enemies.includes(transitionEnemy)&&transitionEnemy.hp===123&&valid(transitionEnemy),{map:g.currentStaticStageMapId,x:transitionEnemy.x,y:transitionEnemy.y});
    return {maps,routes,checks};
  }, args.baseline === '1');
  await page.screenshot({path:path.join(out,args.baseline==='1'?'spawn-baseline.png':'spawn-regression.png')});
  const report={date:new Date().toISOString(),url:page.url(),...result,errors};
  await fs.writeFile(path.join(out,args.baseline==='1'?'spawn-baseline.json':'spawn-regression.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if(errors.length || result.checks.some(c=>!c.ok))process.exitCode=1;
} finally {await browser.close();}
