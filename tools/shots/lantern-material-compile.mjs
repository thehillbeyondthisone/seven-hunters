// Compile the actual composed WebGPU shaders, including room-light self exclusion.
import '../../test/headless.mjs';
import '../../src/engine/render/Frame.js';
import '../../src/materials/LocalLights.js';
import { GPU } from '../../src/engine/gpu/GPU.js';
import { buildMeshShader } from '../../src/engine/render/MeshShader.js';
import { composeShader } from '../../src/engine/gpu/Shader.js';
import { standard } from '../../src/materials/Materials.js';
import { createHandLampMaterials } from '../../src/station/HandLampMaterials.js';
import { writeFileSync } from 'node:fs';
import { SunShadows } from '../../src/engine/render/Shadows.js';

await GPU.init({headless:true});
new SunShadows({size:16});
const layout=[{name:'position',wgsl:'vec3f',location:0},{name:'normal',wgsl:'vec3f',location:1},{name:'uv',wgsl:'vec2f',location:2}];
const materials={...createHandLampMaterials(),unrelated:standard({name:'unrelated-material-control'})};
let checked=0;
for(const [name,material] of Object.entries(materials))for(const kind of ['main','color']) {
 const source=buildMeshShader(material,layout,{kind,late:material.transparent});
 const composed=composeShader({...source,stage:'render',label:name+'-'+kind});
 const shader=GPU.device.createShaderModule({code:composed.code,label:name+'-'+kind});
 const info=await shader.getCompilationInfo();
 const errors=info.messages.filter(m=>m.type==='error');
 if(errors.length)throw new Error(name+' '+kind+': '+errors.map(m=>m.message).join('\n'));
 checked++;
}
writeFileSync('artifacts/lantern-materials/shader-validation.json',JSON.stringify({checked,errors:0,includesUnrelatedMaterial:true},null,2));
console.log(`PASS ${checked} composed metal/glass/flame and unrelated control shaders.`);
GPU.device.destroy();process.exit(0);
