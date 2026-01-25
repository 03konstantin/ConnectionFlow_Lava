import React, { useState, forwardRef, useImperativeHandle } from 'react';
import './SphereInput.css';

const SphereInput = forwardRef(({ value, onChange, placeholder, onSubmit }, ref) => {
    const [dragStart, setDragStart] = useState(null);
    const [offsetY, setOffsetY] = useState(0);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    const triggerFlyAway = () => {
        if (isAnimatingOut) return;
        setIsAnimatingOut(true);
        setOffsetY(0);
        if (onSubmit) {
            setTimeout(() => {
                onSubmit();
            }, 800);
        }
    };

    useImperativeHandle(ref, () => ({
        flyAway: triggerFlyAway
    }));

    const handleStart = (e) => {
        // Only capture drag if NOT on input
        // The input has stopPropagation, so this fires for sphere background interaction
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setDragStart(clientY);
    };

    const handleMove = (e) => {
        if (dragStart === null || isAnimatingOut) return;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const delta = clientY - dragStart;

        // Only allow drag UP (negative)
        // Reduce movement for resistance feeling (0.5 factor)
        if (delta < 0) {
            setOffsetY(delta * 0.8);
        }
    };

    const handleEnd = () => {
        if (isAnimatingOut) return;

        // If dragged up more than 100px, submit
        if (offsetY < -100) {
            triggerFlyAway();
        } else {
            // Snap back
            setOffsetY(0);
        }
        setDragStart(null);
    };

    return (
        <div
            className={`sphere-input-container ${isAnimatingOut ? 'flying-away' : ''}`}
            style={{ transform: isAnimatingOut ? 'none' : `translateY(${offsetY}px)` }}
            onMouseDown={handleStart}
            onTouchStart={handleStart}
            onMouseMove={handleMove}
            onTouchMove={handleMove}
            onMouseUp={handleEnd}
            onTouchEnd={handleEnd}
            onMouseLeave={handleEnd}
        >
            <div className="sphere-blob-stack">
                <div className="blob-layer layer-1"></div>
                <div className="blob-layer layer-2"></div>
                <div className="blob-layer layer-3"></div>
                <div className="blob-layer layer-4"></div>

                <div className="sphere-content">
                    <label className="sphere-label">ニックネーム</label>
                    <input
                        type="text"
                        className="sphere-text-input"
                        placeholder={placeholder}
                        value={value}
                        onChange={onChange}
                        // Stop propagation so typing/selecting text doesn't drag the sphere
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    />
                </div>
            </div>
        </div>
    );
});

export default SphereInput;
