import { Vector3 } from '../engine/index.js';

const base = ((import.meta.env && import.meta.env.BASE_URL) || '/') + 'archive/';

// Authentic scans, placed in the fictional working station. No later report is
// given to the keeper before it could have existed on 3 January 1901.
export const ARCHIVE_DOCUMENTS = {
  islandMap: {
    title: 'The Flannan Isles or Seven Hunters', date: 'Published 1898', image: base+'flannan-chart-1898.jpg', texture: base+'flannan-chart-1898.png',
    alt: 'Original map of the Flannan Isles, with island names, soundings, a scale and two coastal profiles.',
    body: ['The island names stretch across the sheet. Below them are the outlines seen from the sea: the western group beyond Eilean Mòr, and the eastern group from the south-east.', 'Eilean Mòr is a small piece of land on a large sheet of water. You can study the names here, then find the rocks from the lantern.'],
    provenance: 'Original historical map reproduced in A Vertebrate Fauna of the Outer Hebrides (Harvie-Brown and Buckley), 1898. Wikimedia Commons identifies the scan as public domain; digitisation credited there to Roger Griffith, with a later contrast-enhanced version. Downloaded from the 9001.lt reproduction. Its presence and position in this fictional room are reconstructed.',
    sources: [{label:'Wikimedia Commons · original map and publication record',url:'https://commons.wikimedia.org/wiki/File:Flannan_isles.jpg'},{label:'Photographic reproduction used',url:'https://9001.lt/1900/'}],
  },
  lanternElevation: {
    title:'Flannan Isles Lighthouse · Lantern',date:'Original construction drawing · Sheet 1',image:base+'lantern-sheet-1.jpg',texture:base+'lantern-sheet-1.png',
    alt:'Original engineering drawing with the lantern elevation and circular plan.',
    body:['The plan shows the circle of the lantern; the elevation lays out the diamond glazing, lower panels and portholes. What feels like a room around you began as lines on a sheet.', 'This is the lantern structure. The great optic is a separate machine, carried at its centre.'],
    provenance:'Unaltered reproduction of the original Flannan lantern engineering sheet. The download source dates it 1895; the precise archive accession and date have not been matched to an archive master. The drawing is authentic source material; keeping a copy in this rack is a fictional placement.',
    sources:[{label:'Drawing reproduction',url:'https://9001.lt/1900/'},{label:'Historic Environment Scotland · station drawing catalogue',url:'https://www.trove.scot/place/171215'}],
  },
  lanternDetails: {
    title:'Flannan Isles Lighthouse · The fittings',date:'Original construction drawing · Sheet 4',image:base+'lantern-sheet-4.jpg',texture:base+'lantern-sheet-4.png',
    alt:'Original engineering details of glazing bars, sash frames, handrails and bolts.',
    body:['Bars, sashes, handrails and bolts, drawn large enough for a workman to make them. Every pane depends on small pieces meeting properly.', 'The same care belongs to the keeper: clean glass, sound fittings, and nothing left loose in the wind.'],
    provenance:'Unaltered reproduction of the original Flannan lantern detail sheet. The mirror dates it 1895; exact archive identity remains unverified. The accompanying prose and the keeper’s access to this copy are written for the game, not quoted historical instructions.',
    sources:[{label:'Drawing reproduction',url:'https://9001.lt/1900/'},{label:'Historic Environment Scotland · station drawing catalogue',url:'https://www.trove.scot/place/171215'}],
  },
};

export function installArchiveDocuments( story ) {
  for(const display of story.station.parts.archiveDisplays || []) {
    const paper = ARCHIVE_DOCUMENTS[display.id];
    if(!paper)continue;
    story.interact.add({id:display.id,at:display.at || new Vector3(display.x,display.y,display.z),size:.32,reach:1.8,text:display.id==='islandMap'?'Study the old island map':'Examine the lantern drawings',when:()=>!['intro','crossing','end'].includes(story.beat),use:()=>story.ui.archive(paper)});
  }
}
