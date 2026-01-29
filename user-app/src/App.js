// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import './App.css';
import WaveBackground from './components/WaveBackground';
import UserCardInput from './components/UserCardInput'; // Import UserCardInput
import grassImg from './images/grass1.png'; // Import Grass Image
import grass2Img from './images/grass2.png'; // Import Grass 2 Image
import startSand from './images/start_sand.png';
// Waves are now handled by WaveBackground component
// import qrcodeImg from './images/qrcode.png';
import smartphoneImg from './images/smartphone.png';
import aquariumImg from './images/aquarium.png';
import gakuseiImg from './images/gakusei.png';

// --- CONFIGURATION ---
// Set this to 'STUDENT' to register students (saves to student_cards)
// Set this to 'VISITOR' for event mode (saves to visitor_cards)
const APP_MODE = 'VISITOR';
// ---------------------

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
    question: '私はレストランでメニューを選ぶときは、直感でパッと決める',
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

function App() {
  // State
  const [axes, setAxes] = useState([]); // Randomized axes
  const [currentStep, setCurrentStep] = useState(-2); // -2: Welcome, -1.5: Tutorial, -1: Name Input, 0-4: Questions, 6: Done
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [tutorialTouchStart, setTutorialTouchStart] = useState(null);
  const [cardId, setCardId] = useState(null);
  // Current selection index: 0 to 4 (5 options)
  const [currentSelection, setCurrentSelection] = useState(null);
  const [isSending, setIsSending] = useState(false);

  // Wave animation state
  const [isSurging, setIsSurging] = useState(false);

  // Sphere Ref
  const sphereRef = useRef(null);

  // Transition Logic
  const handleStartWave = () => {
    setIsSurging(true);
    // Wait for wave animation (approx 1.2s)
    setTimeout(() => {
      setCurrentStep(-1.5);
      setIsSurging(false); // Reset for next time if needed, though we change screens
    }, 1200);
  };

  // Form State
  // eslint-disable-next-line no-unused-vars
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

  // Timer Logic for Message Screens
  // Timer Logic Removed for -0.9 Screen (User interaction only)

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
      setIsSending(false);
      // Go to Intermediate Message Screen
      setCurrentStep(-0.9);
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
      // Done -> Transition Message Removed, straight to Final
      setCurrentStep(6);
    }
    setIsSending(false);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Global Touch Logic for Name Input
  const [touchStart, setTouchStart] = useState(null);
  const handleGlobalTouchStart = (e) => {
    setTouchStart(e.touches ? e.touches[0].clientY : e.clientY);
  };
  const handleGlobalTouchEnd = (e) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    // Validate
    const isStudentMode = APP_MODE === 'STUDENT';
    const canStart = studentName && (!isStudentMode || studentNumber);

    // If swipe UP (delta > 30px)
    if (touchStart - touchEnd > 30) {
      if (canStart) {
        if (sphereRef.current) {
          sphereRef.current.flyAway();
        }
      } else {
        // Simple alert for now
        alert('名前を入力してください');
      }
    }
    setTouchStart(null);
  };

  // Welcome Screen
  if (currentStep === -2) {
    return (
      <div className="App welcome-screen">
        {/* Animated Waves */}
        <WaveBackground isSurging={isSurging} />

        {/* Sand Section covering the bottom half */}
        <div className="sand-section" style={{ backgroundImage: `url(${startSand})` }}></div>

        {/* Welcome Content */}
        <div className={`welcome-content ${isSurging ? 'fade-out' : ''}`}>
          <div className="title-container">
            <h1 className="welcome-title">つながりの海</h1>
            <svg className="title-droplets" viewBox="0 0 50 50" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              {/* Drop 1 (Teardrop shape) - Rotated */}
              <path d="M25 5 C25 5 15 25 15 32 C15 38 20 42 25 42 C30 42 35 38 35 32 C35 25 25 5 25 5 Z"
                transform="rotate(-20 25 25) scale(0.8) translate(-5, 5)" />
              {/* Drop 2 (Smaller) */}
              <path d="M35 10 C35 10 30 20 30 25 C30 28 32 30 35 30 C38 30 40 28 40 25 C40 20 35 10 35 10 Z"
                transform="rotate(-15 35 20) scale(0.8)" />
            </svg>
          </div>

          <div className="welcome-text">
            <p>５つの質問に答えるだけで、<br />あなたの考え方に近い学生と<br />マッチングできます。</p>
            <p>自分と近いのはどんな学生なのか、<br />見つけてみてください。</p>
          </div>
          <button className="welcome-start-btn" onClick={handleStartWave}>
            あたらしい出会いを見つける
          </button>
        </div>
      </div>
    );
  }

  // Tutorial Screen
  if (currentStep === -1.5) {
    const tutorialSlides = [
      { img: smartphoneImg, text: 'ニックネームを入力して、５つの質問に答える' },
      { img: aquariumImg, text: 'モニタにマッチングした学生をチェック' },
      { img: gakuseiImg, text: '学生の作品プレゼンに会いに行く' }
    ];

    const handleNextSlide = () => {
      if (tutorialIndex < tutorialSlides.length - 1) {
        setTutorialIndex(prev => prev + 1);
      } else {
        setCurrentStep(-1); // Go to Name Input
      }
    };

    const handlePrevSlide = () => {
      if (tutorialIndex > 0) {
        setTutorialIndex(prev => prev - 1);
      }
    };

    const currentSlide = tutorialSlides[tutorialIndex];

    const handleTutorialTouchStart = (e) => {
      setTutorialTouchStart(e.touches[0].clientX);
    };

    const handleTutorialTouchEnd = (e) => {
      if (!tutorialTouchStart) return;
      const touchEnd = e.changedTouches[0].clientX;
      const diff = tutorialTouchStart - touchEnd;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          handleNextSlide();
        } else {
          handlePrevSlide();
        }
      }
      setTutorialTouchStart(null);
    };

    return (
      <div
        className="App tutorial-screen-container"
        onTouchStart={handleTutorialTouchStart}
        onTouchEnd={handleTutorialTouchEnd}
      >
        {/* No waves, no sand. Just gradient background handled by CSS class 'tutorial-screen-container' */}

        {/* Title moved out to act as Header, pushing Content down to true center */}
        <h1 className="welcome-title tutorial-title">つながりの海</h1>

        <div className="tutorial-content">
          <div className="carousel-container">
            {/* Left Arrow */}
            <div className={`arrow-btn ${tutorialIndex === 0 ? 'hidden' : ''}`} onClick={handlePrevSlide}>
              <svg width="24" height="44" viewBox="0 0 24 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L2 22L22 42" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="slide-image-wrapper">
              <img src={currentSlide.img} alt={`step ${tutorialIndex}`} className="slide-image" />
            </div>

            {/* Right Arrow */}
            <div className={`arrow-btn ${tutorialIndex === tutorialSlides.length - 1 ? 'hidden' : ''}`} onClick={handleNextSlide}>
              <svg width="24" height="44" viewBox="0 0 24 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2L22 22L2 42" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <p className="tutorial-text" style={{ color: 'white' }}>{currentSlide.text}</p>

          {/* Dots */}
          <div className="dots-container">
            {tutorialSlides.map((_, idx) => (
              <span key={idx} className={`dot ${idx === tutorialIndex ? 'active' : ''}`} style={{ backgroundColor: idx === tutorialIndex ? '#fff' : 'rgba(255,255,255,0.5)' }} />
            ))}
          </div>
        </div>

        {/* Flexible Button Container - Always rendered to preserve layout stability */}
        <div className="tutorial-btn-wrapper">
          {tutorialIndex === tutorialSlides.length - 1 && (
            <button
              className="tutorial-next-btn fade-in"
              onClick={() => setCurrentStep(-1)}
            >
              つぎへ
            </button>
          )}
        </div>
      </div>
    );
  }

  // Start Screen (Name Input)
  if (currentStep === -1) {
    const isStudentMode = APP_MODE === 'STUDENT';
    const canStart = studentName && (!isStudentMode || studentNumber);

    return (
      <div
        className="App tutorial-screen-container"
        onTouchStart={handleGlobalTouchStart} // Attach Touch Handlers for Global Swipe
        onTouchEnd={handleGlobalTouchEnd}
        onMouseDown={(e) => setTouchStart(e.clientY)} // For Mouse testing
        onMouseUp={(e) => {
          if (touchStart && touchStart - e.clientY > 30 && sphereRef.current && canStart) sphereRef.current.flyAway();
          setTouchStart(null);
        }}
      >
        {/* Back Button */}
        <div className="back-arrow-btn" onClick={() => setCurrentStep(-1.5)}>
          <svg width="24" height="44" viewBox="0 0 24 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'scale(0.6)' }}>
            <path d="M22 2L2 22L22 42" stroke="#528BC5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* User Card Input Component - With Ref */}
        <UserCardInput
          ref={sphereRef}
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="電子太郎"
          onSubmit={canStart ? startSession : null}
          disabled={!canStart}
        />

        {/* Swipe Hint - Rendered Externally */}
        <div className="swipe-hint">上にスワイプして送信</div>
      </div>
    );
  }

  // Name Sent Message (Transition)
  if (currentStep === -0.9) {
    return (
      <div className="App tutorial-screen-container">

        <div className="confirmation-content">
          <div className="confirmation-text">
            あなたの名前を<br />
            モニターに追加しました。<br />
            画面をご確認ください。
          </div>

          <div className="confirmation-text">
            これから5つの質問に答えていくと、<br />
            質問ごとに、<br />
            あなたがどんな学生と近いのかを<br />
            見ることができます。
          </div>

          <button className="confirmation-btn" onClick={() => setCurrentStep(0)}>
            つぎへ
          </button>
        </div>

        <img src={grassImg} alt="grass" className="grass-bottom-img" />
      </div>
    );
  }

  // Done Screen (Final)
  if (currentStep === 6) {
    return (
      <div className="App tutorial-screen-container">

        <div className="confirmation-content">
          <div className="confirmation-header">
            ご来場ありがとうございました。
          </div>

          <div className="confirmation-text">
            あなたと考え方が近い学生が見つかりました。<br />
            モニターをご確認ください。
          </div>

          <div className="confirmation-text">
            自分のお名前をダブルクリックしたら、<br />
            マッチングの結果を<br />
            お持ち帰ることができます。
          </div>
        </div>

        <img src={grass2Img} alt="grass2" className="grass-bottom-img" />
      </div>
    );
  }

  const axis = axes[currentStep];

  return (
    <div className="App tutorial-screen-container">
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
              className="dotted-btn-base dotted-btn-white"
              onClick={handleBack}
              disabled={isSending}
            >
              戻る
            </button>
          )}

          <button
            className="dotted-btn-base dotted-btn-blue"
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