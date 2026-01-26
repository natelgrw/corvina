import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { Annotation } from '../types';
import { TechDropdown } from './TechDropdown';
import { HEADER_SUBTYPES, LIST_SUBTYPES } from '../constants';

// Ensure worker is set (same as in PdfViewer)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface TranscriptionViewProps {
    file: File;
    annotations: Annotation[];
    onUpdateAnnotation: (id: string, value: string | any) => void;
    onUpdateSubtype: (id: string, subtype: string) => void;
    onSubmit: () => void;
    onBack: () => void;
}

// Helper functions for Table
const parseTable = (annotation: Annotation): string[][] => {
    // 1. Check native content
    if (annotation.content && Array.isArray(annotation.content)) {
        return annotation.content;
    }

    // 2. Check stringified text (Legacy - cast to any since text is removed from type)
    const text = (annotation as any).text || '';
    if (!text) return [['', '', ''], ['', '', ''], ['', '', '']]; // Default 3x3

    try {
        const json = JSON.parse(text);
        if (Array.isArray(json) && Array.isArray(json[0])) {
            return json;
        }
    } catch (e) {
        // Fallback to Markdown parsing
    }

    const lines = text.split('\n').filter((l: string) => l.trim() !== '');
    // Filter out separator lines (e.g. |---|---|)
    const dataLines = lines.filter((l: string) => !l.trim().match(/^\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?\|?$/));

    if (dataLines.length === 0) return [['', '', ''], ['', '', ''], ['', '', '']];

    return dataLines.map((line: string) => {
        // Remove leading/trailing pipes if present, then split
        const content = line.trim().replace(/^\|/, '').replace(/\|$/, '');
        return content.split('|').map((c: string) => c.trim());
    });
};

const serializeTable = (data: string[][]): any => {
    return data; // Return object directly
};

const parseCode = (annotation: Annotation): string[] => {
    // 1. Check native content (Array) [NEW STANDARD]
    if (annotation.content && Array.isArray(annotation.content)) {
        // Simple check to ensure it's not a table (which is string[][]) or just assume usage based on label
        // Since this parser is called for 'code'/'list', we expect string[].
        // Even if it's legacy 2D array, we might handle it, but schema says lists are 1D.
        return annotation.content as string[];
    }

    // 2. Check native content (Legacy Dict)
    if (annotation.content && typeof annotation.content === 'object') {
        const dict = annotation.content;
        const sortedKeys = Object.keys(dict).sort((a, b) => parseInt(a) - parseInt(b));
        return sortedKeys.map(k => dict[k]);
    }

    // 2. Check stringified text (Legacy)
    const text = (annotation as any).text || '';
    if (!text) return [''];

    try {
        const dict = JSON.parse(text);
        const sortedKeys = Object.keys(dict).sort((a, b) => parseInt(a) - parseInt(b));
        return sortedKeys.map(k => dict[k]);
    } catch (e) {
        // Fallback for plain text or legacy
        return text.split('\n');
    }
};

const serializeCode = (lines: string[]): any => {
    return lines; // Return array directly [NEW STANDARD]
};

// Reuse code serialization logic for lists since format is identical
const parseList = parseCode;
const serializeList = serializeCode;



const parseMath = (text: string): string => {
    if (!text) return '';
    // Strip leading/trailing $$ if present
    return text.replace(/^\$\$/, '').replace(/\$\$$/, '');
};

const serializeMath = (text: string): string => {
    // Ensure it's wrapped in $$
    if (!text) return '';
    const inner = text.replace(/^\$\$/, '').replace(/\$\$$/, '');
    return `$$${inner}$$`;
};

