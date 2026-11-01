import assert from 'node:assert/strict';
import { fixture, E, TOWER } from './helpers/morning-fixture.mjs';
import { handMesh } from '../src/world/flannan/KeeperCraft.js';
import { DOMESTIC_CRAFT_MODEL as M } from '../src/world/flannan/DomesticCraftModel.js';

let triangles = 0;
for ( const [ name, finishes ] of Object.entries( M.models ) ) for ( const g of Object.values( finishes ) ) {
	assert.ok( g.p.length && g.p.length === g.n.length && g.uv.length * 3 === g.p.length * 2 );
	assert.ok( [ ...g.p, ...g.n, ...g.uv ].every( Number.isFinite ), name + ' has finite mesh attributes' );
	assert.ok( g.idx.every( i => Number.isInteger( i ) && i >= 0 && i < g.p.length / 3 ) );
	for ( let i = 0; i < g.n.length; i += 3 ) assert.ok( Math.abs( Math.hypot( ...g.n.slice( i, i + 3 ) ) - 1 ) < .002, name + ' unit normals' );
	triangles += g.idx.length / 3;
}
assert.equal( Object.keys( M.handPoses ).length, 5 );
for ( const [ name, item ] of Object.entries( M.handPoses ) ) {
	const expected = Object.values( item.finishes ).flatMap( g => g.p );
	const actual = handMesh( name, 'near', [ 'domesticJug', 'domesticSupport' ].includes( name ) ).geometry.attributes.position.array;
	assert.equal( actual.length, expected.length, name + ' selects its complete MCP mesh rather than a generic pose' );
	assert.ok( expected.every( ( x, i ) => Math.abs( x - actual[ i ] ) < 1e-6 ), name + ' retains the authored item frame/chirality' );
}
for ( const p of [ ...Object.values( M.poses ), ...Object.values( M.contacts ) ] ) assert.ok( p.position.every( Number.isFinite ) && Math.abs( Math.hypot( ...p.quaternion ) - 1 ) < 1e-5 );
const { s, app, place, face, keys } = await fixture( false, { search: 'chapterPreview=kitchen' } );
s.hand.setRest( new E.Vector3( -4.95, TOWER.floor + .74, 3.12 ), .4 );
s.flags.nextWatch = { meals: { d2: { stage: 2, kettleCarried: true, kettleAt: 'carried', started: 33 } } }; s.h = 33; s.beat = 'd2kitchen'; s.paused = false;
const d = s.next.domestic, props = d.props, models = props.models;
assert.equal( props.group.name, 'domestic-work-props' );
const work = ( id, t, x, z ) => {
	const it = s.interact.get( id ); place( x, TOWER.floor, z ); face( typeof it.at === 'function' ? it.at() : it.at );
	s.interact.current = it; s.interact.held = it.hold * t; keys.add( 'KeyE' ); d.update( 0, false );
};
const tip = ( name, id ) => models[ name ].localToWorld( new E.Vector3().fromArray( M.tips[ id ] ) );
const endpoint = ( name, y ) => models[ name ].localToWorld( new E.Vector3( 0, y, 0 ) );
work( 'breakfastWater', .55, -.05, 8.25 );
assert.ok( models.waterStream.visible && models.kettleLid.position.length() > .07 );
assert.ok( endpoint( 'waterStream', 0 ).distanceTo( tip( 'jug', 'jug' ) ) < 1e-4 );
assert.ok( endpoint( 'waterStream', -1 ).distanceTo( tip( 'kettle', 'kettleMouth' ) ) < 1e-4 );
assert.deepEqual( d.handContacts().map( c => c.index ).sort(), [ 0, 1 ], 'both grips follow the independently moving fill props' );
assert.ok( d.handContacts().every( c => c.position.toArray().every( Number.isFinite ) && Math.abs( c.quaternion.length() - 1 ) < 1e-5 ) );
d.update( 0, true ); assert.ok( ! models.waterStream.visible && ! models.kettle.visible && ! d.handContacts().length, 'reading/pause suppresses carried tools and contacts' );
keys.delete( 'KeyE' ); d.update( 0, false ); assert.ok( models.kettle.visible && ! models.waterStream.visible && d.handContacts().length === 1, 'release keeps the kettle safely carried and permits retry' );
s.save(); s._restore( s.loadSave() ); s.paused = false; d.update( 0, false );
assert.ok( d.carrying && d.handContacts().length === 1, 'carried kettle survives reload' );
await s.next.prepareMeal( 'breakfastWater' );
work( 'breakfastKettle', .5, -3.1, 7.75 );
assert.ok( models.kettle.position.distanceTo( new E.Vector3().fromArray( M.poses.kettleHeat.position ) ) < 1e-5 );
await s.next.prepareMeal( 'breakfastKettle' );
work( 'breakfastTea', .55, -2.65, 8.9 );
assert.ok( models.teaStream.visible && models.teaSurface.visible );
assert.ok( endpoint( 'teaStream', 0 ).distanceTo( tip( 'kettle', 'kettle' ) ) < 1e-4 );
assert.ok( endpoint( 'teaStream', -1 ).distanceTo( tip( 'cup', 'cup' ) ) < 1e-4 );
await s.next.prepareMeal( 'breakfastTea' ); keys.delete( 'KeyE' ); d.update( 0, false );
assert.ok( ! d.carrying && models.teaSurface.visible && ! models.teaStream.visible );
assert.ok( models.kettle.position.distanceTo( new E.Vector3().fromArray( M.poses.kettleTable.position ) ) < 1e-5 );
work( 'breakfastBread', .7, -2.65, 8.9 );
assert.ok( models.breadPiece.position.y > .09 && d.handContacts().length === 2, 'torn piece lifts while the other hand steadies the loaf' );
await s.next.prepareMeal( 'breakfastBread' ); keys.delete( 'KeyE' ); d.update( 0, false );
assert.equal( s.beat, 'd2crate' ); assert.ok( d.meal.breadBroken && models.breadPiece.position.distanceTo( new E.Vector3().fromArray( M.poses.breadServed.position ) ) < 1e-5 );
console.log( JSON.stringify( { result: 'PASS', route: 'Blender MCP authored geometry / pivots / poses / contacts', triangles, parts: Object.keys( M.models ).length, workPoses: Object.keys( M.poses ).length, contacts: Object.keys( M.contacts ).length, authoredHandPoses: Object.keys( M.handPoses ).length, pouringEndpointToleranceMetres: .0001, carriedSaveRestored: true }, null, 2 ) );
process.exit( 0 );
