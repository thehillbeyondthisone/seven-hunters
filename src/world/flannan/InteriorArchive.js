import { Mesh, Group, Vector3 } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { Builder, quad01Part } from '../village/GeoBuilder.js';
import { loadTexture } from '../marine/WhaleTextures.js';
import { ARCHIVE_DOCUMENTS } from '../../story/ArchiveDocuments.js';
import { HARD, lin } from '../Props.js';

// Three paper planes; each has one local image texture, loaded before shader
// precompilation. The reader loads the larger JPEG only when the paper is opened.
export async function loadInteriorArchive( village ) {
  const parts=village.station.parts,group=new Group();
  group.name='station-original-documents';
  await Promise.all((parts.archiveDisplays || []).map(async display=>{
    display.at=new Vector3(display.x,display.y,display.z);
    const tex=await loadTexture(ARCHIVE_DOCUMENTS[display.id].texture,true);
    const material=standard({name:'archive-'+display.id,roughness:.94,side:'double',textures:{archivePaper:tex},surface:`s.albedo = textureSample( archivePaper, smpAnisoClamp, vec2f( in.uv.x, 1.0-in.uv.y ) ).rgb * vec3f( 0.91, 0.86, 0.74 ); s.roughness = 0.94;`});
    const B=new Builder();
    B.part('paper',quad01Part(display.width,display.height),0,0,0);
    const mesh=new Mesh(B.batches.paper.build(),material);
    mesh.position.copy(display.at);mesh.rotation.set(display.rx,display.ry,0);
    mesh.name=display.id;mesh.castShadow=false;mesh.receiveShadow=true;
    group.add(mesh);
  }));
  const hands=[];
  if(parts.clockFace) {
    const face=new Group();face.position.copy(parts.clockFace);face.rotation.y=Math.PI;
    for(const length of [.073,.107]) {
      const B=new Builder();
      B.rod('hard',[0,-.015,0],[0,length,0],.003,.001,{segs:6,tint:lin(0x282a27),data:HARD(.2,0,.4,.65)});
      const hand=new Mesh(B.batches.hard.build(),village.materials.hard);
      hand.position.z=hands.length*.001;face.add(hand);hands.push(hand);
    }
    group.add(face);
  }
  village.scene.add(group);
  return {group,update(hour){ if(hands.length){hands[0].rotation.z=-hour*Math.PI/6;hands[1].rotation.z=-(hour%1)*Math.PI*2;} }};
}
