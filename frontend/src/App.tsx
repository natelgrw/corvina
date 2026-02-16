import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FileUpload } from './components/FileUpload';
import { ImageViewer } from './components/ImageViewer';
import { AnnotationSidebar } from './components/AnnotationSidebar';
import { TranscriptionView } from './components/TranscriptionView';
import { TranscriptionSidebar } from './components/TranscriptionSidebar';

import { LoadingScreen } from './components/LoadingScreen';
import { TechModal } from './components/TechModal';
import { SuccessToast } from './components/SuccessToast';
import type { Annotation } from './types';


function App() {
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // New Metadata State
  const [drawingType, setDrawingType] = useState('handwritten');
  const [source, setSource] = useState('notebook');

  // Tool State
  const [toolMode, setToolMode] = useState<'box' | 'line' | 'node' | 'connection'>('box');

  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);

  // Phase State ('annotation' -> 'transcription')
  const [phase, setPhase] = useState<'annotation' | 'transcription'>('annotation');
  const [isDrawingText, setIsDrawingText] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [transcriptionIndex, setTranscriptionIndex] = useState(0);
  const [linkingTextId, setLinkingTextId] = useState<string | null>(null);

  // Backend State
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<any[]>([]);



  // Modal State
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    type: 'confirm' | 'alert';
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  // Success Toast State
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const closeModal = useCallback(() => setModal(prev => ({ ...prev, isOpen: false })), []);

  // When adding, we expect the annotation to already have x, y, width, height, AND page.
  // We only add the ID and Label here.
  const handleAddAnnotation = useCallback((rect: Omit<Annotation, 'id' | 'label'>) => {
    // If it's a line, default label to 'connection' to bypass validation
    const type = (rect as any).type;
    let label = '';
    if (type === 'line' || type === 'connection') label = 'connection';
    if (type === 'node') label = 'node';

    const newAnnotation: Annotation = {
      id: uuidv4(),
      label,
      ...rect
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  }, []);

  const handleUpdateAnnotation = useCallback((id: string, label: string) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, label } : ann));
  }, []);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => {
      // 1. Remove the item itself
      const nextAnnotations = prev.filter(ann => ann.id !== id);

      // 2. Remove any connections attached to it
      return nextAnnotations.filter(ann => {
        if (ann.type === 'connection') {
          return ann.sourceId !== id && ann.targetId !== id;
        }
        return true;
      });
    });
  }, []);

  const handleMoveAnnotation = useCallback((fromIndex: number, toIndex: number) => {
    setAnnotations(prev => {
      const newArr = [...prev];
      if (toIndex < 0 || toIndex >= newArr.length || fromIndex === toIndex) return prev;

      const [movedItem] = newArr.splice(fromIndex, 1);
      newArr.splice(toIndex, 0, movedItem);

      return newArr;
    });
  }, []);

  const handleResizeAnnotation = useCallback((id: string, rect: { x: number, y: number, width: number, height: number }) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, ...rect } : ann));
  }, []);





  const handleFinalSubmit = () => {
    // Phase check handled in Transcription Flow
    setModal({
      isOpen: true,
      title: "CONFIRM SUBMISSION",
      message: "Are you sure you want to submit this annotated dataset?",
      type: 'confirm',
      confirmText: "SUBMIT ALL",
      onConfirm: executeSubmit
    });
  };

  // -- Backend Handlers --

  const handleFileUpload = async (file: File) => {

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    // Enforce minimum 3s loading time
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const [response] = await Promise.all([
        fetch('http://localhost:5001/upload', {
          method: 'POST',
          body: formData,
        }),
        minLoadTime
      ]);
      const data = await response.json();

      if (data.status === 'success') {
        setDocumentId(data.document_id);
        // Default values for new schema
        setDrawingType('handwritten');
        setSource('notebook');
        setPageImages(data.pages); // Store image info
        setPageImages(data.pages); // Store image info
        setImgFile(file); // Load viewer
        setAnnotations([]); // Clear annotations
        setPhase('annotation'); // Reset phase
      } else {
        alert(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to connect to backend server. Make sure server.py is running on port 5001.");
    } finally {
      setIsLoading(false);
    }
  };

  const executeSubmit = async () => {
    closeModal(); // Close confirmation popup immediately
    if (!documentId) return;

    setIsSubmitting(true);

    // Construct Payload
    const payload = {
      document_id: documentId,
      pdf_file: imgFile?.name || `${documentId}.png`,
      num_pages: pageImages.length,
      classification: {
        drawing_type: drawingType,
        source: source
      },
      annotations: annotations.map((a, idx) => ({
        id: a.id,
        order: idx + 1,
        type: a.type,
        label: a.label,
        // For box (component)
        bbox: a.type === 'box' || a.type === 'text' ? [Math.round(a.x), Math.round(a.y), Math.round(a.x + a.width), Math.round(a.y + a.height)] : undefined,
        // For node
        position: a.type === 'node' ? [Math.round(a.x + a.width / 2), Math.round(a.y + a.height / 2)] : undefined,
        // For line (legacy)
        points: a.type === 'line' ? a.points : undefined,
        // Connections
        source_id: a.sourceId,
        target_id: a.targetId,
        // Transcription (text annotations)
        raw_text: a.rawText,
        is_ignored: a.isIgnored || false,
        linked_annotation_id: a.linkedAnnotationId,
        label_name: a.type === 'text' ? (a.label && a.label.trim() ? a.label.trim() : undefined) : undefined,
        values: a.values?.map(v => ({
          value: v.value,
          unit_prefix: v.unitPrefix,
          unit_suffix: v.unitSuffix
        })),
        transcription_box: a.transcriptionBox ? [Math.round(a.transcriptionBox.x), Math.round(a.transcriptionBox.y), Math.round(a.transcriptionBox.width), Math.round(a.transcriptionBox.height)] : undefined
      }))
    };

    try {
      const response = await fetch('http://localhost:5001/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.status === 'success') {
        // Trigger Success Toast
        setShowSuccessToast(true);

        // Reset to Home
        setImgFile(null);
        setAnnotations([]);
        setDrawingType('handwritten');
        setSource('notebook');
        setDocumentId(null);
        setPageImages([]);
        setPhase('annotation');
      } else {
        alert(`Save failed: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to submit data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!documentId) {
      alert("No document loaded.");
      return;
    }

    // 1. Validation: Check for unlabeled boxes
    const unlabeled = annotations.filter(a => !a.label || a.label.trim() === '');
    if (unlabeled.length > 0) {
      // ... (existing validation logic)
      const count = unlabeled.length;
      const noun = count === 1 ? "annotation" : "annotations";
      const verb = count === 1 ? "is" : "are";

      setModal({
        isOpen: true,
        title: "MISSING LABELS",
        message: (
          <span>
            Cannot proceed. <strong>{count} {noun}</strong> {verb} missing labels.
            <br /><br />
            Please select a label for all items before proceeding.
          </span>
        ),
        type: 'alert',
        confirmText: 'GO BACK'
      });
      return;
    }

    // 2. Transition to Transcription Phase
    setPhase('transcription');
  };





  return (
    <div style={{ padding: '2rem', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

      {/* Mist Background */}
      <div className="mist-container">
        <div className="mist-blob orange-1" />
        <div className="mist-blob purple-1" />
        <div className="mist-blob orange-2" />
        <div className="mist-blob purple-2" />
        <div className="mist-blob green-1" />
      </div>

      {isLoading && <LoadingScreen />}

      <header style={{
        marginBottom: '1.5rem',
        borderBottom: '1px solid #eee',
        paddingBottom: '0.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '1.35rem', letterSpacing: '-0.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" width="20" height="20">
            <line x1="16" y1="2" x2="16" y2="10" stroke="#111" strokeWidth="2" strokeLinecap="round" />
            <line x1="22" y1="16" x2="30" y2="16" stroke="#111" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="22" x2="16" y2="30" stroke="#111" strokeWidth="2" strokeLinecap="round" />
            <line x1="2" y1="16" x2="10" y2="16" stroke="#111" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16" cy="16" r="2.5" fill="#111" />
          </svg>
          CORVINA
        </h1>
        {imgFile && (
          <button
            onClick={() => {
              setImgFile(null);
              setAnnotations([]);
              setDrawingType('handwritten');
              setSource('notebook');
              setDocumentId(null);
              setPageImages([]);
              setPhase('annotation');
            }}
            className="close-btn"
          >
            Close File
          </button>
        )}
      </header>

      <main style={{ flex: imgFile ? 1 : 'unset', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!imgFile ? (
          <div style={{ maxWidth: '520px', margin: '6rem auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: '#333' }}>CRCUIT ANNOTATION PIPELINE</h2>
            <p style={{ lineHeight: '1.7', color: '#888', fontSize: '0.9rem', marginBottom: '2rem' }}>
              Upload an image to begin annotating.
            </p>
            <FileUpload onFileSelect={handleFileUpload} />
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: phase === 'transcription' ? '1fr 1fr' : '350px 1fr',
            gap: '1rem',
            height: '100%',
            overflow: phase === 'transcription' ? 'visible' : 'hidden',
            background: 'transparent',
            borderRadius: phase === 'transcription' ? '0' : '12px',
            padding: '1rem',
            boxShadow: 'none'
          }}>
            {/* Left Sidebar */}
            <div style={{ height: '100%', overflow: 'hidden' }}>
              {phase === 'annotation' ? (
                <AnnotationSidebar
                  annotations={annotations}
                  isDrawing={isDrawing}
                  toolMode={toolMode}
                  setToolMode={setToolMode}
                  onToggleDrawing={() => setIsDrawing(!isDrawing)}
                  onUpdateAnnotation={handleUpdateAnnotation}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  onMoveAnnotation={handleMoveAnnotation}
                  hoveredId={hoveredAnnotationId}
                  onHoverAnnotation={setHoveredAnnotationId}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  actionLabel="CONTINUE"
                />
              ) : (
                <TranscriptionSidebar
                  annotations={annotations}
                  onUpdateAnnotation={(id, updates) => {
                    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
                  }}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  onFinish={handleFinalSubmit}
                  hoveredId={hoveredAnnotationId}
                  onHoverId={setHoveredAnnotationId}
                  isDrawing={isDrawingText}
                  onToggleDrawing={() => setIsDrawingText(!isDrawingText)}
                  linkingTextId={linkingTextId}
                  setLinkingTextId={setLinkingTextId}
                  onBack={() => setPhase('annotation')}
                />
              )}
            </div>

            {/* Right Image Viewer */}
            <div style={{ height: '100%', overflow: 'hidden' }}>
              {phase === 'annotation' ? (
                <ImageViewer
                  key={documentId}
                  file={imgFile!}
                  annotations={annotations}
                  isDrawing={isDrawing}
                  toolMode={toolMode}
                  onAddAnnotation={handleAddAnnotation}
                  onResizeAnnotation={handleResizeAnnotation}
                  onFinishDrawing={() => setIsDrawing(false)}
                  drawingType={drawingType}
                  setDrawingType={setDrawingType}
                  source={source}
                  setSource={setSource}
                  hoveredId={hoveredAnnotationId}
                  onHoverAnnotation={setHoveredAnnotationId}
                />
              ) : (
                <TranscriptionView
                  file={imgFile!}
                  annotations={annotations}
                  onAddTextAnnotation={(rect) => handleAddAnnotation({ ...rect, type: 'text', page: 1 })}
                  onResizeAnnotation={handleResizeAnnotation}
                  hoveredId={hoveredAnnotationId}
                  onHoverId={setHoveredAnnotationId}
                  isDrawing={isDrawingText}
                  onFinishDrawing={() => setIsDrawingText(false)}
                  linkingTextId={linkingTextId}
                  onLinkAnnotation={(textId, targetId) => {
                    setAnnotations(prev => prev.map(a => a.id === textId ? { ...a, linkedAnnotationId: targetId } : a));
                    setLinkingTextId(null);
                  }}
                />
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={{ marginTop: !imgFile ? '4rem' : '2rem', paddingBottom: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#bbb', letterSpacing: '0.1em', fontWeight: 500 }}>
        DATA IN. INTELLIGENCE OUT.
      </footer>


      <TechModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        confirmText={modal.confirmText || "YES, SUBMIT"}
        cancelText={modal.cancelText || "GO BACK"}
      />

      <SuccessToast
        isVisible={showSuccessToast}
        message="Circuit annotation saved!"
        onClose={() => setShowSuccessToast(false)}
      />
    </div >
  );
}

export default App;
