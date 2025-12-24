
const axes = ['process', 'goal', 'approach', 'aesthetics', 'tempo', 'communication', 'risk'];

function calculateDistance(vectorA, vectorB) {
    let sumSquares = 0;
    let validAxesCount = 0;

    axes.forEach(axis => {
        if (vectorA[axis] === undefined || vectorA[axis] === null) return;

        const valueA = vectorA[axis];
        const valueB = vectorB[axis] || 0.5;
        const diff = valueA - valueB;
        sumSquares += diff * diff;
        validAxesCount++;
    });

    if (validAxesCount === 0) return Math.sqrt(axes.length);

    const projectedSumSquares = (sumSquares / validAxesCount) * axes.length;
    return Math.sqrt(projectedSumSquares);
}

function distanceToSimilarity(distance) {
    const maxDistance = Math.sqrt(axes.length); // 2.6457
    let similarity = 1 - (distance / maxDistance);
    return Math.max(0, Math.min(1, similarity));
}

// Simulate a visitor who has only answered Question 1 ("process")
const visitorPartial = {
    "process": 0.8 // High value for process
};

// Student with similar process
const studentSimilar = {
    "process": 0.9,
    "goal": 0.5, "approach": 0.5, "aesthetics": 0.5, "tempo": 0.5, "communication": 0.5, "risk": 0.5
};

// Student with different process
const studentDifferent = {
    "process": 0.1,
    "goal": 0.5, "approach": 0.5, "aesthetics": 0.5, "tempo": 0.5, "communication": 0.5, "risk": 0.5
};

console.log("--- Partial Match Test (1 Axis) ---");
const distSim = calculateDistance(visitorPartial, studentSimilar);
const simSim = distanceToSimilarity(distSim);
console.log(`Similar (0.8 vs 0.9): Dist=${distSim.toFixed(3)}, Sim=${simSim.toFixed(3)}`);

const distDiff = calculateDistance(visitorPartial, studentDifferent);
const simDiff = distanceToSimilarity(distDiff);
console.log(`Different (0.8 vs 0.1): Dist=${distDiff.toFixed(3)}, Sim=${simDiff.toFixed(3)}`);
