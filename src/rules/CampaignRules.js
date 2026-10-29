/* Small deterministic campaign rules shared by the runtime and regression checks. */
(function(global) {
    'use strict';
    function director(config, stageIndex, time, population, difficulty, bossActive, restUntil = 0) {
        const stage = config.stages[Math.max(0, Math.min(stageIndex, config.stages.length - 1))];
        const cycle = Math.max(1, config.cycleSeconds);
        const phaseTime = Math.max(0, time) % cycle;
        const warning = phaseTime >= cycle - config.warningSeconds;
        const assault = phaseTime < config.assaultSeconds && time >= cycle;
        const resting = time < restUntil;
        const scale = Math.max(0.5, Math.min(1.5, difficulty.waveCount || 1));
        const cap = Math.round(stage.population * scale);
        const count = resting ? 0 : Math.min(Math.max(0, cap - population), Math.max(1, Math.round((assault ? stage.burst : stage.batch) * scale)));
        const interval = Math.max(config.minimumInterval, stage.interval * (difficulty.spawnInterval || 1) * (bossActive ? config.bossIntervalMultiplier : 1) / (assault ? config.assaultRate : 1));
        return {count, cap, interval, warning, assault, resting, phase:resting?'战后休整':bossActive?'守将交锋':warning?'敌军集结':assault?'突击波':'巡防战', stage};
    }
    function bossHp(base, level, config, difficulty = 1) {
        const multiplier = Math.min(config.maxLevelMultiplier, 1 + Math.max(0, level - 1) * config.hpPerLevel);
        return Math.max(1, Math.round(base * multiplier * difficulty));
    }
    function bossSkillScale(level, config = {}) {
        const rate = Number.isFinite(config.skillPerLevel) ? Math.max(0, config.skillPerLevel) : 0.025;
        const cap = Number.isFinite(config.maxSkillMultiplier) ? Math.max(1, config.maxSkillMultiplier) : 1.4;
        return Math.min(cap, 1 + Math.max(0, level - 1) * rate);
    }
    function nextBoss(stages, defeated, active, time) {
        if(active)return -1;
        const index = stages.findIndex((_,i)=>!defeated.has(i));
        return index >= 0 && time >= Number(stages[index].bossSecond) ? index : -1;
    }
    function matchesOrder(enemy, order) {
        if (order?.target === 'phantom') return Boolean(enemy.isQinqiPhantom);
        if(!order || enemy.isProp || enemy.isBoss || enemy.isMiniBoss || enemy.isQinqiPhantom || enemy.isBossSummon || enemy.isTigerGuard)return false;
        return order.target==='any' || order.target==='elite'&&enemy.isElite || order.target===enemy.type;
    }
    function fanAngles(angle, count, halfAngle) {
        const center = Number.isFinite(angle) ? angle : 0;
        const total = Math.max(1, Math.min(9, Math.floor(Number(count) || 1)));
        const spread = Number.isFinite(halfAngle) ? Math.max(0, Math.min(Math.PI / 2, halfAngle)) : 0;
        return Array.from({length:total},(_,i)=>center + (total===1 ? 0 : (i/(total-1)*2-1)*spread));
    }
    global.CampaignRules = {director, bossHp, bossSkillScale, nextBoss, matchesOrder, fanAngles};
})(globalThis);
