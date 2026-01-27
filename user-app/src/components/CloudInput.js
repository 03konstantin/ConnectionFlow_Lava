import React, { useState, forwardRef, useImperativeHandle } from 'react';
import './CloudInput.css';
import cloudBg from '../images/name-enter.png';

const CloudInput = forwardRef(({ value, onChange, placeholder, onSubmit, disabled }, ref) => {
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
        <div className={`cloud-input-container ${isAnimatingOut ? 'flying-away' : ''}`}>

            <img src={cloudBg} alt="background" className="cloud-background" />

            <div className="cloud-content">
                <label className="cloud-label">ニックネーム</label>
                <input
                    type="text"
                    className="cloud-text-input"
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    // Stop event propagation to prevent triggering potential parent handlers unexpectedly
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                />
            </div>
        </div>
    );
});

export default CloudInput;
