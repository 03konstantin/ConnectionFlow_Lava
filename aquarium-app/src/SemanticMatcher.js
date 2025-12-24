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
        console.log('[SemanticMatcher] Ready for vector matching.');
    }

    /**
     * Calculate Euclidean distance between two vectors.
     * @param {Object} vectorA - Visitor vector profile
     * @param {Object} vectorB - Student vector profile
     * @returns {number} Distance (normalized to scale of √N)
     */
    calculateDistance(vectorA, vectorB) {
        let sumSquares = 0;
        let validAxesCount = 0;

        this.axes.forEach(axis => {
            // If visitor doesn't have this axis yet, skip it
            if (vectorA[axis] === undefined || vectorA[axis] === null) return;

            const valueA = vectorA[axis];
            const valueB = vectorB[axis];

            // If student doesn't have value, assume 0.5 (neutral)
            const targetVal = (valueB === undefined || valueB === null) ? 0.5 : valueB;

            // Simple scalar distance
            // Since we use discrete values now (0.25, 0.45...), just diff them.
            const diff = valueA - targetVal;

            sumSquares += diff * diff;
            validAxesCount++;
        });

        if (validAxesCount === 0) return { distance: Math.sqrt(this.axes.length), validAxesCount: 0 };

        // Normalize sumSquares to project as if all axes were present
        const projectedSumSquares = (sumSquares / validAxesCount) * this.axes.length;

        return { distance: Math.sqrt(projectedSumSquares), validAxesCount };
    }

    /**
     * Convert distance to similarity percentage
     * @param {number} distance - Euclidean distance
     * @returns {number} Similarity from 0 to 1
     */
    distanceToSimilarity(distance) {
        const maxDistance = Math.sqrt(this.axes.length);
        let similarity = 1 - (distance / maxDistance);
        return Math.max(0, Math.min(1, similarity));
    }

    /**
     * Find matching students for a visitor based on vector profiles
     * @param {Object} visitor - Visitor card with vector_profile
     * @param {Array} students - Array of student cards with vector_profile
     * @param {number} threshold - Minimum similarity to include (0-1)
     * @returns {Array} Array of {student_id, similarity} objects
     */
    async findMatches(visitor, students, threshold = 0.5) {
        let visitorVector = visitor.vector_profile;

        if (!visitorVector) {
            console.warn('[SemanticMatcher] Visitor has no vector_profile');
            return [];
        }

        if (typeof visitorVector === 'string') {
            try {
                visitorVector = JSON.parse(visitorVector);
            } catch (e) {
                console.error('Failed to parse visitor vector', e);
                return [];
            }
        }

        const matches = [];

        for (const student of students) {
            let studentVector = student.vector_profile;

            if (!studentVector) continue;

            if (typeof studentVector === 'string') {
                try {
                    studentVector = JSON.parse(studentVector);
                } catch (e) {
                    console.error('Failed to parse student vector', e);
                    continue;
                }
            }

            const { distance, validAxesCount } = this.calculateDistance(visitorVector, studentVector);
            const similarity = this.distanceToSimilarity(distance);
            const confidence = validAxesCount / this.axes.length;

            if (similarity >= threshold) {
                matches.push({
                    student_id: student.id,
                    similarity: similarity,
                    confidence: confidence
                });
            }
        }

        return matches.sort((a, b) => b.similarity - a.similarity);
    }
}

export const semanticMatcher = new SemanticMatcher();
