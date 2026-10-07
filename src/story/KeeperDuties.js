import { Group, Mesh, Vector3 } from '../engine/index.js';
import { Builder } from '../world/village/GeoBuilder.js';
import { lin, HARD } from '../world/Props.js';
import { TOWER } from '../world/flannan/Station.js';
import { SUNSET, SUNRISE } from './Script.js';
import { WeightDrive } from '../station/WeightDrive.js';
import { WARN } from '../station/Lamp.js';

// Bounded first-lighting study. Exact controls and timings are reconstructions;
// see docs/KEEPER-DUTIES.md. No changes to the normal watch or its save key.
export const KEEPER_PAPER = {
	id: 'keeper-duty-study', label: 'Keeping the evening light', sub: 'Lamp, optic and clockwork: three different jobs.', title: 'Keeping the evening light',
	body: [
		'Before lighting, examine the prepared apparatus. The oil supply feeds the burner; even, trimmed wicks and clean glass help the light burn clearly. In this study the previous watch has left the apparatus ready. Sound equipment does not need imaginary repairs.',
		'Wind the clockwork at the crank on the pedestal. Winding raises the driving weight. It does not light the burner. In this reconstruction a separate stop holds the machine until you release it.',
		'At sunset, light the burner. Release the machine’s stop at the small brass lever beside the crank. The flame remains at the centre while the optic turns around it. Watch the flame settle and inspect the apparatus again.',
		'On the first night, go down to the upper stair landing and examine the driving weight in the central tube. Watch it descend as the clockwork turns the optic, then return to the crank and raise it again while the light continues working. The tube is exposed in this teaching reconstruction so you can see the connection.',
		'Through the watch, attend to the lamp and the rotation. A burning lamp with a stopped optic is not the same signal as a correctly working light. At dawn, extinguish the lamp and make the apparatus ready for the following evening.',
	],
	provenance: 'Authored teaching notes, not recovered 1901 instructions. Flannan records establish lamp preparation, filled oil supplies, cleaned optics and machinery, and slate-to-log observations. Museum records from other stations explain weight-driven clockwork. The exposed tube, weight dimensions and travel, start lever, winding duration and condition descriptions here are provisional reconstructions. Weather measurements, wick adjustment and morning servicing are not yet simulated by this study.',
	sources: [
		{ label: 'Northern Lighthouse Board · Flannan records', url: 'https://www.nlb.org.uk/history/flannan-isles/' },
		{ label: 'Northern Lighthouse Board · lighthouse keeping', url: 'https://www.nlb.org.uk/history/lighthouse-keeping/' },
		{ label: 'Trinity House · 1839 instructions (comparative evidence)', url: 'https://trinityhouse.co.uk/about-us/history-of-trinity-house/from-the-archives/instructions-for-lighthouse-keepers-1839' },
		{ label: 'St Augustine Lighthouse Museum · weight-driven clockwork (comparative evidence)', url: 'https://www.staugustinelighthouse.org/2015/12/16/lighthouse-technology-clockwork-mechanism/' },
		{ label: 'Parks Victoria · surviving clockwork weights (comparative evidence)', url: 'https://victoriancollections.net.au/items/5b7383d121ea671328cd0dbc' },
	],
};

export class KeeperDuties {
	constructor( story ) {
		this.s = story;
		this.note = null;
		this.lever = null;
		this.at = TOWER.crank.clone().add( new Vector3( 0, -.32, 0 ) );
		// Put the stop on the cabinet beside, rather than underneath, the winding square.
		this.at.x -= Math.sin( TOWER.crankAngle ) * .25;
		this.at.z += Math.cos( TOWER.crankAngle ) * .25;
	}

	get active() { return !! this.s.app.qs?.has( 'keeperPreview' ) && ! this.s.next?.active; }
	get state() { return this.s.flags.keeperDuty ||= { inspected: false, verified: false }; }

