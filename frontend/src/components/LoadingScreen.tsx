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
            fontFamily: '"IBM Plex Mono", monospace'
        }}>
            {/* Pixel Grid Animation */}
            <div className="pixel-grid-loader">
                {[...Array(9)].map((_, i) => (
                    <div key={i} className="pixel-dot"></div>
                ))}
            </div>

            <div style={{ marginTop: '2rem', fontSize: '0.9rem', letterSpacing: '2px', fontWeight: 600 }}>
                PROCESSING IMAGE...
            </div>

            <style>{`
                .pixel-grid-loader {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    width: 64px;
                    height: 64px;
                }
                .pixel-dot {
                    width: 100%;
                    height: 100%;
                    background: #000;
                    opacity: 0.2;
                    animation: pulse-pixel 1.5s infinite;
                }
                /* Staggered Animation */
                .pixel-dot:nth-child(1) { animation-delay: 0s; }
                .pixel-dot:nth-child(2) { animation-delay: 0.2s; }
                .pixel-dot:nth-child(3) { animation-delay: 0.4s; }
                .pixel-dot:nth-child(4) { animation-delay: 0.2s; }
                .pixel-dot:nth-child(5) { animation-delay: 0.4s; }
                .pixel-dot:nth-child(6) { animation-delay: 0.6s; }
                .pixel-dot:nth-child(7) { animation-delay: 0.4s; }
                .pixel-dot:nth-child(8) { animation-delay: 0.6s; }
                .pixel-dot:nth-child(9) { animation-delay: 0.8s; }

                @keyframes pulse-pixel {
                    0% { opacity: 0.2; transform: scale(1); }
                    50% { opacity: 1; transform: scale(0.9); background: #000; }
                    100% { opacity: 0.2; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};
