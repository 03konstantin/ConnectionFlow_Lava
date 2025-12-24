import { semanticMatcher } from './src/SemanticMatcher.js';

const prof1 = 'Project Manager';
const prof2 = 'Web Director';

console.log('Testing profession group matching...\n');

const group1 = semanticMatcher.findProfessionGroup(prof1);
const group2 = semanticMatcher.findProfessionGroup(prof2);

console.log(`"${prof1}" -> group: "${group1}"`);
console.log(`"${prof2}" -> group: "${group2}"`);

if (group1 === group2) {
    console.log('\n✅ Both in same group!');
} else {
    console.log('\n❌ Different groups!');
}
