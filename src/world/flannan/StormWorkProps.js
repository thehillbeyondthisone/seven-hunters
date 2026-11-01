import { Group, Mesh, Vector3, Quaternion, Color } from '../../engine/index.js';
import { Builder, Part } from '../village/GeoBuilder.js';
import { HARD } from '../Props.js';
import { HAULING_SHED } from './NextRooms.js';
import { STORM_WORK_MODEL as model } from './StormWorkModel.js';

const clamp = x => Math.max( 0, Math.min( 1, x ) );
const smooth = x => { x = clamp( x ); return x * x * ( 3 - 2 * x ); };
const geometry = new Map();
function component( village, name ) {
	const group = new Group(); group.name = 'storm-working-' + name;
	for ( const [ finish, data ] of Object.entries( model.parts[ name ] ) ) {
		const key = `${name}/${finish}`;
		if ( !geometry.has( key ) ) {
			const [ r, g, b, metal, rough ] = model.finishes[ finish ] || model.finishes.iron;
			const B = new Builder();
			B.part( 'hard', new Part( data.p, data.n, data.uv, data.idx ), 0, 0, 0, {
				tint: new Color( r, g, b ), data: HARD( .4, .015, metal, rough ),
			} );
			geometry.set( key, B.batches.hard.build() );
		}
		const mesh = new Mesh( geometry.get( key ), village.materials.hard );
		mesh.castShadow = mesh.receiveShadow = true; group.add( mesh );
	}
	return group;
}

// Visual state follows the existing four-second repair. The slide axis, tool
// pivot, travel, grip points and orientations were authored through Blender MCP.
// There is no new duty, collision obstacle, save format or independent timer.
export class StormWorkProps {
	constructor( s ) {
		this.s = s; this.contacts = []; this.progress = 0;
		const a = s.app;
		if ( !a.scene || !a.village.materials?.hard ) return;
		this.group = new Group(); this.group.name = 'storm-working-fittings';
		a.scene.add( this.group );
		this.receiverRoot = new Group();
		this.receiverRoot.position.copy( HAULING_SHED.brake ).add( new Vector3().fromArray( model.rig.receiverOffset ) );
		this.group.add( this.receiverRoot );
		this.receiver = component( a.village, 'receiver' );
		this.washer = component( a.village, 'washer' );
		this.oldPin = component( a.village, 'pin' );
		this.newPin = component( a.village, 'pin' );
		this.spanner = component( a.village, 'spanner' );
		this.receiverRoot.add( this.receiver, this.washer, this.oldPin, this.newPin, this.spanner );
		this.bench = new Group(); this.bench.name = 'storm-workshop-tools';
		this.bench.position.copy( s.station.parts.keepsakes.tools ); this.group.add( this.bench );
		for ( const [ name, record ] of [ [ 'spanner', model.rig.benchSpanner ], [ 'pin', model.rig.benchPin ] ] ) {
			const part = component( a.village, name );
			part.position.fromArray( record.offset ); part.quaternion.fromArray( record.quaternion ); this.bench.add( part );
		}
		this.update();
	}

	contact( object, name, hand = 1 ) {
		const contact = model.contacts[ name ];
		object.updateMatrixWorld( true );
		const grip = object.localToWorld( new Vector3().fromArray( contact.point ) );
		const quaternion = object.getWorldQuaternion( new Quaternion() ).multiply( new Quaternion().fromArray( contact.handQuaternion ) );
		this.contacts.push( { index: hand, position: grip, quaternion, pose: contact.pose } );
	}
	handContacts() { return this.contacts; }

	update() {
		this.contacts = [];
		if ( !this.group ) return;
		const s = this.s, state = s.flags.laterWatch || {}, current = s.interact.current;
		const working = s.beat === 'lw-repair' && current?.id === 'repairBrake' && s.app.input.down( 'KeyE' );
		const progress = this.progress = working ? clamp( s.interact.held / current.hold ) : 0;
		this.bench.visible = !state.tools && !state.repaired;
		this.oldPin.visible = !state.repaired && progress < .34;
		this.newPin.visible = !!state.repaired || progress >= .40;
		this.spanner.visible = working && progress >= .72;
		this.oldPin.position.fromArray( model.rig.pinAxis ).multiplyScalar( model.rig.pinTravel * smooth( progress / .34 ) );
		this.newPin.position.fromArray( model.rig.pinAxis ).multiplyScalar( state.repaired ? 0 : model.rig.pinTravel * ( 1 - smooth( ( progress - .40 ) / .32 ) ) );
		this.spanner.position.fromArray( model.rig.spannerPivot );
		this.spanner.quaternion.setFromAxisAngle( new Vector3().fromArray( model.rig.spannerAxis ), model.rig.spannerTurn * smooth( ( progress - .72 ) / .28 ) );
		this.group.updateMatrixWorld( true );
		if ( working ) {
			if ( progress < .34 ) this.contact( this.oldPin, 'pin' );
			else if ( progress >= .40 && progress < .72 ) this.contact( this.newPin, 'pin' );
			else if ( progress >= .72 ) this.contact( this.spanner, 'spanner' );
		} else if ( s.storm?.active && s.storm.state.oilTaken && !s.storm.state.oilStowed && s.storm.oilCan ) {
			this.contact( s.storm.oilCan, 'oilCan' );
		}
	}
}
