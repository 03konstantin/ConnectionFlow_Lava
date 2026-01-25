const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use the same credentials as in other apps
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://rimemvyscrwvjgqscwut.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbWVtdnlzY3J3dmpncXNjd3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDc0MDcsImV4cCI6MjA3ODYyMzQwN30.KVo8Qmv2sAoNSvcGMCyVReAH-Pt-nx7ye5WQJZIxwbA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateMatch() {
    console.log('--- Simulating Match System ---');

    // 1. Get Latest Visitor
    const { data: visitors, error } = await supabase
        .from('visitor_cards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !visitors || visitors.length === 0) {
        console.error('No visitors found.');
        return;
    }

    const visitor = visitors[0];
    console.log(`Target Visitor: ${visitor.visitor_name} (ID: ${visitor.id})`);

    // 2. Get Students
    const { data: students } = await supabase.from('student_cards').select('*').limit(10);

    if (!students || students.length === 0) {
        console.log('No students found to match against.');
        return;
    }

    // 3. Create Fake Scores (Top 5)
    // We'll just take random 5 students and assign high scores
    const shuffled = students.sort(() => 0.5 - Math.random()).slice(0, 5);

    const scores = shuffled.map((s, i) => ({
        student_id: s.id,
        matchCount: 5 - Math.floor(i / 2), // 5, 5, 4, 4, 3
        totalAnswered: 5,
        similarity: 1.0
    }));

    console.log('Generated Scores:', scores.map(s => s.student_id));

    // 4. Update
    const { error: updateError } = await supabase
        .from('visitor_cards')
        .update({ scores: scores })
        .eq('id', visitor.id);

    if (updateError) {
        console.error('Update Failed:', updateError);
    } else {
        console.log('✅ Update Successful! Check Printer App.');
    }
}

simulateMatch();
