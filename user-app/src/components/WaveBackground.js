import React from 'react';
import './WaveBackground.css';

const WaveBackground = ({ isSurging }) => {
    return (
        <div className={`wave-container-animated ${isSurging ? 'surging' : ''}`}>
            <svg
                className="waves"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                viewBox="0 24 150 124"
                preserveAspectRatio="none"
                shapeRendering="auto"
            >
                <defs>
                    <path
                        id="gentle-wave"
                        d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v200h-352z"
                    />
                </defs>
                <g className="rax">
                    <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(83, 176, 206, 0.7)" />
                    <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(83, 176, 206, 0.5)" />
                    <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(83, 176, 206, 0.3)" />
                    {/* Main Wave Body */}
                    <use xlinkHref="#gentle-wave" x="48" y="7" fill="#6BD4E7" />
                </g>
            </svg>
        </div>
    );
};

export default WaveBackground;
