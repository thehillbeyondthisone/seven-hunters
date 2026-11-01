import { Group, Mesh, Vector3 } from '../engine/index.js';
import { Builder } from '../world/village/GeoBuilder.js';
import { lin, HARD } from '../world/Props.js';
import { TOWER } from '../world/flannan/Station.js';
import { SUNSET, SUNRISE } from './Script.js';
import { WeightDrive } from '../station/WeightDrive.js';
import { WARN } from '../station/Lamp.js';
import { WeightDriveCutscene } from './WeightDriveCutscene.js';
import { FirstLightCutscene } from './FirstLightCutscene.js';

// First lighting for new watches, also available as an isolated study. Existing
// watches without keeperRoutine keep their original controls and progression.
// Exact controls, timings and the exposed weightway are reconstructions.
export const KEEPER_PAPER = {
	id: 'keeper-duty-study', label: 'Keeping the evening light', sub: 'Lamp, optic and clockwork: three different jobs.', title: 'Keeping the evening light',
	body: [
		'Before lighting, examine the prepared apparatus. The oil supply feeds the burner; even, trimmed wicks and clean glass help the light burn clearly. In this study the previous watch has left the apparatus ready. Sound equipment does not need imaginary repairs.',
		'Wind the clockwork at the crank on the pedestal. Winding raises the driving weight. It does not light the burner. In this reconstruction a separate stop holds the machine until you release it.',
		'At sunset, light the burner. The first lighting shows the flame warming and explains the separate clockwork. Release the machine’s stop at the small brass lever beside the crank. The flame remains at the centre while the optic turns around it.',
		'The first time you release the stop after fully winding, a short view down the tower shows the iron weights descending through the column and drawing the cable through the clockwork. Above, the optic revolves around the stationary burner. These views teach the working apparatus; afterwards, raise the weights again while the light continues working.',
		'Through the watch, attend to the lamp and the rotation. A burning lamp with a stopped optic is not the same signal as a correctly working light. At dawn, extinguish the lamp and make the apparatus ready for the following evening.',
	],
	provenance: 'Authored teaching notes, not recovered 1901 instructions. Flannan records establish lamp preparation, filled oil supplies, cleaned optics and machinery, and slate-to-log observations. Museum records from other stations explain weight-driven clockwork. The exposed tube, weight dimensions and travel, start lever, winding duration and condition descriptions here are provisional reconstructions. The separate Morning servicing study adds generic oil handling, cleaning and wick preparation; exact Flannan burner details remain unverified. Normal watches retain their existing dawn flow.',
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
		this.cutscene = new WeightDriveCutscene( this );
		this.firstLight = new FirstLightCutscene( this );
		this.at = TOWER.crank.clone().add( new Vector3( 0, -.32, 0 ) );
		// Put the stop on the cabinet beside, rather than underneath, the winding square.
		this.at.x -= Math.sin( TOWER.crankAngle ) * .25;
		this.at.z += Math.cos( TOWER.crankAngle ) * .25;
	}

	get enabled() { return !! this.s.app.qs?.has( 'keeperPreview' ) || !! this.s.flags.keeperRoutine; }
	get firstNight() { return this.enabled && ! this.s.morning?.enabled && ! this.s.next?.active && ! this.s.returningLight?.active && ! this.s.storm?.active && ! this.s.later?.active; }
	get active() { return this.firstNight && ! [ 'intro', 'crossing', 'climb', 'room', 'letter', 'dawn', 'journal', 'end' ].includes( this.s.beat ); }
	get linear() { return this.firstNight && this.s.h < SUNRISE + 24 - .25 && ! [ 'dawn', 'journal', 'end' ].includes( this.s.beat ); }
	get state() { return this.s.flags.keeperDuty ||= { inspected: false, verified: false }; }
	get driveTaught() { return !! ( this.state.driveCutsceneSeen || this.state.descentSeen ); }
	// Either authored view (weight drive or first lighting) holds the camera.
	get cinematic() { return this.cutscene.active || this.firstLight.active; }

	// One source of truth for prompts, handlers, objectives and restored saves.
	get step() {
		if ( ! this.active ) return null;
		if ( this.busy || this.cinematic || Number.isFinite( this.state.cutsceneElapsed ) ) return 'wait';
		const L = this.s.lamp;
		if ( ! this.state.inspected ) return 'inspect';
		// Older saves may have started the mechanism before learning the drive.
		if ( ! this.driveTaught && L.running ) return 'stop';
		if ( ! L.lit || ! L.running ) {
			if ( L.wind < ( this.driveTaught ? .95 : .999 ) ) return 'wind';
			return L.lit ? 'release' : 'light';
		}
		if ( L.wind < WARN || this.state.windingWatch ) return 'wind';
		if ( ! this.state.rewound ) return 'rewind';
		return 'watch';
	}

	allows( id ) {
		if ( ! this.linear ) return true;
		const step = this.step;
		if ( id === 'lens' ) return [ 'inspect', 'light' ].includes( step );
		if ( id === 'crank' ) return [ 'wind', 'rewind' ].includes( step ) || step === 'watch' && this.s.lamp.wind < .999;
		if ( id === 'machineStop' ) return [ 'stop', 'release' ].includes( step );
		if ( id === 'watch' ) return step === 'watch';
		return false;
	}

	install() {
		const lens = this.s.interact.get( 'lens' ), crank = this.s.interact.get( 'crank' );
		this.originalLensHold = lens.hold;
		this.originalCrankText = crank.text;
		crank.text = () => this.active ? this.s.lamp.wind >= .999 ? 'The driving weight is fully raised' : 'Wind the clockwork · raise the driving weight' : this.originalCrankText();
		this.s.interact.add( { id: 'machineStop', at: this.at, size: .13, reach: 1.8,
			when: () => this.active && this.allows( 'machineStop' ), text: () => this.s.lamp.running ? 'Stop the clockwork' : 'Release the clockwork stop', use: () => this.toggleStop() } );
		const way = this.s.station.parts.weightWay || { bottom: TOWER.floor + .65, top: TOWER.landing - .75, anchor: TOWER.deck - .25, angle: TOWER.hatch.angle };
		this.drive = new WeightDrive( this.s.app.village, way );
		this.s.moving.group?.add( this.drive.group );
		this.drive.sync( this.s.lamp.wind );
		this.buildLever();
		this.sync();
	}

	sync() {
		const enabled = this.enabled, controls = enabled && ! this.s.next?.active && ! this.s.returningLight?.active && ! this.s.storm?.active && ! [ 'dawn', 'journal' ].includes( this.s.beat );
		this.s.interact.get( 'lens' ).hold = controls ? 0 : this.originalLensHold;
		// Old saves waiting for a repeat inspection have already seen the lesson.
		if ( this.active && this.driveTaught && this.s.lamp.lit && this.s.lamp.running ) {
			this.state.verified = true;
			// sync also runs inside restore, before the player pose is restored.
			// Let the normal save cadence persist this migration afterwards.
			if ( this.s.beat === 'machine' ) this.s.beat = 'watch';
		}
		if ( this.drive ) { this.drive.group.visible = enabled; this.drive.sync( this.s.lamp.wind ); }
		if ( this.s.moving.weightCover ) this.s.moving.weightCover.visible = ! enabled;
		if ( this.lever ) { this.lever.visible = enabled; this.lever.rotation.z = this.s.lamp.running ? -.8 : 0; }
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
		switch ( this.step ) {
			case 'wait': return this.firstLight.active ? 'Watch the burner come alight.' : 'Watch how the descending weight drives the optic.';
			case 'stop': return 'Stop the clockwork, wind the crank fully, then release the stop to see how the weight drives the optic.';
			case 'inspect': return 'Examine the prepared lamp and optic before the evening light.';
			case 'wind':
				if ( ! this.state.rewound ) return 'Wind the clockwork fully. The weight drives the optic, not the flame.';
				return this.s.lamp.wind < WARN ? 'The weight is nearly down. Return to the winding crank and fully raise it.' : 'Fully raise the driving weight before continuing the watch.';
			case 'light': return 'The apparatus is ready. Light the burner at sunset.';
			case 'release': return 'Release the clockwork stop: the brass lever beside the crank.';
			case 'rewind': return 'Return to the lantern crank. Raise the weight again while the optic keeps turning.';
			default: return null;
		}
	}

	guidance() {
		if ( ! this.goal() ) return null;
		const step = this.step;
		if ( step === 'wait' ) return null;
		if ( step === 'stop' || step === 'release' ) return { at: this.at, label: 'Clockwork stop', zone: 'lantern' };
		if ( step === 'wind' || step === 'rewind' ) return { at: TOWER.crank, label: step === 'rewind' ? 'Raise the weight again · hold E' : 'Winding crank', zone: 'lantern' };
		return { at: new Vector3( 0, TOWER.deck + 2.1, 0 ), label: this.s.lamp.lit ? 'Lamp and optic' : 'Prepared lamp', zone: 'lantern' };
	}

	lensText() {
		if ( this.s.h >= SUNRISE + 24 - .25 ) return null;
		if ( ! this.allows( 'lens' ) ) return '';
		if ( ! this.state.inspected ) return 'Examine the prepared lamp and optic';
		return this.s.h < SUNSET - .25 ? 'Keep watch until sunset' : 'Light the burner';
	}

	async useLens() {
		const s = this.s, L = s.lamp;
		if ( s.h >= SUNRISE + 24 - .25 ) return false;
		if ( ! this.allows( 'lens' ) ) return true;
		if ( ! this.state.inspected ) {
			this.state.inspected = true;
			this.say( 'The prepared apparatus', 'The oil supply is full, the wicks trimmed, the lens and machinery clean. The previous watch has left it ready. The lamp makes the light; the clockwork turns the optic.' );
			s.save(); return true;
		}
		if ( ! L.lit ) {
			if ( s.h < SUNSET - .25 ) {
				this.busy = true;
				try { await s._skipTo( SUNSET - .03, 'You keep the sunset watch beside the prepared lamp.' ); }
				finally { this.busy = false; }
				return true;
			}
			L.ignite(); s.sound?.ignite(); s.flags.litAt = s.h;
			const late = s.h > SUNSET + .25;
			if ( late ) s.flags.late = true;
			s.row( s.h, late ? 'Lamp lit (late).' : 'Lamp lit.' );
			s.setBeat( 'machine' );
			if ( ! this.state.firstLightSeen ) {
				// Marked at the start, so a reload mid-shot does not replay it.
				this.state.firstLightSeen = true;
				this.firstLight.start();
			} else this.sayLit();
			s.save(); return true;
		}
		return true;
	}

	sayLit() {
		this.say( 'The burner', this.s.lamp.running ? 'The flame is settling. Watch that it burns clearly and that the optic continues to turn.' : 'The burner is alight. The glass optic is still: its clockwork is a separate mechanism. Release the brass stop beside the crank when the weight is raised.' );
	}

	afterFirstLight() { this.sayLit(); this.s.save(); }

	afterDriveCutscene() {
		if ( this.s.lamp.lit && this.s.lamp.running ) {
			this.state.verified = true;
			this.s.setBeat( 'watch' );
			this.say( 'Keeping the light', 'The weights turn the optic around the flame. Raise the weights again at the crank while the light keeps working.' );
		} else this.say( 'The revolving apparatus', 'The weights drive the optic, but the burner is still dark. Light the lamp at sunset.' );
	}

	wind( dt ) {
		if ( ! this.allows( 'crank' ) ) return;
		const L = this.s.lamp, before = L.wind;
		if ( this.state.rewound && before < .999 ) this.state.windingWatch = true;
		if ( before < .999 && this.s.moving.crank ) this.s.moving.crank.rotation.z -= Math.max( 0, dt ) * Math.PI * 1.8;
		// Compressed hand-work for the study, not a measured winding rate.
		L.addWind( Math.max( 0, dt ) / 10, { start: false } );
		if ( L.wind >= .999 ) L.wind = 1; // Match the full-weight threshold used by the prompts.
		this.drive.sync( L.wind );
		this.s.sound?.ratchet( L.wind < .999 );
		if ( before < WARN && L.wind >= WARN && this.state.rewound ) {
			this.s.row( this.s.h, this.s.flags.stoppedAt ? `Clockwork wound after stopping at ${ this.s.flags.stoppedAt.toFixed( 2 ) }.` : 'Machine wound.' );
			this.s.flags.stoppedAt = 0;
		}
		if ( this.state.verified && this.driveTaught && ! this.state.rewound && L.running && L.wind > before && L.wind >= .999 ) {
			this.state.rewound = true;
			this.s.row( this.s.h, 'Driving weight raised again while the revolving apparatus continued working.' );
			this.say( 'Winding during the watch', 'The crank takes up the cable and raises the weight again. The optic continues turning and the burner stays alight. Attend to the weight through the night and wind again before it reaches the foot of the tube.' );
			this.s.save();
		}
		if ( before < .999 && L.wind >= .999 ) {
			delete this.state.windingWatch;
			this.say( 'The driving weight', L.running ? 'The driving weight is fully raised. The machine continues to turn the optic.' : 'The driving weight is fully raised. It stores the work of your hands; the clockwork uses it to turn the optic. The stop is still holding the machine.' );
			this.s.save();
		}
	}

	toggleStop() {
		if ( ! this.allows( 'machineStop' ) ) return;
		const s = this.s, L = s.lamp;
		if ( L.running ) {
			L.stop(); this.state.verified = false;
			this.say( 'Clockwork stopped', 'The optic slows, though the burner remains alight. A fixed light does not show the intended flashing character. Release the stop again to resume the rotation.' );
		} else if ( L.wind <= 0 ) this.say( 'No driving weight', 'The weight is down. Wind the clockwork at the crank before releasing the stop.' );
		else {
			L.start();
			if ( L.lit ) s.row( s.h, 'Machine set going.' );
			if ( ! this.driveTaught && L.wind >= .999 ) { this.cutscene.start(); return; }
			this.say( 'The revolving apparatus', L.lit ? 'The weight descends and the clockwork turns the optic. Watch the flame and moving glass before leaving the lantern.' : 'The optic turns, but the burner is dark. Winding and rotation cannot supply the light: the lamp must also be lit at sunset.' );
		}
		s.save();
	}

	updateCutscene( dt, blocked ) {
		this.firstLight.updateCue( dt, blocked || this.s.paused );
		if ( ! this.active ) return false;
		if ( this.firstLight.active ) { this.firstLight.update( dt, blocked ); return true; }
		if ( ! this.cutscene.active && Number.isFinite( this.state.cutsceneElapsed ) ) {
			if ( blocked || this.s.ui.open ) return false;
			this.cutscene.start( this.state.cutsceneElapsed );
		}
		if ( ! this.cutscene.active ) return false;
		this.cutscene.update( dt, blocked );
		return true;
	}

	update( dt, { blocked = false } = {} ) {
		this.sync();
		if ( ! this.active ) return null;
		if ( this.s.lamp.lit && this.s.lamp.wind <= 0 ) this.state.verified = false;
		if ( this.lever ) this.lever.rotation.z = this.s.lamp.running ? -.8 : 0;
		if ( blocked || ! this.s.app.input.down( 'KeyE' ) || this.s.interact.current?.id !== 'crank' ) this.s.sound?.ratchet( false );
		if ( ! this.note || blocked ) return null;
		this.note.remaining -= Math.max( 0, Math.min( dt, 1 ) );
		if ( this.note.remaining <= 0 ) { this.note = null; return null; }
		return this.note;
	}
}
