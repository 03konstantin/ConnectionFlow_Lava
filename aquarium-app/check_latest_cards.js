const { createClient } = require('@supabase/supabase-js');

// Config from src/supabaseClient.js
const supabaseUrl = 'https://rimemvyscrwvjgqscwut.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbWVtdnlzY3J3dmpncXNjd3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDc0MDcsImV4cCI6MjA3ODYyMzQwN30.KVo8Qmv2sAoNSvcGMCyVReAH-Pt-nx7ye5WQJZIxwbA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatest() {
    console.log('--- Checking Latest Entries ---');

    // Check Students
    const { data: students, error: sError } = await supabase
        .from('student_cards')
        .select('*')
        .order('id', { ascending: false })
        .limit(3);

    if (sError) console.error('Student Error:', sError);
    console.log('\nLATEST 3 STUDENTS:');
    if (students) {
        students.forEach(s => {
            console.log(`[ID: ${s.id}] Name: ${s.student_name} | Table: ${s.table_number || 'N/A'}`);
        });
    }

    // Check Visitors
    const { data: visitors, error: vError } = await supabase
        .from('visitor_cards')
        .select('*')
        .order('id', { ascending: false })
        .limit(3);

    if (vError) console.error('Visitor Error:', vError);
    console.log('\nLATEST 3 VISITORS:');
    if (visitors) {
        visitors.forEach(v => {
            console.log(`[ID: ${v.id}] Name: ${v.visitor_name} | Matched: ${v.matched_student || 'None'}`);
        });
    }
}

checkLatest();
