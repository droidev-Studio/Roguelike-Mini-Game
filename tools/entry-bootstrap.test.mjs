import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function entry(url){
  const state={url:new URL(url),reloads:0,updates:0};
  const location={get hostname(){return state.url.hostname},get search(){return state.url.search},get pathname(){return state.url.pathname},get hash(){return state.url.hash},replace(next){state.reloads++;state.url=new URL(next,state.url)}};
  const window={location,history:{replaceState(_state,_title,next){state.updates++;state.url=new URL(next,state.url)}}};
  const context=vm.createContext({window,URLSearchParams});
  state.run=()=>vm.runInContext(script,context);
  return state;
}
test('Pages entry normalizes defaults without a document reload',()=>{
  const state=entry('https://droidev-studio.github.io/Roguelike-Mini-Game/');state.run();
  assert.equal(state.reloads,0);
  for(const key of ['domUi','ENABLE_LARGE_MAP_CAMERA','ENABLE_GAME_SETTINGS','artTiles','qinqiPhantoms'])assert.equal(state.url.searchParams.get(key),'1',key);
});
test('Pages normalization reaches a fixed point',()=>{
  const state=entry('https://droidev-studio.github.io/Roguelike-Mini-Game/?skipOpening=1');state.run();const url=state.url.href,updates=state.updates;
  for(let i=0;i<4;i++)state.run();
  assert.equal(state.url.href,url);assert.equal(state.reloads,0);assert.equal(state.updates,updates);
});
test('explicit flags, seed, unrelated query and hash survive',()=>{
  const state=entry('https://droidev-studio.github.io/Roguelike-Mini-Game/?domUi=0&artTiles=0&seed=77&skipOpening=1#resume');state.run();
  assert.equal(state.url.searchParams.get('domUi'),'0');assert.equal(state.url.searchParams.get('artTiles'),'0');assert.equal(state.url.searchParams.get('seed'),'77');assert.equal(state.url.searchParams.get('skipOpening'),'1');assert.equal(state.url.hash,'#resume');
});
test('local entry also starts without a reload',()=>{const state=entry('http://127.0.0.1:5173/');state.run();assert.equal(state.reloads,0);assert.equal(state.url.searchParams.get('domUi'),'1');});
test('unrelated hosts keep their own configuration',()=>{const state=entry('https://example.com/game?seed=8');state.run();assert.equal(state.updates,0);assert.equal(state.reloads,0);assert.equal(state.url.search,'?seed=8');});
