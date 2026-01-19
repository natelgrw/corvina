import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { Annotation } from '../types';
import { AnnotationOverlay } from './AnnotationOverlay';
import { DOCUMENT_TYPES, DOMAINS } from '../constants';
import { TechDropdown } from './TechDropdown';

// Set worker to local
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface PdfViewerProps {
    file: File;
    annotations: Annotation[];
    isDrawing: boolean;
    onAddAnnotation: (rect: Omit<Annotation, 'id' | 'label'>) => void;
    onFinishDrawing: () => void;
    docType: string;
    setDocType: (val: string) => void;
    docDomain: string;
    setDocDomain: (val: string) => void;
    onResizeAnnotation: (id: string, rect: { x: number, y: number, width: number, height: number }) => void;
    hoveredId: string | null;
    onHoverAnnotation: (id: string | null) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
    file,
    annotations,
    isDrawing,
    onAddAnnotation,
    onResizeAnnotation,
    onFinishDrawing,
    docType,
    setDocType,
    docDomain,
    setDocDomain,
    hoveredId,
    onHoverAnnotation
}) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);

    // "True" state of the viewport
    const [scale, setScale] = useState<number>(1.0);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    // "Rendered" state (quality)
    const [renderedScale, setRenderedScale] = useState<number>(1.0);
    const [pageDimensions, setPageDimensions] = useState<{ width: number, height: number } | null>(null);

    // Snapshot Buffer
    const [snapshot, setSnapshot] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);

    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = React.useRef<{ x: number, y: number } | null>(null);

    // Refs for state access in event handlers
    const stateRef = React.useRef({ scale, position, renderedScale });
    React.useLayoutEffect(() => {
        stateRef.current = { scale, position, renderedScale };
    }, [scale, position, renderedScale]);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const renderTimeoutRef = React.useRef<any>(null);
    const shouldCenterRef = React.useRef(true);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
        setNumPages(numPages);
        setPageNumber(1);
        setScale(1.0);
        setRenderedScale(1.0);
        // Position reset handled in onPageLoadSuccess for centering
        setSnapshot(null);
        setIsRendering(false);
        shouldCenterRef.current = true;
    }

    function onPageLoadSuccess(page: { originalWidth: number; originalHeight: number; }) {
        // Only update dimensions if they changed (avoid unnecessary renders)
        if (!pageDimensions || pageDimensions.width !== page.originalWidth || pageDimensions.height !== page.originalHeight) {
            setPageDimensions({ width: page.originalWidth, height: page.originalHeight });
        }

        // Initial Fit-to-Screen Logic
        // Only run on first load (shouldCenterRef is true).
        // onDocumentLoadSuccess sets this to true.
        if (shouldCenterRef.current && containerRef.current) {
            const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();

            // Add some padding (e.g. 40px total)
            const padding = 40;
            const availableWidth = containerWidth - padding;
            const availableHeight = containerHeight - padding;

            // Calculate scale to fit ENTIRE page
            const scaleX = availableWidth / page.originalWidth;
            const scaleY = availableHeight / page.originalHeight;

            // Use the smaller scale to ensure it fits in both dimensions (Contain)
            const fitScale = Math.min(scaleX, scaleY);

            // Update both scales synchronously to bypass the debounce/snapshot logic
            // providing an instant clear render at the right size
            setScale(fitScale);
            setRenderedScale(fitScale);

            // Center the page in the viewport
            const scaledWidth = page.originalWidth * fitScale;
            const scaledHeight = page.originalHeight * fitScale;

            const centerX = (containerWidth - scaledWidth) / 2;
            const centerY = (containerHeight - scaledHeight) / 2;

            setPosition({ x: centerX, y: centerY });

            // Disable centering for subsequent renders (zooming, etc)
            shouldCenterRef.current = false;
        }
    }

    function changePage(offset: number) {
        setPageNumber(prev => Math.min(Math.max(1, prev + offset), numPages));
        // Note: We intentionally do NOT set shouldCenterRef=true here.
        // This preserves the current zoom/pan state when switching pages ("Infinite Canvas" feel).
    }

    // Debounce High-Res Render
    React.useEffect(() => {
        if (scale !== renderedScale) {
            if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);

            // Wait 200ms after last zoom interaction to commit high-res
            renderTimeoutRef.current = setTimeout(() => {
                // Capture Snapshot before updating
                // Use containerRef to scope the query
                const canvas = containerRef.current?.querySelector('canvas');
                if (canvas) {
                    try {
                        setSnapshot(canvas.toDataURL());
                        setIsRendering(true);
                    } catch (e) {
                        console.error("Snapshot failed", e);
                    }
                }
                setRenderedScale(scale);
            }, 300);
        }
        return () => {
            if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
        };
    }, [scale, renderedScale]);

    // Derived CSS Scale
    const cssScale = scale / renderedScale;

    // --- Interaction Handlers (Fast) ---

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const { scale: currentScale, position: currentPos } = stateRef.current;

            const rect = container.getBoundingClientRect();
            // Cursor relative to container
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Zoom Math
            const delta = -e.deltaY * 0.002;
            const zoomFactor = 1 + delta;

            // Limit zoom and ensure we don't drift too far
            const newScale = Math.min(Math.max(0.1, currentScale * zoomFactor), 10.0);

            // Standard Zoom-to-Point formula with translation:
            // newPos = mouse - (mouse - oldPos) * (newScale / oldScale)

            const scaleRatio = newScale / currentScale;
            const newX = mouseX - (mouseX - currentPos.x) * scaleRatio;
            const newY = mouseY - (mouseY - currentPos.y) * scaleRatio;

            setScale(newScale);
            setPosition({ x: newX, y: newY });
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        // Clean up: Clear snapshot if we start zooming again to prevent stale overlay
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

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

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', height: '100%' }}>
            {/* Top Bar: Metadata Selectors */}
            <div className="tech-border" style={{
                width: '100%', padding: '0.75rem 1rem', display: 'flex', gap: '2rem', alignItems: 'center', background: '#fff', zIndex: 50
            }}>
                <TechDropdown
                    label="DOCUMENT TYPE"
                    value={docType}
                    options={DOCUMENT_TYPES}
                    onChange={setDocType}
                />

                <TechDropdown
                    label="DOMAIN"
                    value={docDomain}
                    options={DOMAINS}
                    onChange={setDocDomain}
                />
            </div>

            {/* Bottom Bar: Navigation & Tools */}
            <div className="tech-border" style={{
                width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', zIndex: 10
            }}>
                {/* Left: File Info */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{file.name}</span>
                </div>

                {/* Right: Controls */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* Navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button onClick={() => changePage(-1)} disabled={pageNumber <= 1}>&lt;</button>
                        <span style={{ fontSize: '0.9rem', minWidth: '3rem', textAlign: 'center' }}>{pageNumber} / {numPages || '--'}</span>
                        <button onClick={() => changePage(1)} disabled={pageNumber >= numPages}>&gt;</button>
                    </div>

                    <div style={{ width: '1px', height: '15px', background: '#e0e0e0', margin: '0 0.25rem' }}></div>

                    {/* Zoom */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button onClick={() => handleZoomValues(-0.2)}>-</button>
                        <span style={{ fontSize: '0.9rem', minWidth: '3rem', textAlign: 'center' }}>{(scale * 100).toFixed(0)}%</span>
                        <button onClick={() => handleZoomValues(0.2)}>+</button>
                    </div>
                </div>
            </div>

            {/* Canvas Viewport */}
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
                    cursor: isDrawing ? 'crosshair' : (isDragging ? 'grabbing' : 'grab'),
                    userSelect: 'none'
                }}
            >
                {/* Visual Transform Layer */}
                <div style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${cssScale})`,
                    transformOrigin: '0 0',
                    width: 'fit-content', // Shrink to fit content
                    height: 'fit-content',
                    // Hardware acceleration hints
                    willChange: 'transform',
                }}>
                    <div style={{
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        display: 'inline-block', // Ensure div shrinks to Page size
                        position: 'relative'
                    }}>
                        <Document
                            file={file}
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={<div style={{ padding: '2rem', color: 'white' }}>[LOADING DATA STREAM...]</div>}
                            error={<div style={{ padding: '2rem', color: 'red' }}>[ERROR LOADING PDF]</div>}
                        >
                            {/* Rendered Layer: This updates only when 'renderedScale' changes (debounced) */}
                            <Page
                                pageNumber={pageNumber}
                                scale={renderedScale}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                onLoadSuccess={onPageLoadSuccess}
                                onRenderSuccess={() => {
                                    setSnapshot(null);
                                    setIsRendering(false);
                                }}
                            />

                            {/* Snapshot Overlay */}
                            {snapshot && isRendering && (
                                <img
                                    src={snapshot}
                                    alt=""
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        zIndex: 50, // High Z-Index to prevent being covered
                                        pointerEvents: 'none'
                                    }}
                                />
                            )}

                            <AnnotationOverlay
                                pageNumber={pageNumber}
                                scale={renderedScale}
                                annotations={annotations}
                                isDrawing={isDrawing}
                                onAddAnnotation={(rect) => onAddAnnotation({ ...rect, page: pageNumber })}
                                onResizeAnnotation={onResizeAnnotation}
                                onFinishDrawing={onFinishDrawing}
                                hoveredId={hoveredId}
                                onHoverAnnotation={onHoverAnnotation}
                            />
                        </Document>
                    </div>
                </div>
            </div>
        </div>
    );
};
