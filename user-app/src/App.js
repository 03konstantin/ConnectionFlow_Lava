// src/App.js
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

// --- CONFIGURATION ---
// Set this to 'STUDENT' to register students (saves to student_cards)
// Set this to 'VISITOR' for event mode (saves to visitor_cards)
const APP_MODE = 'VISITOR';
// ---------------------

function App() {
  // New Questions definition
  const rawAxes = [
    {
      key: 'cooking_emphasis',
      labelLeft: 'そう思わない',
      labelRight: 'そう思う',
      question: '料理は、作り方より見た目を重視する',
      name: '料理'
    },
    {
      key: 'new_activity_company',
      labelLeft: 'そう思わない',
      labelRight: 'そう思う',
      question: '何か新しいことを始めるとき、誰かと一緒に始めたい',
      name: '新しいこと'
    },
    {
      key: 'menu_selection_style',
      labelLeft: 'そう思わない',
      labelRight: 'そう思う',
      question: '私はメニューを選ぶときは、直感でパッと決める',
      name: 'メニュー選択'
    },
    {
      key: 'social_planning',
      labelLeft: 'そう思わない',
      labelRight: 'そう思う',
      question: '遊びの予定は、当日や前日の急なお誘いでも嬉しい',
      name: '遊びの予定'
    },
    {
      key: 'messaging_urgency',
      labelLeft: 'そう思わない',
      labelRight: 'そう思う',
      question: 'メッセージが来たら、すぐに返信しないと落ち着かない',
      name: 'メッセージ'
    }
  ];

  // State
  const [axes, setAxes] = useState([]); // Randomized axes
  const [currentStep, setCurrentStep] = useState(-1); // -1: Start Screen, 0-4: Questions, 5: Done
  const [cardId, setCardId] = useState(null);
  // Current selection index: 0 to 4 (5 options)
  const [currentSelection, setCurrentSelection] = useState(null);
  const [isSending, setIsSending] = useState(false);

  // Form State
  const [studentNumber, setStudentNumber] = useState('');
  const [studentName, setStudentName] = useState('');

  // Accumulate profile data locally before sending
  const [vectorProfile, setVectorProfile] = useState({});

  // Shuffle axes on mount
  useEffect(() => {
    const shuffled = [...rawAxes].sort(() => 0.5 - Math.random());
    setAxes(shuffled);
  }, []);

  // Restore selection when step changes (for Back functionality)
  useEffect(() => {
    if (currentStep >= 0 && currentStep < axes.length) {
      const currentAxis = axes[currentStep];
      if (!currentAxis) return;

      const savedIndex = vectorProfile[currentAxis.key + '_selection_index'];
      if (savedIndex !== undefined && savedIndex !== null) {
        setCurrentSelection(savedIndex);
      } else {
        setCurrentSelection(null);
      }
    }
  }, [currentStep, axes, vectorProfile]);

  // Strict values as requested
  const valueMapping = [
    0.25, // Option 0: そう思わない
    0.45, // Option 1: ややそう思わない
    0.50, // Option 2: どっちも言えない
    0.75, // Option 3: ややそう思う
    0.95  // Option 4: そう思う
  ];

  // Start Session
  const startSession = async () => {
    const isStudentMode = APP_MODE === 'STUDENT';
    // Validate inputs
    if (!studentName) {
      alert('名前を入力してください。');
      return;
    }
    if (isStudentMode && !studentNumber) {
      alert('学籍番号を入力してください。');
      return;
    }

    setIsSending(true);

    // Initial local state - empty
    setVectorProfile({});

    // Dynamic Table Selection
    const tableName = APP_MODE === 'STUDENT' ? 'student_cards' : 'visitor_cards';

    // Prepare Insert payload
    const insertPayload = {
      vector_profile: {} // Start empty in DB, strictly 5 params later
    };

    // If Student mode, save details to columns
    if (APP_MODE === 'STUDENT') {
      insertPayload.student_name = studentName;
      insertPayload.student_number = studentNumber; // Dedicated column
      insertPayload.table_number = '';
    }
    // Visitor mode
    if (APP_MODE === 'VISITOR') {
      insertPayload.visitor_name = studentName; // Name field used as visitor name
      // matched_student will be updated by Aquarium app later
    }

    const { data, error } = await supabase
      .from(tableName)
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error('Error creating card:', error);
      alert('Error starting session');
      setIsSending(false);
    } else {
      setCardId(data.id);
      setCurrentStep(0);
      setIsSending(false);
    }
  };

  // Submit Answer & Next
  const handleNext = async () => {
    if (isSending || currentSelection === null) return;
    setIsSending(true);

    const currentAxis = axes[currentStep];
    const selectedValue = valueMapping[currentSelection];

    // Local state stores everything including selection index/metadata for UI
    const newProfile = {
      ...vectorProfile,
      [currentAxis.key]: selectedValue,
      [currentAxis.key + '_selection_index']: currentSelection
    };

    // Update local state
    setVectorProfile(newProfile);

    const tableName = APP_MODE === 'STUDENT' ? 'student_cards' : 'visitor_cards';

    // Prepare STRICT DB Payload (Only the 5 axes)
    const dbProfile = {};
    const validKeys = [
      'cooking_emphasis',
      'new_activity_company',
      'menu_selection_style',
      'social_planning',
      'messaging_urgency'
    ];

    validKeys.forEach(key => {
      if (newProfile[key] !== undefined) {
        dbProfile[key] = newProfile[key];
      }
    });

    // Update DB
    const { error } = await supabase
      .from(tableName)
      .update({ vector_profile: dbProfile })
      .eq('id', cardId);

    if (error) {
      console.error('Error updating:', error);
    }

    if (currentStep < axes.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setCurrentStep(axes.length); // Done
    }
    setIsSending(false);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Start Screen
  if (currentStep === -1) {
    const isStudentMode = APP_MODE === 'STUDENT';
    const canStart = studentName && (!isStudentMode || studentNumber);

    return (
      <div className="App">
        <div className="card center-content">
          <h1>Connection Flow</h1>
          <p>深くに考えず、サクッと<br />回答してください。</p>

          <div className="input-group">
            {isStudentMode && (
              <input
                type="text"
                placeholder="学籍番号"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                className="text-input"
              />
            )}
            <input
              type="text"
              placeholder={isStudentMode ? "名前" : "お名前 (ニックネーム可)"}
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="text-input"
            />
          </div>

          <button
            className="start-btn"
            onClick={startSession}
            disabled={isSending || !canStart}
          >
            {isSending ? '開始中...' : "Let's start !"}
          </button>

          <div style={{ marginTop: '20px', fontSize: '10px', color: '#ccc' }}>
            MODE: {APP_MODE} (v2)
          </div>
        </div>
      </div>
    );
  }

  // Done Screen
  if (currentStep === axes.length) {
    return (
      <div className="App">
        <div className="card center-content">
          <h1>完了!</h1>
          <p>ありがとうございました。<br />登録が完了しました。</p>
        </div>
      </div>
    );
  }

  const axis = axes[currentStep];

  return (
    <div className="App">
      <div className="card question-card">
        <div className="header-row">
          <h2>質問 {currentStep + 1}</h2>
        </div>

        <h3 className="question-text">{axis.question}</h3>

        <div className="selection-container">
          {/* 5 Circles */}
          <div className="circles-row">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className={`circle-option option-${index} ${currentSelection === index ? 'selected' : ''}`}
                onClick={() => setCurrentSelection(index)}
              />
            ))}
          </div>

          <div className="labels-row">
            <span>そう思わない</span>
            <span>そう思う</span>
          </div>
        </div>

        <div className="button-row">
          {currentStep > 0 && (
            <button
              className="back-btn"
              onClick={handleBack}
              disabled={isSending}
            >
              戻る
            </button>
          )}

          <button
            className="next-btn"
            onClick={handleNext}
            disabled={isSending || currentSelection === null}
          >
            {isSending ? '送信中...' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;