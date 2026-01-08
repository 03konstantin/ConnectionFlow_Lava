import React, { useEffect, useRef, useState, useMemo } from 'react';
import Matter from 'matter-js';
import { supabase } from './supabaseClient';
import './App.css';
import { NotificationStack } from './NotificationStack';
import { semanticMatcher } from './SemanticMatcher';

// 🔥 CONFIGURATION 🔥
// const MATCH_THRESHOLD = 0.0; // Unused currently

const { Engine, Runner, World, Bodies, Body, Vector, Events } = Matter;

const QUESTION_MAP = {
  'cooking_emphasis': '料理は、作り方より見た目を重視する',
  'new_activity_company': '何か新しいことを始めるとき、誰かと一緒に始めたい',
  'menu_selection_style': '私はメニューを選ぶときは、直感でパッと決める',
  'social_planning': '遊びの予定は、当日や前日の急なお誘いでも嬉しい',
  'messaging_urgency': 'メッセージが来たら、すぐに返信しないと落ち着かない'
};

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

  // =================================================================
  // 🧠 NOTIFICATION LOGIC
  // =================================================================
  const addNotification = (title, message, type = 'info') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => {
      // Simple debounce/limit: keep max 5
      const newStack = [...prev, { id, title, message, type }];
      if (newStack.length > 5) return newStack.slice(newStack.length - 5);
      return newStack;
    });

    // Auto remove after 5s
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // =================================================================
  // 🧠 LOCAL SEMANTIC BRAIN
  // =================================================================
  useEffect(() => {
    semanticMatcher.init();
  }, []);

  // --- PHYSICS ENGINE ---
  useEffect(() => {
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

    // PHYSICS LOOP
    Events.on(engine, 'beforeUpdate', () => {
      const allBodies = engine.world.bodies;

      allBodies.forEach(body => {
        if (body.isStatic) return;

        const isVisitor = body.cardData?.type === 'visitor';
        const isStudent = body.cardData?.type === 'student';

        // --- 1. VISITOR PHYSICS ---
        if (isVisitor) {
          Body.setAngle(body, 0);
          Body.setAngularVelocity(body, 0);

          // Visitor Repulsion (they push each other away strongly)
          const otherVisitors = allBodies.filter(b => b !== body && b.cardData?.type === 'visitor');

          otherVisitors.forEach(other => {
            const vec = Vector.sub(body.position, other.position);
            const dist = Vector.magnitude(vec);
            if (dist < 500) {
              const force = 2.0 / (dist + 1);
              Body.applyForce(body, body.position, Vector.mult(Vector.normalise(vec), force));
            }
          });

          // Gentle Centering if very far
          const center = { x: W / 2, y: H / 2 };
          const distToCenter = Vector.magnitude(Vector.sub(body.position, center));
          if (distToCenter > Math.min(W, H) * 0.4) {
            Body.applyForce(body, body.position, Vector.mult(Vector.normalise(Vector.sub(center, body.position)), 0.0002));
          }
        }

        // --- 2. STUDENT PHYSICS (THE SWARM) ---
        if (isStudent) {
          // A. CONSTANT WANDER (The "Life" force)
          if (!body.wanderAngle) body.wanderAngle = Math.random() * Math.PI * 2;
          body.wanderAngle += (Math.random() - 0.5) * 0.1;

          const wanderForceMag = 0.00004;
          Body.applyForce(body, body.position, {
            x: Math.cos(body.wanderAngle) * wanderForceMag,
            y: Math.sin(body.wanderAngle) * wanderForceMag
          });

          // B. CLUSTERING (Student-Student Affinity)
          // "Students ... matches 3 out of 5 ... be in one pile"
          const neighbors = studentGraphRef.current.get(body.cardData.id);
          if (neighbors && neighbors.length > 0) {
            neighbors.forEach(neighborId => {
              // Find neighbour body
              const neighborBody = allBodies.find(b => b.cardData?.type === 'student' && b.cardData.id === neighborId);
              if (!neighborBody) return;

              const vec = Vector.sub(neighborBody.position, body.position);
              const dist = Vector.magnitude(vec);
              const dir = Vector.normalise(vec);

              // Attraction to cluster
              // Target distance: don't sit on top, but close (e.g. 80px)
              const clusterDist = 80;
              if (dist > clusterDist) {
                // Gentle pull
                const cohesion = 0.000015;
                Body.applyForce(body, body.position, Vector.mult(dir, cohesion));
              }
            });
          }

          // C. VISITOR ATTRACTION (Strict Radial Rings)
          const visitors = allBodies.filter(b => b.cardData?.type === 'visitor');

          let bestMatch = null;
          let bestVisitorBody = null;

          visitors.forEach(vBody => {
            if (!vBody.cardData?.scores) return;
            const m = vBody.cardData.scores.find(s => s.student_id === body.cardData.id);
            if (m && (!bestMatch || m.matchCount > bestMatch.matchCount)) {
              bestMatch = m;
              bestVisitorBody = vBody;
            }
          });

          if (bestMatch && bestVisitorBody) {
            const vec = Vector.sub(bestVisitorBody.position, body.position);
            const dist = Vector.magnitude(vec);
            const dir = Vector.normalise(vec);

            // STRICT TARGET DISTANCES (Rings)
            // RELAXED LOGIC: 3+ matches = CLOSEST
            let targetR = 1000;
            let tension = 0.00001;

            switch (bestMatch.matchCount) {
              case 5:
              case 4:
              case 3:
                targetR = 80; tension = 0.00015; // All 3+ go to center (stronger pull)
                break;
              case 2:
                targetR = 400; tension = 0.00005; // Mid
                break;
              case 1:
                targetR = 600; tension = 0.00003; // Far
                break;
              default:
                targetR = 1200; tension = 0.00002; // Push away
                break;
            }

            // 1. RADIAL FORCE
            const error = dist - targetR;
            Body.applyForce(body, body.position, Vector.mult(dir, error * tension));

            // 2. TANGENTIAL FORCE (Orbit/Swirl)
            const tangent = Vector.perp(dir);
            const direction = (body.id % 2 === 0) ? 1 : -1;
            const orbitSpeed = 0.00003;

            Body.applyForce(body, body.position, Vector.mult(tangent, direction * orbitSpeed));
          }

          // D. STUDENT SEPARATION (Don't clump too hard)
          const others = allBodies.filter(b => b !== body && b.cardData?.type === 'student');
          others.forEach(other => {
            const vec = Vector.sub(body.position, other.position);
            const dist = Vector.magnitude(vec);
            if (dist < 55) {
              const force = 0.0005;
              Body.applyForce(body, body.position, Vector.mult(Vector.normalise(vec), force));
            }
          });
        }

        // --- 3. BOUNDARY (Gentle containment) ---
        const m = 50;
        const boundaryForce = 0.0005;
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

        // 2. Update Lines
        if (b.cardData?.type === 'visitor' && b.cardData.scores) {
          b.cardData.scores.forEach(match => {
            // Show lines for ANY match (>= 1) so user feels feedback immediately
            if (match.matchCount < 1) return;

            const lineId = `line-${b.cardData.id}-${match.student_id}`;
            const lineEl = lineRefs.current.get(lineId);
            const studentBody = engineRef.current.world.bodies.find(sb => sb.cardData?.type === 'student' && sb.cardData.id === match.student_id);

            if (lineEl && studentBody) {
              lineEl.setAttribute('x1', b.position.x);
              lineEl.setAttribute('y1', b.position.y);
              lineEl.setAttribute('x2', studentBody.position.x);
              lineEl.setAttribute('y2', studentBody.position.y);
            }
          });
        }
      });
      frameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      Runner.stop(runnerRef.current);
      if (frameId) cancelAnimationFrame(frameId);
      World.clear(engine.world);
      Engine.clear(engine);
    };
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
    const radius = isVisitor ? 70 : 45;

    const body = Bodies.circle(x, y, radius, {
      restitution: 0.6,
      frictionAir: isVisitor ? 0.05 : 0.002,
      friction: 0,
      density: isVisitor ? 10 : 1,
    });

    body.dbId = uniqueId;
    body.cardData = card;

    World.add(engine.world, body);
    setCards(prev => new Map(prev).set(uniqueId, body));

    if (isNew && isVisitor) {
      processNewCard(card.id);
      addNotification('New Visitor', `${card.visitor_name} has joined!`, 'info');
    }
  };


  // --- LOGIC: MATCHING ---
  const processNewCard = async (cardId) => {
    const { data: card } = await supabase.from('visitor_cards').select('*').eq('id', cardId).single();
    if (!card) return;

    const { data: students } = await supabase.from('student_cards').select('*');
    const matches = await semanticMatcher.findMatches(card, students || [], 0.0);

    await supabase.from('visitor_cards').update({ scores: matches }).eq('id', cardId);
    updateBodyData({ ...card, type: 'visitor', scores: matches });
  };

  const updateBodyData = (newData) => {
    const uniqueId = `${newData.type}-${newData.id}`;
    const engine = engineRef.current;
    const body = engine.world.bodies.find(b => b.dbId === uniqueId);
    if (body) {
      body.cardData = { ...body.cardData, ...newData };
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
    <div className="aquarium-container" ref={sceneRef} onClick={() => setExpandedId(null)}>
      <NotificationStack notifications={notifications} />

      <svg className="connections-layer">
        {connections.map(line => (
          <line
            key={line.id}
            ref={el => {
              if (el) lineRefs.current.set(line.id, el);
              else lineRefs.current.delete(line.id);
            }}
            className="connection-line"
            style={{ stroke: `rgba(100,200,255,${line.opacity})`, strokeWidth: line.width }}
          />
        ))}
      </svg>

      {Array.from(cards.values()).map(body => {
        const d = body.cardData;
        const isExpanded = expandedId === d.id;

        return (
          <div
            key={d.id}
            ref={el => {
              if (el) cardRefs.current.set(body.dbId, el);
              else cardRefs.current.delete(body.dbId);
            }}
            className={`card-body ${d.type} ${isExpanded ? 'expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(prev => prev === d.id ? null : d.id);
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              willChange: 'transform'
            }}
          >
            {!isExpanded && (
              <div className="blob-name">
                {d.visitor_name || d.student_name || '...'}
              </div>
            )}
            {isExpanded && (
              <div className="expanded-content">
                <div style={{ fontWeight: 'bold' }}>{d.visitor_name || d.student_name}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;