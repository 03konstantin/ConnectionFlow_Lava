// src/SemanticMatcher.js

class SemanticMatcher {
    constructor() {
        this.axes = [
            'cooking_emphasis',
            'new_activity_company',
            'menu_selection_style',
            'social_planning',
            'messaging_urgency'
        ];
    }

    async init() {
        console.log('[SemanticMatcher] Ready for discrete matching.');
    }

    /**
     * Calculate discrete matches.
     * @param {Object} visitor - Visitor vector (partial or full)
     * @param {Object} student - Student vector (full)
     * @returns {Object} { matchCount, totalAnswered, similarity }
     */
    calculateMatch(visitorVector, studentVector) {
        let matchCount = 0;
        let totalAnswered = 0;

        this.axes.forEach(axis => {
            // Only count axes the visitor has answered
            if (visitorVector[axis] === undefined || visitorVector[axis] === null) return;

            totalAnswered++;
            const valA = visitorVector[axis];
            const valB = studentVector[axis];

            // If student has no value, it's a mismatch
            if (valB === undefined || valB === null) return;

            // Strict equality (with floating point tolerance just in case)
            if (Math.abs(valA - valB) < 0.05) {
                matchCount++;
            }
        });

        // Similarity is 0 if no questions answered yet
        const similarity = totalAnswered === 0 ? 0 : (matchCount / totalAnswered);

        return { matchCount, totalAnswered, similarity };
    }

    /**
     * Find matching students
     * @param {Object} visitor 
     * @param {Array} students 
     * @param {number} threshold 
     */
    async findMatches(visitor, students, threshold = 0.0) {
        let visitorVector = visitor.vector_profile;
        if (!visitorVector) return [];
        if (typeof visitorVector === 'string') visitorVector = JSON.parse(visitorVector);

        const matches = [];

        for (const student of students) {
            let studentVector = student.vector_profile;
            if (!studentVector) continue;
            if (typeof studentVector === 'string') studentVector = JSON.parse(studentVector);

            const { matchCount, totalAnswered, similarity } = this.calculateMatch(visitorVector, studentVector);

            // Return detailed stats for the physics engine
            matches.push({
                student_id: student.id,
                matchCount,
                totalAnswered,
                similarity
            });
        }

        return matches.sort((a, b) => b.matchCount - a.matchCount);
    }
}

export const semanticMatcher = new SemanticMatcher();
