import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import type { Annotation } from '../types';
import { AnnotationOverlay } from './AnnotationOverlay';
import { DRAWING_TYPES, SOURCES } from '../constants';
import { TechDropdown } from './TechDropdown';

interface ImageViewerProps {
    file: File;
    annotations: Annotation[];
    isDrawing: boolean;
    toolMode?: 'box' | 'line' | 'node' | 'connection';
    onAddAnnotation: (rect: Omit<Annotation, 'id' | 'label'>) => void;
    onResizeAnnotation: (id: string, rect: { x: number, y: number, width: number, height: number }) => void;
    onFinishDrawing: () => void;

    // New Metadata
    drawingType: string;
    setDrawingType: (val: string) => void;
    source: string;
    setSource: (val: string) => void;

    hoveredId: string | null;
    onHoverAnnotation: (id: string | null) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
    file,
    annotations,
    isDrawing,
    toolMode = 'box',
    onAddAnnotation,
    onResizeAnnotation,
    onFinishDrawing,
    drawingType,
    setDrawingType,
    source,
    setSource,
    hoveredId,
    onHoverAnnotation
}) => {
    // Canvas State
    const [scale, setScale] = useState<number>(1.0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imgDimensions, setImgDimensions] = useState<{ width: number, height: number } | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Center ref to handle initial load centering only
    const shouldCenterRef = useRef(true);

    // Create object URL for file
    useEffect(() => {
        if (!file) return;
        const objectUrl = URL.createObjectURL(file);
        setImageSrc(objectUrl);
        shouldCenterRef.current = true; // Reset centering for new file

        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    // Handle Image Load & Centering
    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setImgDimensions({ width: naturalWidth, height: naturalHeight });

        if (shouldCenterRef.current && containerRef.current) {
            const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();

            // Fit logic
            const padding = 40;
            const availableWidth = containerWidth - padding;
            const availableHeight = containerHeight - padding;

            const scaleX = availableWidth / naturalWidth;
            const scaleY = availableHeight / naturalHeight;
            const fitScale = Math.min(scaleX, scaleY, 1.0); // Don't over-zoom small images by default

            setScale(fitScale);

            // Center
            const scaledW = naturalWidth * fitScale;
            const scaledH = naturalHeight * fitScale;
            const centerX = (containerWidth - scaledW) / 2;
            const centerY = (containerHeight - scaledH) / 2;

            setPosition({ x: centerX, y: centerY });
            shouldCenterRef.current = false;
        }
    };

    // Zoom Handling
    const handleZoomValues = (delta: number) => {
        const container = containerRef.current;
        if (!container) return;
        const { width, height } = container.getBoundingClientRect();

        const currentScale = scale;
        const newScale = Math.min(Math.max(0.1, currentScale + delta), 10.0);
        const scaleRatio = newScale / currentScale;

        const centerX = width / 2;
        const centerY = height / 2;

        const newX = centerX - (centerX - position.x) * scaleRatio;
        const newY = centerY - (centerY - position.y) * scaleRatio;

        setScale(newScale);
        setPosition({ x: newX, y: newY });
    };

    // Wheel Zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            // Use refs or functional updates to get fresh state if needed, 
            // but simplest is to recalculate based on current render scope if closure is fresh
            // However, event listener added once needs fresh closure or refs. 
            // We'll use a ref for state access in the listener.
        };
        // NOTE: React's 'onWheel' is passive by default. 
        // We need non-passive to preventDefault (browser zoom).
        // Attaching manually is safer for this.

        // Simpler implementation reusing logic from PdfViewer but adapted
        // See below for the actual handler using stateRef pattern if we need it,
        // OR just rely on buttons for now to keep it robust and simple for the "Pivot".
        // Let's implement the robust wheel handler.

    }, []);

    // ... Re-implementing robust wheel zoom using stateRef ...
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
        return () => container.removeEventListener('wheel', onWheel);
    }, []);


    // Mouse Interaction (Pan)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isDrawing) return;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragStartRef.current) return;
        setPosition({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        dragStartRef.current = null;
    };

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', height: '100%' }}>
            {/* Top Bar: Metadata */}
            <div className="tech-border" style={{
                width: '100%', padding: '0.75rem 1rem', display: 'flex', gap: '2rem', alignItems: 'center', background: '#fff', zIndex: 50
            }}>
                <TechDropdown
                    label="DRAWING TYPE"
                    value={drawingType}
                    options={DRAWING_TYPES}
                    onChange={setDrawingType}
                />
                <TechDropdown
                    label="SOURCE"
                    value={source}
                    options={SOURCES}
                    onChange={setSource}
                />
            </div>

            {/* Bottom Bar: Controls */}
            <div className="tech-border" style={{
                width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', zIndex: 10
            }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{file.name}</span>
                </div>
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
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                    padding: 0,
                    background: '#666',
                    overflow: 'hidden',
                    width: '100%',
                    flex: 1,
                    position: 'relative',
                    cursor: (isDrawing && toolMode === 'line') ? 'copy' : (isDrawing ? 'crosshair' : (isDragging ? 'grabbing' : 'grab')),
                    userSelect: 'none'
                }}
            >
                <div style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    width: 'fit-content',
                    height: 'fit-content',
                    position: 'relative',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    {imageSrc && (
                        <img
                            src={imageSrc}
                            alt="Circuit"
                            onLoad={handleImageLoad}
                            style={{ display: 'block', pointerEvents: 'none' }}
                            draggable={false}
                        />
                    )}

                    {imgDimensions && (
                        <AnnotationOverlay
                            pageNumber={1} // Single page for images
                            scale={1.0}
                            coordinateScale={scale} // Pass dynamic zoom scale for input normalization
                            annotations={annotations}
                            isDrawing={isDrawing}
                            toolMode={toolMode}
                            onAddAnnotation={(rect) => onAddAnnotation({ ...rect, page: 1 })}
                            onResizeAnnotation={onResizeAnnotation}
                            onFinishDrawing={onFinishDrawing}
                            hoveredId={hoveredId}
                            onHoverAnnotation={onHoverAnnotation}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
