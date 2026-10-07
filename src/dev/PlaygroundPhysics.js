import { Vector3 } from '../engine/index.js';
import { G } from '../core/Globals.js';

const feet = new Vector3(), before = new Vector3();
// Sphere-bounded props, deliberately separate from historical furnishings.
// Swept substeps and capsule collision also constrain held objects against walls.
export function stepPlaygroundProp( body, dt, app, heldAt = null ) {
	const { mesh, velocity, radius } = body, p = mesh.position;
	if ( ! mesh.visible ) return;
	dt = Number.isFinite( dt ) ? Math.max( 0, Math.min( .1, dt ) ) : 0;
	for ( let left = dt; left > 1e-8; ) {
		const h = Math.min( left, 1 / 180 ); left -= h;
		if ( heldAt ) {
			velocity.addScaledVector( before.copy( heldAt ).sub( p ), h * 110 ); velocity.multiplyScalar( Math.exp( - h * 19 ) );
		} else {
			velocity.y -= 9.8 * h;
			const ground = app.terrainData.heightAt( p.x, p.z ), flow = app.extremeSea?.active ? app.extremeSea.sample( p.x, p.z ) : { height: 0, u: 0, v: 0 };
			const surface = G.seaLevel.value + flow.height;
			if ( ground < surface - radius && p.y < surface + radius ) {
				const wet = Math.max( 0, Math.min( 1, ( surface + radius - p.y ) / ( 2 * radius ) ) );
				velocity.y += ( wet * 25 - velocity.y * wet * 4 ) * h;
				velocity.x += ( flow.u - velocity.x ) * wet * h * 2; velocity.z += ( flow.v - velocity.z ) * wet * h * 2;
			}
		}
		velocity.clampLength( 0, 42 ); before.copy( p ); p.addScaledVector( velocity, h );
		const floor = Math.max( app.terrainData.heightAt( p.x, p.z ), app.colliders.groundHeightAt( p.x, p.z, Math.max( before.y, p.y ) + radius ) );
		if ( p.y < floor + radius ) {
			p.y = floor + radius;
			if ( velocity.y < 0 ) velocity.y = Math.abs( velocity.y ) > .8 && ! heldAt ? - velocity.y * .38 : 0;
			velocity.x *= Math.exp( - h * 5 ); velocity.z *= Math.exp( - h * 5 );
		}
		feet.copy( p ); feet.y -= radius;
		if ( app.colliders.resolveCapsule( feet, radius, radius * 2, 0 ) ) {
			p.x = feet.x; p.z = feet.z; velocity.x *= - .12; velocity.z *= - .12;
		}
	}
	if ( ! heldAt ) { mesh.rotation.x += velocity.z * dt * .35; mesh.rotation.z -= velocity.x * dt * .35; }
}

export function separatePlaygroundProps( bodies, held ) {
	for ( let i = 0; i < bodies.length; i ++ ) for ( let j = i + 1; j < bodies.length; j ++ ) {
		const a = bodies[ i ], b = bodies[ j ]; if ( ! a.mesh.visible || ! b.mesh.visible ) continue;
		const delta = before.copy( b.mesh.position ).sub( a.mesh.position ), d = delta.length(), sum = a.radius + b.radius;
		if ( d >= sum ) continue;
		if ( d < 1e-6 ) delta.set( 1, 0, 0 ); else delta.multiplyScalar( 1 / d );
		const move = sum - d, wa = a === held ? 0 : b === held ? 1 : .5, wb = 1 - wa;
		a.mesh.position.addScaledVector( delta, - move * wa ); b.mesh.position.addScaledVector( delta, move * wb );
		const approach = b.velocity.dot( delta ) - a.velocity.dot( delta );
		if ( approach < 0 ) { a.velocity.addScaledVector( delta, approach * .65 * wa ); b.velocity.addScaledVector( delta, - approach * .65 * wb ); }
	}
}
