import { gridPart } from '../village/GeoBuilder.js';
import { lin, WOOD, HARD } from '../Props.js';

// Construction studies guided by the actual station photographs. The furniture
// models, finish colours and placement are reconstruction, not a 1901 inventory.
const oak = seed => ({ tint: lin( 0x71573d ), data: WOOD( seed, 0.04, 0, 0 ) });
const dark = seed => ({ tint: lin( 0x443d30 ), data: WOOD( seed, 0.03, 0, 0 ) });
const iron = { tint: lin( 0x333a36 ), data: HARD( .64, .01, .65, .48 ) };
const linen = { tint: lin( 0xc7bea3 ), data: HARD( .48, 0, 0, .96 ) };

export function keeperTable( B, x, F, z, w, d, h, ry = 0, seed = .4, drawer = false ) {

  B.pushAt( x, F, z, ry );
  for ( let i = 0; i < 4; i ++ ) B.box( 'stationTimber', 0, h - .025, (i + .5) * d / 4 - d / 2, w, .05, d / 4 - .002, { grain: 0, ...oak( seed + i * .013 ) } );
  for ( const side of [ -1, 1 ] ) {
    B.box( 'stationTimber', 0, h - .12, side * ( d / 2 - .07 ), w - .12, .15, .045, { grain: 0, ...oak( seed + .08 ) } );
    B.box( 'stationTimber', side * ( w / 2 - .07 ), h - .12, 0, .045, .15, d - .13, { grain: 2, ...oak( seed + .1 ) } );
  }
  for ( const sx of [ -1, 1 ] ) for ( const sz of [ -1, 1 ] ) {
    const lx = sx * (w / 2 - .085), lz = sz * (d / 2 - .085);
    B.lathe( 'stationTimber', lx, .015, lz, [[.037,0],[.039,.045],[.028,.07],[.026,h*.43],[.042,h*.5],[.04,h*.56],[.036,h-.12]], { segs: 12, ...oak( seed + .12 ) } );
    B.box( 'stationTimber', lx, h - .06, lz, .078, .10, .078, { grain: 1, ...oak( seed ) } );
    B.box( 'stationTimber', lx, h - .16, lz + sz * .025, .008, .028, .013, dark( seed ) );
  }
  if ( drawer ) {
    B.box( 'stationTimber', 0, h - .12, d / 2 - .037, w * .55, .105, .018, { grain: 0, ...dark( seed ) } );
    B.box( 'stationTimber', 0, h - .12, d / 2 - .023, w * .53, .088, .022, { grain: 0, ...oak( seed + .05 ) } );
    for ( const sx of [-1,1] ) B.cyl( 'hard', sx * w * .16, h - .12, d / 2 - .006, .014, .014, .021, { rx: Math.PI/2, segs: 10, ...iron } );
  }
  B.pop();
}

export function keeperChair( B, x, F, z, ry = 0, seed = .4 ) {
  B.pushAt( x, F, z, ry );
  B.box( 'stationTimber', 0, .446, 0, .43, .044, .42, { grain: 0, ...oak( seed ) } );
  B.part( 'stationTimber', gridPart( 8, 8, ( i, j ) => {
    const u = i / 8, v = j / 8;
    return { p:[(u-.5)*.426, .47 - Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.015, (v-.5)*.416], n:[0,1,0], uv:[u*.426,v*.416] };
  } ), 0, 0, 0, oak(seed) );
  for ( const sx of [-1,1] ) for ( const sz of [-1,1] ) {
    B.beam( 'stationTimber', [sx*.195,.025,sz*.19], [sx*.17,.425,sz*.16], .037, .037, oak( seed + .025 ) );
  }
  for ( const sx of [-1,1] ) {
    B.beam( 'stationTimber', [sx*.17,.43,.17], [sx*.17,.965,.225], .035, .035, oak( seed + .05 ) );
    B.beam( 'stationTimber', [sx*.185,.21,-.18], [sx*.185,.21,.18], .021, .026, dark(seed) );
  }
  B.box( 'stationTimber', 0, .245, -.18, .37, .026, .022, { grain: 0, ...dark(seed) } );
  B.box( 'stationTimber', 0, .55, .181, .36, .045, .03, { grain: 0, ...oak(seed) } );
  B.box( 'stationTimber', 0, .935, .222, .405, .08, .035, { grain: 0, ...oak(seed) } );
  for ( const sx of [-.1,0,.1] ) B.beam( 'stationTimber', [sx,.57,.187], [sx,.90,.218], .043, .012, oak(seed+.03) );
  B.pop();
}

// A small cloth surface whose normals follow its folds, rather than a flat box.
export function clothSurface( B, sample, material = linen, cols = 28, rows = 20 ) {
  const part = gridPart( cols, rows, ( i, j ) => {
    const u = i/cols, v = j/rows, p = sample(u,v), pu = sample(u+.0001,v), pv = sample(u,v+.0001);
    const a = pu.map((x,k)=>x-p[k]), b=pv.map((x,k)=>x-p[k]);
    const n = [a[2]*b[1]-a[1]*b[2],a[0]*b[2]-a[2]*b[0],a[1]*b[0]-a[0]*b[1]];
    const length=Math.hypot(...n)||1;
    return {p,n:n.map(x=>x/length),uv:[u,v]};
  });
  B.part( 'hard', part, 0, 0, 0, material );
}