	install() {
		if ( ! this.active ) return;
		const lens = this.s.interact.get( 'lens' ), crank = this.s.interact.get( 'crank' );
		lens.hold = 0; // The inspection is a deliberate use, not a timed challenge.
		crank.hideProgress = true;
		crank.text = () => this.s.lamp.wind >= .999 ? 'The driving weight is fully raised' : 'Wind the clockwork · raise the driving weight';
		this.s.interact.add( { id: 'machineStop', at: this.at, size: .13, reach: 1.8,
			when: () => this.active, text: () => this.s.lamp.running ? 'Stop the clockwork' : 'Release the clockwork stop', use: () => this.toggleStop() } );
		const way = this.s.station.parts.weightWay || { bottom: TOWER.floor + .65, top: TOWER.deck - .8, anchor: TOWER.deck - .25, angle: TOWER.hatch.angle };
		this.drive = new WeightDrive( this.s.app.village, way );
		this.s.moving.group?.add( this.drive.group );
		this.drive.sync( this.s.lamp.wind );
		this.s.interact.add( { id: 'drivingWeight', at: () => this.drive.at, size: .24, reach: 2.15,
			when: () => this.active && this.weightVisible(), text: 'Examine the driving weight', use: () => this.inspectWeight() } );
		this.buildLever();
	}

	buildLever() {
		const village = this.s.app.village, group = this.s.moving.group;
		if ( ! group || ! village.materials?.hard ) return; // Logic-only tests have no renderer.
		const B = new Builder(), brass = { tint: lin( 0xb08a3e ), data: HARD( .45, 0, .8, .35 ) };
		B.cyl( 'hard', 0, 0, 0, .045, .045, .06, { rx: Math.PI / 2, segs: 12, ...brass } );
		B.rod( 'hard', [ 0, 0, .04 ], [ 0, .14, .04 ], .018, .018, { segs: 8, ...brass } );
		B.cyl( 'hard', 0, .14, .04, .035, .035, .05, { rx: Math.PI / 2, segs: 12, ...brass } );
		const base = new Group(); base.position.copy( this.at ); base.rotation.y = Math.PI / 2 - TOWER.crankAngle;
		const lever = this.lever = new Mesh( B.batches.hard.build(), village.materials.hard );
		lever.name = 'keeper-study-machine-stop'; lever.castShadow = lever.receiveShadow = true;
		lever.onBeforeRender = () => village.textures.bake();
		base.add( lever ); group.add( base );
	}

	say( from, text ) {
		this.note = { from, text, lesson: true, remaining: Math.max( 14, text.split( /\s+/ ).length / 2 + 4 ) };
	}

	goal() {
		if ( ! this.active || this.s.h >= SUNRISE + 24 - .25 ) return null;
		if ( this.state.verified ) {
			if ( this.s.lamp.wind < WARN ) return 'The weight is nearly down. Return to the winding crank and raise it.';
			if ( ! this.state.descentSeen ) return this.state.weightLook ? 'Watch the driving weight descend as the optic turns.' : 'Go down to the upper stair landing. Examine the driving weight in the central tube.';
			if ( ! this.state.rewound ) return 'Return to the lantern crank. Raise the weight again while the optic keeps turning.';
			return null;
		}
		if ( ! this.state.inspected ) return 'Examine the prepared lamp and optic before the evening light.';
		if ( ! this.s.lamp.lit ) return this.s.lamp.wind < .95 ? 'Wind the clockwork. The weight drives the optic, not the flame.' : 'The apparatus is ready. Light the burner at sunset.';
		if ( this.s.lamp.wind < .95 && ! this.s.lamp.running ) return 'The lamp is burning. Raise the driving weight at the crank.';
		if ( ! this.s.lamp.running ) return 'Release the clockwork stop: the brass lever beside the crank.';
		return 'Watch the flame settle and the optic turn. Examine the apparatus again.';
	}

