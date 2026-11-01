import { Group, Vector3, Quaternion, Matrix4, BufferGeometry, BufferAttribute } from '../../engine/index.js';
import { loadGLB } from '../../engine/loaders/GLTF.js';
import { SkinnedModel } from '../../engine/render/Skinning.js';
import { BOATMAN_ELBOW_RIG } from './BoatmanRig.js';

const UP = new Vector3( 0, 1, 0 ), ONE = new Vector3( 1, 1, 1 );
const FORWARD = new Vector3( 0, 0, -1 );

// Stable elbow plane, including singular and overextended targets.
export function armPoints( shoulder, target, side, upper = .34, fore = .32, poleDirection = null ) {
 const axis = target.clone().sub( shoulder );
 const distance = Math.max( Math.abs( upper - fore ) + .0001, Math.min( upper + fore - .001, axis.length() ) );
 if ( axis.lengthSq() < 1e-10 ) axis.set( 0, -1, 0 ); else axis.normalize();
 const along = ( upper * upper - fore * fore + distance * distance ) / ( 2 * distance );
 const pole = poleDirection?.clone() || new Vector3( side, -.55, .15 );
 const bend = pole.addScaledVector( axis, -pole.dot( axis ) ).normalize();
 if ( bend.lengthSq() < 1e-10 ) bend.crossVectors( axis, Math.abs( axis.y ) < .9 ? UP : new Vector3( 1, 0, 0 ) ).normalize();
 const elbow = shoulder.clone().addScaledVector( axis, along ).addScaledVector( bend, Math.sqrt( Math.max( 0, upper * upper - along * along ) ) );
 return { elbow, wrist: shoulder.clone().addScaledVector( axis, distance ) };
}

// Read the bend planes authored and exported through Blender MCP. Linear
// interpolation follows the baked rowing cycle, while live targets adapt to waves.
export function authoredElbowPole( phase, side ) {
 const samples = side < 0 ? BOATMAN_ELBOW_RIG.left : BOATMAN_ELBOW_RIG.right;
 const at = ( ( phase % 1 + 1 ) % 1 ) * ( samples.length - 1 ), index = Math.floor( at );
 return new Vector3().fromArray( samples[ index ] ).lerp( new Vector3().fromArray( samples[ index + 1 ] ), at - index ).normalize();
}

function matrix( model, index ) { return new Matrix4().fromArray( model.world, index * 16 ); }
function point( model, index ) { return new Vector3().setFromMatrixPosition( matrix( model, index ) ); }
function rotation( m ) { return new Quaternion().setFromRotationMatrix( new Matrix4().extractRotation( m ) ); }
function basis( across, forward ) {
 const x = across.clone().normalize(), y = forward.clone().addScaledVector( x, -forward.dot( x ) ).normalize();
 return new Matrix4().makeBasis( x, y, new Vector3().crossVectors( x, y ).normalize() );
}
function distanceGeometry( primitive ) {
 const a = primitive.attributes, geo = new BufferGeometry();
 for ( const [ attribute, source, size ] of [ [ 'position', 'POSITION', 3 ], [ 'normal', 'NORMAL', 3 ], [ 'uv', 'TEXCOORD_0', 2 ] ] ) {
  if ( a[ source ] ) geo.setAttribute( attribute, new BufferAttribute( a[ source ].array, size ) );
 }
 geo.setAttribute( 'skinIndex', new BufferAttribute( Uint32Array.from( a.JOINTS_0.array ), 4 ) );
 const weights = Float32Array.from( a.WEIGHTS_0.array );
 for ( let i = 0; i < weights.length; i += 4 ) {
  const sum = weights[ i ] + weights[ i + 1 ] + weights[ i + 2 ] + weights[ i + 3 ];
  if ( sum > 0 ) for ( let j = 0; j < 4; j++ ) weights[ i + j ] /= sum;
 }
 geo.setAttribute( 'skinWeight', new BufferAttribute( weights, 4 ) );
 if ( primitive.indices ) geo.setIndex( new BufferAttribute( primitive.indices, 1 ) );
 geo.computeBoundingSphere(); return geo;
}

// Joe's face and anatomy, tailored in Blender. One skin, shared PBR materials,
// baked seated performance, and final hand constraints against the live oars.
export class Boatman {
 constructor( parent ) {
  this.group = new Group(); this.group.name = 'arrival-boatman-joe'; parent.add( this.group );
  this.arms = [ -1, 1 ].map( side => ( { side, upper: new Group(), fore: new Group(), hand: new Group() } ) );
  this.targets = [ new Vector3(), new Vector3() ]; this.oarAxes = [ new Vector3(), new Vector3() ];
  this.far = false; this.gripError = 0; this.lifeTime = 0; this.model = null;
 }

