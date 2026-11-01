import assert from 'node:assert/strict';
import { fixture, TOWER } from './helpers/morning-fixture.mjs';
import { Watcher } from '../src/story/Watcher.js';
import { WATCHER } from '../src/story/Script.js';

const {s,app,step,place}=await fixture(false,{search:'keeperPreview',morningStudy:false});
s.setBeat('gallan');s.h=17;s.paused=false;s.flags.signalLesson={practiceIndex:0,practiceSymbol:0};
s.watcher=new Watcher();s.watcher.appear();s.watcher.call();
let sent=0;s.watcher.onSent=(text,minutes)=>{sent++;s.h+=minutes/60;};
place(TOWER.signalStand.x,TOWER.deck,TOWER.signalStand.z);
const start=s.h;s._enterSignal();
assert.equal(s.guidedSignal.active,true,'the real signal entry starts onboarding');
step(2.2);assert.equal(s.guidedSignal.phase,'practice');
assert.equal(s.h,start,'the actual story clock holds while the player learns the shutter');
for(const code of ['.','-','.-'])for(const mark of code){assert.equal(s.guidedSignal.flash(mark),true);step(mark==='.'?.4:1.2);step(.6);}
assert.equal(s.flags.signalLesson.practised,true);
assert.equal(s.watcher.node,WATCHER.nodes.hello);

s.ui.choose=async()=>1;
const key={code:'Space',repeat:false,preventDefault(){}};
s._key(key);step(1/60);await Promise.resolve();await Promise.resolve();
assert.equal(s.watcher.manualReply,true,'the chosen first reply uses guided shutter chunks');
assert.equal(s.watcher.log.filter(row=>row.from==='you').length,1);
s._hurry=false;s._key(key);s.mobileCommand('read');
assert.equal(s._hurry,false,'manual Space/touch input cannot also queue fast-forward');
assert.equal(s.guidedSignal.flash('-'),true);step(1.1);
const partial=s.watcher.manualChunk;
const snapshot=JSON.parse(JSON.stringify(s._snapshot()));
s._leaveSignal();assert.equal(app.player.busy,false);assert.equal(app.input.enabled,true);
s._restore(snapshot);s.paused=false;
assert.equal(s.watcher.manualReply,true,'the real save restore keeps the chosen manual transmission');
assert.equal(s.watcher.manualChunk.index,partial.index);assert.equal(s.watcher.manualChunk.symbol,partial.symbol);
s._enterSignal();assert.equal(s.guidedSignal.active,true);
app.mobile={paused:true};s.guidedSignal.press(true);s.update(1/60);app.mobile.paused=false;
assert.equal(s.guidedSignal.pressed,false,'mobile pause does not leave the shutter held');
let guard=0;
while(s.guidedSignal.active&&guard++<200){const chunk=s.watcher.manualChunk;if(chunk.complete){step(.6);break;}assert.equal(s.guidedSignal.flash(chunk.code[chunk.symbol]),true);step(1.4);step(.6);}
assert.ok(guard<200);assert.equal(sent,1);
assert.equal(s.flags.signalLesson.firstReplyDone,true);
assert.equal(s.watcher.node,WATCHER.nodes.alone);
assert.equal(s.watcher.log.filter(row=>row.from==='you').length,1,'leaving, restoring and returning never repeats the reply choice');
assert.ok(s.watcher.text!==WATCHER.nodes.alone.her,'finishing the guided reply does not finish the next incoming message');
s._leaveSignal();assert.equal(s.guidedSignal.active,false);assert.equal(app.input.enabled,true);assert.equal(app.player.busy,false);
// Ordinary later messages use the same modern save progress after the first
// guided reply. Loading must retain both an unread tail and an offered branch.
s.watcher=new Watcher();s.watcher.appear();s.watcher.answer();s.watcher.update(0,{watched:true,hurry:true});s.watcher.reply(0);s.watcher.update(0,{watched:true,hurry:true});s.watcher.update(.35,{watched:true});
const partialWho=s.watcher.save(),rawWho=s.watcher.rawMorse;assert.equal(partialWho.node,'who');
s._restore(JSON.parse(JSON.stringify(s._snapshot())));s.paused=false;s._enterSignal();
assert.equal(s.watcher.node,WATCHER.nodes.who);assert.equal(s.watcher.state,partialWho.state);assert.equal(s.watcher.save().progress.read,partialWho.progress.read);assert.equal(s.watcher.rawMorse,rawWho);
s.watcher.update(0,{watched:true,hurry:true});s.watcher.reply(0);s.watcher.update(0,{watched:true,hurry:true});s.watcher.update(0,{watched:true,hurry:true});
assert.equal(s.watcher.node,WATCHER.nodes.ceit);assert.equal(s.watcher.state,'waiting');
const decemberOption=s.watcher.options.findIndex(option=>option.next==='december');
s._restore(JSON.parse(JSON.stringify(s._snapshot())));s.paused=false;s._enterSignal();
assert.equal(s.watcher.node,WATCHER.nodes.ceit);assert.equal(s.watcher.state,'waiting');assert.equal(s.watcher.options[decemberOption].next,'december');s._leaveSignal();
console.log('Guided signal integration: real entry/clock, contextual input, save/reload, mobile pause, exact reply/branch and restored walking passed.');
process.exit(0);
