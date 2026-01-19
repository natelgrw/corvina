import React, { useEffect, useState } from 'react';

interface SuccessToastProps {
    isVisible: boolean;
    message: string;
    onClose: () => void;
    duration?: number;
}

export const SuccessToast: React.FC<SuccessToastProps> = ({
    isVisible,
    message,
    onClose,
    duration = 3000
}) => {
    const [renderParams, setRenderParams] = useState({ show: false, animate: false });

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (isVisible) {
            setRenderParams({ show: true, animate: true });
            timer = setTimeout(() => {
                onClose();
            }, duration);
        } else {
            setRenderParams(prev => ({ ...prev, animate: false }));
            // Wait for animation to finish before unmounting
            const animTimer = setTimeout(() => {
                setRenderParams({ show: false, animate: false });
            }, 300); // match transition duration
            return () => clearTimeout(animTimer);
        }
        return () => clearTimeout(timer);
    }, [isVisible, duration, onClose]);

    if (!renderParams.show) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: `translate(-50%, ${renderParams.animate ? '0' : '-100px'})`,
            opacity: renderParams.animate ? 1 : 0,
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
            backgroundColor: 'black',
            color: 'white',
            padding: '1rem 2rem',
            zIndex: 3000,
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '0.9rem',
            fontWeight: 600,
            border: '1px solid white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            userSelect: 'none',
            pointerEvents: 'none' // Let clicks pass through if needed, though usually toasts block nothing
        }}>
            <div style={{ width: '8px', height: '8px', background: '#00ff00' }}></div>
            {message}
        </div>
    );
};
