import React, { useEffect } from 'react';

interface TechModalProps {
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'confirm' | 'alert';
}

export const TechModal: React.FC<TechModalProps> = ({
    isOpen,
    title,
    message,
    onClose,
    onConfirm,
    confirmText = "CONFIRM",
    cancelText = "CANCEL",
    type = 'confirm'
}) => {
    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(255, 255, 255, 0.8)', // Glassy look roughly
            backdropFilter: 'grayscale(100%)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"IBM Plex Mono", monospace'
        }}>
            <div style={{
                width: '400px',
                maxWidth: '90%',
                backgroundColor: 'white',
                border: '1px solid black',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    backgroundColor: 'black',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    fontWeight: 600,
                    letterSpacing: '-0.5px'
                }}>
                    {title.toUpperCase()}
                </div>

                {/* Content */}
                <div style={{ padding: '2rem 1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    {message}
                </div>

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    borderTop: '1px solid #eee',
                }}>
                    {type === 'confirm' && (
                        <button
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '1rem',
                                border: 'none',
                                borderRight: '1px solid #eee',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: '#666',
                                fontWeight: 600
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            {cancelText}
                        </button>
                    )}

                    <button
                        onClick={onConfirm || onClose}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'black'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'black';
                            e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'black';
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface TechDropdownProps {
    label: string;
    value: string;
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
    placeholder?: string;
}

export const TechDropdown: React.FC<TechDropdownProps> = ({
    label,
    value,
    options,
    onChange,
    placeholder = '-'
}) => {
    return (
        <div>
            <label style={{ fontSize: '0.65rem', fontWeight: 600, display: 'block', marginBottom: '2px', opacity: 0.6 }}>
                {label}
            </label>
            <div style={{ position: 'relative' }}>
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        width: '100%',
                        appearance: 'none',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        padding: '0.4rem 0.5rem',
                        fontSize: '0.8rem',
                        fontFamily: 'inherit',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                {/* Custom Arrow */}
                <div style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    fontSize: '0.6rem',
                    opacity: 0.5
                }}>
                    ▼
                </div>
            </div>
        </div>
    );
};
