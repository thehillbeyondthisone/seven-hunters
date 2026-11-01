import './headless.mjs';
import assert from 'node:assert/strict';
import {GPU} from '../src/engine/gpu/GPU.js';
import {Texture} from '../src/engine/gpu/Texture.js';
import {readTexture} from '../src/engine/gpu/Readback.js';
import {photographPixels,PRINT_SIZE} from '../src/story/Photography.js';
await GPU.init({headless:true});const errors=[];GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));GPU.device.pushErrorScope('validation');
const texture=new Texture({width:2,height:2,format:'rgba8unorm',usage:['copyDst','copySrc'],label:'transient photograph'});
GPU.queue.writeTexture({texture:texture.getGPU()},new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]),{bytesPerRow:8},{width:2,height:2});
const pending=readTexture(texture);texture.getGPU().destroy(); // Canvas presentation similarly expires a swap texture.
const {data,width,height}=await pending,raw=new Uint8Array(data);assert.equal(raw[0],255);assert.equal(raw[5],255);assert.equal(raw[10],255);
const print=photographPixels(raw,width,height);assert.ok(print[0]>print[(PRINT_SIZE-1)*PRINT_SIZE*4]);assert.equal(print.at(-1),255);assert.equal(await GPU.device.popErrorScope(),null);assert.deepEqual(errors,[]);
console.log('PASS real transient GPU readback, immediate copy before presentation, square crop and monochrome print.');process.exit(0);

