import { ShaderModule } from '../engine/gpu/Shader.js';

// The globe emits sideways; the opaque fount and cap shade the lower/upper
// hemispheres. Share this profile between surfaces and indoor scattering.
export const handLampLightModule = new ShaderModule( {
	name: 'hand-lamp-light',
	code: /* wgsl */`
fn handLampEmission( outward: vec3f, shape: vec4f ) -> f32 {
	if ( shape.w <= 0.0 ) { return 1.0; }
	let elevation = dot( outward, shape.xyz );
	let fount = mix( 1.0, .24, smoothstep( .30, .88, -elevation ) );
	let cap = mix( 1.0, .10, smoothstep( .25, .80, elevation ) );
	return mix( 1.0, fount * cap, shape.w );
}
`,
} );

export function configureHandLampLight( light, lamp ) {

	light.color.setRGB( 1, .67, .36 );
	light.intensity = 7;
	light.range = 6.5;
	light.cosInner = -1.5;
	light.cosOuter = -2;
	light.at = lamp.lightPosition;
	light.up = lamp.lightUp;
	light.lantern = true;
	// Surface brightness is independent of aerosol scattering. A clear room
	// needs only a trace around this small flame, not a luminous fog at the eye.
	light.roomAirStrength = .12;

}

export function updateHandLampLight( light, lamp, bounds, dt ) {

	light.on = lamp.glow > .002;
	light.scale = lamp.glow * lamp.flicker;
	light.bounds = bounds;
	const target = bounds ? 1 : 0;
	light.boost = light.boost === undefined ? target : light.boost + ( target - light.boost ) * ( 1 - Math.exp( -dt / .35 ) );

}
