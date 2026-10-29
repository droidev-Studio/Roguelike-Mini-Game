// Observational telemetry around original runtime calls; never adjusts combat state.
export async function installCombatPlayAudit(page){
  await page.evaluate(()=>{
    const g=gameManager;
    const data={encounters:[],levels:[],damage:[],largeHits:[],attacks:[],damageTotal:0,lowHpByStage:{},terminal:null};
    let source='other';
    const bins=new Map(),bossRecords=new WeakMap();
    const build=()=>({level:g.player?.level,hp:g.player?.hp,maxHp:g.player?.maxHp,
      weapons:g.player?.weapons.map(w=>({type:w.type,level:w.level,damage:w.damage})),skills:{...g.player?.inGameSkills}});
    for(const [method,tag]of [['updateDamageSystem','fire-area'],['applyTerrainHazardsToPlayer','terrain'],['updateProjectileSystem','projectile'],['updateCollisionSystem','contact']]){
      const original=g[method];if(!original)continue;
      g[method]=function(...args){const previous=source;source=tag;try{return original.apply(this,args);}finally{source=previous;}};
    }
    const damage=g.applyPlayerDamage;
    g.applyPlayerDamage=function(amount){
      const hp=g.player.hp,stage=g.currentStage,time=g.gameTime,tag=source;
      const result=damage.call(this,amount),loss=Math.max(0,hp-g.player.hp);
      if(loss>0){
        data.damageTotal+=loss;
        const key=stage+':'+Math.floor(time)+':'+tag;
        let bin=bins.get(key);if(!bin){bin={stage,second:Math.floor(time),source:tag,loss:0,hits:0};bins.set(key,bin);data.damage.push(bin);}bin.loss+=loss;bin.hits++;
        if(loss>=8)data.largeHits.push({time,stage,source:tag,loss,hpBefore:hp,hpAfter:g.player.hp});
      }
      return result;
    };
    const spawn=g.spawnTimelineBoss;
    g.spawnTimelineBoss=function(index,...args){
      const boss=spawn.call(this,index,...args);
      if(boss&&!bossRecords.has(boss)){
        const record={index,name:STAGES[index].boss,spawn:g.gameTime,active:boss.isDormantFinalBoss?null:g.gameTime,hp:boss.maxHp,entry:build()};
        bossRecords.set(boss,record);data.encounters.push(record);
        const ability=boss.useAbility;
        boss.useAbility=function(...values){const before=g.projectiles.length;const result=ability.apply(this,values);data.attacks.push({time:g.gameTime,index,ability:this.ability,phase:this.halfHealthTriggered?2:1,projectiles:Math.max(0,g.projectiles.length-before)});return result;};
      }
      return boss;
    };
    const activate=g.activateFinalBossBattle;
    g.activateFinalBossBattle=function(boss){const result=activate.call(this,boss);const record=bossRecords.get(boss);if(record&&record.active===null&&g.finalBossBattleTriggered){record.active=g.gameTime;record.activeBuild=build();}return result;};
    const death=g.handleEnemyDeath;
    g.handleEnemyDeath=function(enemy,...args){
      const record=bossRecords.get(enemy),hpBeforeRewards=g.player.hp;const result=death.call(this,enemy,...args);
      if(record&&!g.enemies.includes(enemy)&&record.defeated===undefined){record.defeated=g.gameTime;record.battleSeconds=record.active===null?null:g.gameTime-record.active;record.hpBeforeRewards=hpBeforeRewards;record.exit=build();}
      return result;
    };
    const level=g.onPlayerLevelUp;
    g.onPlayerLevelUp=function(...args){data.levels.push({time:g.gameTime,stage:g.currentStage,...build()});return level.apply(this,args);};
    for(const method of ['victory','gameOver']){const original=g[method];g[method]=function(...args){if(!data.terminal)data.terminal={outcome:method,time:g.gameTime,stage:g.currentStage,...build()};return original.apply(this,args);};}
    window.__COMBAT_PLAY_AUDIT__={data,sample(){if(g.player){const stage=g.currentStage;data.lowHpByStage[stage]=Math.min(data.lowHpByStage[stage]??Infinity,g.player.hp);}return data;}};
  });
}
