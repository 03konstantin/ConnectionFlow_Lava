import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { supabase } from './supabaseClient';
import './App.css';

import { semanticMatcher } from './SemanticMatcher';

// 🔥 CONFIGURATION 🔥
const ATTRACT_THRESHOLD = 0.65;
const REPEL_THRESHOLD = 0.45;

const { Engine, Runner, World, Bodies, Body, Vector, Events, Mouse, MouseConstraint } = Matter;

function App() {
  const sceneRef = useRef(null);
  const engineRef = useRef(Engine.create());
  const runnerRef = useRef(Runner.create());
  const [cards, setCards] = useState(new Map());

  // Interaction State
  const [expandedId, setExpandedId] = useState(null);

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

    // Walls
    const wallOptions = { isStatic: true, render: { visible: false } };
    const offset = 200;
    World.add(engine.world, [
      Bodies.rectangle(window.innerWidth / 2, -offset, window.innerWidth + 2 * offset, 50, wallOptions),
      Bodies.rectangle(window.innerWidth / 2, window.innerHeight + offset, window.innerWidth + 2 * offset, 50, wallOptions),
      Bodies.rectangle(-offset, window.innerHeight / 2, 50, window.innerHeight + 2 * offset, wallOptions),
      Bodies.rectangle(window.innerWidth + offset, window.innerHeight / 2, 50, window.innerHeight + 2 * offset, wallOptions)
    ]);

    // PHYSICS LOOP
    Events.on(engine, 'beforeUpdate', () => {
      const allBodies = engine.world.bodies;
      const time = engine.timing.timestamp;

      allBodies.forEach(body => {
        if (body.isStatic) return;

        const isVisitor = body.cardData?.type === 'visitor';
        const isStudent = body.cardData?.type === 'student';

        // --- 1. VISITOR PHYSICS (HEAVY CORE) ---
        if (isVisitor) {
          Body.setAngle(body, 0); // Keep upright (though it's a circle now, good for logic)
          Body.setAngularVelocity(body, 0);

          // Visitor Separation (Don't overlap)
          const otherVisitors = allBodies.filter(b => b !== body && b.cardData?.type === 'visitor');
          otherVisitors.forEach(other => {
            const vec = Vector.sub(body.position, other.position);
            const dist = Vector.magnitude(vec);
            if (dist < 400) {
              const force = 0.5 / (dist + 1); // Heavy push
              Body.applyForce(body, body.position, Vector.mult(Vector.normalise(vec), force));
            }
          });

          // Gentle Bobbing (Breathing feeling)
          Body.applyForce(body, body.position, {
            x: Math.cos(time * 0.0003) * 0.0005,
            y: Math.sin(time * 0.0003) * 0.0005
          });
        }

        // --- 2. STUDENT PHYSICS (LAVA LAMP BLOBS) ---
        if (isStudent) {
          // A. WANDER (Fluid movement)
          if (!body.wanderAngle) body.wanderAngle = Math.random() * Math.PI * 2;
          body.wanderAngle += (Math.random() - 0.5) * 0.1; // Slow turn

          // LAVA VISCOSITY: High frictionAir (0.1) means they stop quickly if not pushed.
          // Combined with low wander force -> Syrupy movement.
          const wanderForceMag = 0.00005; // Very subtle self-propulsion
          Body.applyForce(body, body.position, {
            x: Math.cos(body.wanderAngle) * wanderForceMag,
            y: Math.sin(body.wanderAngle) * wanderForceMag
          });

          // B. SEPARATION (Bounce smoothly off others)
          const others = allBodies.filter(b => b !== body && b.cardData?.type === 'student');
          others.forEach(other => {
            const vec = Vector.sub(body.position, other.position);
            const dist = Vector.magnitude(vec);
            // Blob radius approx 50-60. 
            if (dist < 120) {
              // Smooth "Magnet Repel"
              const strength = 0.0002 * (1 - dist / 120);
              Body.applyForce(body, body.position, Vector.mult(Vector.normalise(vec), strength));
            }
          });

          // C. ATTRACTION TO VISITOR (The Heat Source)
          const visitors = allBodies.filter(b => b.cardData?.type === 'visitor');
          visitors.forEach(visitorBody => {
            if (!visitorBody.cardData?.scores) return;

            const match = visitorBody.cardData.scores.find(s => s.student_id === body.cardData.id);
            if (!match) return;

            const vecToVisitor = Vector.sub(visitorBody.position, body.position);
            const dist = Vector.magnitude(vecToVisitor);
            const dir = Vector.normalise(vecToVisitor);

            // LOGIC: Closer match = Stronger Pull = Closer Proximity
            if (match.similarity > ATTRACT_THRESHOLD) {
              // How "urgent" is the pull?
              // Sim 1.0 -> Urgency 1.0
              // Sim 0.65 -> Urgency 0.0
              const urgency = (match.similarity - ATTRACT_THRESHOLD) / (1 - ATTRACT_THRESHOLD);

              // Force Magnitude
              let strength = 0.0003 * urgency;

              // DAMPING/CUSHION: Don't hit the visitor hard. Slow down when close.
              // Visitor radius ~80, Student ~40. touch at ~120.
              if (dist < 200) {
                strength *= 0.1; // Reduce pull significantly when close
              }
              // Stop completely if 'touching' to prevent chaotic overlapping
              if (dist < 130) {
                strength = 0;
              }

              Body.applyForce(body, body.position, Vector.mult(dir, strength));
            } else {
              // Weak Repel from non-matches to clear path for matches
              if (dist < 300) {
                Body.applyForce(body, body.position, Vector.mult(dir, -0.00005));
              }
            }
          });

          // D. WALL AVOIDANCE (Soft Turn)
          const margin = 100;
          const { x, y } = body.position;
          const w = window.innerWidth;
          const h = window.innerHeight;
          const boundaryPush = 0.0001;

          if (x < margin) Body.applyForce(body, body.position, { x: boundaryPush, y: 0 });
          if (x > w - margin) Body.applyForce(body, body.position, { x: -boundaryPush, y: 0 });
          if (y < margin) Body.applyForce(body, body.position, { x: 0, y: boundaryPush });
          if (y > h - margin) Body.applyForce(body, body.position, { x: 0, y: -boundaryPush });
        }
      });
    });

    Runner.run(runnerRef.current, engine);
    // Mouse Interaction (to drag blobs potentially? Optional)
    // const mouse = Mouse.create(sceneRef.current);
    // const mouseConstraint = MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
    // World.add(engine.world, mouseConstraint);

    return () => {
      Runner.stop(runnerRef.current);
      World.clear(engine.world);
      Engine.clear(engine);
    };
  }, []);

  const addCardToWorld = (card, isNew = false) => {
    const uniqueId = `${card.type}-${card.id}`;
    const engine = engineRef.current;

    if (engine.world.bodies.find(b => b.dbId === uniqueId)) return; // Already exists

    // Calculate Position
    const x = isNew ? window.innerWidth / 2 : Math.random() * (window.innerWidth - 200) + 100;
    const y = isNew ? window.innerHeight - 100 : Math.random() * (window.innerHeight - 200) + 100;

    const isVisitor = card.type === 'visitor';

    // PHYSICS BODY PROPERTIES
    // Visitor: Heavy, Large Circle
    // Student: Light, Medium Circle
    const radius = isVisitor ? 70 : 45;

    const body = Bodies.circle(x, y, radius, {
      restitution: 0.1, // Soft, low bounce (Lava)
      frictionAir: isVisitor ? 0.3 : 0.05, // Viscous fluid resistance. Student moves easier than visitor.
      density: isVisitor ? 20 : 0.001, // VISITOR IS HEAVY (20000x difference)
      friction: 0, // fluid
      slop: 0.5, // allowance for soft feeling
    });

    // Initial nudge
    if (isNew) Body.applyForce(body, body.position, { x: 0, y: -0.1 });

    body.dbId = uniqueId;
    body.cardData = card;

    World.add(engine.world, body);
    setCards(prev => new Map(prev).set(uniqueId, body));

    if (isNew && isVisitor) {
      processNewCard(card.id);
    }
  };


  // --- LOGIC: MATCHING ---
  const processNewCard = async (cardId) => {
    // Fetch fresh data
    const { data: card } = await supabase.from('visitor_cards').select('*').eq('id', cardId).single();
    if (!card) return;

    // Calculate
    const { data: students } = await supabase.from('student_cards').select('*');
    const matches = await semanticMatcher.findMatches(card, students || [], 0.0);

    // Save & Update
    await supabase.from('visitor_cards').update({ scores: matches }).eq('id', cardId);
    updateBodyData({ ...card, type: 'visitor', scores: matches });
  };

  const updateBodyData = (newData) => {
    const uniqueId = `${newData.type}-${newData.id}`;
    const engine = engineRef.current;
    const body = engine.world.bodies.find(b => b.dbId === uniqueId);
    if (body) {
      body.cardData = { ...body.cardData, ...newData };
      // Force trigger render update
      setCards(prev => new Map(prev).set(uniqueId, body));
    }
  };

  // --- SUPABASE SUBSCRIPTION (REALTIME) ---
  useEffect(() => {
    const fetchAll = async () => {
      const { data: s } = await supabase.from('student_cards').select('*');
      const { data: v } = await supabase.from('visitor_cards').select('*');
      if (s) s.forEach(c => addCardToWorld({ ...c, type: 'student' }, false));
      if (v) v.forEach(c => addCardToWorld({ ...c, type: 'visitor' }, false));

      // Recalc matches for all visitors on load (ensure consistency)
      if (v && s) {
        v.forEach(visitor => processNewCard(visitor.id));
      }
    };
    fetchAll();

    const channel = supabase.channel('aquarium_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visitor_cards' },
        (payload) => addCardToWorld({ ...payload.new, type: 'visitor' }, true)
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'visitor_cards' },
        (payload) => {
          // When visitor updates (answers question), re-process matches locally immediately
          processNewCard(payload.new.id);
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'student_cards' },
        (payload) => addCardToWorld({ ...payload.new, type: 'student' }, true)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);


  // --- RENDERING ---
  const Scene = () => {
    const [positions, setPositions] = useState({});

    // Animation Loop
    useEffect(() => {
      let frameId;
      const loop = () => {
        const newPos = {};
        engineRef.current.world.bodies.forEach(b => {
          newPos[b.dbId] = { x: b.position.x, y: b.position.y };
        });
        setPositions(newPos);
        frameId = requestAnimationFrame(loop);
      };
      loop();
      return () => cancelAnimationFrame(frameId);
    }, []);

    return (
      <>
        {/* CONNECTIONS (Background) */}
        <svg className="connections-layer">
          {Array.from(cards.values()).map(body => {
            const data = body.cardData;
            if (data.type !== 'visitor' || !data.scores) return null;
            const myPos = positions[body.dbId];
            if (!myPos) return null;

            return data.scores.map(match => {
              if (match.similarity < ATTRACT_THRESHOLD) return null;

              // Find student body
              const studentBody = Array.from(cards.values()).find(b => b.cardData.type === 'student' && b.cardData.id === match.student_id);
              if (!studentBody) return null;
              const sPos = positions[studentBody.dbId];
              if (!sPos) return null;

              return (
                <line key={`${data.id}-${match.student_id}`}
                  x1={myPos.x} y1={myPos.y}
                  x2={sPos.x} y2={sPos.y}
                  className="connection-line"
                  style={{ stroke: `rgba(100,200,255,${match.similarity})`, strokeWidth: match.similarity * 3 }}
                />
              );
            });
          })}
        </svg>

        {/* ENTITIES (Blobs) */}
        {Array.from(cards.values()).map(body => {
          const pos = positions[body.dbId];
          if (!pos) return null;
          const d = body.cardData;
          const isExpanded = expandedId === d.id;
          const isVisitor = d.type === 'visitor';

          return (
            <div
              key={d.id}
              className={`card-body ${d.type} ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedId(prev => prev === d.id ? null : d.id);
              }}
              style={{
                left: pos.x,
                top: pos.y,
                // Center the body on the physics coordinates
                transform: `translate(-50%, -50%)`,
              }}
            >
              {/* COLLAPSED STATE: Name Only */}
              {!isExpanded && (
                <div className="blob-name">
                  {d.visitor_name || d.student_name || '...'}
                  {d.table_number && <div style={{ fontSize: '0.6em', opacity: 0.7 }}>Table: {d.table_number}</div>}
                </div>
              )}

              {/* EXPANDED STATE: Full Detail */}
              {isExpanded && (
                <div className="expanded-content">
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center' }}>
                    {d.visitor_name || d.student_name}
                  </div>

                  {d.table_number && <div style={{ textAlign: 'center', marginBottom: '10px', color: '#666' }}>Table {d.table_number}</div>}

                  {d.vector_profile && (
                    <div className="profile-graph">
                      {[
                        { key: 'cooking_emphasis', label: '料理' },
                        { key: 'new_activity_company', label: '新規' },
                        { key: 'menu_selection_style', label: '直感' },
                        { key: 'social_planning', label: '急な' },
                        { key: 'messaging_urgency', label: '返信' }
                      ].map(axis => (
                        <div key={axis.key} className="axis-row">
                          <div className="axis-label">{axis.label}</div>
                          <div className="bar-container">
                            <div className="bar-fill" style={{ width: `${(d.vector_profile[axis.key] || 0) * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="aquarium-container" ref={sceneRef} onClick={() => setExpandedId(null)}>
      <Scene />
    </div>
  );
}

export default App;