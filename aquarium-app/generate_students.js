const { createClient } = require('@supabase/supabase-js');

// Config from src/supabaseClient.js
const supabaseUrl = 'https://rimemvyscrwvjgqscwut.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbWVtdnlzY3J3dmpncXNjd3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDc0MDcsImV4cCI6MjA3ODYyMzQwN30.KVo8Qmv2sAoNSvcGMCyVReAH-Pt-nx7ye5WQJZIxwbA';

const supabase = createClient(supabaseUrl, supabaseKey);

const axes = [
    'cooking_emphasis',
    'new_activity_company',
    'menu_selection_style',
    'social_planning',
    'messaging_urgency'
];

// Strict values as requested
const allowedValues = [0.25, 0.45, 0.50, 0.75, 0.95];

function randomProfile() {
    const profile = {};
    axes.forEach(axis => {
        // Pick one random value from the allowed list
        const val = allowedValues[Math.floor(Math.random() * allowedValues.length)];
        profile[axis] = val;
    });
    return profile;
}

async function generateStudents() {
    console.log('Cleaning up old records...');
    // Delete all records to ensure no 7-parameter or random-float data remains
    const { error: deleteError } = await supabase
        .from('student_cards')
        .delete()
        .neq('id', 0); // Delete all rows where id != 0 (basically all)

    if (deleteError) {
        console.error('Error deleting old records:', deleteError);
        return;
    }
    console.log('Old records deleted.');

    console.log('Generating 70 random students with strict values and new schema...');
    const students = [];

    for (let i = 1; i <= 70; i++) {
        students.push({
            student_name: `Student ${i}`,
            vector_profile: randomProfile(),
            table_number: '' // Placeholder for table_number as requested
        });
    }

    console.log('Inserting into Supabase...');

    const batchSize = 10;
    for (let i = 0; i < students.length; i += batchSize) {
        const batch = students.slice(i, i + batchSize);
        const { error } = await supabase.from('student_cards').insert(batch);
        if (error) {
            console.error('Error inserting batch:', error);
        } else {
            console.log(`Inserted students ${i + 1} to ${Math.min(i + batchSize, students.length)}`);
        }
    }

    console.log('Done! 70 students added.');
}

generateStudents();
