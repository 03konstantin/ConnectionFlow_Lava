import React, { useEffect, useRef, useState, useMemo } from 'react';
import Matter from 'matter-js';
import { supabase } from './supabaseClient';
import './App.css';
import bgmFile from './sound/BGM.mp3';
import dragSoundFile from './sound/draging_visitor.mp3';
import newVisitorSoundFile from './sound/new_visitor_appeaer_sound.mp3';
import { NotificationStack } from './NotificationStack';
import { semanticMatcher } from './SemanticMatcher';
import logo from './logo.svg';
// import visitorIcon from './visitor_icon.png';

// 🔥 CONFIGURATION 🔥
// const MATCH_THRESHOLD = 0.0; // Unused currently

const { Engine, Runner, World, Bodies, Body, Vector, Events, Mouse, MouseConstraint } = Matter;

const QUESTION_MAP = {
  'cooking_emphasis': '料理は、作り方より見た目を重視する',
  'new_activity_company': '何か新しいことを始めるとき、誰かと一緒に始めたい',
  'menu_selection_style': '私はメニューを選ぶときは、直感でパッと決める',
  'social_planning': '遊びの予定は、当日や前日の急なお誘いでも嬉しい',
  'messaging_urgency': 'メッセージが来たら、すぐに返信しないと落ち着かない'
};

// Helper: Tiered Selection (Best matches, minimum 3)
function selectActiveMatches(allMatches) {
  if (!allMatches || allMatches.length === 0) return [];

  // Group by score
  const byScore = { 5: [], 4: [], 3: [], 2: [], 1: [] };
  allMatches.forEach(m => {
    if (byScore[m.matchCount]) byScore[m.matchCount].push(m);
  });

  let active = [];

  // Iterate from top score down
  for (let s = 5; s >= 1; s--) {
    const tier = byScore[s];
    if (tier && tier.length > 0) {
      // Logic:
      // 1. If we have nothing yet, take the ENTIRE top tier (even if > 3)
      if (active.length === 0) {
        active = active.concat(tier);
      }
      // 2. If we have some but < 3, fill the gap
      else if (active.length < 3) {
        const needed = 3 - active.length;
        // Take standard slice (arbitrary tie-break by ID/order is fine)
        active = active.concat(tier.slice(0, needed));
      }
      // 3. If we already have >= 3, stop looking at lower tiers
      else {
        break;
      }
    }
  }
  return active;
}

