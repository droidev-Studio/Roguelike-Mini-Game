// Read-only observations around the real runtime methods; no HP/time/spawn injection.
export async function installTerrainPlayAudit(page) {
  await page.evaluate(()=>{
    const g=gameManager;
    const data={births:0,refused:0,badBirths:[],birthsByType:{},switches:[],repairs:[],samples:0,sampleViolations:[]};
    const invalid=e=>{
      const r=g.getEnemyTerrainRadius(e);
      return !Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<r||e.y<r||e.x>g.getWorldWidth()-r||e.y>g.getWorldHeight()-r||g.isTerrainBlockedAt(e.x,e.y,r,e);
    };
    const describe=e=>({type:e.type||e.constructor.name,boss:!!e.isBoss,x:e.x,y:e.y,radius:g.getEnemyTerrainRadius(e)});
    const add=g.addEnemySafely;
    g.addEnemySafely=function(e){
      const accepted=add.call(this,e);
      if(accepted){data.births++;const type=e.type||e.constructor.name;data.birthsByType[type]=(data.birthsByType[type]||0)+1;
        if(invalid(e))data.badBirths.push({time:g.gameTime,map:g.currentStaticStageMapId,...describe(e)});
      }else data.refused++;
      return accepted;
    };
    const repair=g.repairEnemyTerrainPositions;
    g.repairEnemyTerrainPositions=function(){
      const before=(g.enemies||[]).map(e=>({e,hp:e.hp,x:e.x,y:e.y,invalid:invalid(e)}));
      const result=repair.call(this);
      if(before.length)data.repairs.push({time:g.gameTime,map:g.currentStaticStageMapId,enemies:before.length,
        overlappingBefore:before.filter(v=>v.invalid).length,invalidAfter:before.filter(v=>invalid(v.e)).map(v=>describe(v.e)),
        moved:before.filter(v=>Math.hypot(v.e.x-v.x,v.e.y-v.y)>.01).length,hpPreserved:before.every(v=>v.hp===v.e.hp)});
      return result;
    };
    let lastMap=g.currentStaticStageMapId;
    const sync=g.syncStaticStageMap;
    g.syncStaticStageMap=function(...args){
      const previous=g.currentStaticStageMapId;
      const result=sync.apply(this,args);
      if(previous!==g.currentStaticStageMapId)data.switches.push({time:g.gameTime,from:previous,to:g.currentStaticStageMapId,
        enemies:g.enemies.length,invalid:g.enemies.filter(invalid).map(describe)});
      lastMap=g.currentStaticStageMapId;
      return result;
    };
    window.__TERRAIN_PLAY_AUDIT__={data,sample(){data.samples++;
      if(lastMap!==g.currentStaticStageMapId){data.switches.push({time:g.gameTime,from:lastMap,to:g.currentStaticStageMapId,kind:'direct-map-change',enemies:g.enemies.length,invalid:g.enemies.filter(invalid).map(describe)});lastMap=g.currentStaticStageMapId;}
      const bad=(g.enemies||[]).filter(e=>!e.isProp&&g.isTerrainBlockedAt(e.x,e.y,g.getEnemyTerrainRadius(e),e));
      if(bad.length)data.sampleViolations.push({time:g.gameTime,map:g.currentStaticStageMapId,enemies:bad.map(describe)});
      return data;
    }};
  });
}
