import { TOWER, ROOM } from '../../src/world/flannan/Station.js';
const assert = { ok( value, message ) { if ( ! value ) throw new Error( message || 'Morning route check failed' ); }, equal( value, expected, message ) { this.ok( value === expected, message ); } };
export async function walkMorningRoutine( f ) {


const { s, m, player, keys, step, face } = f;
const at = ( r, a ) => [ Math.cos( a ) * r, Math.sin( a ) * r ];
const arc = ( r, from, to ) => {
	const delta = Math.atan2( Math.sin( to - from ), Math.cos( to - from ) );
	const n = Math.max( 1, Math.ceil( Math.abs( delta ) / .22 ) );
	return Array.from( { length: n }, ( _, i ) => at( r, from + delta * ( i + 1 ) / n ) );
};
const angle = () => Math.atan2( player.position.z, player.position.x );
function walk( points, label, reach = .22 ) {
	keys.add( 'KeyW' );
	for ( const [ x, z ] of points ) {
		let best = Infinity, stuck = 0;
		while ( Math.hypot( x - player.position.x, z - player.position.z ) > reach ) {
			const dx = x - player.position.x, dz = z - player.position.z, d = Math.hypot( dx, dz );
			if ( d < best - .035 ) { best = d; stuck = 0; } else stuck += 1 / 30;
			assert.ok( stuck < 4, `${ label }: stuck at ${ player.position.toArray() } toward ${ x },${ z }` );
			player.yaw = Math.atan2( -dx, -dz ); player.pitch = 0; step( 1 / 30 );
		}
	}
	keys.delete( 'KeyW' ); step( .1 );
}
async function use( id ) {
	const it = s.interact.get( id ); face( typeof it.at === 'function' ? it.at() : it.at );
	assert.equal( s.interact.pick()?.id, id, `walking pose selects ${ id } (got ${ s.interact.pick()?.id })` );
	if ( id === 'journal' ) await f.checkpoint?.( 'journal-ready' );
	await it.use(); step( .1 ); await f.checkpoint?.( id );
}
function work( id, seconds ) {
	const it = s.interact.get( id ); face( typeof it.at === 'function' ? it.at() : it.at );
	assert.equal( s.interact.pick()?.id, id, `walking pose selects ${ id } (got ${ s.interact.pick()?.id }, feet ${ player.position.toArray() })` );
	keys.add( 'KeyE' ); step( seconds ); keys.delete( 'KeyE' ); step( .1 );
}
const H = TOWER.hatch, hc = Math.cos( H.angle ), hs = Math.sin( H.angle );
const hp = d => [ hc * H.r - hs * d, hs * H.r + hc * d ];
const top = hp( H.run + .15 ), topA = Math.atan2( top[ 1 ], top[ 0 ] );
async function down() {
	walk( [ ...arc( 1.9, angle(), topA + .35, -1 ) ], 'lantern hatch' );
	await use( 'towerDown' );
	walk( [ at( 1.8, TOWER.doorAngle ), at( 3, TOWER.doorAngle ), at( 4, TOWER.doorAngle ), [ -2.5, 3.2 ], [ .3, 4.6 ] ], 'tower to house door' );
}
async function up() {
	walk( [ [ -.5, 4.6 ], [ -2.5, 3.2 ], at( 4, TOWER.doorAngle ), at( 3, TOWER.doorAngle ), at( 1.8, TOWER.doorAngle ) ], 'house to tower' );
	await use( 'towerUp' );
	walk( [ at( 1.9, topA + .35 ) ], 'lantern arrival' );
}
async function store() {
	walk( [ [ 3, 4.6 ], [ 5, 4.6 ], [ 9.3, 2.2 ], [ 9.3, .9 ] ], 'yard to oil store' );
	await use( 'morningStoreDoor' ); step( 1 );
	walk( [ [ 9.3, -1.3 ], [ 9.3, -2.35 ] ], 'through oil store doorway' );
	assert.ok( m.inStore );
}
function fromStore() { walk( [ [ 9.3, -1.3 ], [ 9.3, .9 ], [ 9.3, 2.2 ], [ 5, 4.6 ], [ 3, 4.6 ], [ .3, 4.6 ] ], 'store back to keepers’ house' ); }
await use( 'lens' ); await use( 'morningInspect' );
assert.equal( m.guidance().id, 'towerDown', 'oil store route starts at the descent action' );
await down(); await use( 'houseDoor' ); step( 1 ); await store();
walk( [ [ 8.1, -2.35 ] ], 'kit bench' ); await use( 'morningKit' );
walk( [ [ 9.5, -2.35 ] ], 'oil can bench' ); await use( 'morningCan' );
walk( [ [ 10.4, -2.35 ] ], 'filling surface' ); work( 'morningFill', 3.2 ); await use( 'morningCap' );
fromStore(); await up();
walk( arc( 1.9, angle(), m.layout.angle + .55, -1 ), 'service shelf' ); await use( 'morningShelf' );
// Faster tower travel can get back before the stopped optic finishes coasting.
for ( let i = 0; i < 90 && ! m.safe; i ++ ) step( 1 );
assert.ok( m.safe, 'wait for the real optic to stop before opening the apparatus' );
const opening = m.layout.angle + s.lamp.angle;
walk( arc( 1.9, angle(), opening, -1 ), 'service opening' ); await use( 'morningPanel' );
if ( m.state.familiar ) work( 'morningFamiliar', 6.2 );
else {
walk( arc( 1.9, angle(), opening - .4, -1 ), 'glass surface' ); work( 'morningGlass', 3.2 );
walk( arc( 1.9, angle(), opening, 1 ), 'open apparatus access' ); work( 'morningHousing', 3.2 ); work( 'morningWick', 3.2 );
}
walk( arc( 1.9, angle(), m.layout.angle + .55, -1 ), 'oil fountain' ); await use( 'morningFountain' ); work( 'morningPour', 3.2 ); await use( 'morningSeal' );
walk( arc( 1.9, angle(), opening, 1 ), 'close service section' ); await use( 'morningPanel' );
walk( arc( 1.9, angle(), TOWER.crankAngle, -1 ), 'winding square' ); work( 'crank', 7 );
walk( arc( 1.9, angle(), opening, 1 ), 'prepared apparatus inspection' ); await use( 'morningCheck' );
walk( arc( 1.9, angle(), m.layout.angle + .55, -1 ), 'collect service kit' ); await use( 'morningShelf' );
await down();
// Approach the still-open store without toggling its door closed.
walk( [ [ 3, 4.6 ], [ 5, 4.6 ], [ 9.3, 2.2 ], [ 9.3, -1.3 ], [ 8.4, -1.8 ] ], 'return supplies to oil store' );
await use( 'morningCloths' ); walk( [ [ 8.1, -2.35 ] ], 'return kit' ); await use( 'morningKit' );
walk( [ [ 9.5, -2.35 ] ], 'return can' ); await use( 'morningCan' );
walk( [ [ 9.3, -1.3 ], [ 9.3, .9 ] ], 'leave store before securing' ); await use( 'morningStoreDoor' ); step( 2 );
walk( [ [ 9.3, 2.2 ], [ 5, 4.6 ], [ 3, 4.6 ], [ .3, 4.6 ], [ -3.6, 3.4 ], [ ROOM.journal.x + .5, ROOM.journal.z + .7 ] ], 'write up at desk' );
await use( 'journal' ); assert.ok( m.state.done && m.stowed );
}
