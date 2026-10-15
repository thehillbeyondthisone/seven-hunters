import { Vector3 } from '../engine/index.js';
import { standard, physical } from '../materials/Materials.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { commonModule } from '../engine/render/wgsl/common.js';

// Metre-scaled surface fields in the lantern's own frame. No animated noise or
// screen-space dirt: scratches and handling marks move with the carried object.
const detail = new ShaderModule( { name:'storm-lantern-surface-detail', deps:[commonModule], code:/* wgsl */`
fn lampHash(p: vec3f) -> f32 { return fract(sin(dot(p,vec3f(127.1,311.7,74.7))) * 43758.5453); }
fn lampNoise(p: vec3f) -> f32 {
	let i=floor(p); let f=fract(p); let u=f*f*(3.0-2.0*f);
	return mix(mix(mix(lampHash(i),lampHash(i+vec3f(1,0,0)),u.x),mix(lampHash(i+vec3f(0,1,0)),lampHash(i+vec3f(1,1,0)),u.x),u.y),
		mix(mix(lampHash(i+vec3f(0,0,1)),lampHash(i+vec3f(1,0,1)),u.x),mix(lampHash(i+vec3f(0,1,1)),lampHash(i+vec3f(1,1,1)),u.x),u.y),u.z);
}
fn lampBand(y:f32,centre:f32,width:f32) -> f32 { return 1.0-smoothstep(width*.35,width,abs(y-centre)); }
fn lampScratch(q:vec2f,cellSize:vec2f,seed:f32,aa:f32) -> f32 {
	let cell=floor(q/cellSize);let f=fract(q/cellSize)-0.5;
	let h=lampHash(vec3f(cell,seed));let h2=lampHash(vec3f(cell+7.3,seed+4.1));
	let slope=(h2-.5)*.65;let a=vec2f(-.35,(h-.5)*.45);let b=vec2f(.35,(h-.5)*.45+slope);
	let v=(b-a)*cellSize;let d=f*cellSize-a*cellSize;
	let distance=length(d-v*clamp(dot(d,v)/dot(v,v),0.0,1.0));
	let width=.000025+h*.000035;
	return (1.0-smoothstep(width,width+aa,distance))*min(1.0,width/max(aa,.00001))*smoothstep(.68,.86,h);
}
` } );

const localFrame = { varyings:{vLampLocal:'vec3f',vLampNormal:'vec3f'}, vertex:'o.vLampLocal = v.position; o.vLampNormal = v.normal;' };

