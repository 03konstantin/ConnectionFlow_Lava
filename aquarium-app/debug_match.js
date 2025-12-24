
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

const visitor95 = {
    "goal": 0.14,
    "risk": 0.76,
    "tempo": 0.82,
    "process": 0.76,
    "approach": 0.68,
    "aesthetics": 0.31,
    "communication": 0.81
};

const student41 = {
    "goal": 0.21,
    "risk": 0.82,
    "tempo": 0.72,
    "process": 0.66,
    "approach": 0.82,
    "aesthetics": 0.25,
    "communication": 0.73
};

const dist = calculateDistance(visitor95, student41);
const sim = distanceToSimilarity(dist);

console.log(`Visitor 95 vs Student 41`);
console.log(`Distance: ${dist}`);
console.log(`Similarity: ${sim}`);
