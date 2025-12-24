import { semanticMatcher } from './src/SemanticMatcher.js';

async function testMatching() {
    console.log('Testing SemanticMatcher with Strict Value Logic...');

    const visitor = {
        id: 'visitor_1',
        vector_profile: {
            cooking_emphasis: 0.95, // strict value
            new_activity_company: 0.25,
            menu_selection_style: 0.50,
            social_planning: 0.75,
            messaging_urgency: 0.45
        }
    };

    const students = [
        {
            id: 'student_perfect',
            vector_profile: {
                cooking_emphasis: 0.95, // Match
                new_activity_company: 0.25, // Match
                menu_selection_style: 0.50, // Match
                social_planning: 0.75, // Match
                messaging_urgency: 0.45 // Match
            }
        },
        {
            id: 'student_bad',
            vector_profile: {
                cooking_emphasis: 0.25, // Far
                new_activity_company: 0.95, // Far
                menu_selection_style: 0.25, // Far
                social_planning: 0.25, // Far
                messaging_urgency: 0.95 // Far
            }
        }
    ];

    console.log('Visitor:', JSON.stringify(visitor.vector_profile, null, 2));

    const matches = await semanticMatcher.findMatches(visitor, students, 0.0);

    console.log('\nMatches:');
    matches.forEach(m => {
        console.log(`Student: ${m.student_id}, Similarity: ${m.similarity.toFixed(4)}, Confidence: ${m.confidence}`);
    });

    // Check expectation
    if (matches[0].student_id === 'student_perfect' && matches[0].similarity === 1.0) {
        console.log('\nSUCCESS: Perfect match found with 1.0 similarity.');
    } else {
        console.error('\nFAILURE: Perfect match not top or not 1.0');
    }
}

testMatching();