	guidance() {
		if ( ! this.goal() ) return null;
		const L = this.s.lamp;
		if ( this.state.verified ) {
			if ( L.wind < WARN || this.state.descentSeen ) return { at: TOWER.crank, label: 'Raise the weight again · hold E', zone: 'lantern' };
			return { at: this.drive.at, label: 'Driving weight · E', zone: 'weight' };
		}
		if ( this.state.inspected && L.wind < .95 && ! L.running ) return { at: TOWER.crank, label: 'Winding crank', zone: 'lantern' };
		if ( L.lit && ! L.running ) return { at: this.at, label: 'Clockwork stop', zone: 'lantern' };
		return { at: new Vector3( 0, TOWER.deck + 2.1, 0 ), label: L.lit ? 'Lamp and optic' : 'Prepared lamp', zone: 'lantern' };
	}

	lensText() {
		if ( this.s.h >= SUNRISE + 24 - .25 ) return null;
		if ( ! this.state.inspected ) return 'Examine the prepared lamp and optic';
		if ( this.s.lamp.lit ) return 'Examine the burning lamp and optic';
		return this.s.h < SUNSET - .25 ? 'Keep watch until sunset' : 'Light the burner';
	}

	async useLens() {
		const s = this.s, L = s.lamp;
		if ( s.h >= SUNRISE + 24 - .25 ) return false;
		if ( ! this.state.inspected ) {
			this.state.inspected = true;
			this.say( 'The prepared apparatus', 'The oil supply is full, the wicks trimmed, the lens and machinery clean. The previous watch has left it ready. The lamp makes the light; the clockwork turns the optic.' );
			s.save(); return true;
		}
		if ( ! L.lit ) {
			if ( s.h < SUNSET - .25 ) { await s._skipTo( SUNSET - .03, 'You keep the sunset watch beside the prepared lamp.' ); return true; }
			L.ignite(); s.sound?.ignite(); s.flags.litAt = s.h; s.row( s.h, 'Lamp lit.' );
			s.setBeat( 'machine' );
			this.say( 'The burner', L.running ? 'The flame is settling. Watch that it burns clearly and that the optic continues to turn.' : 'The burner is alight. The glass optic is still: its clockwork is a separate mechanism. Release the brass stop beside the crank when the weight is raised.' );
			s.save(); return true;
		}
		if ( ! L.running || L.wind <= 0 || ! L.turning ) this.say( 'A light held fixed', 'The lamp is burning, but the optic is not turning at its working speed. Attend to the driving weight and clockwork. The flame alone does not give the light its flashing character.' );
		else if ( L.glow < .95 || L.speed < .95 ) this.say( 'Let the apparatus settle', 'The burner is warming and the optic is gathering speed. Keep watch here for a moment, then examine it again.' );
		else {
			if ( ! this.state.verified ) s.row( s.h, 'Lamp and revolving apparatus examined; light working.' );
			this.state.verified = true;
			s.setBeat( 'watch' );
			this.say( 'Keeping the light', this.state.rewound ? 'The flame is steady and the optic revolves. Keep attending to the light and its clockwork throughout the watch.' : 'The flame is steady at the centre; the optic revolves around it. Now go down to the upper stair landing and examine the weight in the central tube. Watch what is driving the machine.' );
		}
		s.save(); return true;
	}

	wind( dt ) {
		const L = this.s.lamp, before = L.wind;
		if ( before < .999 && this.s.moving.crank ) this.s.moving.crank.rotation.z -= Math.max( 0, dt ) * Math.PI * 1.8;
		// Compressed hand-work for the study, not a measured winding rate.
		L.addWind( Math.max( 0, dt ) / 10, { start: false } );
		this.drive.sync( L.wind );
		this.s.sound?.ratchet( L.wind < .999 );
		if ( this.state.descentSeen && ! this.state.rewound && L.running && L.wind > before && L.wind >= Math.min( .999, this.state.descentWind + .08 ) ) {
			this.state.rewound = true;
			this.s.row( this.s.h, 'Driving weight raised again while the revolving apparatus continued working.' );
			this.say( 'Winding during the watch', 'The crank takes up the cable and raises the weight again. The optic continues turning and the burner stays alight. Attend to the weight through the night and wind again before it reaches the foot of the tube.' );
			this.s.save();
		}
		if ( before < .999 && L.wind >= .999 ) {
			this.say( 'The driving weight', L.running ? 'The driving weight is fully raised. The machine continues to turn the optic.' : 'The driving weight is fully raised. It stores the work of your hands; the clockwork uses it to turn the optic. The stop is still holding the machine.' );
			this.s.save();
		}
	}