function App() {
  const sceneRef = useRef(null);
  const engineRef = useRef(Engine.create());
  const runnerRef = useRef(Runner.create());
  const [cards, setCards] = useState(new Map()); // Stores DATA, not positions

  // DIRECT DOM REFS for performance (Bypassing React Render Loop)
  const cardRefs = useRef(new Map());
  const lineRefs = useRef(new Map());

  // Notification State
  const [notifications, setNotifications] = useState([]);

  // Ref to track previous state of data to detect CHANGES for notifications
  const previousDataRef = useRef(new Map()); // Map<id, vector_profile>

  // Ref to store Student-Student Neighbors for clustering
  const studentGraphRef = useRef(new Map()); // Map<studentId, Array<neighborId>>

  // Interaction State
  const [expandedId, setExpandedId] = useState(null);
  const [draggingId, setDraggingId] = useState(null); // Track dragging for hiding lines
  const isDraggingRef = useRef(false); // Ref for immediate logic outside render loop
  const draggingIdRef = useRef(null); // Ref for render loop access
  const lastClickRef = useRef({}); // Track click times for manual double-click

  // SOUND REFS (Lazy Init)
  const bgmRef = useRef(null);
  const dragSoundRef = useRef(null);
  const newVisitorSoundRef = useRef(null);

  if (!bgmRef.current) bgmRef.current = new Audio(bgmFile);
  if (!dragSoundRef.current) dragSoundRef.current = new Audio(dragSoundFile);
  if (!newVisitorSoundRef.current) newVisitorSoundRef.current = new Audio(newVisitorSoundFile);

  // PRINTING STATE
  const [printingVisitor, setPrintingVisitor] = useState(null);
  const [matchedStudents, setMatchedStudents] = useState({ compatible: [], surprising: null });

  // =================================================================
  // 🖨️ PRINTING LOGIC
  // =================================================================
  const handlePrintRequest = async (visitor) => {
    // 1. Check if matches exist
    if (!visitor.scores || visitor.scores.length === 0) {
      addNotification('Printer', 'マッチングデータがまだありません。', 'info');
      return;
    }

    setPrintingVisitor(visitor);

    // 2. Fetch Student Details
    // 2. Fetch Student Details
    console.log('Printing for:', visitor.visitor_name, visitor.scores);

    let activeMatches = selectActiveMatches(visitor.scores);

    // Fallback if tiered selection returns nothing but we have scores
    if ((!activeMatches || activeMatches.length === 0) && visitor.scores.length > 0) {
      console.warn('Tiered selection returned empty. Falling back to simple sort.');
      activeMatches = visitor.scores;
    }

    // Sort these active matches by score descending
    const topMatches = activeMatches.sort((a, b) => b.matchCount - a.matchCount).slice(0, 10); // increased limit to 10
    const compatibleIds = topMatches.map(m => m.student_id);

    // --- SURPRISING PARTNER (0 Matches) ---
    // Filter for matchCount === 0
    const zeroMatches = visitor.scores.filter(m => m.matchCount === 0);
    let surprisingMatch = null;
    let surprisingId = null;

    if (zeroMatches.length > 0) {
      // Randomly pick one
      const randomIndex = Math.floor(Math.random() * zeroMatches.length);
      surprisingMatch = zeroMatches[randomIndex];
      surprisingId = surprisingMatch.student_id;
    }

    const idsToFetch = [...compatibleIds];
    if (surprisingId) idsToFetch.push(surprisingId);

    console.log('Fetching students:', idsToFetch);

    const { data: students, error } = await supabase
      .from('student_cards')
      .select('id, student_name, student_number, katakana_name, table_number') // Added fields
      .in('id', idsToFetch);

    if (error || !students) {
      console.error('Student fetch error:', error);
      addNotification('Printer', '学生データの取得に失敗しました', 'error');
      setPrintingVisitor(null);
      return;
    }

    // Process Compatible
    const compatibleData = topMatches.map((match, index) => {
      const details = students.find(s => s.id === match.student_id);
      return {
        rank: index + 1,
        // PREFER KATAKANA NAME, fallback to student_name
        name: details?.katakana_name || details?.student_name || 'Unknown',
        number: details?.student_number || '---',
        table: details?.table_number || '?', // Table Number
        id: match.student_id,
        similarity: match.similarity || 0,
        matchCount: match.matchCount, // Use matchCount for Hearts
        type: 'compatible'
      };
    });

    // Process Surprising
    let surprisingData = null;
    if (surprisingMatch && surprisingId) {
      const details = students.find(s => s.id === surprisingId);
      if (details) {
        surprisingData = {
          name: details.katakana_name || details.student_name || 'Unknown',
          number: details.student_number || '---',
          table: details.table_number || '?',
          id: surprisingId,
          similarity: 0,
          matchCount: 0,
          type: 'surprising'
        };
      }
    }

    const finalData = {
      compatible: compatibleData,
      surprising: surprisingData
    };

    console.log('Final Print Data:', finalData);
    setMatchedStudents(finalData);

    // 3. Trigger Print after render
    setTimeout(() => {
      window.print();
    }, 1000); // 1s wait to ensure re-render
  };

  // 🧠 NOTIFICATION LOGIC
  // =================================================================
  // HELPER: Safe Audio Play
  const safePlay = (audioRef) => {
    if (!audioRef.current) return;
    const promise = audioRef.current.play();
    if (promise !== undefined) {
      promise.catch(error => {
        // console.log("Audio autoplay blocked. Waiting for interaction.");
      });
    }
  };

  const addNotification = (title, message, type = 'info') => {
    // ... same ...
    const id = Date.now() + Math.random();
    setNotifications(prev => {
      const newStack = [...prev, { id, title, message, type }];
      if (newStack.length > 5) return newStack.slice(newStack.length - 5);
      return newStack;
    });

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // =================================================================
  // 🧠 LOCAL SEMANTIC BRAIN
  // =================================================================
  useEffect(() => {
    semanticMatcher.init();

    // AUDIO SETUP
    // BGM
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.5;

    // Robust Autoplay Handler
    const tryPlayBGM = () => {
      if (bgmRef.current.paused) {
        bgmRef.current.play().then(() => {
          // Success! Remove listeners
          window.removeEventListener('click', tryPlayBGM);
          window.removeEventListener('keydown', tryPlayBGM);
          window.removeEventListener('touchstart', tryPlayBGM);
        }).catch(e => {
          // Still blocked? Keep listening.
          console.log("BGM blocked, waiting for interaction...");
        });
      }
    };

    // Try immediately
    tryPlayBGM();

    // Attach listeners to retry on ANY interaction
    window.addEventListener('click', tryPlayBGM);
    window.addEventListener('keydown', tryPlayBGM);
    window.addEventListener('touchstart', tryPlayBGM);

    // Drag Sound Loop Setup
    dragSoundRef.current.loop = true;

    return () => {
      window.removeEventListener('click', tryPlayBGM);
      window.removeEventListener('keydown', tryPlayBGM);
      window.removeEventListener('touchstart', tryPlayBGM);
    };

  }, []);

  // --- CARD LIFECYCLE MANAGEMENT (FADE OUT) ---
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const FADE_THRESHOLD = 90 * 1000; // 1.5 minutes (90s)
      const WARN_THRESHOLD = 80 * 1000; // Warning at 80s (10s before exp)

      setCards(prevCards => {
        let changed = false;
        const newMap = new Map(prevCards);

        newMap.forEach((body, key) => {
          if (body.cardData.type !== 'visitor') return;
          if (body.isFading) return; // Already fading

          // IMMUTABLE EXPIRATION: Use DB creation time
          // If created_at is missing, fallback to now (new cards) or createdAt prop
          let birthTime = 0;
          if (body.cardData.created_at) {
            birthTime = new Date(body.cardData.created_at).getTime();
          } else {
            birthTime = body.cardData.createdAt || 0; // Fallback
          }

          const age = now - birthTime;

          // Debug Expiration
          // console.log(`Card ${body.cardData.visitor_name}: Age ${Math.floor(age/1000)}s`);

          // WARNING: Flicker before expiration
          if (age > WARN_THRESHOLD && age < FADE_THRESHOLD) {
            if (!body.isFlickering) {
              body.isFlickering = true;
              changed = true;
            }
          }

          if (age > FADE_THRESHOLD) {
            // Start Fading
            body.isFlickering = false; // Stop flicker, start fade
            body.isFading = true;
            changed = true;

            // Schedule removal
            setTimeout(async () => {
              World.remove(engineRef.current.world, body);
              setCards(current => {
                const updated = new Map(current);
                updated.delete(key);
                return updated;
              });
              // DELETE FROM DB
              await supabase.from('visitor_cards').delete().eq('id', body.cardData.id);
              console.log('Expired and deleted card:', body.cardData.visitor_name);
            }, 2000); // 2s Fade duration
          }
        });

        return changed ? newMap : prevCards;
      });
    }, 2000); // Check every 2s for responsiveness

    return () => clearInterval(checkInterval);
  }, []);

  // --- PHYSICS ENGINE ---
  useEffect(() => {
    // ... (Physic setup code stays same) ...
    const engine = engineRef.current;

    // ZERO GRAVITY (Lava Lamp)
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;

    // WALLS (Strict Boundaries) - Made slightly bouncy
    const wallOptions = {
      isStatic: true,
      render: { visible: false },
      restitution: 0.8,
      friction: 0
    };

    const T = 1000;
    const W = window.innerWidth;
    const H = window.innerHeight;

    World.add(engine.world, [
      Bodies.rectangle(W / 2, -T / 2, W + 2 * T, T, wallOptions), // TOP
      Bodies.rectangle(W / 2, H + T / 2, W + 2 * T, T, wallOptions), // BOTTOM
      Bodies.rectangle(-T / 2, H / 2, T, H + 2 * T, wallOptions), // LEFT
      Bodies.rectangle(W + T / 2, H / 2, T, H + 2 * T, wallOptions) // RIGHT
    ]);


    // MOUSE CONTROL (Drag & Drop)
    const mouse = Mouse.create(sceneRef.current);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false }
      }
    });
    World.add(engine.world, mouseConstraint);

    // DRAG EVENTS
    // DRAG EVENTS
    // DRAG EVENTS
    Events.on(mouseConstraint, 'startdrag', (event) => {
      isDraggingRef.current = true;
      const body = event.body;
      if (body && body.dbId) {
        if (body.cardData?.type === 'visitor') {
          setDraggingId(body.cardData.id);
          draggingIdRef.current = body.cardData.id;

          // Start Drag Sound
          dragSoundRef.current.currentTime = 0;
          safePlay(dragSoundRef);
        }
      }
    });

    Events.on(mouseConstraint, 'enddrag', () => {
      isDraggingRef.current = false;
      setDraggingId(null);
      draggingIdRef.current = null;

      // Stop Drag Sound
      dragSoundRef.current.pause();
      dragSoundRef.current.currentTime = 0;
    });

    // PHYSICS LOOP

    // PHYSICS LOOP
    Events.on(engine, 'beforeUpdate', () => {
      const allBodies = engine.world.bodies;

      allBodies.forEach(body => {
        if (body.isStatic) return;

        const isVisitor = body.cardData?.type === 'visitor';
        const isStudent = body.cardData?.type === 'student';

        // --- 1. VISITOR PHYSICS ---
        if (isVisitor) {
          // ... (visitor physics same) ...
          Body.setAngle(body, 0);
          Body.setAngularVelocity(body, 0);

          // Visitor Repulsion (they push each other away strongly)
          const otherVisitors = allBodies.filter(b => b !== body && b.cardData?.type === 'visitor');

          otherVisitors.forEach(other => {
            const vec = Vector.sub(body.position, other.position);
            const dist = Vector.magnitude(vec);
            if (dist < 600) {
              const force = 5.0 / (dist + 1); // Increased force
              Body.applyForce(body, body.position, Vector.mult(Vector.normalise(vec), force));
            }
          });

          // Gentle Centering if very far (Allow roaming up to 90% of screen)
          const center = { x: W / 2, y: H / 2 };
          const distToCenter = Vector.magnitude(Vector.sub(body.position, center));
          if (distToCenter > Math.min(W, H) * 0.9) {
            Body.applyForce(body, body.position, Vector.mult(Vector.normalise(Vector.sub(center, body.position)), 0.00015));
          }
        }

        // --- 2. STUDENT PHYSICS (THE SWARM) ---
        if (isStudent) {
          // ... (student physics same) ...
          // A. CONSTANT WANDER (The "Life" force)
          if (!body.wanderAngle) body.wanderAngle = Math.random() * Math.PI * 2;

          // Smoother, continuous turning (Lava lamp blobs don't jitter, they flow)
          // REDUCED TURNING (0.08 -> 0.02): They keep direction longer to cross the screen
          body.wanderAngle += (Math.random() - 0.5) * 0.02;

          // Constant gentle drive - SUPERCHARGED for full-tank traversal
          // High frictionAir (0.035) requires strong force to move long distances
          const wanderForceMag = 0.02;
          // Steering: Avoid Walls actively
          // If we hit a wall, we shouldn't just push back, we should TURN our swimming direction away.
          // Reduced margin to 60 (was 150) so they can touch/bump the wall before turning.
          const margin = 60;
          const turnSpeed = 0.15; // Faster turn since we are closer

          // Left Wall
          if (body.position.x < margin && Math.cos(body.wanderAngle) < 0) {
            body.wanderAngle += turnSpeed; // Turn Right
          }
          // Right Wall
          if (body.position.x > W - margin && Math.cos(body.wanderAngle) > 0) {
            body.wanderAngle += turnSpeed; // Turn (this will cycle round)
          }
          // Top Wall
          if (body.position.y < margin && Math.sin(body.wanderAngle) < 0) {
            body.wanderAngle += turnSpeed;
          }
          // Bottom Wall
          if (body.position.y > H - margin && Math.sin(body.wanderAngle) > 0) {
            body.wanderAngle += turnSpeed;
          }

          // CORNER KICK (Prevent corner traps)
          // Reduced to 80 (was 100)
          if (body.position.x < 80 && body.position.y < 80) body.wanderAngle = Math.PI * 0.25; // Top-Left -> Go SouthEast
          if (body.position.x > W - 80 && body.position.y < 80) body.wanderAngle = Math.PI * 0.75; // Top-Right -> Go SouthWest
          if (body.position.x < 80 && body.position.y > H - 80) body.wanderAngle = Math.PI * 1.75; // Btm-Left -> Go NorthEast
          if (body.position.x > W - 80 && body.position.y > H - 80) body.wanderAngle = Math.PI * 1.25; // Btm-Right -> Go NorthWest

          Body.applyForce(body, body.position, {
            x: Math.cos(body.wanderAngle) * wanderForceMag,
            y: Math.sin(body.wanderAngle) * wanderForceMag
          });

          // D. GENTLE SEPARATION (Anti-Clumping)
          // Ensure they don't stick together if they meet, pushing them gently apart.
          const others = allBodies.filter(b => b !== body && b.cardData?.type === 'student');
          others.forEach(other => {
            const vec = Vector.sub(body.position, other.position);
            const dist = Vector.magnitude(vec);
            // Repel if within visual proximity (approx 2x visual radius + margin)
            // Visual width is ~100px. So 130px is a good "personal space" buffer.
            if (dist < 130) {
              // Linear falloff: Stronger when closer.
              // Max force 0.005 is 25% of wander force (0.02), enough to separate but not explode.
              const strength = 0.005 * (1 - dist / 130);
              Body.applyForce(body, body.position, Vector.mult(Vector.normalise(vec), strength));
            }
          });

          // C. VISITOR FIELD (Progressive Tiered Matching)
          const visitors = allBodies.filter(b => b.cardData?.type === 'visitor');

          if (visitors.length > 0) {
            visitors.forEach(vBody => {
              if (!vBody.cardData || !vBody.cardData.scores) return;

              // 1. Determine Active Matches for this visitor
              // We do this every frame? Ideally cache it, but for 50 students it's fast enough.
              const activeMatches = selectActiveMatches(vBody.cardData.scores);
              const activeIds = new Set(activeMatches.map(m => m.student_id));

              // Store for renderer (lines)
              vBody.activeIds = activeIds;

              // Check if THIS student is active
              const myId = body.cardData.id;
              const match = vBody.cardData.scores.find(s => s.student_id === myId);
              const isActive = activeIds.has(myId);
              const score = match ? match.matchCount : 0;

              const vec = Vector.sub(vBody.position, body.position);
              const dist = Vector.magnitude(vec);
              const dir = Vector.normalise(vec);

              if (isActive) {
                // ATTRACT (Tiered Radius)
                let targetR = 600; // Default weak
                if (score === 5) targetR = 80;   // Stuck
                else if (score === 4) targetR = 150;
                else if (score === 3) targetR = 250;
                else if (score === 2) targetR = 400; // Mid
                else if (score === 1) targetR = 550; // Far orbit

                const tension = 0.0001 + (score * 0.00005); // Stronger tension for higher scores

                if (dist > targetR) {
                  const force = (dist - targetR) * tension;
                  Body.applyForce(body, body.position, Vector.mult(dir, force));
                }
                // Swirl
                const tangent = Vector.perp(dir);
                Body.applyForce(body, body.position, Vector.mult(tangent, 0.00005));
              } else {
                // REPEL (Not in the tournament)
                const repulsionZone = 350;
                if (dist < repulsionZone) {
                  const force = -0.015 * (1 - dist / repulsionZone);
                  Body.applyForce(body, body.position, Vector.mult(dir, force));
                }
              }
            });
          }

        }

        // --- 3. BOUNDARY (Hard Wall Bounce) ---
        // Reduced m to 40 (was 100) -> allows touching the edge
        const m = 40;
        const boundaryForce = 0.15; // Strong push back
        if (body.position.x < m) Body.applyForce(body, body.position, { x: boundaryForce, y: 0 });
        if (body.position.x > W - m) Body.applyForce(body, body.position, { x: -boundaryForce, y: 0 });
        if (body.position.y < m) Body.applyForce(body, body.position, { x: 0, y: boundaryForce });
        if (body.position.y > H - m) Body.applyForce(body, body.position, { x: 0, y: -boundaryForce });
      });
    });

    Runner.run(runnerRef.current, engine);

    // RENDER LOOP (Direct DOM)
    let frameId;
    const renderLoop = () => {
      engineRef.current.world.bodies.forEach(b => {
        if (!b.dbId) return;

        // 1. Update Cards
        const el = cardRefs.current.get(b.dbId);
        if (el) {
          el.style.transform = `translate3d(${b.position.x}px, ${b.position.y}px, 0) translate(-50%, -50%)`;
        }

        // ... (lines update same) ...
        // 2. Update Lines
        // HIDE LINES IF DRAGGING
        const currentDragId = draggingIdRef.current;

        if (b.cardData.scores) {
          b.cardData.scores.forEach(match => {
            if (!b.activeIds || !b.activeIds.has(match.student_id)) {
              // Hide line if not active
              const lineId = `line-${b.cardData.id}-${match.student_id}`;
              const lineEl = lineRefs.current.get(lineId);
              if (lineEl) lineEl.style.opacity = 0;
              return;
            }

            const lineId = `line-${b.cardData.id}-${match.student_id}`;
            const lineEl = lineRefs.current.get(lineId);
            const studentBody = engineRef.current.world.bodies.find(sb => sb.cardData?.type === 'student' && sb.cardData.id === match.student_id);

            if (lineEl && studentBody) {
              // HIDE IF DRAGGING THIS VISITOR
              if (b.cardData.id === currentDragId) {
                lineEl.style.opacity = 0;
                return;
              }

              // const dx = b.position.x - studentBody.position.x;
              // const dy = b.position.y - studentBody.position.y;
              // const dist = Math.sqrt(dx * dx + dy * dy);
              // const angle = Math.atan2(dy, dx) * 180 / Math.PI;

              // Line Style based on Score
              const score = match.matchCount;
              let width = 1;
              let opacity = 0.2;

              if (score === 5) { width = 6; opacity = 0.9; }
              else if (score === 4) { width = 4; opacity = 0.7; }
              else if (score === 3) { width = 3; opacity = 0.5; }
              else if (score === 2) { width = 2; opacity = 0.3; }

              lineEl.setAttribute('x1', studentBody.position.x);
              lineEl.setAttribute('y1', studentBody.position.y);
              lineEl.setAttribute('x2', b.position.x);
              lineEl.setAttribute('y2', b.position.y);
              lineEl.style.opacity = opacity;
              lineEl.style.strokeWidth = width;
            }
          });
        }
      });
      frameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Runner.stop(runnerRef.current);
      if (frameId) cancelAnimationFrame(frameId);
      World.clear(engine.world);
      Engine.clear(engine);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- CARD MANAGEMENT ---
  const addCardToWorld = (card, isNew = false) => {
    const uniqueId = `${card.type}-${card.id}`;
    const engine = engineRef.current;

    // Store data for diffing later
    if (card.vector_profile) {
      previousDataRef.current.set(card.id, JSON.stringify(card.vector_profile));
    }

    if (engine.world.bodies.find(b => b.dbId === uniqueId)) return;

    // Spread them out initially
    const x = Math.random() * (window.innerWidth - 100) + 50;
    const y = Math.random() * (window.innerHeight - 100) + 50;

    const isVisitor = card.type === 'visitor';

    const visualRadius = isVisitor ? 50 : 25; // Student reduced ~30% (35 -> 25)

    // PHYSICS SIZE (Larger core to REDUCE OVERLAP)
    // 0.85 ratio -> minimal overlap, they bump sooner
    const physicsRadius = visualRadius * 0.85;

    const body = Bodies.circle(x, y, physicsRadius, {
      restitution: 0.1, // No bounce
      frictionAir: 0.035, // Medium-High Viscosity (Lava Lamp)
      friction: 0,
      density: isVisitor ? 2 : 1,
    });

    body.dbId = uniqueId;
    // Add random delay so they don't pulse in sync (0 to -8s)
    const randomDelay = -(Math.random() * 8).toFixed(2);
    // Random blob shape variant (1-4)
    const blobVariant = Math.floor(Math.random() * 4) + 1;

    // INIT LAST UPDATED (Local visual tracking only, logic uses DB created_at)
    const createdAtLocal = Date.now();
    body.cardData = {
      ...card,
      visualRadius,
      randomDelay,
      blobVariant,
      createdAt: createdAtLocal,
      // Ensure 'created_at' from DB is present if card has it
      created_at: card.created_at
    };

    World.add(engine.world, body);
    setCards(prev => new Map(prev).set(uniqueId, body));

    if (isNew && isVisitor) {
      processNewCard(card.id);
      addNotification('New Visitor', `${card.visitor_name} つながりの海へようこそ。`, 'info');
      // Play Sound
      newVisitorSoundRef.current.currentTime = 0;
      safePlay(newVisitorSoundRef);
    }
  };


  // --- LOGIC: MATCHING ---
  const processNewCard = async (cardId) => {
    const { data: card } = await supabase.from('visitor_cards').select('*').eq('id', cardId).single();
    if (!card) return;

    const { data: students } = await supabase.from('student_cards').select('*');
    const matches = await semanticMatcher.findMatches(card, students || [], 0.0);

    // INFINITE LOOP PREVENTION:
    // If the database already has these scores, DO NOT update.
    // Simple check: compare JSON stringification or length + first item
    if (card.scores && JSON.stringify(card.scores) === JSON.stringify(matches)) {
      // Just update local body if needed, but DO NOT write to DB (which triggers update loop)
      // Actually, if it's the same, we might not even need to update local body if it's already there.
      // But to be safe, let's update local body without changing lastUpdated.
      updateBodyData({ ...card, type: 'visitor', scores: matches });
      return;
    }

    await supabase.from('visitor_cards').update({ scores: matches }).eq('id', cardId);
    updateBodyData({ ...card, type: 'visitor', scores: matches, lastUpdated: Date.now() });
  };

  const updateBodyData = (newData) => {
    const uniqueId = `${newData.type}-${newData.id}`;
    const engine = engineRef.current;
    const body = engine.world.bodies.find(b => b.dbId === uniqueId);
    if (body) {
      // RESET Timer on update ONLY if explicitly requested or if it's the first match
      // Currently it resets on every update. Let's PRESERVE it if not passed.
      const currentLastUpdated = body.cardData.lastUpdated;
      body.cardData = {
        ...body.cardData,
        ...newData,
        lastUpdated: newData.lastUpdated || currentLastUpdated
      };

      console.log('Updated body data:', uniqueId, 'Last Updated:', new Date(body.cardData.lastUpdated).toLocaleTimeString());

      // Force React update for data changes (like new scores), but NOT for position
      setCards(prev => new Map(prev).set(uniqueId, body));
    }
  };

  // --- DIFFING LOGIC FOR NOTIFICATIONS ---
  const checkDiffAndNotify = (newCard) => {
    const prevJson = previousDataRef.current.get(newCard.id);
    const newVector = newCard.vector_profile || {};
    const prevVector = prevJson ? JSON.parse(prevJson) : {};

    const newKeys = Object.keys(newVector);
    const oldKeys = Object.keys(prevVector);
    const addedKey = newKeys.find(k => !oldKeys.includes(k));

    if (addedKey) {
      const readableQuestion = QUESTION_MAP[addedKey] || 'ある質問';
      addNotification('Update', `${newCard.visitor_name}が回答: 「${readableQuestion}」`, 'success');
    }
    previousDataRef.current.set(newCard.id, JSON.stringify(newVector));
  };

  // ... (Clustering and Supabase Effect remain same) ...
  // --- CLUSTERING CALCULATION (Pre-calc) ---
  const calculateStudentClusters = async (studentList) => {
    // Very simple N^2 check. 100 * 100 = 10,000. Easy for JS.
    const map = new Map();

    for (let i = 0; i < studentList.length; i++) {
      const s1 = studentList[i];
      const v1 = s1.vector_profile ? (typeof s1.vector_profile === 'string' ? JSON.parse(s1.vector_profile) : s1.vector_profile) : {};

      for (let j = i + 1; j < studentList.length; j++) {
        const s2 = studentList[j];
        const v2 = s2.vector_profile ? (typeof s2.vector_profile === 'string' ? JSON.parse(s2.vector_profile) : s2.vector_profile) : {};

        const { matchCount } = semanticMatcher.calculateMatch(v1, v2);

        // RULE: Match 3 out of 5 to be in a "group"
        if (matchCount >= 3) {
          // Link them
          const list1 = map.get(s1.id) || [];
          list1.push(s2.id);
          map.set(s1.id, list1);

          const list2 = map.get(s2.id) || [];
          list2.push(s1.id);
          map.set(s2.id, list2);
        }
      }
    }
    studentGraphRef.current = map;
    console.log('Student Clustering Graph Calculated:', map.size, 'nodes with connections');
  };

  // --- SUPABASE SUBSCRIPTION (REALTIME) ---
  useEffect(() => {
    const fetchAll = async () => {
      const { data: s } = await supabase.from('student_cards').select('*');
      const { data: v } = await supabase.from('visitor_cards').select('*');

      // Init Clusters
      if (s) {
        s.forEach(c => addCardToWorld({ ...c, type: 'student' }, false));
        calculateStudentClusters(s);
      }
      if (v) v.forEach(c => addCardToWorld({ ...c, type: 'visitor' }, false));
      if (v && s) v.forEach(visitor => processNewCard(visitor.id));
    };
    fetchAll();

    const channel = supabase.channel('aquarium_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visitor_cards' },
        (payload) => addCardToWorld({ ...payload.new, type: 'visitor' }, true)
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'visitor_cards' },
        (payload) => {
          checkDiffAndNotify(payload.new);
          processNewCard(payload.new.id);
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'student_cards' },
        async (payload) => {
          addCardToWorld({ ...payload.new, type: 'student' }, true);
          // Re-calc clusters lazily or just add new node
          const { data: allS } = await supabase.from('student_cards').select('*');
          if (allS) calculateStudentClusters(allS);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute connections only when cards data changes, NOT on every frame
  const connections = useMemo(() => {
    const lines = [];
    Array.from(cards.values()).forEach(body => {
      const data = body.cardData;
      if (data.type !== 'visitor' || !data.scores) return;
      data.scores.forEach(match => {
        // SHOW LINES FOR ANY MATCH >= 1
        if (match.matchCount < 1) return;
        lines.push({
          id: `line-${data.id}-${match.student_id}`,
          visitorId: data.id,
          studentId: match.student_id,
          opacity: match.matchCount / 5,
          width: match.matchCount
        });
      });
    });
    return lines;
  }, [cards]);

  return (
    <>
      <div className="aquarium-container" ref={sceneRef} onClick={() => setExpandedId(null)}>
        <NotificationStack notifications={notifications} />

        <svg className="connections-layer">
          {connections.map(line => {
            const isHidden = line.visitorId === draggingId;
            return (
              <line
                key={line.id}
                ref={el => {
                  if (el) lineRefs.current.set(line.id, el);
                  else lineRefs.current.delete(line.id);
                }}
                className="connection-line"
                style={{
                  stroke: `rgba(100,200,255,${line.opacity})`,
                  strokeWidth: line.width,
                  opacity: isHidden ? 0 : 0.6
                }}
              />
            );
          })}
        </svg>

        {Array.from(cards.values()).map(body => {
          const d = body.cardData;
          const isExpanded = expandedId === d.id;
          const isFading = body.isFading; // Get fading state

          return (
            <div
              key={d.id}
              ref={el => {
                if (el) cardRefs.current.set(body.dbId, el);
                else cardRefs.current.delete(body.dbId);
              }}
              // Add variant class AND fading class
              className={
                (d.type === 'visitor' ? 'card-body visitor' : `card-body ${d.type} variant-${d.blobVariant || 1} ${isExpanded ? 'expanded' : ''}`) +
                (isFading ? ' fading' : '') +
                (body.isFlickering ? ' flickering' : '')
              }
              onClick={(e) => {
                e.stopPropagation();

                // VISITOR: Manual Double Click Logic
                if (d.type === 'visitor') {
                  const now = Date.now();
                  const lastTime = lastClickRef.current[d.id] || 0;

                  if (now - lastTime < 300) {
                    // DOUBLE CLICK DETECTED
                    setExpandedId(expandedId === d.id ? null : d.id);
                    lastClickRef.current[d.id] = 0; // Reset
                  } else {
                    // SINGLE CLICK
                    lastClickRef.current[d.id] = now;

                    // Optional: Shake on single click? User said "Single click just provides... shake"
                    // But previously I disabled it to stabilize. 
                    // Now that we rely on time, movement matters less for detection, but let's keep it steady.
                    // Only shake if NOT double click.
                  }
                  return;
                }

                // STUDENT: Shake only
                const b = engineRef.current.world.bodies.find(x => x.dbId === body.dbId);
                if (b) {
                  Body.applyForce(b, b.position, {
                    x: (Math.random() - 0.5) * 0.15,
                    y: -0.15
                  });
                }
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                // OVAL SHAPE: wider than it is tall (1.4x width)
                width: d.type === 'visitor' ? `${d.visualRadius * 2}px` : (d.visualRadius ? `${d.visualRadius * 2.8}px` : '200px'),
                height: d.visualRadius ? `${d.visualRadius * 2}px` : '140px',
                willChange: 'transform',
                animationDelay: `${d.randomDelay}s` // Randomize blob phase
              }}
            >
              {d.type === 'visitor' ? (
                <div className="visitor-blob-stack">
                  <div className="v-blob-layer"></div>
                  <div className="v-blob-layer"></div>
                  <div className="v-blob-layer"></div>
                  <div className="v-blob-layer"></div>
                  <div className="visitor-content-inner">
                    {d.visitor_name || 'Visitor'}
                    {/* EXPANDED VISITOR CONTENT */}
                    {isExpanded && (
                      <div style={{ marginTop: '10px', pointerEvents: 'auto' }}>
                        {(!d.scores || d.scores.length === 0) ? (
                          <div style={{ fontSize: '0.8rem', color: 'white' }}>Matching...</div>
                        ) : (
                          <button
                            style={{
                              padding: '8px 16px',
                              background: '#fff',
                              color: '#e84393',
                              border: 'none',
                              borderRadius: '20px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintRequest(d);
                            }}
                          >
                            印刷
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // STUDENT CARD RENDER
                <>
                  <div className="blob-name">
                    {d.visitor_name || d.student_name || '...'}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {printingVisitor && matchedStudents && (
        <div className="receipt-container">
          <div className="receipt">
            {/* --- HEADER --- */}
            <div className="r-header">
              <h1 className="r-title-jp">ツナガリのウミ</h1>
              <p className="r-subtitle-jp">ニホン デンシ センモン ガッコウ</p>
              <p className="r-subtitle-jp">ウェブ デザインカ ソツギョウ テンジカイ</p>

              <div className="r-spacer-large"></div>

              <h2 className="r-greeting">イツカ イッショニ シゴト デキタラ イイナ！</h2>
              <p className="r-date">{new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            {/* --- COMPATIBLE PARTNERS --- */}
            <div className="r-section">
              <div className="r-section-title">
                {/* Hands Icon (Simple SVG path) */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="black" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                キノアウ パートナー
              </div>

              {matchedStudents.compatible && matchedStudents.compatible.map(s => (
                <div key={s.id} className="r-row">
                  <div className="r-row-left">
                    <span className="r-table-no">No{s.table}</span>
                    <span className="r-name-katakana">{s.name}</span>
                  </div>
                  <div className="r-row-right">
                    <div className="r-hearts">
                      {[...Array(5)].map((_, i) => (
                        <span key={i}>{i < s.matchCount ? '♥' : '♡'}</span>
                      ))}
                    </div>
                    <div className="r-pay-line">{s.number} AW-Pay</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="r-divider-line">----------------------------------------------------</div>

            {/* --- SURPRISING PARTNER --- */}
            {matchedStudents.surprising && (
              <>
                <div className="r-section">
                  <div className="r-section-title">
                    {/* Target Icon */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="6" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                    オドロキヲ アタエル パートナー
                  </div>

                  <div className="r-row">
                    <div className="r-row-left">
                      <span className="r-table-no">No{matchedStudents.surprising.table}</span>
                      <span className="r-name-katakana">{matchedStudents.surprising.name}</span>
                    </div>
                    <div className="r-row-right">
                      <div className="r-hearts">
                        <span>*****</span>
                      </div>
                      <div className="r-pay-line">0 AW-Pay</div>
                    </div>
                  </div>
                </div>
                <div className="r-divider-line">----------------------------------------------------</div>
              </>
            )}

            {/* --- FOOTER --- */}
            <div className="r-footer">
              <h3 className="r-footer-msg">ゴライジョウ アリガトウゴザイマシタ</h3>

              {/* Logo Image */}
              <div className="r-logo-container">
                <img src={logo} alt="Logo" className="r-logo-img" />
              </div>

              <p className="r-footer-sub">ニホン デンシ センモン ガッコウ</p>
              <p className="r-footer-sub">ウェブ デザインカ ソツギョウ テンジカイ</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;