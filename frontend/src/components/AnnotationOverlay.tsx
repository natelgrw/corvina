import React, { useRef, useState, useCallback } from 'react';
import type { Annotation } from '../types';

interface AnnotationOverlayProps {
    pageNumber: number;
    scale: number;
    coordinateScale?: number;
    annotations: Annotation[];
    isDrawing: boolean;
    toolMode?: 'box' | 'line' | 'node' | 'connection';
    onAddAnnotation: (rect: Omit<Annotation, 'id' | 'label' | 'page'>) => void;
    onResizeAnnotation: (id: string, rect: { x: number, y: number, width: number, height: number }) => void;
    onFinishDrawing: () => void;
    hoveredId: string | null;
    onHoverAnnotation: (id: string | null) => void;

    // New Props for Reusability
    lockedTypes?: string[]; // Types that cannot be resized/moved
    allowedTypes?: string[]; // Types to render
    onAnnotationMouseDown?: (e: React.MouseEvent, id: string) => void;
    highlightedId?: string | null; // For special highlighting (e.g. Linking)
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
    pageNumber,
    scale,
    coordinateScale = 1.0,
    annotations,
    isDrawing,
    toolMode = 'box',
    onAddAnnotation,
    onResizeAnnotation,
    onFinishDrawing,
    hoveredId,
    onHoverAnnotation,
    lockedTypes = [],
    allowedTypes = ['box', 'node', 'connection'],
    onAnnotationMouseDown,
    highlightedId
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    // Box Drawing State
    const [currentBox, setCurrentBox] = useState<{ startX: number, startY: number, currX: number, currY: number } | null>(null);

    // Line Drawing State (Legacy)
    const [currentLine, setCurrentLine] = useState<{ startX: number, startY: number, currX: number, currY: number } | null>(null);

