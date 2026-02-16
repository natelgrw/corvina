import React from 'react';

export const LoadingScreen: React.FC = () => {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: '#ffffff',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: '"IBM Plex Mono", monospace',
            overflow: 'hidden'
        }}>
            {/* Background mist */}
            <div className="ld-mist ld-mist-orange" />
            <div className="ld-mist ld-mist-purple" />

            {/* Logo + text lockup */}
            <div className="ld-lockup">
                {/* Crosshair SVG that draws itself */}
                <svg className="ld-logo" viewBox="0 0 80 80" width="48" height="48" fill="none">
                    {/* Lines draw in staggered */}
                    <line x1="40" y1="4" x2="40" y2="24" className="ld-stroke ld-s1" />
                    <line x1="56" y1="40" x2="76" y2="40" className="ld-stroke ld-s2" />
                    <line x1="40" y1="56" x2="40" y2="76" className="ld-stroke ld-s3" />
                    <line x1="4" y1="40" x2="24" y2="40" className="ld-stroke ld-s4" />
                    {/* Center dot fades in last */}
                    <circle cx="40" cy="40" r="4" fill="#111" className="ld-dot" />
                </svg>

                {/* CORVINA text reveals letter by letter */}
                <div className="ld-title">
                    {'CORVINA'.split('').map((ch, i) => (
                        <span key={i} className="ld-char" style={{ animationDelay: `${0.8 + i * 0.08}s` }}>{ch}</span>
                    ))}
                </div>
            </div>

            {/* Progress bar */}
            <div className="ld-bar-track">
                <div className="ld-bar-fill" />
            </div>

            <div className="ld-status">Processing image...</div>

            <style>{`
                /* ---- Mist ---- */
                .ld-mist {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    pointer-events: none;
                }
                .ld-mist-orange {
                    width: 420px; height: 420px;
                    background: radial-gradient(circle, rgba(255, 122, 47, 0.15), transparent 70%);
                    top: -10%; right: -8%;
                    animation: ld-drift 8s ease-in-out infinite alternate;
                }
                .ld-mist-purple {
                    width: 380px; height: 380px;
                    background: radial-gradient(circle, rgba(168, 85, 247, 0.15), transparent 70%);
                    bottom: -8%; left: -6%;
                    animation: ld-drift 9s ease-in-out infinite alternate-reverse;
                }
                @keyframes ld-drift {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(-30px, 20px) scale(1.12); }
                }

                /* ---- Lockup ---- */
                .ld-lockup {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    position: relative;
                    z-index: 2;
                }

                /* ---- Logo draw-on ---- */
                .ld-stroke {
                    stroke: #111;
                    stroke-width: 2;
                    stroke-linecap: round;
                    stroke-dasharray: 24;
                    stroke-dashoffset: 24;
                    animation: ld-draw 0.5s ease-out forwards;
                }
                .ld-s1 { animation-delay: 0.1s; }
                .ld-s2 { animation-delay: 0.25s; }
                .ld-s3 { animation-delay: 0.4s; }
                .ld-s4 { animation-delay: 0.55s; }

                @keyframes ld-draw {
                    to { stroke-dashoffset: 0; }
                }

                .ld-dot {
                    opacity: 0;
                    animation: ld-pop 0.3s ease-out 0.7s forwards;
                }
                @keyframes ld-pop {
                    0% { opacity: 0; transform: scale(0); }
                    70% { transform: scale(1.3); }
                    100% { opacity: 1; transform: scale(1); }
                }

                /* ---- Title char reveal ---- */
                .ld-title {
                    font-size: 1.6rem;
                    font-weight: 600;
                    letter-spacing: 0.1em;
                    display: flex;
                }
                .ld-char {
                    opacity: 0;
                    transform: translateY(6px);
                    animation: ld-char-in 0.3s ease-out forwards;
                }
                @keyframes ld-char-in {
                    to { opacity: 1; transform: translateY(0); }
                }

                /* ---- Progress bar ---- */
                .ld-bar-track {
                    margin-top: 2.5rem;
                    width: 180px;
                    height: 2px;
                    background: #eee;
                    border-radius: 1px;
                    overflow: hidden;
                    position: relative;
                    z-index: 2;
                }
                .ld-bar-fill {
                    height: 100%;
                    width: 40%;
                    border-radius: 1px;
                    background: linear-gradient(90deg, #ff7a2f, #a855f7);
                    animation: ld-slide 1.5s ease-in-out infinite;
                }
                @keyframes ld-slide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(350%); }
                }

                /* ---- Status text ---- */
                .ld-status {
                    margin-top: 1.2rem;
                    font-size: 0.75rem;
                    letter-spacing: 0.1em;
                    color: #aaa;
                    font-weight: 400;
                    position: relative;
                    z-index: 2;
                    animation: ld-fade-in 0.5s ease-out 1.4s both;
                }
                @keyframes ld-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};
