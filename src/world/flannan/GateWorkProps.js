import { Group, Mesh } from '../../engine/index.js';
import { Builder, Part } from '../village/GeoBuilder.js';
import { lin, HARD, WOOD } from '../Props.js';
import { GATE_WORK_MODEL } from './GateWorkModel.js';

const parts = new Map();
const finish = {
	paint: [ 'stationTimber', lin( 0x536151 ), WOOD( .74, .02, 1 ) ],
	iron: [ 'hard', lin( 0x343c38 ), HARD( .57, .025, .65, .48 ) ],
	rope: [ 'hard', lin( 0xb5a17c ), HARD( .43, 0, 0, .96 ) ],
};

export function gateWorkPart( builder, name ) {
	for ( const [ key, data ] of Object.entries( GATE_WORK_MODEL.models[ name ] ) ) {
		const id = name + '/' + key;
		if ( ! parts.has( id ) ) parts.set( id, new Part( data.p, data.n, data.uv, data.idx ) );
		const [ material, tint, vdata ] = finish[ key ];
		builder.part( material, parts.get( id ), 0, 0, 0, { tint, data: vdata } );
	}
}

// Only the binding's availability follows game state. Geometry and contacts
// come from the live Blender MCP export. Later rope condition remains unstated.
export class GateWorkProps {
	constructor( story ) {
		this.s = story; this.gates = [];
		const village = story.app.village;
		if ( ! village.materials || ! village.group ) return;
		for ( const [ index, name ] of [ [ 0, 'gate' ], [ 1, 'southGate' ] ] ) {
			const doors = story.doors[ name ];
			if ( ! doors?.length ) continue;
			const group = new Group(); group.name = name + '-rope-binding';
			group.position.copy( doors[ 0 ].hinge ).add( doors[ 1 ].hinge ).multiplyScalar( .5 );
			group.rotation.y = index === 0 ? Math.PI / 2 : 0;
			const entry = { index, name, group };
			for ( const variant of [ 'wrapped', 'ready' ] ) {
				const b = new Builder(); gateWorkPart( b, variant );
				const root = entry[ variant ] = new Group();
				for ( const [ key, batch ] of Object.entries( b.batches ) ) if ( batch.idx.length ) {
					const mesh = new Mesh( batch.build(), village.materials[ key ] );
					mesh.castShadow = mesh.receiveShadow = true;
					mesh.onBeforeRender = () => village.textures?.bake();
					root.add( mesh );
				}
				group.add( root );
			}
			village.group.add( group ); this.gates.push( entry );
		}
		this.update();
	}
	update() {
		for ( const gate of this.gates ) {
			const rope = this.s.flags.gateRopes?.[ gate.index ];
			const shut = this.s.doors[ gate.name ].every( leaf => leaf.target < .05 && leaf.open < .12 );
			gate.wrapped.visible = !! rope?.secured && shut;
			const unsettled = gate.index === 0 && this.s.flags.gateMoved && ! this.s.firstWatch.state.resecured;
			gate.ready.visible = ! rope?.secured && ! unsettled;
		}
	}
}
