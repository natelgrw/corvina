import React from 'react';
import type { Annotation } from '../types';
import { TechDropdown } from './TechDropdown';
import { DOCUMENT_TYPES, DOMAINS, BOUNDING_BOX_TYPES, HEADER_SUBTYPES, LIST_SUBTYPES } from '../constants';

interface AnnotationSidebarProps {
    annotations: Annotation[];
    isDrawing: boolean;
    onToggleDrawing: () => void;
    onUpdateAnnotation: (id: string, label: string) => void;
    onDeleteAnnotation: (id: string) => void;
    onMoveAnnotation: (fromIndex: number, toIndex: number) => void;
    hoveredId: string | null;
    onHoverAnnotation: (id: string | null) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    actionLabel?: string;
}

// Helper to manage input state so it doesn't jump around or lose focus weirdly
const OrderInput = ({ index, total, onMove }: { index: number, total: number, onMove: (i: number) => void }) => {
    const [val, setVal] = React.useState((index + 1).toString());

    // Sync local state when index changes (e.g. after reorder)
    React.useEffect(() => {
        setVal((index + 1).toString());
    }, [index]);

    const commit = React.useCallback((valueStr: string) => {
        const num = parseInt(valueStr);
        if (!isNaN(num) && num >= 1 && num <= total) {
            if (num !== index + 1) {
                onMove(num - 1);
            }
        } else {
            // Revert if invalid
            setVal((index + 1).toString());
        }
    }, [index, total, onMove]);



    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        // Allow empty string to let user delete and retype
        if (newVal === '') {
            setVal('');
            return;
        }

        const num = parseInt(newVal);
        // strict validation: blocking invalid inputs immediately
        if (!isNaN(num) && num >= 1 && num <= total) {
            setVal(newVal);
        }
    };

    return (
        <input
            type="number"
            value={val}
            onChange={handleChange}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur(); // Blur triggers onBlur commit immediately
                }
            }}
            onBlur={() => commit(val)}
            style={{
                width: '40px',
                padding: '2px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                textAlign: 'center',
                border: '1px solid #ccc',
                background: '#f9f9f9',
                outline: 'none',
                fontFamily: 'monospace'
            }}
        />
    );
};

export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
    annotations,
    isDrawing,
    onToggleDrawing,
    onUpdateAnnotation,
    onDeleteAnnotation,
    onMoveAnnotation,
    hoveredId,
    onHoverAnnotation,
    onSubmit,
    isSubmitting,
    actionLabel = "SUBMIT"
}) => {
    const handleLabelChange = (id: string, newLabel: string) => {
        onUpdateAnnotation(id, newLabel);
    };

    const handleMove = (index: number, newIndexStr: string) => {
        const newIndex = parseInt(newIndexStr, 10);
        if (!isNaN(newIndex)) {
            // adjust for 1-based index input
            onMoveAnnotation(index, newIndex - 1);
        }
    }

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FAFAFA',
            // borderRight removed
            padding: '1rem',
            fontFamily: '"IBM Plex Mono", monospace'
        }}>
            {/* Header */}
            <div style={{
                marginBottom: '1.5rem',
                borderBottom: '2px solid black',
                paddingBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ fontWeight: 600, letterSpacing: '-0.5px' }}>BOUNDING BOXES</span>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>{annotations.length}</span>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {annotations.map((ann, index) => (
                    <div
                        key={ann.id}
                        onMouseEnter={() => onHoverAnnotation(ann.id)}
                        onMouseLeave={() => onHoverAnnotation(null)}
                        style={{
                            padding: '0.75rem',
                            border: hoveredId === ann.id ? '1px solid black' : '1px solid #eee',
                            backgroundColor: hoveredId === ann.id ? 'white' : 'transparent',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#888' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>#</span>
                                <input
                                    type="number"
                                    defaultValue={index + 1}
                                    className="tech-input-minimal"
                                    onBlur={(e) => handleMove(index, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleMove(index, e.currentTarget.value);
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    style={{
                                        width: '30px',
                                        border: 'none',
                                        background: 'transparent',
                                        fontFamily: 'inherit',
                                        fontSize: 'inherit',
                                        color: 'inherit',
                                        padding: 0,
                                        fontWeight: 'bold',
                                        textAlign: 'center'
                                    }}
                                />
                            </div>
                            <span>Pg {ann.page} [{Math.round(ann.x)}, {Math.round(ann.y)}, {Math.round(ann.x + ann.width)}, {Math.round(ann.y + ann.height)}]</span>
                            <button
                                className="delete-annotation-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteAnnotation(ann.id);
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <TechDropdown
                            value={ann.label}
                            onChange={(val) => handleLabelChange(ann.id, val)}
                            options={BOUNDING_BOX_TYPES}
                            placeholder="SELECT TYPE"
                        />
                    </div>
                ))}

                {annotations.length === 0 && (
                    <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: '#999',
                        fontSize: '0.85rem',
                        border: '1px dashed #ddd',
                        borderRadius: '4px'
                    }}>
                        NO ANNOTATIONS
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button
                    className={`tech-button ${isDrawing ? 'active' : ''}`}
                    onClick={onToggleDrawing}
                    style={{ flex: 1 }}
                    disabled={isSubmitting}
                >
                    {isDrawing ? 'CANCEL DRAW' : '+ ADD BOX'}
                </button>
            </div>

            <button
                className="tech-button"
                style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: isSubmitting ? 'white' : 'black',
                    color: isSubmitting ? 'black' : 'white',
                    border: '1px solid #333',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: isSubmitting ? 'wait' : 'pointer',
                    position: 'relative'
                }}
                onClick={onSubmit}
                disabled={isSubmitting}
            >
                <span>{actionLabel}</span>
                {isSubmitting && (
                    <>
                        {/* Top Left Pixel */}
                        <div style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            width: '4px',
                            height: '4px',
                            backgroundColor: 'black',
                            animation: 'blink 1s infinite',
                            animationDelay: '0ms'
                        }} />
                        {/* Bottom Right Pixel */}
                        <div style={{
                            position: 'absolute',
                            bottom: '4px',
                            right: '4px',
                            width: '4px',
                            height: '4px',
                            backgroundColor: 'black',
                            animation: 'blink 1s infinite',
                            animationDelay: '300ms'
                        }} />
                    </>
                )}
            </button>
        </div>
    );
};