	toggleStop() {
		const s = this.s, L = s.lamp;
		if ( L.running ) {
			L.stop(); this.state.verified = false;
			this.say( 'Clockwork stopped', 'The optic slows, though the burner remains alight. A fixed light does not show the intended flashing character. Release the stop again to resume the rotation.' );
		} else if ( L.wind <= 0 ) this.say( 'No driving weight', 'The weight is down. Wind the clockwork at the crank before releasing the stop.' );
		else {
			L.start();
			if ( L.lit ) s.row( s.h, 'Machine set going.' );
			this.say( 'The revolving apparatus', L.lit ? 'The weight descends and the clockwork turns the optic. Watch the flame and moving glass before leaving the lantern.' : 'The optic turns, but the burner is dark. Winding and rotation cannot supply the light: the lamp must also be lit at sunset.' );
		}
		s.save();
	}

	weightVisible() {
		const p = this.s.app.camera.position, a = this.drive.way.angle;
		return p.x * Math.cos( a ) + p.z * Math.sin( a ) > .05;
	}

	inspectWeight() {
		const s = this.s, L = s.lamp;
		this.drive.sync( L.wind );
		if ( L.wind <= 0 ) this.say( 'The weight at the foot', 'The weight has reached the foot of the tube. With no further fall to drive it, the clockwork cannot keep the optic turning. Return to the crank and raise the weight.' );
		else if ( ! L.running ) this.say( 'The weight held', 'The cable is taut, but the stop holds the clockwork and the weight remains at this height. Raising the weight stores the work of winding; releasing the stop lets gravity drive the optic.' );
		else {
			this.state.weightLook ||= { wind: L.wind };
			this.say( 'The driving weight', this.state.descentSeen ? 'The weight is descending on its cable. The clockwork governs that fall and turns the optic. Winding raises the weight so the mechanism can continue working.' : 'Watch the iron weight on its cable. It descends slowly as the clockwork turns the optic above. The flame does not drive the machinery. Keep looking and you will see the weight move down the tube.' );
		}
		s.save();
	}

	observeWeight( blocked ) {
		const state = this.state, L = this.s.lamp;
		if ( blocked || ! state.verified || ! state.weightLook || state.descentSeen || ! L.running || this.s.interact.current?.id !== 'drivingWeight' || ! this.weightVisible() ) return;
		// Observe real movement of the simulation, never a countdown or a scripted fall.
		const drop = ( state.weightLook.wind - L.wind ) * ( this.drive.way.top - this.drive.way.bottom );
		if ( drop < .18 ) return;
		state.descentSeen = true; state.descentWind = L.wind;
		this.s.row( this.s.h, 'Driving weight observed descending; clockwork turning the optic.' );
		this.say( 'The weight descends', 'The weight has moved down the tube, pulling the cable through the clockwork. That fall supplies the work that turns the optic. Return to the crank and raise it again; the light can keep working while you wind.' );
		this.s.save();
	}

	update( dt, { blocked = false } = {} ) {
		if ( this.lever ) this.lever.visible = this.active;
		if ( this.drive ) { this.drive.group.visible = this.active; this.drive.sync( this.s.lamp.wind ); }
		if ( ! this.active ) return null;
		if ( this.s.lamp.lit && this.s.lamp.wind <= 0 ) this.state.verified = false;
		if ( this.lever ) this.lever.rotation.z = this.s.lamp.running ? -.8 : 0;
		this.observeWeight( blocked );
		if ( blocked || ! this.s.app.input.down( 'KeyE' ) || this.s.interact.current?.id !== 'crank' ) this.s.sound?.ratchet( false );
		if ( ! this.note || blocked ) return null;
		this.note.remaining -= Math.max( 0, Math.min( dt, 1 ) );
		if ( this.note.remaining <= 0 ) { this.note = null; return null; }
		return this.note;
	}
}