 async load() {
  const g = await loadGLB( `${import.meta.env?.BASE_URL ?? './'}models/characters/boatman.glb` );
  const near = g.nodes.findIndex( n => n.name.startsWith( 'Boatman near' ) && n.mesh !== undefined );
  const far = g.nodes.find( n => n.name.startsWith( 'Boatman far' ) && n.mesh !== undefined );
  if ( near < 0 || !far ) throw new Error( 'Boatman: missing wardrobe LOD' );
  const nearPrimitives = g.meshes[ g.nodes[ near ].mesh ], farPrimitives = g.meshes[ far.mesh ];
  const selected = { ...g, skins: [ g.skins[ g.nodes[ near ].skin ] ], nodes: g.nodes.map( ( n, i ) => ( { ...n, skin: i === near ? 0 : undefined } ) ) };
  const model = this.model = await SkinnedModel.create( selected, {
   materials: ( { name } ) => /head|hands|nape skin/.test( name ) ? {
    surface: `let skinLuma = dot( s.albedo, vec3f( 0.2126, 0.7152, 0.0722 ) );
     s.albedo = mix( s.albedo, vec3f( skinLuma ), 0.14 ) * vec3f( 0.94, 0.98, 1.02 );
     s.roughness = max( s.roughness, 0.72 );`,
   } : {},
  } );
  model.group.name = 'Joe - oilskins and watch cap'; this.group.add( model.group );
  for ( const mat of model.materials ) mat.underwaterLighting = 'lite';
  this.lods = model.meshes.map( ( mesh, i ) => {
   const primitive = farPrimitives.find( p => p.material === nearPrimitives[ i ].material );
   if ( !primitive ) throw new Error( 'Boatman: mismatched distance material' );
   return { mesh, near: mesh.geometry, far: distanceGeometry( primitive ) };
  } );
  const index = name => {
   const i = g.nodes.findIndex( n => n.name === 'Bip01 ' + name );
   if ( i < 0 ) throw new Error( 'Boatman: missing joint ' + name ); return i;
  };
  this.head = index( 'Head' );
  this.chest = index( 'Spine2' );
  this.lids = [ 'LEyeBlinkTop', 'REyeBlinkTop', 'LEyeBlinkBottom', 'REyeBlinkBottom' ].map( index );
  for ( const arm of this.arms ) {
   const label = arm.side < 0 ? 'L' : 'R';
   arm.indices = [ 'UpperArm', 'Forearm', 'Hand' ].map( n => index( label + ' ' + n ) );
   arm.clavicle = index( label + ' Clavicle' );
   const [ u, f, h ] = arm.indices;
   const shoulder = point( model, u ), elbow = point( model, f ), wrist = point( model, h );
   arm.upperAxis = elbow.clone().sub( shoulder ); arm.foreAxis = wrist.clone().sub( elbow );
   arm.lengths = [ arm.upperAxis.length(), arm.foreAxis.length() ];
   arm.restQ = arm.indices.map( i => rotation( matrix( model, i ) ) );
   const knuckles = [ 1, 2, 3, 4 ].map( n => point( model, index( label + ' Finger' + n ) ) );
   const centre = knuckles.reduce( ( p, k ) => p.add( k ), new Vector3() ).multiplyScalar( .25 );
   arm.offset = centre.sub( wrist );
   const handBasis = basis( knuckles[ 0 ].clone().sub( knuckles[ 3 ] ), arm.offset );
   arm.contactOffset = arm.offset.clone().addScaledVector( new Vector3().setFromMatrixColumn( handBasis, 2 ), arm.side * .027 );
   arm.inverseBasis = handBasis.invert();
   arm.localAnchor = arm.contactOffset.clone().applyQuaternion( arm.restQ[ 2 ].clone().invert() );
  }
  model.poseModifier = () => this.constrain();
  this.loaded = true; return this;
 }

 // Keep working world matrices current for child constraints in this evaluation.
 orient( index, desired, position ) {
  const m = this.model, parent = m.parent[ index ];
  const q = parent < 0 ? desired : rotation( matrix( m, parent ) ).invert().multiply( desired );
  q.toArray( m.local[ index ].r );
  new Matrix4().compose( position, desired, ONE ).toArray( m.world, index * 16 );
 }

