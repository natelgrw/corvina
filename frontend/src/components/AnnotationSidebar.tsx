import React, { useMemo } from 'react';
import type { Annotation } from '../types';
import { TechDropdown } from './TechDropdown';
import { ANNOTATION_CLASSES } from '../constants';

interface AnnotationSidebarProps {
    annotations: Annotation[];
    isDrawing: boolean;
    toolMode: 'box' | 'line' | 'node' | 'connection';
    setToolMode: (mode: 'box' | 'line' | 'node' | 'connection') => void;
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

export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
    annotations,
    isDrawing,
    toolMode,
    setToolMode,
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

    // Helper to get type-specific index (Global Source of Truth)
    const getTypeIndex = (ann: Annotation) => {
        const typeSiblings = annotations.filter(a => a.type === ann.type);
        return typeSiblings.findIndex(a => a.id === ann.id) + 1;
    };

    // Filter displayed annotations based on toolMode
    const filteredAnnotations = useMemo(() => {
        if (toolMode === 'node') {
            return annotations.filter(a => a.type === 'node');
        } else if (toolMode === 'connection') {
            return annotations.filter(a => a.type === 'connection' || a.type === 'line');
        } else {
            // Default to Component (Box) view
            return annotations.filter(a => a.type === 'box');
        }
    }, [annotations, toolMode]);

    const getAnnotationDetails = (ann: Annotation) => {
        const typeIndex = getTypeIndex(ann);

        if (ann.type === 'node') {
            return `Node ${typeIndex}`;
        }
        if (ann.type === 'box') {
            const x1 = Math.round(ann.x);
            const y1 = Math.round(ann.y);
            const x2 = Math.round(ann.x + ann.width);
            const y2 = Math.round(ann.y + ann.height);
            return `[${x1}, ${y1}, ${x2}, ${y2}]`;
        }
        if (ann.type === 'connection' && ann.sourceId && ann.targetId) {
            const sIndex = annotations.findIndex(a => a.id === ann.sourceId);
            const tIndex = annotations.findIndex(a => a.id === ann.targetId);

            if (sIndex === -1 || tIndex === -1) return "LINK (Invalid)";

            const source = annotations[sIndex];
            const target = annotations[tIndex];

            const sTypeIndex = getTypeIndex(source);
            const tTypeIndex = getTypeIndex(target);

            return `LINK`;
        }
        return `[${Math.round(ann.x)}, ${Math.round(ann.y)}]`;
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            padding: '1rem',
            fontFamily: '"IBM Plex Mono", monospace',
            borderRadius: '12px',
            border: '1px solid #e8e8e8',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
            {/* Header */}
            <div style={{
                marginBottom: '1rem',
                borderBottom: '2px solid black',
                paddingBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ fontWeight: 600, letterSpacing: '-0.5px' }}>ANNOTATIONS</span>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>
                    {filteredAnnotations.length}
                </span>
            </div>

            {/* Tool Switcher (Tabs) */}
            <div style={{ display: 'flex', marginBottom: '1rem', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                    onClick={() => setToolMode('box')}
                    style={{
                        flex: 1,
                        padding: '0.4rem',
                        border: 'none',
                        background: toolMode === 'box' ? 'black' : 'white',
                        color: toolMode === 'box' ? 'white' : 'black',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.65rem',
                        borderRadius: 0
                    }}
                >
                    COMPONENTS
                </button>
                <button
                    onClick={() => setToolMode('node')}
                    style={{
                        flex: 1,
                        padding: '0.4rem',
                        border: 'none',
                        background: toolMode === 'node' ? 'black' : 'white',
                        color: toolMode === 'node' ? 'white' : 'black',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.65rem',
                        borderRadius: 0
                    }}
                >
                    NODES
                </button>
                <button
                    onClick={() => setToolMode('connection')}
                    style={{
                        flex: 1,
                        padding: '0.4rem',
                        border: 'none',
                        background: toolMode === 'connection' ? 'black' : 'white',
                        color: toolMode === 'connection' ? 'white' : 'black',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.65rem',
                        borderRadius: 0
                    }}
                >
                    LINKS
                </button>
            </div>

            {/* List (Filtered) */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredAnnotations.map((ann) => {
                    const isSimple = ann.type === 'node' || ann.type === 'connection' || ann.type === 'line';
                    const typeIndex = getTypeIndex(ann);

                    // Resolution for connections body text
                    let connectionLabel = 'LINK';
                    if (ann.type === 'connection' && ann.sourceId && ann.targetId) {
                        const sIndex = annotations.findIndex(a => a.id === ann.sourceId);
                        const tIndex = annotations.findIndex(a => a.id === ann.targetId);

                        if (sIndex !== -1 && tIndex !== -1) {
                            const source = annotations[sIndex];
                            const target = annotations[tIndex];
                            const sTypeIndex = getTypeIndex(source);
                            const tTypeIndex = getTypeIndex(target);

                            const sName = source.type === 'node' ? `N${sTypeIndex}` : `C${sTypeIndex}`;
                            const tName = target.type === 'node' ? `N${tTypeIndex}` : `C${tTypeIndex}`;
                            connectionLabel = `${sName} -> ${tName}`;
                        }
                    }

                    return (
                        <div
                            key={ann.id}
                            onMouseEnter={() => onHoverAnnotation(ann.id)}
                            onMouseLeave={() => onHoverAnnotation(null)}
                            style={{
                                padding: '0.75rem',
                                border: hoveredId === ann.id ? '1px solid #999' : '1px solid #e8e8e8',
                                backgroundColor: hoveredId === ann.id ? '#fafafa' : '#ffffff',
                                transition: 'all 0.15s ease',
                                position: 'relative',
                                borderRadius: '6px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#888' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {/* Index (Static) */}
                                    <span style={{
                                        minWidth: '25px',
                                        fontWeight: 'bold',
                                        color: 'black',
                                        fontSize: '0.8rem'
                                    }}>
                                        {ann.type === 'node' ? `N${typeIndex}` : (ann.type === 'connection' ? `L${typeIndex}` : `C${typeIndex}`)}
                                    </span>
                                </div>
                                <span>
                                    {getAnnotationDetails(ann)}
                                </span>
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

                            {isSimple ? (
                                <div style={{
                                    padding: '0.5rem',
                                    background: '#f0f0f0',
                                    color: '#666',
                                    fontSize: '0.8rem',
                                    textAlign: 'center',
                                    fontStyle: 'italic',
                                    fontWeight: 500,
                                    borderRadius: '4px'
                                }}>
                                    {ann.type === 'node' ? `Node ${typeIndex}` : (ann.type === 'connection' ? connectionLabel : 'LEGACY LINE')}
                                </div>
                            ) : (
                                <TechDropdown
                                    value={ann.label}
                                    onChange={(val) => handleLabelChange(ann.id, val)}
                                    options={ANNOTATION_CLASSES}
                                    placeholder="SELECT COMPONENT"
                                />
                            )}
                        </div>
                    )
                })}

                {filteredAnnotations.length === 0 && (
                    <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: '#999',
                        fontSize: '0.85rem',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px'
                    }}>
                        NO {toolMode === 'box' ? 'COMPONENTS' : (toolMode === 'connection' ? 'LINKS' : 'NODES')}
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
                    {isDrawing ? 'CANCEL DRAW' : (toolMode === 'connection' ? '+ START LINKING' : (toolMode === 'node' ? '+ ADD NODE' : '+ ADD COMPONENT'))}
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
