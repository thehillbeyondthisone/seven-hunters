import assert from 'node:assert/strict';
import {fixture} from './helpers/morning-fixture.mjs';

const {s,app,keys}=await fixture(false,{search:'laterWatchPreview=photography',morningStudy:false});
const photo=s.photography,messages=[];s.toast=text=>messages.push(text);
photo.state.taken=true;photo.raised=false;s.paused=false;

// The camera cannot displace the kettle before it reaches the range/table.
s.beat='d2kitchen';s.h=34;
s.flags.nextWatch={meals:{d2:{stage:2,kettleCarried:true,kettleAt:'carried'}}};
s.next.domestic.action=null;
assert.equal(photo.available,false);assert.equal(photo.toggle(),false);assert.equal(photo.raised,false);
assert.match(messages.at(-1),/kettle.*set it down/i);
s.next.state.meals.d2.kettleCarried=false;
assert.equal(photo.available,true);assert.equal(photo.toggle(),true);
s.next.state.meals.d2.kettleCarried=true;
assert.equal(photo.available,false);assert.equal(photo.toggle(),true,'putting away works even when a restored tool now blocks equipping');
assert.equal(photo.raised,false);s.next.state.meals.d2.kettleCarried=false;

// The oil supply stays in the player's hands until it is stowed safely.
s.beat='storm-prepare';s.flags.storm={oilTaken:true,oilStowed:false};app.player.carryingHeavy=true;
assert.equal(photo.toggle(),false);assert.match(messages.at(-1),/oil supply.*shelf/i);
s.flags.storm.oilStowed=true;app.player.carryingHeavy=false;
assert.equal(photo.toggle(),true);assert.equal(photo.toggle(),true);

// C cannot interrupt a physical hold and put a second object in those hands.
s.beat='lw-repair';s.interact.current=s.interact.get('repairBrake');s.interact.held=.2;keys.add('KeyE');
assert.equal(photo.toggle(),false);assert.match(messages.at(-1),/working tool/i);
keys.clear();s.interact.current=null;s.interact.held=0;
assert.equal(photo.toggle(),true,'releasing the work action recovers camera use');
assert.equal(photo.toggle(),true);
s.later.state.tools=true;
assert.equal(photo.toggle(),true,'a spanner in the inventory does not occupy the hands');

// Lowering is always a recovery route, including modal/busy/readback states.
s.ui.modal=1;assert.equal(photo.toggle(),true);s.ui.modal=0;
assert.equal(photo.toggle(),true);app.player.busy=true;assert.equal(photo.toggle(),true);app.player.busy=false;
assert.equal(photo.toggle(),true);photo.capturing=true;assert.equal(photo.toggle(),true);photo.capturing=false;

app.player.carryingHeavy=true;await s.later.begin('photography');
assert.equal(app.player.carryingHeavy,false,'a deliberate fresh chapter review does not inherit a stale carried supply');
assert.equal(photo.available,true);assert.equal(photo.toggle(),true);assert.equal(photo.toggle(),true);
console.log('PASS Brownie excludes carried kettle, oil and active tools; lowering remains available; stowing/releasing and fresh review recover camera use.');
