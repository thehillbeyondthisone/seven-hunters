import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as script from '../../src/story/Script.js';

// Snapshot the playable dialogue from its source. The generated HTML needs no
// server, imports or external assets, and author notes use their own save key.
const root = new URL( '../../', import.meta.url );
const data = JSON.stringify( { watcher: script.WATCHER, letter: script.LETTER, crossingPapers: script.CROSSING_PAPERS, prologue: script.PROLOGUE, ending: script.ENDING } ).replace( /</g, '\\u003c' );
const hero = 'data:image/jpeg;base64,' + readFileSync( new URL( 'public/ui/keyart-flannan.jpg', root ) ).toString( 'base64' );
const template = readFileSync( new URL( './template.html', import.meta.url ), 'utf8' );
const output = new URL( 'public/story-guide.html', root );
writeFileSync( output, template.replace( '__STORY_DATA__', data ).replace( '__KEYART__', hero ) );
console.log( 'Story guide:', fileURLToPath( output ) );
