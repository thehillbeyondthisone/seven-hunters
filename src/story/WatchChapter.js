import { Vector3, MathUtils } from '../engine/index.js';
import { TOWER, updateDoor } from '../world/flannan/Station.js';
import { Beams } from '../station/Beams.js';
import { hazeDensityForVisibility } from '../post/AirHaze.js';
import { storyGuidance } from './Guidance.js';

// Selected watches share the existing apparatus, signalling and touch actions.
export function chapterFrame( s, dt, { communicate=false, visibility=60, clouds=.62, rate=0, cap=Infinity, blocked=false }={} ) {
	const a=s.app,hold=blocked||s.paused||s.ui.open||a.mobile?.paused||a.devMenu?.open||a.freeCam||a.ui?.ui?.photoMode||globalThis.document?.hidden||a.keeperSafety?.state==='dead';
	const dh=hold?0:Math.max(0,Math.min(dt*rate,cap-s.h));s.h+=dh;s.lamp.update(dt,dh);s._applyClock();
	const density=hazeDensityForVisibility(visibility);if(a.haze)a.haze.density.value=density;if(a.clouds?.coverage)a.clouds.coverage.value=clouds;
	for(const ds of Object.values(s.doors))for(const d of ds)updateDoor(d,hold?0:dt);
	const want=s.signal||s.hasTelescope&&a.input.rightDown&&a.input.enabled&&!hold;
	s.tel+=(Number(!!want)-s.tel)*(1-Math.exp(-dt/.12));a.camera.fov=MathUtils.lerp(s.baseFov,3.5,s.tel);a.camera.updateProjectionMatrix();a.player.lookScale=a.camera.fov/s.baseFov;
	s.ui.telescope(MathUtils.smoothstep(s.tel,.4,.95));Beams.uniforms.gain.value=1+6*s.tel;
	if(s.signal){a.input.enabled=false;a.camera.position.set(TOWER.signalStand.x,TOWER.deck+1.62,TOWER.signalStand.z);a.camera.lookAt(s._herRender(new Vector3()));}
	a.camera.updateMatrixWorld();
	if(communicate&&!hold)s._updateWatcher(dt,density);else if(!communicate){Beams.uniforms.far.value[0].w=0;s.ui.strip(null);}
	if(s._leaveIn>0&&!hold&&(s._leaveIn-=dt)<=0&&s.signal)s._leaveSignal();
	if(!hold&&!s.signal)s.interact.update(dt);
	s.ui.arrival(null);s.ui.setClock(`${s.dayText()} · ${String(Math.floor(s.h%24)).padStart(2,'0')}.${String(Math.floor(s.h%1*60)).padStart(2,'0')}`);
	s.ui.setObjective(s.goal());s.ui.guidance(storyGuidance(s),a.camera,!!a.player.prompt);
	s.saveT+=hold?0:dt;if(s.saveT>20)s.save();
	return !hold;
}