export function roomJoinery( B, R, F ) {
  const painted = { tint: lin( 0x697268 ), data: WOOD( .42, .025, 1, 0 ) };
  const trim = { tint: lin( 0x4c574e ), data: WOOD( .48, .025, 1, 0 ) };
  const panelRun = ( x,z,length,ry ) => {
    B.pushAt(x,F,z,ry);
    const count = Math.ceil(length/.25), width=length/count;
    for(let i=0;i<count;i++) B.box('stationTimber',-length/2+(i+.5)*width,.50,0,width-.003,.94,.021,{grain:1,...painted});
    for(const [y,h] of [[.09,.16],[.99,.065],[1.025,.018]]) B.box('stationTimber',0,y,.01,length,h,.043,{grain:0,...trim});
    B.pop();
  };
  panelRun(-6.0,R.z0+.024,5.94,0);
  panelRun(-5.96,R.z1-.025,5.98,0);
  panelRun(R.x0+.025,.35,3.05,Math.PI/2);
  panelRun(R.x0+.025,4.36,2.06,Math.PI/2);
  // Slim cornice; doorway spans stay open.
  for(const z of [R.z0+.035,R.z1-.035]) B.box('stationTimber',-6,F+3.50,z,5.94,.085,.075,{grain:0,tint:lin(0xcecabb),data:WOOD(.55,0,1)});
}

export function rangeDetails( B, x, F, z, w = .9, d = .72 ) {
  // Accessible face points east: the player's stove target remains unchanged.
  const face = x+w/2+.014;
  B.box('hard',x,F+.018,z,w+.35,.035,d+.35,{tint:lin(0x787970),data:HARD(.4,0,0,.94)});
  for(const [height,width] of [[.54,.48],[.23,.50]]) {
    B.box('hard',face,F+height,z,.027,height>.3?.30:.14,width,iron);
    for(const dz of [-width/2,width/2]) B.box('hard',face+.015,F+height,z+dz,.025,height>.3?.33:.16,.018,iron);
    B.rod('hard',[face+.045,F+height,z-.04],[face+.045,F+height,z+.1],.009,.009,{segs:8,...iron});
  }
  for(let i=0;i<6;i++) B.box('hard',face+.02,F+.235,z-.16+i*.058,.007,.045,.019,{tint:lin(0x121713),data:HARD(.2,0,0,.9)});
  for(const dz of [-.18,.18]) {
    B.torus('hard',x,F+.905,z+dz,.105,.009,{radial:5,tubular:28,...iron});
    B.box('hard',x,F+.903,z+dz,.12,.009,.009,iron);
  }
  for(const sx of [-1,1]) for(const sz of [-1,1]) B.box('hard',x+sx*(w/2-.08),F+.08,z+sz*(d/2-.08),.07,.13,.07,iron);
  B.rod('hard',[face+.06,F+.77,z-.28],[face+.06,F+.77,z+.28],.016,.016,{segs:10,...iron});
}

export function berthBedding( B, F ) {
  const wood=oak(.61), blanket={tint:lin(0x586b64),data:HARD(.62,0,0,.98)};
  for(const sx of [-1,1]) for(const sz of [-1,1]) B.lathe('stationTimber',-4.05+sx*.79,F+.015,12.5+sz*1.035,[[.035,0],[.04,.08],[.04,.68],[.055,.71],[0,.76]],{segs:12,...wood});
  for(const z of [11.445,13.555]) {
    B.box('stationTimber',-4.05,F+.91,z,1.68,.075,.09,{grain:0,...wood});
    for(const x of [-4.55,-4.05,-3.55]) B.box('stationTimber',x,F+.7,z,.19,.3,.014,{grain:1,...dark(.65)});
  }
  clothSurface(B,(u,v)=>{
    const x=-4.05+(u-.5)*1.63,z=11.46+v*1.78;
    const edge=Math.max(0,Math.abs(u-.5)-.44)/.06;
    return [x,F+.59+Math.sin(u*Math.PI)*.027+.007*Math.sin(v*38+u*15)-edge*.11,z];
  },blanket,40,36);
  // Foot blanket, turned over at one end; no invented personal names or insignia.
  clothSurface(B,(u,v)=>[-4.05+(u-.5)*1.63,F+.605+Math.sin(u*Math.PI)*.025+Math.sin(v*Math.PI)*.025-Math.max(0,Math.abs(u-.5)-.44)*1.6,11.48+v*.42],{tint:lin(0x9a8970),data:HARD(.72,0,0,.97)});
  B.lathe('hard',-4.05,F+.625,13.11,[[0,0],[.13,.01],[.16,.045],[.14,.10],[.075,.14],[0,.15]],{segs:32,sx:3.0,sz:1.55,...linen});
}
