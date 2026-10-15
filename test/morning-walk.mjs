import { fixture } from './helpers/morning-fixture.mjs';
import { walkMorningRoutine } from './helpers/morning-route.mjs';

for ( const familiar of [ false, true ] ) {
	await walkMorningRoutine( await fixture( familiar ) );
	console.log( `PASS full ${ familiar ? 'familiar' : 'first' } dawn: both store trips on foot, real doors and floor, tower travel actions, every service target and signed journal.` );
}