export const TranscriptionView: React.FC<TranscriptionViewProps> = ({
    file,
    annotations,
    onUpdateAnnotation,
    onUpdateSubtype,
    onSubmit,
    onBack
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [pageDimensions, setPageDimensions] = useState<{ width: number, height: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const codeInputsRef = useRef<(HTMLTextAreaElement | null)[]>([]);
    const focusTargetIndex = useRef<number | null>(null);

    // Focus management for code editor
    useEffect(() => {
        if (focusTargetIndex.current !== null && codeInputsRef.current[focusTargetIndex.current]) {
            codeInputsRef.current[focusTargetIndex.current]?.focus();
            focusTargetIndex.current = null;
        }
    }, [annotations]); // Re-run when annotations change (which happens after update)

    const currentAnnotation = annotations[currentIndex];

    // Auto-focus logic
    useEffect(() => {
        if (currentAnnotation.label !== 'list' && textAreaRef.current) {
            textAreaRef.current.focus();
        }
    }, [currentIndex, currentAnnotation.label]);

    const handleNext = () => {
        if (currentIndex < annotations.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onSubmit();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        } else {
            onBack();
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdateAnnotation(currentAnnotation.id, e.target.value);
    };

    const onPageLoadSuccess = (page: { originalWidth: number; originalHeight: number; }) => {
        setPageDimensions({ width: page.originalWidth, height: page.originalHeight });
    };

    // Calculate crop
    const getTransformStyle = () => {
        if (!pageDimensions || !containerRef.current) return {};
        const { width: cw, height: ch } = containerRef.current.getBoundingClientRect();
        const bbox = currentAnnotation;
        // padding
        const p = 50;
        const scale = Math.min((cw - p * 2) / bbox.width, (ch - p * 2) / bbox.height, 5.0);
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const tx = (cw / 2) - (cx * scale);
        const ty = (ch / 2) - (cy * scale);

        return {
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: '0 0'
        };
    };

    return (
        <div style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            backgroundColor: '#f5f5f5',
            fontFamily: '"IBM Plex Mono", monospace'
        }}>
            {/* Left Panel */}
            <div style={{
                width: (currentAnnotation.label === 'table' || currentAnnotation.label === 'code') ? '50%' : '450px',
                transition: 'width 0.3s ease',
                backgroundColor: '#FAFAFA',
                borderRight: '1px solid #ddd',
                display: 'flex',
                flexDirection: 'column',
                padding: '2rem',
                zIndex: 10,
                boxShadow: '10px 0 30px rgba(0,0,0,0.2)'
            }}>
                {/* Header */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', color: '#888', fontSize: '0.75rem' }}>
                        <span>ITEM {currentIndex + 1} / {annotations.length}</span>
                        <span>PG {currentAnnotation.page}</span>
                    </div>

                    <div style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
                        {currentAnnotation.label.toUpperCase()}
                    </div>

                    {/* Subtype Selector */}
                    {(currentAnnotation.label === 'heading' || currentAnnotation.label === 'list') && (
                        <div style={{ paddingLeft: '0' }}>
                            <TechDropdown
                                value={currentAnnotation.subtype || ''}
                                onChange={(val) => onUpdateSubtype(currentAnnotation.id, val)}
                                options={currentAnnotation.label === 'heading' ? HEADER_SUBTYPES : LIST_SUBTYPES}
                                placeholder={currentAnnotation.label === 'heading' ? "SELECT LEVEL" : "SELECT STYLE"}
                            />
                        </div>
                    )}
                </div>

                {/* Table Controls (Fixed outside scroll area) */}
                {currentAnnotation.label === 'table' && (() => {
                    const data = parseTable(currentAnnotation);
                    const colCount = data[0]?.length || 2;

                    const updateTable = (newData: string[][]) => {
                        onUpdateAnnotation(currentAnnotation.id, serializeTable(newData));
                    };

                    return (
                        <div style={{ paddingBottom: '1rem', borderBottom: '1px solid #eee', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => {
                                            const newData = [...data, Array(colCount).fill('')];
                                            updateTable(newData);
                                        }}
                                        className="table-action-btn"
                                    >+ ROW</button>
                                    <button
                                        onClick={() => {
                                            if (data.length > 2) {
                                                const newData = data.slice(0, -1);
                                                updateTable(newData);
                                            }
                                        }}
                                        className="table-action-btn"
                                        disabled={data.length <= 2}
                                        style={{ opacity: data.length <= 2 ? 0.3 : 1, cursor: data.length <= 2 ? 'not-allowed' : 'pointer' }}
                                    >- ROW</button>
                                </div>
                                <div style={{ width: '1px', backgroundColor: '#ddd' }}></div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => {
                                            const newData = data.map(r => [...r, '']);
                                            updateTable(newData);
                                        }}
                                        className="table-action-btn"
                                    >+ COL</button>
                                    <button
                                        onClick={() => {
                                            if (colCount > 1) {
                                                const newData = data.map(r => r.slice(0, -1));
                                                updateTable(newData);
                                            }
                                        }}
                                        className="table-action-btn"
                                        disabled={colCount <= 1}
                                        style={{ opacity: colCount <= 1 ? 0.3 : 1, cursor: colCount <= 1 ? 'not-allowed' : 'pointer' }}
                                    >- COL</button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '2rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {currentAnnotation.label !== 'figure' && (
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#999', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>TRANSCRIPTION</label>
                    )}

                    {currentAnnotation.label === 'list' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {(() => {
                                const listItems = parseList(currentAnnotation);
                                return listItems.map((item, idx, arr) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start' }}>
                                        {/* Bullet Point */}
                                        <div style={{
                                            width: '2rem',
                                            paddingTop: '0.6rem',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {currentAnnotation.subtype === 'numbered' ? (
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#333' }}>{idx + 1}.</span>
                                            ) : (
                                                /* Square Bullet */
                                                <div style={{ width: '6px', height: '6px', backgroundColor: '#333', marginTop: '4px' }} />
                                            )}
                                        </div>

                                        {/* Text Input */}
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                                            <div className="list-input-wrapper" style={{ flex: 1, position: 'relative' }}>
                                                <textarea
                                                    value={item}
                                                    onChange={(e) => {
                                                        const newArr = [...arr];
                                                        newArr[idx] = e.target.value;
                                                        onUpdateAnnotation(currentAnnotation.id, serializeList(newArr));
                                                        // Auto-grow
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                    }}
                                                    ref={el => {
                                                        if (el) {
                                                            // Initial auto-grow
                                                            el.style.height = 'auto';
                                                            el.style.height = el.scrollHeight + 'px';
                                                        }
                                                    }}
                                                    placeholder="List item..."
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.5rem',
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        fontFamily: 'inherit',
                                                        fontSize: '0.95rem',
                                                        resize: 'none',
                                                        outline: 'none',
                                                        lineHeight: '1.5',
                                                        minHeight: '2.5rem',
                                                        overflow: 'hidden'
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            const newArr = [...arr];
                                                            // Insert new item after current
                                                            newArr.splice(idx + 1, 0, '');
                                                            onUpdateAnnotation(currentAnnotation.id, serializeList(newArr));
                                                        } else if (e.key === 'Backspace' && item === '' && arr.length > 1) {
                                                            e.preventDefault();
                                                            const newArr = [...arr];
                                                            newArr.splice(idx, 1);
                                                            onUpdateAnnotation(currentAnnotation.id, serializeList(newArr));
                                                        } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                                            handleNext();
                                                        }
                                                    }}
                                                />
                                                <div className="list-input-underline" />
                                            </div>
                                            {arr.length > 1 && (
                                                <button
                                                    onClick={() => {
                                                        const newArr = [...arr];
                                                        newArr.splice(idx, 1);
                                                        onUpdateAnnotation(currentAnnotation.id, serializeList(newArr));
                                                    }}
                                                    className="delete-btn"
                                                    style={{ flexShrink: 0 }}
                                                >×</button>
                                            )}
                                        </div>
                                    </div>
                                ));
                            })()}
                            <button
                                onClick={() => {
                                    const listItems = parseList(currentAnnotation);
                                    const newArr = [...listItems, ''];
                                    onUpdateAnnotation(currentAnnotation.id, serializeList(newArr));
                                }}
                                className="add-item-btn"
                                style={{
                                    marginTop: '1rem',
                                    width: '100%',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: '#000',
                                    background: '#fff',
                                    border: '1px solid #000',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    padding: '0.75rem',
                                    alignSelf: 'stretch',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    letterSpacing: '0.05em',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <span>+ ADD LIST ITEM</span>
                            </button>
                            <style>{`
                                .delete-btn {
                                    margin-left: 0.5rem;
                                    margin-top: 0.5rem;
                                    border: 1px solid transparent;
                                    background: transparent;
                                    color: #ccc;
                                    cursor: pointer;
                                    width: 18px;
                                    height: 18px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 1rem;
                                    transition: all 0.2s;
                                    padding: 0;
                                    line-height: 1;
                                }
                                .delete-btn:hover {
                                    background-color: black;
                                    color: white;
                                }
                                .add-item-btn:hover {
                                    background-color: #000 !important;
                                    color: #fff !important;
                                }
                                .list-input-underline {
                                    position: absolute;
                                    bottom: 0;
                                    left: 0;
                                    width: 0;
                                    height: 1px;
                                    background-color: black;
                                    transition: width 0.3s ease;
                                }
                                .list-input-wrapper:focus-within .list-input-underline {
                                    width: 100%;
                                }
                            `}</style>
                        </div>
                    ) : currentAnnotation.label === 'table' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Table Editor */}
                            <div style={{ display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
                                {(() => {
                                    const data = parseTable(currentAnnotation);

                                    const updateTable = (newData: string[][]) => {
                                        onUpdateAnnotation(currentAnnotation.id, serializeTable(newData));
                                    };

                                    return (
                                        <div style={{ display: 'inline-block', minWidth: '100%' }}>
                                            {/* Column Headers / Delete Controls could go here if needed, but for now simple grid */}
                                            {/* Table Grid */}
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                {data.map((row, rIdx) => (
                                                    <div key={rIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                                        {row.map((cell, cIdx) => (
                                                            <div key={`${rIdx}-${cIdx}`} style={{ position: 'relative', flex: 1, minWidth: '100px' }}>
                                                                <input
                                                                    value={cell}
                                                                    onChange={(e) => {
                                                                        const newData = [...data.map(r => [...r])];
                                                                        newData[rIdx][cIdx] = e.target.value;
                                                                        updateTable(newData);
                                                                    }}
                                                                    placeholder={rIdx === 0 ? "Header" : "Data"}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '0.5rem',
                                                                        background: rIdx === 0 ? '#f0f0f0' : 'transparent',
                                                                        border: '1px solid #ddd',
                                                                        fontFamily: 'inherit',
                                                                        fontSize: '0.9rem',
                                                                        fontWeight: rIdx === 0 ? 600 : 400,
                                                                        outline: 'none',
                                                                        color: '#333'
                                                                    }}
                                                                    onFocus={(e) => e.target.style.borderColor = 'black'}
                                                                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>

                                            <style>{`
                                                .table-action-btn {
                                                    font-size: 0.75rem;
                                                    font-weight: 600;
                                                    color: #666;
                                                    background: transparent;
                                                    border: 1px solid #ddd;
                                                    padding: 0.25rem 0.5rem;
                                                    cursor: pointer;
                                                    transition: all 0.2s;
                                                }
                                                .table-action-btn:hover {
                                                    background-color: black;
                                                    border-color: black;
                                                    color: white;
                                                }
                                                .table-action-btn:disabled {
                                                    background-color: transparent !important;
                                                    border-color: #eee !important;
                                                    color: #ccc !important;
                                                }
                                            `}</style>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : currentAnnotation.label === 'figure' ? (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#666',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            letterSpacing: '0.02em',
                            opacity: 0.7
                        }}>
                            Verify bounds are accurate!
                        </div>
                    ) : currentAnnotation.label === 'code' ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#f5f5f5',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontSize: '0.9rem',
                            maxHeight: '60vh',
                            overflowY: 'auto'
                        }}>
                            {(() => {
                                const lines = parseCode(currentAnnotation);

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {lines.map((line, idx) => (
                                            <div key={idx} style={{ display: 'flex', borderBottom: '1px solid transparent' }}>
                                                {/* Line Number Gutter */}
                                                <div style={{
                                                    width: '3rem',
                                                    padding: '0.5rem',
                                                    backgroundColor: '#eaeaea',
                                                    color: '#999',
                                                    textAlign: 'right',
                                                    userSelect: 'none',
                                                    borderRight: '1px solid #ddd',
                                                    flexShrink: 0
                                                }}>
                                                    {idx + 1}
                                                </div>

                                                {/* Code Input */}
                                                <textarea
                                                    ref={(el) => {
                                                        codeInputsRef.current[idx] = el;
                                                        if (el) {
                                                            // Initial auto-grow
                                                            el.style.height = 'auto';
                                                            el.style.height = el.scrollHeight + 'px';
                                                        }
                                                    }}
                                                    value={line}
                                                    onChange={(e) => {
                                                        const newLines = [...lines];
                                                        newLines[idx] = e.target.value;
                                                        onUpdateAnnotation(currentAnnotation.id, serializeCode(newLines));
                                                        // Auto-grow
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault(); // Prevent newline in textarea
                                                            const newLines = [...lines];
                                                            newLines.splice(idx + 1, 0, '');
                                                            onUpdateAnnotation(currentAnnotation.id, serializeCode(newLines));
                                                            focusTargetIndex.current = idx + 1;
                                                        } else if (e.key === 'Backspace' && line === '') {
                                                            if (lines.length > 1) {
                                                                e.preventDefault();
                                                                const newLines = [...lines];
                                                                newLines.splice(idx, 1);
                                                                onUpdateAnnotation(currentAnnotation.id, serializeCode(newLines));
                                                                focusTargetIndex.current = Math.max(0, idx - 1);
                                                            }
                                                        } else if (e.key === 'ArrowUp' && idx > 0) {
                                                            e.preventDefault();
                                                            codeInputsRef.current[idx - 1]?.focus();
                                                        } else if (e.key === 'ArrowDown' && idx < lines.length - 1) {
                                                            e.preventDefault();
                                                            codeInputsRef.current[idx + 1]?.focus();
                                                        }
                                                    }}
                                                    placeholder="// code..."
                                                    rows={1}
                                                    style={{
                                                        flex: 1,
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        padding: '0.5rem',
                                                        fontFamily: 'inherit',
                                                        fontSize: 'inherit',
                                                        outline: 'none',
                                                        color: '#333',
                                                        resize: 'none',
                                                        overflow: 'hidden',
                                                        minHeight: '2.5rem',
                                                        lineHeight: '1.5'
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <textarea
                            ref={textAreaRef}
                            value={currentAnnotation.label === 'display_math' ? parseMath(currentAnnotation.content || (currentAnnotation as any).text || '') : (currentAnnotation.content || (currentAnnotation as any).text || '')}
                            onChange={(e) => {
                                if (currentAnnotation.label === 'display_math') {
                                    onUpdateAnnotation(currentAnnotation.id, serializeMath(e.target.value));
                                } else {
                                    handleTextChange(e);
                                }
                            }}
                            placeholder={currentAnnotation.label === 'display_math' ? "LaTeX equation..." : "Data..."}
                            style={{
                                flex: 1,
                                padding: '1rem',
                                border: '1px solid #eee',
                                backgroundColor: '#fff',
                                fontFamily: 'inherit',
                                fontSize: '1rem',
                                resize: 'none',
                                outline: 'none',
                                lineHeight: '1.6'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'black'}
                            onBlur={(e) => e.target.style.borderColor = '#eee'}
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                    handleNext();
                                }
                            }}
                        />
                    )}
                </div>

                {/* Footer Controls */}
                <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                    <button
                        onClick={handlePrev}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            background: 'white',
                            border: '1px solid #ddd',
                            color: '#333',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.8rem'
                        }}
                    >
                        {currentIndex === 0 ? 'BACK' : 'PREV'}
                    </button>
                    <button
                        onClick={handleNext}
                        style={{
                            flex: 2,
                            padding: '1rem',
                            background: 'black',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.8rem'
                        }}
                    >
                        {currentIndex === annotations.length - 1 ? 'FINISH' : 'NEXT'}
                    </button>
                </div>
            </div>

            {/* Right Panel */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#333' }}>
                <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        ...getTransformStyle(),
                        transition: 'transform 0.4s cubic-bezier(0.2, 0, 0, 1)'
                    }}>
                        <Document file={file} loading={null}>
                            <Page
                                pageNumber={currentAnnotation.page}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                onLoadSuccess={onPageLoadSuccess}
                                width={pageDimensions?.width}
                            />
                        </Document>
                        <div style={{
                            position: 'absolute',
                            left: currentAnnotation.x,
                            top: currentAnnotation.y,
                            width: currentAnnotation.width,
                            height: currentAnnotation.height,
                            border: '2px solid #00f',
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
                            pointerEvents: 'none'
                        }} />
                    </div>
                </div>
            </div>
        </div>
    );
};
