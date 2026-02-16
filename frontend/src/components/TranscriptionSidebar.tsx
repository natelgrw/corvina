import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Annotation } from '../types';

interface TranscriptionSidebarProps {
    annotations: Annotation[]; // Full list
    onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
    onDeleteAnnotation?: (id: string) => void;
    onFinish: () => void;
    hoveredId: string | null;
    onHoverId: (id: string | null) => void;
    isDrawing: boolean;
    onToggleDrawing: () => void;
    linkingTextId: string | null;
    setLinkingTextId: (id: string | null) => void;
    onBack?: () => void;
}

const SI_PREFIXES = [
    { label: '-', value: '-' },
    { label: 'p', value: 'p' },
    { label: 'n', value: 'n' },
    { label: 'µ', value: 'u' }, // Display 'µ', value 'u'
    { label: 'm', value: 'm' },
    { label: 'k', value: 'k' },
    { label: 'M', value: 'M' },
    { label: 'G', value: 'G' }
];

const UNIT_SUFFIXES = [
    { label: '-', value: '-' },
    { label: 'V', value: 'V' },
    { label: 'A', value: 'A' },
    { label: 'Ω', value: 'Ohm' },
    { label: 'F', value: 'F' },
    { label: 'H', value: 'H' },
    { label: 'Hz', value: 'Hz' }
    // Removed 's' and '%' as requested
];

// Mini Dropdown Component using Portal to avoid clipping
interface MiniDropdownProps {
    value: string;
    options: { label: string, value: string }[];
    onChange: (val: string) => void;
    placeholder?: string;
}

