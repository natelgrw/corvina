import React, { useRef, useState, useMemo, useEffect, useLayoutEffect } from 'react';
import type { Annotation } from '../types';
import { AnnotationOverlay } from './AnnotationOverlay';

interface TranscriptionViewProps {
    file: File;
    annotations: Annotation[];
    onAddTextAnnotation: (rect: { x: number, y: number, width: number, height: number }) => void;
    onResizeAnnotation?: (id: string, rect: { x: number, y: number, width: number, height: number }) => void;
    hoveredId: string | null;
    onHoverId: (id: string | null) => void;
    isDrawing: boolean;
    onFinishDrawing: () => void;
    linkingTextId?: string | null;
    onLinkAnnotation?: (textId: string, targetId: string) => void;
}

export const TranscriptionView: React.FC<TranscriptionViewProps> = ({
    file,
    annotations,
    onAddTextAnnotation,
    onResizeAnnotation,
    hoveredId,
    onHoverId,
    isDrawing,
    onFinishDrawing,
    linkingTextId,
    onLinkAnnotation
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);

    // Pan / Zoom State
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);

    // Load Image
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setImageSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // Initial Fit
    useEffect(() => {
        if (!containerRef.current || !imageSrc) return;
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            if (!containerRef.current) return;
            const containerW = containerRef.current.clientWidth;
            const containerH = containerRef.current.clientHeight;
            const scaleW = containerW / img.width;
            const scaleH = containerH / img.height;
            const newScale = Math.min(scaleW, scaleH) * 0.9;
            setScale(newScale);

            const scaledW = img.width * newScale;
            const scaledH = img.height * newScale;
            setPosition({
                x: (containerW - scaledW) / 2,
                y: (containerH - scaledH) / 2
            });
        };
    }, [imageSrc]);

    // Robust Wheel Zoom (State Ref Pattern)
    const stateRef = useRef({ scale, position });
    useLayoutEffect(() => {
        stateRef.current = { scale, position };
    }, [scale, position]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const { scale: currentScale, position: currentPos } = stateRef.current;
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const delta = -e.deltaY * 0.002;
            const zoomFactor = 1 + delta;
            const newScale = Math.min(Math.max(0.1, currentScale * zoomFactor), 10.0);

            const scaleRatio = newScale / currentScale;
            const newX = mouseX - (mouseX - currentPos.x) * scaleRatio;
            const newY = mouseY - (mouseY - currentPos.y) * scaleRatio;

            setScale(newScale);
            setPosition({ x: newX, y: newY });
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        // NOTE: React passive by default fix not usually needed if we used ref based listener above
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    // Button Zoom Helper
    const handleZoomValues = (delta: number) => {
        const container = containerRef.current;
        if (!container) return;
        const { width, height } = container.getBoundingClientRect();
        const centerX = width / 2;
        const centerY = height / 2;

        const currentScale = scale;
        const newScale = Math.min(Math.max(0.1, currentScale + delta), 10.0);
        const scaleRatio = newScale / currentScale;

        const newX = centerX - (centerX - position.x) * scaleRatio;
        const newY = centerY - (centerY - position.y) * scaleRatio;

        setScale(newScale);
        setPosition({ x: newX, y: newY });
    };

    // Pan Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        // Only pan if not interaction with Overlay (which stops prop)
        // If we draw, we skip pan
        if (isDrawing) return;

        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && dragStartRef.current) {
            setPosition({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        dragStartRef.current = null;
    };

    // Linking Handler
    const handleAnnotationClick = (e: React.MouseEvent, id: string) => {
        if (linkingTextId && onLinkAnnotation) {
            // Check if clicked item is box or node
            const ann = annotations.find(a => a.id === id);
            if (ann && (ann.type === 'box' || ann.type === 'node')) {
                onLinkAnnotation(linkingTextId, id);
            }
        }
    };

    // Add Annotation Interceptor (Force 'text' type)
    const handleAddAnnotation = (rect: any) => {
        // AnnotationOverlay defaults to 'box' if toolMode='box'. 
        // We intercept and force type='text'
        onAddTextAnnotation({ ...rect, width: rect.width, height: rect.height });
    };

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Header / Zoom Controls */}
            <div className="tech-border" style={{
                width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', zIndex: 10
            }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', letterSpacing: '-0.5px' }}>TRANSCRIPTION VIEW</span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button onClick={() => handleZoomValues(-0.2)}>-</button>
                    <span style={{ fontSize: '0.9rem', minWidth: '3rem', textAlign: 'center' }}>{(scale * 100).toFixed(0)}%</span>
                    <button onClick={() => handleZoomValues(0.2)}>+</button>
                </div>
            </div>

            {/* Viewport */}
            <div
                ref={containerRef}
                className="tech-border"
                style={{
                    flex: 1,
                    width: '100%',
                    background: '#f0f0f0',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: linkingTextId ? 'crosshair' : (isDrawing ? 'crosshair' : (isDragging ? 'grabbing' : 'grab'))
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDragStart={(e) => e.preventDefault()}
            >
                <div style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    width: 'fit-content',
                    height: 'fit-content',
                    position: 'relative',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    {imageSrc && <img src={imageSrc} alt="Circuit" style={{ display: 'block', pointerEvents: 'none' }} />}

                    {/* Unified Overlay */}
                    <AnnotationOverlay
                        pageNumber={1}
                        scale={1.0} // Internal scale 1.0 because we scale the DIV, so SVG sizes are base
                        coordinateScale={scale} // Pass zoom for linewidth adjustment
                        annotations={annotations}
                        isDrawing={isDrawing}
                        toolMode="box" // Treat text as box for drawing
                        onAddAnnotation={handleAddAnnotation}
                        onResizeAnnotation={(id, rect) => onResizeAnnotation && onResizeAnnotation(id, rect)}
                        onFinishDrawing={onFinishDrawing}
                        hoveredId={hoveredId}
                        onHoverAnnotation={onHoverId}
                        lockedTypes={['box', 'node', 'connection']}
                        allowedTypes={['box', 'node', 'connection', 'text']}
                        onAnnotationMouseDown={handleAnnotationClick}
                        highlightedId={linkingTextId}
                    />
                </div>
            </div>
        </div>
    );
};