    // Connection State
    const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);

    // Resize / Move State
    const [resizeState, setResizeState] = useState<{
        id: string;
        handle: string; // 'nw', 'se', etc. OR 'move'
        startMouseX: number;
        startMouseY: number;
        originalX: number;
        originalY: number;
        originalW: number;
        originalH: number;
    } | null>(null);

    // --- Geometry Helpers for Line Clipping ---

    // Get intersection point snapped to the center of the nearest face (N/S/E/W)
    const getRectIntersection = (
        box: { x: number, y: number, w: number, h: number },
        center: { x: number, y: number },
        otherCenter: { x: number, y: number }
    ) => {
        const dx = otherCenter.x - center.x;
        const dy = otherCenter.y - center.y;

        // Aspect Ratio Check to determine face
        // We compare slope dy/dx with box ratio h/w
        // If |dy/dx| < h/w, it hits Left/Right. Else Top/Bottom.
        // Avoid div by zero
        const slope = Math.abs(dx) > 0.001 ? Math.abs(dy / dx) : 1000;
        const boxRatio = box.h / box.w;

        if (slope < boxRatio) {
            // Left or Right
            if (dx > 0) {
                // Right Edge Center
                return { x: box.x + box.w, y: center.y };
            } else {
                // Left Edge Center
                return { x: box.x, y: center.y };
            }
        } else {
            // Top or Bottom
            if (dy > 0) {
                // Bottom Edge Center
                return { x: center.x, y: box.y + box.h };
            } else {
                // Top Edge Center
                return { x: center.x, y: box.y };
            }
        }
    };

    // Get intersection point of a line (from center to otherCenter) with a circle (node)
    const getCircleIntersection = (
        node: { cx: number, cy: number, r: number },
        center: { x: number, y: number },
        otherCenter: { x: number, y: number }
    ) => {
        const dx = otherCenter.x - center.x;
        const dy = otherCenter.y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.001) return center;

        // Unit vector
        const ux = dx / dist;
        const uy = dy / dist;

        return {
            x: center.x + ux * node.r,
            y: center.y + uy * node.r
        };
    };

    // Get coordinates relative to the overlay, normalized by coordinateScale
    const getRelativeCoords = (e: React.MouseEvent) => {
        if (!overlayRef.current) return { x: 0, y: 0 };
        const rect = overlayRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / coordinateScale,
            y: (e.clientY - rect.top) / coordinateScale
        };
    };

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!isDrawing) return;

        if (toolMode === 'connection') {
            setPendingSourceId(null);
            return;
        }

        if (e.button !== 0) return;

        const { x, y } = getRelativeCoords(e);

        if (toolMode === 'line') {
            setCurrentLine({ startX: x, startY: y, currX: x, currY: y });
        } else if (toolMode === 'node') {
            const logicalSize = 1;
            onAddAnnotation({
                x: x - logicalSize / 2,
                y: y - logicalSize / 2,
                width: logicalSize,
                height: logicalSize,
                type: 'node'
            });
            onFinishDrawing();
        } else if (toolMode === 'box') {
            setCurrentBox({ startX: x, startY: y, currX: x, currY: y });
        }
    }, [isDrawing, toolMode, onAddAnnotation, onFinishDrawing, coordinateScale]);

    const startResizeOrMove = (e: React.MouseEvent, ann: Annotation, handle: string) => {
        e.stopPropagation();
        e.preventDefault();

        // Check Locked Status
        if (lockedTypes.includes(ann.type)) {
            // If locked but we have an external click handler, call it
            if (handle === 'move' && onAnnotationMouseDown) {
                onAnnotationMouseDown(e, ann.id);
            }
            return;
        }

        // External Handler for Non-Locked (Linking etc)
        // If we are clicking 'move' (body), we might want to trigger selection
        if (handle === 'move' && onAnnotationMouseDown) {
            onAnnotationMouseDown(e, ann.id);
            // If dragging is still allowed, we continue.
            // But if we are linking, we probably don't want to move.
            // Let's assume onAnnotationMouseDown handles the logic. 
            // If it's for linking, we shouldn't move.
            // Since we can't consume the event return easily here, we will just proceed
            // UNLESS it's a 'move' action and we have a handler for it.
            // Actually, best to just continue unless 'locked'.
        }


        if (isDrawing && toolMode === 'connection') {
            if (pendingSourceId === null) {
                setPendingSourceId(ann.id);
            } else {
                if (pendingSourceId !== ann.id) {
                    onAddAnnotation({
                        x: 0, y: 0, width: 0, height: 0,
                        type: 'connection',
                        sourceId: pendingSourceId,
                        targetId: ann.id
                    });
                    setPendingSourceId(null);
                    onFinishDrawing();
                }
            }
            return;
        }

        if (isDrawing) return;

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
        if (resizeState) {
            e.preventDefault();
            const deltaX = (e.clientX - resizeState.startMouseX) / coordinateScale;
            const deltaY = (e.clientY - resizeState.startMouseY) / coordinateScale;

            let newX = resizeState.originalX;
            let newY = resizeState.originalY;
            let newW = resizeState.originalW;
            let newH = resizeState.originalH;

            if (resizeState.handle === 'move') {
                newX += deltaX;
                newY += deltaY;
            } else {
                if (resizeState.handle.includes('e')) {
                    newW = Math.max(0.5, resizeState.originalW + deltaX);
                }
                if (resizeState.handle.includes('s')) {
                    newH = Math.max(0.5, resizeState.originalH + deltaY);
                }
                if (resizeState.handle.includes('w')) {
                    const maxDelta = resizeState.originalW - 0.5;
                    const validDelta = Math.min(maxDelta, deltaX);
                    newX += validDelta;
                    newW -= validDelta;
                }
                if (resizeState.handle.includes('n')) {
                    const maxDelta = resizeState.originalH - 0.5;
                    const validDelta = Math.min(maxDelta, deltaY);
                    newY += validDelta;
                    newH -= validDelta;
                }
            }

            onResizeAnnotation(resizeState.id, { x: newX, y: newY, width: newW, height: newH });
            return;
        }

        if (!isDrawing) return;
        const { x, y } = getRelativeCoords(e);

        if (currentBox) {
            setCurrentBox(prev => prev ? { ...prev, currX: x, currY: y } : null);
        } else if (currentLine) {
            setCurrentLine(prev => prev ? { ...prev, currX: x, currY: y } : null);
        }
    }, [isDrawing, currentBox, currentLine, resizeState, scale, coordinateScale, onResizeAnnotation]);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        if (resizeState) {
            setResizeState(null);
            return;
        }

        if (!isDrawing) return;

        if (currentBox && toolMode === 'box') {
            const { startX, startY, currX, currY } = currentBox;
            const x = Math.min(startX, currX);
            const y = Math.min(startY, currY);
            const width = Math.abs(currX - startX);
            const height = Math.abs(currY - startY);

            if (width > 0.5 && height > 0.5) {
                onAddAnnotation({ x, y, width, height, type: 'box' });
            }
            setCurrentBox(null);
            // Don't auto-finish here unless requested, logic handled by parent if desired
            onFinishDrawing();
        } else if (currentLine && toolMode === 'line') {
            const { startX, startY, currX, currY } = currentLine;

            const p1 = { x: startX, y: startY };
            const p2 = { x: currX, y: currY };

            // Calculate BBox for compatibility
            const minX = Math.min(p1.x, p2.x);
            const minY = Math.min(p1.y, p2.y);
            const width = Math.abs(p2.x - p1.x);
            const height = Math.abs(p2.y - p1.y);

            const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            if (dist > 5) {
                onAddAnnotation({
                    x: minX, y: minY, width, height,
                    type: 'line',
                    points: [p1, p2]
                });
            }
            setCurrentLine(null);
            onFinishDrawing();
        }

    }, [isDrawing, currentBox, currentLine, toolMode, scale, coordinateScale, onAddAnnotation, onFinishDrawing, resizeState]);

    // Filter annotations for this page
    const pageAnnotations = annotations.filter(a => a.page === pageNumber);

    const getHandleStyle = (handle: string): React.CSSProperties => {
        const size = 8;
        const offset = -4;
        const style: React.CSSProperties = {
            position: 'absolute',
            width: `${size / coordinateScale}px`,
            height: `${size / coordinateScale}px`,
            background: 'white',
            border: `${1 / coordinateScale}px solid blue`,
            zIndex: 40,
            cursor: `${handle}-resize`
        };

        if (handle.includes('n')) style.top = `${offset / coordinateScale}px`;
        else style.bottom = `${offset / coordinateScale}px`;

        if (handle.includes('w')) style.left = `${offset / coordinateScale}px`;
        else style.right = `${offset / coordinateScale}px`;

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
                cursor: (isDrawing && toolMode === 'line') ? 'copy' : (isDrawing ? 'crosshair' : 'default'),
                pointerEvents: isDrawing || resizeState ? 'auto' : 'none'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
                setCurrentBox(null);
                setCurrentLine(null);
                setResizeState(null);
            }}
        >
            {/* Connections Layer (SVG) */}
            {allowedTypes.includes('connection') && (
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 15 }}>
                    {pageAnnotations.filter(a => a.type === 'connection').map((ann) => {
                        const source = annotations.find(n => n.id === ann.sourceId);
                        const target = annotations.find(n => n.id === ann.targetId);

                        if (!source || !target) return null;

                        // 1. Determine Actual Screen Coordinates for Source & Target
                        // We need these to calculate clipping
                        const getScreenGeom = (item: Annotation) => {
                            let x = item.x * scale;
                            let y = item.y * scale;
                            let w = item.width * scale;
                            let h = item.height * scale;
                            let isNode = item.type === 'node';
                            let radius = 0;

                            if (isNode) {
                                const NODE_SCREEN_SIZE = 25;
                                const renderSize = NODE_SCREEN_SIZE / coordinateScale;
                                // Center stays same in logic map, but visual bbox is constant
                                const cx = x + w / 2;
                                const cy = y + h / 2;
                                x = cx - renderSize / 2;
                                y = cy - renderSize / 2;
                                w = renderSize;
                                h = renderSize;
                                radius = renderSize / 2;
                            }

                            return { x, y, w, h, isNode, radius, cx: x + w / 2, cy: y + h / 2 };
                        };

                        const sGeom = getScreenGeom(source);
                        const tGeom = getScreenGeom(target);

                        let startPoint = { x: sGeom.cx, y: sGeom.cy };
                        let endPoint = { x: tGeom.cx, y: tGeom.cy };

                        // 2. Clip Start Point
                        const sCenter = { x: sGeom.cx, y: sGeom.cy };
                        const tCenter = { x: tGeom.cx, y: tGeom.cy };

                        if (sGeom.isNode) {
                            startPoint = getCircleIntersection({ cx: sGeom.cx, cy: sGeom.cy, r: sGeom.radius }, sCenter, tCenter);
                        } else {
                            startPoint = getRectIntersection({ x: sGeom.x, y: sGeom.y, w: sGeom.w, h: sGeom.h }, sCenter, tCenter);
                        }

                        // 3. Clip End Point
                        if (tGeom.isNode) {
                            endPoint = getCircleIntersection({ cx: tGeom.cx, cy: tGeom.cy, r: tGeom.radius }, tCenter, sCenter);
                        } else {
                            endPoint = getRectIntersection({ x: tGeom.x, y: tGeom.y, w: tGeom.w, h: tGeom.h }, tCenter, sCenter);
                        }

                        const isHovered = hoveredId === ann.id;

                        return (
                            <line
                                key={ann.id}
                                x1={startPoint.x} y1={startPoint.y}
                                x2={endPoint.x} y2={endPoint.y}
                                stroke={isHovered ? "blue" : "#006400"} // Darker Green
                                strokeWidth={2 / coordinateScale}
                                style={{ opacity: 0.8 }}
                            />
                        )
                    })}

                    {/* Legacy Lines */}
                    {pageAnnotations.filter(a => a.type === 'line' && a.points).map((ann) => {
                        const isHovered = hoveredId === ann.id;
                        const pointsStr = ann.points!.map(p => `${p.x * scale},${p.y * scale}`).join(' ');
                        return (
                            <polyline
                                key={ann.id}
                                points={pointsStr}
                                fill="none"
                                stroke={isHovered ? "blue" : "red"}
                                strokeWidth={3 / coordinateScale}
                                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                            />
                        );
                    })}

                    {/* Drawing Line Preview */}
                    {currentLine && (
                        <line
                            x1={currentLine.startX}
                            y1={currentLine.startY}
                            x2={currentLine.currX}
                            y2={currentLine.currY}
                            stroke="blue"
                            strokeWidth={3 / coordinateScale}
                            strokeDasharray={`${5 / coordinateScale},${5 / coordinateScale}`}
                        />
                    )}
                </svg>
            )}

            {/* Boxes & Nodes Layer */}
            {pageAnnotations.filter(a => allowedTypes.includes(a.type)).map((ann) => {
                // Skip connection as it is SVG above
                if (ann.type === 'connection' || ann.type === 'line') return null;

                const isHovered = hoveredId === ann.id;
                const isActive = resizeState?.id === ann.id;
                const isPendingSource = pendingSourceId === ann.id;
                const isHighlighted = highlightedId === ann.id; // Picking Mode
                const isLocked = lockedTypes.includes(ann.type);

                const isNode = ann.type === 'node';
                const isText = ann.type === 'text';

                // Determine Independent Index
                const typeSiblings = annotations.filter(a => a.type === ann.type);
                const typeIndex = typeSiblings.findIndex(a => a.id === ann.id) + 1;

                const showHandles = (isHovered || isActive) && !isDrawing && !isNode && !isLocked;

                // Color Logic
                let borderColor = 'red';
                let bgColor = 'rgba(255, 0, 0, 0.1)';

                if (isNode) {
                    borderColor = 'blue';
                    bgColor = 'rgba(0, 0, 255, 0.1)';
                } else if (isText) {
                    borderColor = 'blue';
                    bgColor = 'rgba(0, 0, 255, 0.05)';
                }

                if (isHovered || isActive) {
                    borderColor = 'blue';
                    bgColor = 'rgba(0, 0, 255, 0.1)';
                }

                if (isPendingSource) {
                    borderColor = 'orange';
                    bgColor = 'rgba(255, 165, 0, 0.2)';
                }

                if (isHighlighted) {
                    borderColor = '#ff00ff';
                    bgColor = 'rgba(255, 0, 255, 0.2)';
                }

                // Text Dashed
                const borderStyle = isText ? 'dashed' : 'solid';

                // Visual Overrides for Fixed-Screen-Size Nodes
                let finalLeft = ann.x * scale;
                let finalTop = ann.y * scale;
                let finalWidth = ann.width * scale;
                let finalHeight = ann.height * scale;
                let borderRadius = '0';

                // Fixed Node CSS Logic
                if (isNode) {
                    const NODE_SCREEN_SIZE = 25;
                    const renderSize = NODE_SCREEN_SIZE / coordinateScale;

                    const cx = finalLeft + finalWidth / 2;
                    const cy = finalTop + finalHeight / 2;

                    finalLeft = cx - renderSize / 2;
                    finalTop = cy - renderSize / 2;
                    finalWidth = renderSize;
                    finalHeight = renderSize;
                    borderRadius = '50%';
                }

                return (
                    <div
                        key={ann.id}
                        onMouseEnter={() => !resizeState && onHoverAnnotation(ann.id)}
                        onMouseLeave={() => !resizeState && onHoverAnnotation(null)}
                        onMouseDown={(e) => startResizeOrMove(e, ann, 'move')}
                        style={{
                            position: 'absolute',
                            left: finalLeft,
                            top: finalTop,
                            width: finalWidth,
                            height: finalHeight,
                            border: `${2 / coordinateScale}px ${borderStyle} ${borderColor}`,
                            backgroundColor: bgColor,
                            borderRadius: borderRadius,
                            pointerEvents: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: (isDrawing && toolMode === 'connection') ? 'pointer' : (isLocked ? (onAnnotationMouseDown ? 'pointer' : 'default') : 'move')
                        }}
                    >
                        {/* Handles (Only for boxes/text) */}
                        {showHandles && ['nw', 'ne', 'sw', 'se'].map(h => (
                            <div
                                key={h}
                                onMouseDown={(e) => startResizeOrMove(e, ann, h)}
                                style={getHandleStyle(h)}
                            />
                        ))}

                        {/* Node Label (Internal) */}
                        {isNode && (
                            <span style={{
                                fontSize: `${11 / coordinateScale}px`,
                                fontWeight: 'bold',
                                color: 'black',
                                userSelect: 'none',
                                pointerEvents: 'none'
                            }}>
                                N{typeIndex}
                            </span>
                        )}

                        {/* Box Label (External) */}
                        {((isHovered || isActive) && !isNode && !isText) && (
                            <div style={{
                                position: 'absolute',
                                top: '-20px',
                                left: '-2px',
                                background: 'blue',
                                color: 'white',
                                padding: `${2 / coordinateScale}px ${6 / coordinateScale}px`,
                                fontSize: `${12 / coordinateScale}px`,
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                zIndex: 30,
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none'
                            }}>
                                C{typeIndex}
                            </div>
                        )}

                        {/* Text Label */}
                        {isText && (
                            <span style={{
                                position: 'absolute',
                                bottom: '100%', left: 0,
                                background: 'black',
                                color: 'white',
                                fontSize: `${10 / coordinateScale}px`,
                                padding: `${1 / coordinateScale}px ${3 / coordinateScale}px`,
                                pointerEvents: 'none'
                            }}>
                                TEXT
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Drawing Box Preview */}
            {currentBox && (
                <div
                    style={{
                        position: 'absolute',
                        left: Math.min(currentBox.startX, currentBox.currX),
                        top: Math.min(currentBox.startY, currentBox.currY),
                        width: Math.abs(currentBox.currX - currentBox.startX),
                        height: Math.abs(currentBox.currY - currentBox.startY),
                        border: `${2 / coordinateScale}px dashed blue`,
                        backgroundColor: 'rgba(0, 0, 255, 0.1)'
                    }}
                />
            )}
        </div>
    );
};
