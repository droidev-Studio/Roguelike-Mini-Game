import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../src/rules/CampaignRules.js';
const R=globalThis.CampaignRules,context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../GameSettings.js',import.meta.url),'utf8'),context);
const settings=context.window.DEFAULT_GAME_SETTINGS.CAMPAIGN;
const stages=JSON.parse(fs.readFileSync(new URL('../src/spec/stages.json',import.meta.url))).stages;
const source=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
vm.runInNewContext(source.slice(source.indexOf('class GameInputActions {'),source.indexOf('class GameManager {'))+'\nthis.Input = GameInputActions;',context);
test('time thresholds cannot bypass an uncleared guard or create parallel guards',()=>{
  assert.equal(R.nextBoss(stages,new Set(),false,119),-1);
  assert.equal(R.nextBoss(stages,new Set(),false,600),0);
  assert.equal(R.nextBoss(stages,new Set(),true,600),-1);
  assert.equal(R.nextBoss(stages,new Set([0,1]),false,600),2);
  assert.equal(R.nextBoss(stages,new Set([0,1,2,3]),false,600),4);
  assert.equal(R.nextBoss(stages,new Set([0,1,2,3,4]),false,900),-1);
});
test('all stage director populations remain bounded even after an hour',()=>{
  for(let i=0;i<5;i++)for(const t of [0,60,600,3600]){
    const p=R.director(settings.DIRECTOR,i,t,0,{waveCount:1,spawnInterval:1},false);
    assert.equal(p.cap,settings.DIRECTOR.stages[i].population);assert.ok(p.interval>=settings.DIRECTOR.minimumInterval);assert.ok(p.count<=4);
    assert.equal(R.director(settings.DIRECTOR,i,t,p.cap,{},false).count,0);
    assert.equal(R.director(settings.DIRECTOR,i,t,p.cap-1,{},false).count,1);
  }
});
test('a five-second warning precedes an assault; recovery suppresses new spawning',()=>{
  assert.equal(R.director(settings.DIRECTOR,0,41,0,{},false).phase,'敌军集结');
  assert.equal(R.director(settings.DIRECTOR,0,46,0,{},false).phase,'突击波');
  const rest=R.director(settings.DIRECTOR,0,46,0,{},false,50);assert.equal(rest.count,0);assert.equal(rest.phase,'战后休整');
  assert.equal(R.director(settings.DIRECTOR,0,58,0,{},false).phase,'巡防战');
});
test('boss battles reduce troop frequency, and hard mode stays within cap',()=>{
  const a=R.director(settings.DIRECTOR,3,120,0,{},false),b=R.director(settings.DIRECTOR,3,120,0,{},true);
  assert.ok(b.interval>a.interval);const hard=R.director(settings.DIRECTOR,3,120,0,{waveCount:1.45,spawnInterval:.65},true);assert.equal(hard.cap,102);assert.ok(hard.interval>=settings.DIRECTOR.minimumInterval);
});
test('XP growth never multiplies boss HP without limit and difficulty applies once',()=>{
  assert.equal(R.bossHp(800,1,settings.BOSS),800);assert.equal(R.bossHp(800,1000,settings.BOSS),1240);assert.equal(R.bossHp(800,1000,settings.BOSS,2),2480);
});
test('late boss skill damage is bounded while still increasing above starting strength',()=>{
  assert.equal(R.bossSkillScale(1,settings.BOSS),1);assert.equal(R.bossSkillScale(33,settings.BOSS),1.4);assert.equal(R.bossSkillScale(999,settings.BOSS),1.4);
  assert.equal(15*R.bossSkillScale(33,settings.BOSS),21);
});
test('legacy URLs disabling settings still receive finite boss skill defaults',()=>{
  assert.equal(R.bossSkillScale(33,{}),1.4);assert.equal(R.bossSkillScale(33),1.4);assert.equal(R.bossSkillScale(33,{skillPerLevel:0,maxSkillMultiplier:1}),1);
});
test('military orders exclude summoned, phantom and boss farm targets',()=>{
  const order={target:'elite'};
  assert.ok(R.matchesOrder({isElite:true},order));assert.equal(R.matchesOrder({isElite:true,isBoss:true},order),false);
  assert.equal(R.matchesOrder({isElite:true,isQinqiPhantom:true},order),false);assert.equal(R.matchesOrder({isElite:true,isBossSummon:true},order),false);
  assert.ok(R.matchesOrder({type:'archer'},{target:'archer'}));assert.equal(R.matchesOrder({type:'normal'},{target:'archer'}),false);
  assert.ok(R.matchesOrder({isQinqiPhantom:true},{target:'phantom'}));
});
test('a quick down-up between frames is consumed exactly once',()=>{
  const input=new context.Input({});input.setKey('p',true);input.setKey('p',false);assert.equal(input.consume('pause'),true);assert.equal(input.consume('pause'),false);
  input.setKey('2',true);input.setKey('2',false);assert.equal(input.consumeKey('2'),true);assert.equal(input.consumeKey('2'),false);
});
test('clearing input prevents menu keys leaking into resumed play',()=>{
  const input=new context.Input({});input.setKey('p',true);input.clearActions(['pause']);assert.equal(input.consume('pause'),false);
});
test('final volley leaves player-sized dodge lanes at fighting distance',()=>{
  const config=context.window.DEFAULT_GAME_SETTINGS.CAMPAIGN.FINAL_BOSS;
  for(const [count,spread]of [[config.volleyCount,config.volleyHalfAngle],[config.enragedVolleyCount,config.enragedHalfAngle]]){
    const angles=R.fanAngles(Math.PI/2,count,spread);
    assert.equal(angles.length,count);
    assert.ok(Math.abs(angles.reduce((a,b)=>a+b,0)/count-Math.PI/2)<1e-10);
    const gap=2*120*Math.sin((angles[1]-angles[0])/2);
    assert.ok(gap>2*(18+5),'a player and arrow must fit between adjacent lanes');
  }
  assert.ok(config.volleyLifetime<3*settings.BOSS.enrageCooldownMultiplier+settings.BOSS.warningSeconds,'fans expire before the next legacy-speed volley');
  assert.ok(config.volleyDamage*R.bossSkillScale(999,settings.BOSS)<20);
  assert.ok(config.volleyDamage*R.bossSkillScale(999,settings.BOSS)*config.enragedVolleyCount+20<100,'normal full-health player is not killed by one complete fan plus contact burst');
});
test('invalid fan inputs cannot create unbounded bullets or non-finite directions',()=>{
  assert.equal(R.fanAngles(0,100,100).length,9);
  assert.equal(R.fanAngles(0,-3,.5).length,1);
  assert.ok(R.fanAngles(NaN,5,NaN).every(Number.isFinite));
});
