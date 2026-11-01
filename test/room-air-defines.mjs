// Compile the actual module graph with inert GPU descriptors, without an
// adapter, dispatch or GPU work. Room air must preprocess the same cloud and
// terrain visibility helpers as the outdoor haze that supplies them.
import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Texture } from '../src/engine/gpu/Texture.js';
import { ShaderModule } from '../src/engine/gpu/Shader.js';
import { setShadowMap } from '../src/engine/render/wgsl/lighting.js';
import { AirHaze } from '../src/post/AirHaze.js';
import { RoomAir } from '../src/post/RoomAir.js';

globalThis.GPUShaderStage = { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
globalThis.GPUColorWrite = { ALL: 15 };
GPU.device = {
	createBindGroupLayout: descriptor => descriptor,
	createPipelineLayout: descriptor => descriptor,
	createShaderModule: descriptor => descriptor,
	createRenderPipeline: descriptor => descriptor,
};
GPU.syncPipelines = true;
setShadowMap( new Texture( { format: 'depth32float', dimension: '2d-array' } ) );
const depthTexture = new Texture( { format: 'depth32float' } );
const underwater = { module: new ShaderModule( { name: 'inert room-air ray dependency' } ) };
const clouds = { module: new ShaderModule( { name: 'inert room-air cloud dependency' } ) };
const terrain = { module: new ShaderModule( { name: 'inert room-air terrain dependency' } ) };
const visibilityBody = air => {
	air._build();
	return air._pass.source.split( 'fn hazeVisibilityRest(' )[ 1 ].split( '\n}' )[ 0 ];
};

const full = new AirHaze( { depthTexture, underwater, clouds, terrain } );
const fullBody = visibilityBody( new RoomAir( { depthTexture, haze: full } ) );
assert.ok( fullBody.includes( 'cloudsShadow( g )' ), 'room march retains real cloud visibility when outdoor haze enables it' );
assert.ok( fullBody.includes( 'hazeTerrainSun( P )' ), 'room march retains real hill visibility when outdoor haze enables it' );

const clear = new AirHaze( { depthTexture, underwater } );
const clearBody = visibilityBody( new RoomAir( { depthTexture, haze: clear } ) );
assert.ok( ! clearBody.includes( 'cloudsShadow( g )' ) && ! clearBody.includes( 'hazeTerrainSun( P )' ), 'absent systems are compiled out consistently' );

const fixture = new RoomAir( { depthTexture, haze: { module: clear.module } } );
assert.doesNotThrow( () => fixture._build(), 'isolated fixtures can omit optional haze feature definitions' );
console.log( 'PASS room-air shader composition: real cloud/terrain visibility enabled consistently, absent dependencies compiled out, isolated fixtures supported; no GPU work.' );
