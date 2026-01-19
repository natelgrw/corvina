import React, { useState, useRef, useEffect } from 'react';

interface TechDropdownProps {
    label?: string;
    placeholder?: string;
    value: string;
    options: string[];
    onChange: (val: string) => void;
}

export const TechDropdown: React.FC<TechDropdownProps> = ({ label, placeholder, value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
            {label && (
                <label style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.6, marginBottom: '0.25rem' }}>
                    {label}
                </label>
            )}

            <div
                className={`tech-dropdown-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                style={{ color: !value ? '#999' : 'inherit' }}
            >
                {value ? value.toUpperCase() : (placeholder || 'SELECT').toUpperCase()}
            </div>

            {isOpen && (
                <div className="tech-dropdown-menu">
                    {options.map((opt) => (
                        <div
                            key={opt}
                            className={`tech-dropdown-item ${opt === value ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(opt);
                                setIsOpen(false);
                            }}
                        >
                            {opt.toUpperCase()}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
