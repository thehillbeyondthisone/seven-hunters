import assert from 'node:assert/strict';
import { fixture } from './helpers/morning-fixture.mjs';
import { assembleWestLanding, westLandingBreak } from '../src/world/flannan/Station.js';
import { CoastalState } from '../src/ocean/CoastalState.js';
import { KeeperSafety } from '../src/player/KeeperSafety.js';

const { app, s, st, terrain, colliders } = await fixture(false,{search:'stormPreview',morningStudy:false});
const L=terrain.landing('west'),cut=westLandingBreak(L);
const materials=Object.fromEntries(['landingConcrete','hard','wood'].map(name=>[name,{name}]));
const works=assembleWestLanding(st.parts,L,materials);
st.moving.westLanding=works;
app.coastal=new CoastalState(terrain);app.keeperSafety=new KeeperSafety(app,s);

// A landing with invisible concrete cannot establish the shape the storm takes.
const slab=works.lower.children.find(m=>m.material===materials.landingConcrete);
assert.ok(slab&&slab.geometry.index.count>400,'the intact lower stage, platform and treads are rendered');
const positions=slab.geometry.attributes.position.array,index=slab.geometry.index.array;
assert.ok([...index].some(i=>Math.hypot(positions[i*3]-L.stage.x,positions[i*3+2]-L.stage.z)<6&&Math.abs(positions[i*3+1]-L.stage.y)<.01),'the stage deck is present at its physical support height');
assert.ok(works.lower.children.some(m=>m.name==='west-landing-rope'),'derrick wire is assembled along with its ironwork');
assert.ok(works.broken.children.some(m=>m.material===materials.landingConcrete),'a physical fracture remains after the works fail');
assert.ok(works.broken.children.every(m=>[...m.geometry.attributes.position.array].every(Number.isFinite)));
assert.equal(works.lower.visible,true);assert.equal(works.broken.visible,false);

const before=terrain.heights.slice(),states=colliders.boxes.map(b=>[b.solid,b.walkable]);
const high=L.steps.pts[cut.run+6],highGround=app.player.groundAt(high[0],high[2],high[1]+.5);
assert.ok(app.player.groundAt(L.stage.x,L.stage.z,L.stage.y+.5)>=L.stage.y-.01);
let uploads=0,cuts=0;app.terrainGPU={heightTexture:{upload(){uploads++;}}};app.cameraCut=()=>cuts++;
const damage=s.storm.damage;
damage.set(true);
assert.equal(works.lower.visible,false);assert.equal(works.broken.visible,true);assert.equal(works.upper.visible,true);
assert.ok(app.player.groundAt(L.stage.x,L.stage.z,L.stage.y+.5)<0,'destroyed deck no longer supplies invisible footing');
assert.equal(app.player.groundAt(high[0],high[2],high[1]+.5),highGround,'the intact upper flight remains walkable');
assert.ok(damage.changed.length&&damage.boxes.length);
assert.ok(damage.boxes.every(([b])=>!b.solid&&!b.walkable));
const changes=damage.changed.length;damage.set(true);assert.equal(damage.changed.length,changes,'reapplying a loaded damage state is idempotent');
assert.equal(uploads,1);assert.equal(cuts,1);assert.equal(app.query.cpuValid,false);

damage.set(false);
assert.deepEqual(terrain.heights,before,'retry restores the exact terrain');
assert.deepEqual(colliders.boxes.map(b=>[b.solid,b.walkable]),states,'retry restores every collider flag');
assert.equal(works.lower.visible,true);assert.equal(works.broken.visible,false);assert.equal(uploads,2);
assert.equal(app.keeperSafety.anchors.find(a=>a.name==='west').intact,true);
damage.set(true);damage.set(false);assert.deepEqual(terrain.heights,before,'repeated reviews do not accumulate terrain damage');
console.log('PASS visible west concrete and wire, broken remnants, support removal, safe upper flight, render/GPU state and exact reversible retries.');