export function createHandLampMaterials() {
	const metal = (color,roughness,metalness,kind) => {
		const m=standard({color,roughness,metalness,...localFrame,modules:[detail],defines:{LANTERN_SELF_LIGHT:1},
			uniforms:{flamePos:['vec3f',new Vector3()],flameLit:['f32',0],finishKind:['f32',kind]}});
		m.name='storm-lantern-'+['tinned-steel','polished-edges','aged-brass','charred-wick'][kind];
		m.surface=/* wgsl */`
		let p=in.vs.vLampLocal;let localN=normalize(in.vs.vLampNormal);let aN=abs(localN);
		let q0=select(p.xy,p.zy,aN.x>aN.z);let q=select(q0,p.xz,aN.y>max(aN.x,aN.z));
		let pixel=max(length(fwidth(p)),.000008);
		let patinaField=lampNoise(p*145.0);let mottling=lampNoise(p*430.0+2.7);
		let scratch=clamp(lampScratch(q,vec2f(.014,.009),3.0,pixel)+lampScratch(q.yx,vec2f(.027,.018),17.0,pixel)*.45,0.0,1.0);
		let r=length(p.xz);
		let rims=max(max(lampBand(p.y,.008,.0025)*smoothstep(.068,.075,r),lampBand(p.y,.044,.002)*smoothstep(.064,.071,r)),
			max(lampBand(p.y,.222,.002)*smoothstep(.073,.080,r),lampBand(p.y,.261,.0015)*smoothstep(.028,.034,r)));
		let grip=smoothstep(.275,.31,p.y)*(1.0-smoothstep(.002,.009,abs(p.z)));
		let wear=clamp((rims*.75+grip*.55)*(0.6+patinaField*.4),0.0,1.0);
		let burner=lampBand(p.y,.099,.030)*(1.0-smoothstep(.027,.045,r));
		let hood=smoothstep(.208,.218,p.y)*(1.0-smoothstep(.242,.267,p.y))*(1.0-smoothstep(.035,.075,r));
		let soot=clamp((burner*.35+hood*.60)*(0.6+mottling*.4),0.0,.72);
		let oil=exp(-length(p.xz-vec2f(-.042,.037))*145.0)*lampBand(p.y,.056,.022)*.32;
		let oxide=smoothstep(.36,.79,patinaField)*(1.0-wear)*.11;
		let isBrass=select(0.0,1.0,mat.finishKind>1.5 && mat.finishKind<2.5);
		let isWick=select(0.0,1.0,mat.finishKind>2.5);
		let tarnishColor=mix(vec3f(.075,.083,.075),vec3f(.12,.075,.027),isBrass);
		let bare=mix(mat.color,vec3f(.62,.65,.59),.25*(1.0-isBrass));
		s.albedo=mix(mat.color*(.94+mottling*.10),tarnishColor,oxide);
		s.albedo=mix(s.albedo,bare,clamp(wear*.52+scratch*.43,0.0,.75)*(1.0-isWick));
		s.albedo=mix(s.albedo,vec3f(.012,.010,.008),soot*.75+oil*.20);
		s.metalness=mix(mat.metalness,.12,clamp(oxide+soot*.85,0.0,.8));
		s.roughness=clamp(mat.roughness+oxide*.28+(mottling-.5)*.06+scratch*.12+soot*.42-wear*.10-oil*.08,.17,.92);
		// Micron-scale surface relief breaks up reflections without changing the shape.
		let microFade=1.0-smoothstep(.00015,.00065,pixel);
		let fine=lampNoise(p*3300.0);
		let height=(mottling-.5)*.0000025+(fine-.5)*.000001*microFade-scratch*.000002;
		s.normal=perturbNormalByHeight(in.P,s.normal,dpdx(height),dpdy(height),1.0);
		// Bounded finite-source GGX response replaces the former painted-on glow.
		let delta=mat.flamePos-in.P;let d2=dot(delta,delta);let L=delta*inverseSqrt(max(d2,1e-6));
		let F0=mix(vec3f(.04),s.albedo,s.metalness);
		let brdf=min(BRDF_GGX(L,normalize(in.V),s.normal,F0,1.0,max(s.roughness,.25)),vec3f(2.5));
		let irradiance=vec3f(1.0,.58,.24)*mat.flameLit*.018/(d2+.003);
		let bounce=s.albedo*(1.0-s.metalness*.8)*.025;
		s.emissive += irradiance*(max(dot(s.normal,L),0.0)*(brdf+s.albedo*(1.0-s.metalness)*INV_PI)+bounce);
		`;
		return m;
	};
	const tin=metal(0x92988e,.29,.98,0),steel=metal(0xb8bdb4,.23,1,1),brass=metal(0xb99459,.30,.96,2),black=metal(0x20211c,.90,0,3);
	const glass=physical({color:0xe4ebe2,roughness:.035,ior:1.47,transparent:true,opacity:.1,depthWrite:false,side:'double',velocityWeight:0,
		defines:{NO_LOCAL_LIGHTS:1},...localFrame,modules:[detail]});
	glass.name='storm-lantern-blown-glass';
	glass.surface=/* wgsl */`
		let p=in.vs.vLampLocal;let theta=atan2(p.z,p.x);
		let pixel=max(length(fwidth(p)),.000008);
		let cloud=lampNoise(p*230.0+9.1);let deposit=lampNoise(p*470.0+3.7);
		let top=smoothstep(.177,.216,p.y+(.5-cloud)*.009);
		let soot=top*(.32+deposit*.60)*(0.74+.26*sin(theta*5.0+cloud*3.0));
		let wiped=(.5+.5*sin(theta*43.0+cloud*2.0))*.035*lampBand(p.y,.145,.060);
		let scratch=lampScratch(vec2f(theta*.053,p.y),vec2f(.021,.028),41.0,pixel)*.45;
		let grazing=pow(1.0-abs(dot(normalize(in.N),normalize(in.V))),4.0);
		s.alpha=clamp(.035+grazing*.34+soot*.25+wiped+scratch*.07,.03,.55);
		s.albedo=mix(mat.color,vec3f(.065,.047,.025),soot*.72);
		s.roughness=.025+soot*.32+wiped*.6+scratch*.16;
		let height=(lampNoise(p*670.0)-.5)*.000009-scratch*.000002;
		s.normal=perturbNormalByHeight(in.P,s.normal,dpdx(height),dpdy(height),.7);
	`;
	const flame=standard({color:0x000000,roughness:1,transparent:true,opacity:0,depthWrite:false,defines:{NO_LOCAL_LIGHTS:1}});
	return {tin,steel,brass,black,glass,flame};
}
