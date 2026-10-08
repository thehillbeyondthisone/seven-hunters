import { Group, Mesh, Vector3 } from '../engine/index.js';
import { Builder } from '../world/village/GeoBuilder.js';
import { lin, HARD } from '../world/Props.js';
import { bolt } from '../world/flannan/ApparatusCraft.js';

// Teaching reconstruction, derived from the same winding state that drives the optic.
// Dimensions and the exposed weightway are not recovered Flannan specifications.
export function weightHeight( way, wind ) {
	return way.bottom + ( way.top - way.bottom ) * Math.max( 0, Math.min( 1, wind ) );
}

export class WeightDrive {
	constructor( village, way ) {
		this.way = way;
		this.at = new Vector3();
		this.group = new Group(); this.group.name = 'keeper-study-weight-drive';
		this.weight = new Group(); this.weight.name = 'keeper-study-driving-weight';
		this.cable = new Group(); this.cable.name = 'keeper-study-weight-cable';
		this.group.add( this.weight, this.cable );
		if ( village.materials?.hard ) {
			const iron = { tint: lin( 0x73736b ), data: HARD( .45, 0, .7, .3 ) };
			const B = new Builder();
			for ( let i = 0; i < 5; i ++ ) B.cyl( 'hard', 0, -.25 + i * .10, 0, .145, .145, .09, { segs: 20, ...iron } );
			const dark = { tint: lin( 0x343d39 ), data: HARD( .48, .01, .7, .45 ) };
			for ( const y of [ -.274, .248 ] ) B.cyl( 'hard', 0, y, 0, .151, .151, .019, { segs: 24, ...dark } );
			bolt( B, [ 0, .267, 0 ], [ 0, 1, 0 ], dark, .032 );
			bolt( B, [ 0, -.274, 0 ], [ 0, -1, 0 ], dark, .032 );
			B.rod( 'hard', [ 0, -.27, 0 ], [ 0, .38, 0 ], .022, .022, { segs: 8, ...iron } );
			B.torus( 'hard', 0, .34, 0, .055, .012, { rx: Math.PI / 2, radial: 6, tubular: 16, ...iron } );
			const wire = new Builder(); wire.cyl( 'hard', 0, -.5, 0, .007, .007, 1, { segs: 6, ...iron } );
			for ( const [ builder, parent ] of [ [ B, this.weight ], [ wire, this.cable ] ] ) {
				const mesh = new Mesh( builder.batches.hard.build(), village.materials.hard );
				mesh.castShadow = mesh.receiveShadow = true;
				mesh.onBeforeRender = () => village.textures.bake();
				parent.add( mesh );
			}
		}
		this.sync( 0 );
	}
	sync( wind ) {
		const y = weightHeight( this.way, wind ), end = y + .38;
		this.at.set( 0, y, 0 );
		this.weight.position.y = y;
		this.cable.position.y = ( this.way.anchor + end ) / 2;
		this.cable.scale.y = Math.max( .02, this.way.anchor - end );
	}
}
