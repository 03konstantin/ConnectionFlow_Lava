import React, { useState, forwardRef, useImperativeHandle } from 'react';
import './UserCardInput.css';

const UserCardInput = forwardRef(({ value, onChange, placeholder, onSubmit, disabled }, ref) => {
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    const triggerFlyAway = () => {
        if (isAnimatingOut || disabled) return;
        setIsAnimatingOut(true);
        if (onSubmit) {
            setTimeout(() => {
                onSubmit();
            }, 800);
        }
    };

    useImperativeHandle(ref, () => ({
        flyAway: triggerFlyAway
    }));

    return (
        <div className={`user-card-input-container ${isAnimatingOut ? 'flying-away' : ''}`}>
             <div className="visitor-blob-stack">
                <div className="v-blob-layer"></div>
                <div className="v-blob-layer"></div>
                <div className="v-blob-layer"></div>
                <div className="v-blob-layer"></div>
                
                <div className="visitor-content-inner">
                    <label className="card-label">ニックネーム</label>
                    <input
                        type="text"
                        className="card-text-input"
                        placeholder={placeholder}
                        value={value}
                        onChange={onChange}
                        // Stop event propagation to prevent triggering potential parent handlers unexpectedly
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    />
                </div>
            </div>
        </div>
    );
});

export default UserCardInput;