const MiniDropdown: React.FC<MiniDropdownProps> = ({ value, options, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null); // Ref for the portal menu
    const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

    // Update position when opening
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    // Close on click outside or scroll
    useEffect(() => {
        if (!isOpen) return;

        const handleInteraction = (event: Event) => {
            const target = event.target as Node;

            // Allow interaction if click is inside trigger (containerRef) OR menu (menuRef)
            if (
                (containerRef.current && containerRef.current.contains(target)) ||
                (menuRef.current && menuRef.current.contains(target))
            ) {
                return;
            }

            // Close otherwise
            setIsOpen(false);
        };

        // Use mousedown for clicks, verify scroll doesn't auto-close if scrolling INSIDE menu
        document.addEventListener('mousedown', handleInteraction);

        // Only close on window resize, or maybe scroll of MAIN window if desired..
        // But if user scrolls INSIDE the dropdown, we don't want to close.
        // 'scroll' event captures. If target is inside menuRef, don't close.
        const handleScroll = (event: Event) => {
            const target = event.target as Node;
            if (menuRef.current && menuRef.current.contains(target)) {
                return; // Scrolling inside menu
            }
            // Logic to close on outside scroll is tricky with Portals nicely. 
            // Ideally we just close on resize. Scroll usually keeps position or we update it.
            // For now, let's just close on Resize to be safe, and rely on Click Outside for closing.
            // (Updating position on scroll is complex without a library like popper.js)
            // Let's force close if main window scrolls?
            // Actually user complained "doesnt allow me to scroll down the dropdown bar".
            // So I MUST NOT close on scroll if it's the menu scrolling.

            // Simplest: Don't listen to scroll at all, just mousedown.
            // The menu is fixed position? No, absolute in body.
            // If body scrolls, menu moves with it (because top is calculated with scrollY).
            // Wait, if I calculate `top = rect.bottom + window.scrollY` once on open,
            // then if user scrolls the PAGE, the menu stays at that absolute Y.
            // The Trigger Element moves UP/DOWN. The menu stays put. They detach.
            // This is why usually we close on window scroll.
            // BUT, validation: "doesnt allow me to scroll down the dropdown bar".
            // This implies filtering or just the menu itself has a scrollbar.
            // If I have `maxHeight: 200px; overflowY: auto`, the menu has a scrollbar.
            // Using the scrollbar triggers 'mousedown' on the scrollbar? Actually 'mousedown' on scrollbar might be outside content on some browsers?
            // Key fix: ensuring logic checks menuRef.
        };

        window.addEventListener('resize', () => setIsOpen(false));
        // window.addEventListener('scroll', () => setIsOpen(false), true); // Creating potential issues with inner scroll.
        // Let's remove global scroll listener. If page scrolls, menu detaches. It's acceptable for a "MiniDropdown".
        // Better than breaking inner scroll.

        return () => {
            document.removeEventListener('mousedown', handleInteraction);
            window.removeEventListener('resize', () => setIsOpen(false));
            // window.removeEventListener('scroll', ...);
        };
    }, [isOpen]);

    const selectedOption = options.find(o => o.value === value);

    const dropdownMenu = position && (
        <div
            ref={menuRef}
            style={{
                position: 'absolute', // Absolute relative to body (portal)
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: '150px', // Restrict height to force scroll
                overflowY: 'auto',
                background: 'white',
                border: '1px solid black',
                zIndex: 9999,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                fontFamily: '"IBM Plex Mono", monospace'
            }}
            onMouseDown={(e) => e.stopPropagation()} // Stop propagation just in case
        >
            {options.map((opt) => (
                <div
                    key={opt.value}
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange(opt.value);
                        setIsOpen(false);
                    }}
                    style={{
                        padding: '0.3rem',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        background: opt.value === value ? '#eee' : 'white',
                        borderBottom: '1px solid #f0f0f0'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = opt.value === value ? '#eee' : 'white'}
                >
                    {opt.label}
                </div>
            ))}
        </div>
    );

    return (
        <div ref={containerRef} style={{ position: 'relative', minWidth: '50px' }}>
            <div
                className={`tech-input ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    cursor: 'pointer',
                    padding: '0.3rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'white'
                }}
            >
                <span>{selectedOption ? selectedOption.label : (placeholder || '-')}</span>
                <span style={{ fontSize: '0.6em', marginLeft: '4px', opacity: 0.5 }}>▼</span>
            </div>

            {isOpen && position && createPortal(dropdownMenu, document.body)}
        </div>
    );
};


export const TranscriptionSidebar: React.FC<TranscriptionSidebarProps> = ({
    annotations,
    onUpdateAnnotation,
    onDeleteAnnotation,
    onFinish,
    hoveredId,
    onHoverId,
    isDrawing,
    onToggleDrawing,
    linkingTextId,
    setLinkingTextId,
    onBack
}) => {
    // Filter only text annotations
    const textAnnotations = annotations.filter(a => a.type === 'text');

    // Helper to get formatted name of linked target
    const getLinkedName = (targetId: string) => {
        const target = annotations.find(a => a.id === targetId);
        if (!target) return 'Unknown';

        // Find index among same type
        const typeSiblings = annotations.filter(a => a.type === target.type);
        const index = typeSiblings.findIndex(a => a.id === targetId) + 1;
        const prefix = target.type === 'node' ? 'N' : 'C';
        return `${prefix}${index} (${target.type === 'node' ? 'Node' : 'Component'})`;
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(12px)',
            borderRight: 'none',
            position: 'relative',
            fontFamily: '"IBM Plex Mono", monospace',
            borderRadius: '12px',
            border: '1px solid #e8e8e8',
            boxShadow: 'none'
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem',
                borderBottom: '2px solid black',
                background: '#FAFAFA',
                borderRadius: '12px 12px 0 0'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, letterSpacing: '-0.5px' }}>
                        TEXT TRANSCRIPTION
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>({textAnnotations.length})</span>
                </div>

                <button
                    onClick={onToggleDrawing}
                    className="tech-button"
                    style={{
                        marginTop: '1rem',
                        width: '100%',
                        justifyContent: 'center',
                        background: isDrawing ? 'black' : 'white',
                        color: isDrawing ? 'white' : 'black',
                        border: '1px solid black'
                    }}
                >
                    {isDrawing ? 'CANCEL DRAWING' : '+ NEW BOUNDING BOX'}
                </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {textAnnotations.map((ann, idx) => {
                    const isHovered = hoveredId === ann.id;
                    const isActive = isHovered;
                    const isPicking = linkingTextId === ann.id;
                    const hasLabel = ann.label !== undefined && ann.label !== null && ann.label !== '';

                    return (
                        <div
                            key={ann.id}
                            onMouseEnter={() => onHoverId(ann.id)}
                            onMouseLeave={() => onHoverId(null)}
                            style={{
                                padding: '1rem',
                                border: isActive ? '1px solid #999' : '1px solid #e8e8e8',
                                background: isActive ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.4)',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                borderRadius: '6px'
                            }}
                        >
                            {/* Header Line */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Text #{idx + 1}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={!!ann.isIgnored}
                                            onChange={(e) => onUpdateAnnotation(ann.id, { isIgnored: e.target.checked })}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        Ignore
                                    </label>
                                    {onDeleteAnnotation && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteAnnotation(ann.id);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#666',
                                                fontSize: '1.2rem',
                                                cursor: 'pointer',
                                                lineHeight: 1,
                                                padding: '0 0.25rem',
                                                marginLeft: '4px'
                                            }}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Raw Text Input (Black Border, No Strikethrough) */}
                            <div>
                                <textarea
                                    value={ann.rawText || ''}
                                    onChange={(e) => onUpdateAnnotation(ann.id, { rawText: e.target.value })}
                                    className="tech-input"
                                    placeholder="Transcribe text..."
                                    rows={2}
                                    style={{
                                        width: '100%',
                                        resize: 'vertical',
                                        fontSize: '0.9rem',
                                        fontFamily: 'monospace',
                                        border: '1px solid black',
                                        padding: '0.5rem',
                                        outline: 'none',
                                        background: 'white',
                                        color: ann.isIgnored ? '#666' : 'black',
                                        opacity: ann.isIgnored ? 0.7 : 1,
                                        textDecoration: 'none'
                                    }}
                                />
                            </div>

                            {/* Metadata Section (Only if NOT ignored) */}
                            {!ann.isIgnored && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ borderTop: '1px dashed #eee' }} />

                                    {/* 1. Association Selection */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: '4px', opacity: 0.6 }}>
                                            ASSOCIATED WITH (REQUIRED)
                                        </label>

                                        {isPicking ? (
                                            /* Active Picking State (Black Button) */
                                            <button
                                                onClick={() => setLinkingTextId(null)} // Click again to cancel
                                                className="tech-button"
                                                style={{
                                                    width: '100%',
                                                    justifyContent: 'center',
                                                    background: 'black',
                                                    color: 'white',
                                                    border: '1px solid black',
                                                    padding: '0.5rem'
                                                }}
                                            >
                                                CLICK COMPONENT ON IMAGE
                                            </button>
                                        ) : (
                                            /* Not Picking */
                                            !ann.linkedAnnotationId ? (
                                                /* No Link -> White Pick Button */
                                                <button
                                                    onClick={() => setLinkingTextId(ann.id)}
                                                    className="tech-button"
                                                    style={{
                                                        width: '100%',
                                                        justifyContent: 'center',
                                                        background: 'white',
                                                        color: 'black',
                                                        border: '1px solid black',
                                                        padding: '0.5rem'
                                                    }}
                                                >
                                                    PICK FROM IMAGE
                                                </button>
                                            ) : (
                                                /* Linked -> Display + Change Button */
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <div style={{
                                                        flex: 1,
                                                        padding: '0.5rem',
                                                        background: '#eee',
                                                        fontSize: '0.8rem',
                                                        borderRadius: '4px'
                                                    }}>
                                                        {getLinkedName(ann.linkedAnnotationId)}
                                                    </div>
                                                    <button
                                                        onClick={() => setLinkingTextId(ann.id)}
                                                        className="tech-button"
                                                        style={{
                                                            padding: '0.5rem',
                                                            fontSize: '0.75rem',
                                                            border: '1px solid #ccc',
                                                            background: 'white',
                                                            color: 'black'
                                                        }}
                                                    >
                                                        CHANGE
                                                    </button>
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* 2. Label & Values (Only if Associated) */}
                                    {ann.linkedAnnotationId && (
                                        <>
                                            {/* Label Name */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: '4px', opacity: 0.6 }}>
                                                    LABEL NAME
                                                </label>

                                                {!hasLabel ? (
                                                    <button
                                                        onClick={() => onUpdateAnnotation(ann.id, { label: ' ' })} // Initialize
                                                        className="tech-button"
                                                        style={{
                                                            width: '100%',
                                                            justifyContent: 'center',
                                                            background: 'white',
                                                            color: '#666',
                                                            border: '1px dashed #ccc',
                                                            fontSize: '0.75rem',
                                                            padding: '0.4rem'
                                                        }}
                                                    >
                                                        + ADD LABEL NAME
                                                    </button>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <input
                                                            type="text"
                                                            value={ann.label || ''}
                                                            onChange={(e) => onUpdateAnnotation(ann.id, { label: e.target.value })}
                                                            className="tech-input"
                                                            placeholder="e.g. R1"
                                                            autoFocus
                                                            style={{ flex: 1, background: 'white' }}
                                                        />
                                                        <button
                                                            onClick={() => onUpdateAnnotation(ann.id, { label: '' })} // Reset
                                                            className="tech-button"
                                                            style={{
                                                                padding: '0 0.5rem',
                                                                color: '#666',
                                                                border: '1px solid #ccc'
                                                            }}
                                                            title="Remove Label"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Values */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.6 }}>
                                                    VALUES
                                                </label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    {(ann.values || []).map((valItem, vIdx) => (
                                                        <div key={vIdx} style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'minmax(0, 1fr) 50px 50px 24px',
                                                            gap: '0.5rem',
                                                            alignItems: 'center',
                                                            background: 'white',
                                                            padding: '0.5rem',
                                                            border: '1px solid #eee'
                                                        }}>
                                                            {/* Value Input */}
                                                            <input
                                                                type="text"
                                                                value={valItem.value}
                                                                onChange={(e) => {
                                                                    const newVals = [...(ann.values || [])];
                                                                    newVals[vIdx] = { ...newVals[vIdx], value: e.target.value };
                                                                    onUpdateAnnotation(ann.id, { values: newVals });
                                                                }}
                                                                className="tech-input"
                                                                placeholder="Value"
                                                                style={{ padding: '0.3rem', fontSize: '0.85rem' }}
                                                            />

                                                            {/* Prefix Custom Dropdown */}
                                                            <MiniDropdown
                                                                value={valItem.unitPrefix || '-'}
                                                                options={SI_PREFIXES}
                                                                onChange={(val) => {
                                                                    const newVals = [...(ann.values || [])];
                                                                    newVals[vIdx] = { ...newVals[vIdx], unitPrefix: val };
                                                                    onUpdateAnnotation(ann.id, { values: newVals });
                                                                }}
                                                            />

                                                            {/* Suffix Custom Dropdown */}
                                                            <MiniDropdown
                                                                value={valItem.unitSuffix || '-'}
                                                                options={UNIT_SUFFIXES}
                                                                onChange={(val) => {
                                                                    const newVals = [...(ann.values || [])];
                                                                    newVals[vIdx] = { ...newVals[vIdx], unitSuffix: val };
                                                                    onUpdateAnnotation(ann.id, { values: newVals });
                                                                }}
                                                            />

                                                            {/* Delete */}
                                                            <button
                                                                onClick={() => {
                                                                    const newVals = ann.values?.filter((_, i) => i !== vIdx);
                                                                    onUpdateAnnotation(ann.id, { values: newVals });
                                                                }}
                                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#999', display: 'flex', justifyContent: 'center' }}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => {
                                                            const newVals = [...(ann.values || []), { value: '', unitPrefix: '-', unitSuffix: '-' }];
                                                            onUpdateAnnotation(ann.id, { values: newVals });
                                                        }}
                                                        className="tech-button"
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            padding: '0.4rem',
                                                            border: '1px dashed #ccc',
                                                            background: 'transparent',
                                                            color: '#666',
                                                            marginTop: '0.25rem',
                                                            justifyContent: 'center',
                                                            width: '100%'
                                                        }}
                                                    >
                                                        + ADD VALUE
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {textAnnotations.length === 0 && (
                    <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: '#999',
                        fontSize: '0.85rem',
                        border: '1px dashed #ccc',
                        borderRadius: '4px'
                    }}>
                        NO TEXT ANNOTATIONS
                    </div>
                )}
            </div>

            {/* Footer */}
            {/* Footer */}
            <div style={{ borderTop: '1px solid #e8e8e8', padding: '1rem', background: 'transparent', borderRadius: '0 0 12px 12px', display: 'flex', gap: '1rem' }}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="tech-button"
                        style={{
                            flex: 1,
                            backgroundColor: 'transparent',
                            color: 'black',
                            border: '1px solid black',
                            justifyContent: 'center',
                            padding: '0.8rem'
                        }}
                    >
                        GO BACK
                    </button>
                )}
                <button
                    onClick={onFinish}
                    className="tech-button primary"
                    style={{
                        flex: 2,
                        backgroundColor: 'black',
                        color: 'white',
                        border: '1px solid black',
                        justifyContent: 'center',
                        padding: '0.8rem'
                    }}
                >
                    FINISH TRANSCRIPTION
                </button>
            </div>
        </div>
    );
};
