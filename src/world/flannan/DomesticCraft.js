import { Group, Mesh, Vector3, Quaternion } from '../../engine/index.js';
import { Builder, Part } from '../village/GeoBuilder.js';
import { lin, HARD } from '../Props.js';
import { keeperMaterial } from './KeeperCraft.js';
import { DOMESTIC_CRAFT_MODEL as MODEL } from './DomesticCraftModel.js';

const finishes = { iron: [ 0x343d39, .65, .43 ], tin: [ 0x858a80, .75, .44 ], black: [ 0x181d1b, .1, .8 ], cream: [ 0xd8d1ba, 0, .3 ], blue: [ 0x40595e, 0, .32 ],
	breadCrust: [ 0xa77b3e, 0, .91 ], breadCrumb: [ 0xd9be82, 0, .97 ], water: [ 0x879d9d, 0, .21 ], tea: [ 0x583114, 0, .24 ] };
const geometry = new Map(), DOWN = new Vector3( 0, -1, 0 );
const clamp = t => Math.max( 0, Math.min( 1, t ) );
const ease = t => { t = clamp( t ); return t * t * ( 3 - 2 * t ); };
const v = p => new Vector3().fromArray( p ), q = a => new Quaternion().fromArray( a );
const pose = name => ( { position: v( MODEL.poses[ name ].position ), quaternion: q( MODEL.poses[ name ].quaternion ) } );

function modelGroup( name ) {
	const group = new Group(); group.name = 'domestic-' + name;
	if ( ! geometry.has( name ) ) {
		const B = new Builder();
		for ( const [ finish, g ] of Object.entries( MODEL.models[ name ] ) ) {
			const [ color, metal, rough ] = finishes[ finish ];
			B.part( 'domestic', new Part( g.p, g.n, g.uv, g.idx ), 0, 0, 0, { tint: lin( color ), data: HARD( .4, .01, metal, rough ) } );
		}
		geometry.set( name, B.batches.domestic.build() );
	}
	const mesh = new Mesh( geometry.get( name ), keeperMaterial() ); mesh.name = group.name + '-mesh'; mesh.castShadow = mesh.receiveShadow = true;
	group.add( mesh ); return group;
}
function apply( group, p ) { group.position.copy( p.position ); group.quaternion.copy( p.quaternion ); }
function blend( group, a, b, t ) { group.position.lerpVectors( a.position, b.position, clamp( t ) ); group.quaternion.slerpQuaternions( a.quaternion, b.quaternion, clamp( t ) ); }

// Constructed once with the station, so exploration/review routes retain the
// same props. The old merged placeholders are omitted in NextRooms.js.
export function makeDomesticProps( floor ) {
	const group = new Group(), models = {};
	group.name = 'domestic-work-props'; group.position.y = floor;
	for ( const name of Object.keys( MODEL.models ) ) { models[ name ] = modelGroup( name ); group.add( models[ name ] ); }
	models.kettle.add( models.kettleLid ); models.cup.add( models.teaSurface ); models.breadMain.add( models.breadPiece );
	for ( const [ name, anchor ] of [ [ 'kettle', 'kettleRest' ], [ 'jug', 'jugRest' ], [ 'cup', 'cupRest' ], [ 'breadMain', 'breadRest' ] ] ) apply( models[ name ], pose( anchor ) );
	models.kettleLid.position.set( 0, 0, 0 ); models.breadPiece.position.set( 0, 0, 0 );
	models.waterStream.visible = models.teaStream.visible = models.teaSurface.visible = false;
	return { group, models, floor };
}

