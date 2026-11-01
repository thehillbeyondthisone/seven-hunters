import assert from 'node:assert/strict';
import { AirHaze, hazeDensityForVisibility } from '../src/post/AirHaze.js';
import { CoastalMist, COASTAL_MIST_BANKS } from '../src/post/CoastalMist.js';
import { ShaderModule, collectModules } from '../src/engine/gpu/Shader.js';

const mist = new CoastalMist();
assert.equal( mist.enabled, true ); assert.equal( mist.strength, 1 );
for ( const [ input, expected ] of [ [ 0, 0 ], [ -1, 0 ], [ 1.4, 1.4 ], [ 20, 2 ], [ NaN, 2 ] ] ) {
	mist.strength = input; assert.equal( mist.strength, expected );
}
mist.enabled = false; assert.equal( mist.uniforms.fields.enabled.value, 0 );
mist.enabled = true; assert.equal( mist.uniforms.fields.enabled.value, 1 );
assert.ok( COASTAL_MIST_BANKS.every( b => b.center[ 1 ] + b.radii[ 1 ] <= 14 ), 'all banks clear the 80 m station and high signal bearings' );
assert.ok( ! Object.values( mist.module.bindings ).some( b => b.texture || b.storage ), 'local mist adds no texture or storage binding' );
const dependencies = { underwater: { module: new ShaderModule( { name: 'test ray module' } ) } };
const ordinary = new AirHaze( dependencies );
const coastal = new AirHaze( { ...dependencies, coastalMist: true } );
assert.equal( ordinary.coastalMist, null );
assert.ok( ! collectModules( [ ordinary.compositeModule ] ).some( module => module.name === 'coastal-mist' ), 'other worlds compile without local coastal mist' );
assert.ok( collectModules( [ coastal.compositeModule ] ).includes( coastal.coastalMist.module ) );
assert.equal( ordinary.uniforms.fields.density.value, coastal.uniforms.fields.density.value );
const visibility = hazeDensityForVisibility( 30 ); coastal.coastalMist.strength = 0;
assert.equal( hazeDensityForVisibility( 30 ), visibility, 'mist review controls cannot alter meteorological visibility' );
assert.ok( coastal.compositeModule.code.indexOf( 'coastalMistOpticalDepth' ) < coastal.compositeModule.code.indexOf( '// ---- the lighthouse' ), 'beams and distant lights retain their current additions after local mist' );
assert.ok( coastal.compositeModule.code.includes( 'frame.cameraUnderwater < 0.5' ) && coastal.compositeModule.code.includes( 'if ( inAir > 0.5 )' ), 'mist shares camera and per-pixel underwater bypasses' );
console.log( 'PASS coastal mist: bounded finite banks, numeric review controls, optional dependency graph, no new texture, unchanged visibility and signal-light ordering.' );