 constrain() {
  const m = this.model, t = this.lifeTime;
  const chest = new Quaternion().fromArray( m.local[ this.chest ].r ).multiply( new Quaternion().setFromAxisAngle( new Vector3( 1, 0, 0 ), .004 * Math.sin( t * 1.17 ) ) );
  chest.toArray( m.local[ this.chest ].r );
  // Horizon glances and blinks run independently of the rowing period.
  const glance = Math.pow( Math.max( 0, Math.sin( t * .27 - .8 ) ), 6 ) * .16 - Math.pow( Math.max( 0, Math.sin( t * .19 + 2 ) ), 10 ) * .10;
  const head = new Quaternion().fromArray( m.local[ this.head ].r ).multiply( new Quaternion().setFromAxisAngle( UP, glance ) );
  head.toArray( m.local[ this.head ].r );
  // Refresh the sampled hierarchy for constraints after the independent breath.
  const localMatrix = new Matrix4(), parentMatrix = new Matrix4(), position = new Vector3(), q = new Quaternion(), scale = new Vector3();
  for ( const i of m.order ) {
   const local = m.local[ i ]; localMatrix.compose( position.fromArray( local.t ), q.fromArray( local.r ), scale.fromArray( local.s ) );
   if ( m.parent[ i ] >= 0 ) localMatrix.premultiply( parentMatrix.fromArray( m.world, m.parent[ i ] * 16 ) );
   localMatrix.toArray( m.world, i * 16 );
  }
  const cycle = ( t + .8 ) % 4.7, blink = Math.max( 0, 1 - Math.abs( cycle - .12 ) / .12 );
  for ( let j = 0; j < this.lids.length; j++ ) {
   const i = this.lids[ j ], parent = m.parent[ i ];
   const delta = new Vector3( 0, ( j < 2 ? -.0016 : .0003 ) + ( j < 2 ? -.0085 : .003 ) * blink, 0 ).applyQuaternion( rotation( matrix( m, parent ) ).invert() );
   m.local[ i ].t[ 0 ] += delta.x; m.local[ i ].t[ 1 ] += delta.y; m.local[ i ].t[ 2 ] += delta.z;
  }
  for ( let j = 0; j < this.arms.length; j++ ) {
   const arm = this.arms[ j ], [ u, f, h ] = arm.indices;
   const across = this.oarAxes[ j ].clone().multiplyScalar( -arm.side );
   const delta = basis( across, FORWARD ).multiply( arm.inverseBasis );
   const dq = rotation( delta ), desiredHand = dq.clone().multiply( arm.restQ[ 2 ] );
   const wristTarget = this.targets[ j ].clone().sub( arm.contactOffset.clone().applyQuaternion( dq ) );
   const shoulder = point( m, u );
   const reach = wristTarget.clone().sub( shoulder ), excess = reach.length() - ( arm.lengths[ 0 ] + arm.lengths[ 1 ] - .002 );
   // A steep wave raises the hands beyond the neutral shoulder's reach. The
   // scapula follows the hand instead of letting the grip detach from the oar.
   if ( excess > 0 ) {
    const shift = reach.normalize().multiplyScalar( excess );
    const c = arm.clavicle, parent = m.parent[ c ];
    const local = shift.clone().applyQuaternion( rotation( matrix( m, parent ) ).invert() );
    for ( let k = 0; k < 3; k++ ) m.local[ c ].t[ k ] += local.toArray()[ k ];
    const cm = matrix( m, c ); cm.elements[ 12 ] += shift.x; cm.elements[ 13 ] += shift.y; cm.elements[ 14 ] += shift.z;
    cm.toArray( m.world, c * 16 ); shoulder.add( shift );
   }
   const pole = authoredElbowPole( this.rowingPhase || 0, arm.side ).applyQuaternion( rotation( matrix( m, this.chest ) ) );
   const pose = armPoints( shoulder, wristTarget, arm.side, ...arm.lengths, pole );
   const upperQ = new Quaternion().setFromUnitVectors( arm.upperAxis.clone().normalize(), pose.elbow.clone().sub( shoulder ).normalize() ).multiply( arm.restQ[ 0 ] );
   const foreQ = new Quaternion().setFromUnitVectors( arm.foreAxis.clone().normalize(), pose.wrist.clone().sub( pose.elbow ).normalize() ).multiply( arm.restQ[ 1 ] );
   this.orient( u, upperQ, shoulder ); this.orient( f, foreQ, pose.elbow ); this.orient( h, desiredHand, pose.wrist );
   arm.upper.position.copy( shoulder ); arm.fore.position.copy( pose.elbow ); arm.hand.position.copy( pose.wrist );
  }
 }

 update( oars, lean = 0, camera = null, { dt = 0, phase = 0, paused = false } = {} ) {
  if ( !paused ) this.lifeTime += Math.max( 0, dt );
  const far = camera ? this.group.getWorldPosition( new Vector3() ).distanceTo( camera.position ) > ( this.far ? 17 : 20 ) : false;
  if ( far !== this.far ) { this.far = far; for ( const lod of this.lods || [] ) lod.mesh.geometry = far ? lod.far : lod.near; }
  for ( let i = 0; i < 2; i++ ) {
   const side = this.arms[ i ].side, oar = oars[ i ];
   const grip = this.group.worldToLocal( oar.localToWorld( new Vector3( -side * .75, -.012, 0 ) ) );
   this.targets[ i ].copy( grip );
   const tip = this.group.worldToLocal( oar.localToWorld( new Vector3( -side * .75 + 1, -.012 - side * .118, 0 ) ) );
   this.oarAxes[ i ].copy( tip ).sub( grip ).normalize();
  }
  if ( !this.model ) return;
  this.rowingPhase = phase;
  this.model.sample( 'rowing', phase * this.model.clipDuration( 'rowing' ), { resetMotion: !this._posed } ); this._posed = true;
  this.gripError = 0;
  for ( let i = 0; i < 2; i++ ) {
   const arm = this.arms[ i ];
   const anchor = arm.localAnchor.clone().applyMatrix4( matrix( this.model, arm.indices[ 2 ] ) );
   this.gripError = Math.max( this.gripError, anchor.distanceTo( this.targets[ i ] ) );
  }
 }
}