export class DomesticCraft {
	constructor( next ) { this.next = next; this.s = next.s; this.props = this.s.moving.domesticCraft || this.s.station.parts.domesticCraft; this.action = null; }
	get meal() {
		const meals = this.next.state.meals || {}, day = this.s.beat.slice( 0, 2 );
		return meals[ day ] || Object.values( meals ).sort( ( a, b ) => ( b.started || 0 ) - ( a.started || 0 ) )[ 0 ] || {};
	}
	get carrying() { return !! this.meal.kettleCarried && this.next.active; }
	get carryingTool() { return this.carrying || !! this.action; }
	carryPose() {
		const a = this.s.app, p = pose( 'kettleCarry' );
		p.position.applyQuaternion( a.camera.quaternion ).add( a.camera.position );
		this.props.group.updateWorldMatrix( true, false ); this.props.group.worldToLocal( p.position );
		p.quaternion.premultiply( a.camera.quaternion ); return p;
	}
	target( id ) {
		const name = id === 'breakfastWater' ? 'jugRest' : id === 'breakfastTea' ? 'cupRest' : id === 'breakfastBread' ? 'breadRest' : id === 'breakfastKettleTake' && this.meal.kettleAt === 'table' ? 'kettleTable' : 'kettleRest';
		const p = pose( name ).position;
		const top = id === 'breakfastWater' ? MODEL.tips.jug : id === 'breakfastTea' ? MODEL.tips.cup : id === 'breakfastBread' ? MODEL.contacts.breadSteady.position : MODEL.tips.kettleMouth;
		p.add( v( top ) ); p.y += this.props?.floor || 0; return p;
	}
	update( dt, blocked = false ) {
		if ( ! this.props ) return;
		const { models: m } = this.props, s = this.s, meal = this.meal, current = s.interact.current;
		this.blocked = blocked;
		this.action = ! blocked && this.next.active && s.app.input.down( 'KeyE' ) && this.next.mealStep()?.id === current?.id ? current.id : null;
		const t = clamp( s.interact.held / ( current?.hold || 1 ) ), carried = this.carrying, carry = carried || this.action ? this.carryPose() : null;
		apply( m.kettle, carried ? carry : pose( meal.kettleAt === 'table' ? 'kettleTable' : 'kettleRest' ) );
		apply( m.jug, pose( 'jugRest' ) ); apply( m.cup, pose( 'cupRest' ) ); apply( m.breadMain, pose( 'breadRest' ) );
		m.kettleLid.position.set( 0, 0, 0 ); m.kettleLid.quaternion.identity(); m.kettle.visible = ! ( blocked && carried );
		apply( m.breadPiece, meal.breadBroken ? pose( 'breadServed' ) : { position: new Vector3(), quaternion: new Quaternion() } );
		m.waterStream.visible = m.teaStream.visible = false; m.teaSurface.visible = !! meal.tea;
		if ( this.action === 'breakfastKettleTake' ) blend( m.kettle, pose( meal.kettleAt === 'table' ? 'kettleTable' : 'kettleRest' ), carry, ease( t ) );
		if ( this.action === 'breakfastWater' ) {
			const fill = pose( 'kettleFill' ); blend( m.kettle, carry, fill, ease( t / .22 ) );
			if ( t > .82 ) blend( m.kettle, fill, carry, ease( ( t - .82 ) / .18 ) );
			const lift = pose( 'jugLift' ), pour = pose( 'jugPour' );
			blend( m.jug, pose( 'jugRest' ), lift, ease( t / .22 ) );
			if ( t > .22 ) blend( m.jug, lift, pour, ease( ( t - .22 ) / .2 ) );
			if ( t > .76 ) blend( m.jug, pour, pose( 'jugRest' ), ease( ( t - .76 ) / .24 ) );
			blend( m.kettleLid, { position: new Vector3(), quaternion: new Quaternion() }, pose( 'lidOpen' ), ease( t / .2 ) * ( 1 - ease( ( t - .8 ) / .2 ) ) );
			if ( t > .34 && t < .77 ) this.stream( 'waterStream', 'jug', 'jug', 'kettle', 'kettleMouth' );
		}
		if ( this.action === 'breakfastKettle' ) {
			const hot = pose( 'kettleHeat' ); blend( m.kettle, carry, hot, ease( t / .18 ) );
			if ( t > .82 ) blend( m.kettle, hot, carry, ease( ( t - .82 ) / .18 ) );
			const fire = s.app.localLights?.sources.find( l => l.kind === 'kitchenFire' ); if ( fire ) fire.scale = 1;
		}
		if ( this.action === 'breakfastTea' ) {
			const pour = pose( 'kettlePour' ); blend( m.kettle, carry, pour, ease( t / .28 ) );
			if ( t > .77 ) blend( m.kettle, pour, pose( 'kettleTable' ), ease( ( t - .77 ) / .23 ) );
			if ( t > .34 && t < .76 ) this.stream( 'teaStream', 'kettle', 'kettle', 'cup', 'cup' );
			if ( t > .48 ) m.teaSurface.visible = true;
		}
		if ( this.action === 'breakfastBread' ) blend( m.breadPiece, { position: new Vector3(), quaternion: new Quaternion() }, pose( 'breadLift' ), ease( t / .7 ) );
		this.props.group.updateMatrixWorld( true );
	}
	stream( name, fromModel, fromTip, toModel, toTip ) {
		const m = this.props.models, stream = m[ name ];
		this.props.group.updateMatrixWorld( true );
		const a = m[ fromModel ].localToWorld( v( MODEL.tips[ fromTip ] ) ), b = m[ toModel ].localToWorld( v( MODEL.tips[ toTip ] ) );
		this.props.group.worldToLocal( a ); this.props.group.worldToLocal( b );
		const delta = b.sub( a ); stream.position.copy( a ); stream.quaternion.setFromUnitVectors( DOWN, delta.clone().normalize() ); stream.scale.set( 1, delta.length(), 1 ); stream.visible = true;
	}
	handContacts() {
		if ( ! this.props || this.blocked ) return [];
		const names = this.action === 'breakfastBread' ? [ 'breadSteady', 'breadBreak' ] : this.action === 'breakfastWater' ? [ 'kettleGrip', 'jugGrip' ] : this.action === 'kitchenStove' ? [ 'stoveDraught' ] : this.carrying || [ 'breakfastKettleTake', 'breakfastKettle', 'breakfastTea' ].includes( this.action ) ? [ 'kettleGrip' ] : [];
		this.props.group.updateMatrixWorld( true );
		return names.map( name => {
			const c = MODEL.contacts[ name ], model = this.props.models[ c.prop ];
			return { index: c.index, pose: c.pose, position: model.localToWorld( v( c.position ) ), quaternion: model.getWorldQuaternion( new Quaternion() ).multiply( q( c.quaternion ) ) };
		} );
	}
}
