import React, { useRef, useState, useCallback } from 'react';
import type { Annotation } from '../types';


interface AnnotationOverlayProps {
    pageNumber: number;
    scale: number;
    annotations: Annotation[];
    isDrawing: boolean;
    onAddAnnotation: (rect: Omit<Annotation, 'id' | 'label' | 'page'>) => void;
    onResizeAnnotation: (id: string, rect: { x: number, y: number, width: number, height: number }) => void;
    onFinishDrawing: () => void;
    hoveredId: string | null;
    onHoverAnnotation: (id: string | null) => void;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
    pageNumber,
    scale,
    annotations,
    isDrawing,
    onAddAnnotation,
    onResizeAnnotation,
    onFinishDrawing,
    hoveredId,
    onHoverAnnotation
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [currentBox, setCurrentBox] = useState<{ startX: number, startY: number, currX: number, currY: number } | null>(null);
    const [resizeState, setResizeState] = useState<{
        id: string;
        handle: string;
        startMouseX: number;
        startMouseY: number;
        originalX: number;
        originalY: number;
        originalW: number;
        originalH: number;
    } | null>(null);

    const getRelativeCoords = (e: React.MouseEvent) => {
        if (!overlayRef.current) return { x: 0, y: 0 };
        const rect = overlayRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!isDrawing) return;
        e.stopPropagation();

        if (e.button !== 0) return;

        const { x, y } = getRelativeCoords(e);
        setCurrentBox({ startX: x, startY: y, currX: x, currY: y });
    }, [isDrawing]);

    const startResize = (e: React.MouseEvent, ann: Annotation, handle: string) => {
        e.stopPropagation();
        e.preventDefault(); // Stop text selection
        setResizeState({
            id: ann.id,
            handle,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            originalX: ann.x,
            originalY: ann.y,
            originalW: ann.width,
            originalH: ann.height
        });
    };

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        // Handle Resizing
        if (resizeState) {
            e.preventDefault();
            const deltaX = (e.clientX - resizeState.startMouseX) / scale;
            const deltaY = (e.clientY - resizeState.startMouseY) / scale;

            let newX = resizeState.originalX;
            let newY = resizeState.originalY;
            let newW = resizeState.originalW;
            let newH = resizeState.originalH;

            // Logic for each handle
            if (resizeState.handle.includes('e')) {
                newW = Math.max(5, resizeState.originalW + deltaX);
            }
            if (resizeState.handle.includes('s')) {
                newH = Math.max(5, resizeState.originalH + deltaY);
            }
            if (resizeState.handle.includes('w')) {
                const maxDelta = resizeState.originalW - 5;
                const validDelta = Math.min(maxDelta, deltaX);
                newX += validDelta;
                newW -= validDelta;
            }
            if (resizeState.handle.includes('n')) {
                const maxDelta = resizeState.originalH - 5;
                const validDelta = Math.min(maxDelta, deltaY);
                newY += validDelta;
                newH -= validDelta;
            }

            onResizeAnnotation(resizeState.id, { x: newX, y: newY, width: newW, height: newH });
            return;
        }

        // Handle Drawing
        if (!isDrawing || !currentBox) return;
        const { x, y } = getRelativeCoords(e);
        setCurrentBox(prev => prev ? { ...prev, currX: x, currY: y } : null);
    }, [isDrawing, currentBox, resizeState, scale, onResizeAnnotation]);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        if (resizeState) {
            setResizeState(null);
            return;
        }

        if (!isDrawing || !currentBox) return;

        const { startX, startY, currX, currY } = currentBox;

        // Calculate normalized coordinates
        const x = Math.min(startX, currX) / scale;
        const y = Math.min(startY, currY) / scale;
        const width = Math.abs(currX - startX) / scale;
        const height = Math.abs(currY - startY) / scale;

        if (width > 5 && height > 5) {
            onAddAnnotation({ x, y, width, height });
        }

        setCurrentBox(null);
        onFinishDrawing();
    }, [isDrawing, currentBox, scale, onAddAnnotation, onFinishDrawing, resizeState]);

    // Filter annotations for this page
    const pageAnnotations = annotations.filter(a => a.page === pageNumber);

    const getHandleStyle = (handle: string): React.CSSProperties => {
        const size = 8;
        const offset = -4; // Center the 8px handle on the corner (0,0)
        const style: React.CSSProperties = {
            position: 'absolute',
            width: `${size}px`,
            height: `${size}px`,
            background: 'white',
            border: '1px solid blue',
            zIndex: 40,
            cursor: `${handle}-resize`
        };

        if (handle.includes('n')) style.top = `${offset}px`;
        else style.bottom = `${offset}px`;

        if (handle.includes('w')) style.left = `${offset}px`;
        else style.right = `${offset}px`;

        return style;
    };

    return (
        <div
            ref={overlayRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 20,
                cursor: isDrawing ? 'crosshair' : 'default',
                pointerEvents: isDrawing || resizeState ? 'auto' : 'none'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
                setCurrentBox(null);
                setResizeState(null);
            }}
        >
            {/* Existing Annotations */}
            {pageAnnotations.map((ann) => {
                const globalIndex = annotations.findIndex(a => a.id === ann.id);
                const isHovered = hoveredId === ann.id;
                const isActive = resizeState?.id === ann.id;

                // Show handles if hovered OR currently being resized
                const showHandles = (isHovered || isActive) && !isDrawing;

                return (
                    <div
                        key={ann.id}
                        onMouseEnter={() => !resizeState && onHoverAnnotation(ann.id)}
                        onMouseLeave={() => !resizeState && onHoverAnnotation(null)}
                        style={{
                            position: 'absolute',
                            left: ann.x * scale,
                            top: ann.y * scale,
                            width: ann.width * scale,
                            height: ann.height * scale,
                            border: (isHovered || isActive) ? '2px solid blue' : '2px solid red',
                            backgroundColor: (isHovered || isActive) ? 'rgba(0, 0, 255, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                            pointerEvents: isDrawing ? 'none' : 'auto',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start'
                        }}
                    >
                        {/* Handles */}
                        {showHandles && ['nw', 'ne', 'sw', 'se'].map(h => (
                            <div
                                key={h}
                                onMouseDown={(e) => startResize(e, ann, h)}
                                style={getHandleStyle(h)}
                            />
                        ))}

                        {(isHovered || isActive) && (
                            <div style={{
                                position: 'absolute',
                                top: '-20px',
                                left: '-2px',
                                background: 'blue',
                                color: 'white',
                                padding: '2px 6px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                zIndex: 30,
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none'
                            }}>
                                #{globalIndex + 1}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Drawing Box */}
            {currentBox && (
                <div
                    style={{
                        position: 'absolute',
                        left: Math.min(currentBox.startX, currentBox.currX),
                        top: Math.min(currentBox.startY, currentBox.currY),
                        width: Math.abs(currentBox.currX - currentBox.startX),
                        height: Math.abs(currentBox.currY - currentBox.startY),
                        border: '2px dashed blue',
                        backgroundColor: 'rgba(0, 0, 255, 0.1)'
                    }}
                />
            )}
        </div>
    );
};
