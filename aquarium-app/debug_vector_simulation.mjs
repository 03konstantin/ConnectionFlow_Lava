import { semanticMatcher } from './src/SemanticMatcher.js';

// Mock data based on User's example
// Student A: High Kindness (Communication) and High Beauty (Aesthetics)
const studentA = {
    id: 'student-A',
    vector_profile: {
        communication: 0.7, // Kindness
        aesthetics: 0.9,    // Beauty
        process: 0.5,
        goal: 0.5,
        approach: 0.5,
        tempo: 0.5,
        risk: 0.5
    }
};

const students = [studentA];

async function runSimulation() {
    console.log('--- STARTING SIMULATION ---');
    console.log('Student A Profile:', JSON.stringify(studentA.vector_profile, null, 2));

    // STEP 1: User indicates Kindness (Communication) = 70%
    console.log('\n--- STEP 1: User answers Q1 (Kindness/Communication = 0.7) ---');
    const visitorStep1 = {
        id: 'visitor-1',
        vector_profile: {
            communication: 0.7
            // Other axes undefined
        }
    };

    const matchesStep1 = await semanticMatcher.findMatches(visitorStep1, students, 0.0);
    const match1 = matchesStep1[0];
    console.log(`Match Score 1 (Should be high): ${(match1.similarity * 100).toFixed(2)}%`);
    console.log(`Distance: ${semanticMatcher.calculateDistance(visitorStep1.vector_profile, studentA.vector_profile).distance.toFixed(4)}`);

    // STEP 2: User indicates Beauty (Aesthetics) = 40%
    // Student A has 90%. difference is 0.5.
    console.log('\n--- STEP 2: User answers Q2 (Beauty/Aesthetics = 0.4) ---');
    const visitorStep2 = {
        id: 'visitor-1',
        vector_profile: {
            communication: 0.7,
            aesthetics: 0.4
        }
    };

    const matchesStep2 = await semanticMatcher.findMatches(visitorStep2, students, 0.0);
    const match2 = matchesStep2[0];
    console.log(`Match Score 2 (Should be LOWER): ${(match2.similarity * 100).toFixed(2)}%`);
    console.log(`Distance: ${semanticMatcher.calculateDistance(visitorStep2.vector_profile, studentA.vector_profile).distance.toFixed(4)}`);

    if (match2.similarity < match1.similarity) {
        console.log('\n✅ SUCCESS: Match weakened as expected.');
    } else {
        console.log('\n❌ FAILURE: Match did not weaken.');
    }
}

runSimulation();
