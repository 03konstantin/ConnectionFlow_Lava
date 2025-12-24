import { semanticMatcher } from './src/SemanticMatcher.js';

async function test() {
    console.log('Initializing model...');
    await semanticMatcher.init();

    console.log('\n=== TEST 1: Technical Director should match with Engineer ===');
    const visitor1 = { text_profession: 'Technical Director', text_interests: '', text_goal: '' };
    const students1 = [
        { id: 1, text_profession: 'Engineer', text_interests: '', text_goal: '' },
        { id: 2, text_profession: 'Designer', text_interests: '', text_goal: '' }
    ];

    const matches1 = await semanticMatcher.findMatches(visitor1, students1);
    console.log('Matches:', matches1);

    const engMatch = matches1.find(m => m.student_id === 1);
    const desMatch = matches1.find(m => m.student_id === 2);

    if (engMatch && !desMatch) {
        console.log('✅ PASSED: Technical Director matched with Engineer only');
    } else {
        console.log('❌ FAILED');
    }

    console.log('\n=== TEST 2: Project Manager should match with Web Director ===');
    const visitor2 = { text_profession: 'Project Manager', text_interests: '', text_goal: '' };
    const students2 = [
        { id: 3, text_profession: 'Web Director', text_interests: '', text_goal: '' },
        { id: 4, text_profession: 'Coder', text_interests: '', text_goal: '' }
    ];

    const matches2 = await semanticMatcher.findMatches(visitor2, students2);
    console.log('Matches:', matches2);

    const webMatch = matches2.find(m => m.student_id === 3);
    const coderMatch = matches2.find(m => m.student_id === 4);

    if (webMatch && !coderMatch) {
        console.log('✅ PASSED: Project Manager matched with Web Director only');
    } else {
        console.log('❌ FAILED');
    }

    console.log('\n=== TEST 3: Graphic Designer should match with UI Designer ===');
    const visitor3 = { text_profession: 'Graphic Designer', text_interests: '', text_goal: '' };
    const students3 = [
        { id: 5, text_profession: 'UI Designer', text_interests: '', text_goal: '' },
        { id: 6, text_profession: 'Engineer', text_interests: '', text_goal: '' }
    ];

    const matches3 = await semanticMatcher.findMatches(visitor3, students3);
    console.log('Matches:', matches3);

    const uiMatch = matches3.find(m => m.student_id === 5);
    const engMatch2 = matches3.find(m => m.student_id === 6);

    if (uiMatch && !engMatch2) {
        console.log('✅ PASSED: Graphic Designer matched with UI Designer only');
    } else {
        console.log('❌ FAILED');
    }
}

test();
