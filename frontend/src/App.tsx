import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FileUpload } from './components/FileUpload';
import { PdfViewer } from './components/PdfViewer';
import { AnnotationSidebar } from './components/AnnotationSidebar';
import { LoadingScreen } from './components/LoadingScreen';
import { TechModal } from './components/TechModal';
import { SuccessToast } from './components/SuccessToast';
import type { Annotation } from './types';

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [docType, setDocType] = useState('homework');
  const [docDomain, setDocDomain] = useState('math_phys_cs');
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);

  // Backend State
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<any[]>([]);

  // Cleanup helper
  const cleanupSession = useCallback((id: string) => {
    if (!id) return;
    try {
      // Use sendBeacon for reliability during unload
      const blob = new Blob([JSON.stringify({ document_id: id })], { type: 'application/json' });
      navigator.sendBeacon('http://localhost:5001/cleanup', blob);
    } catch (e) {
      console.error("Cleanup failed", e);
    }
  }, []);

  // Handle browser close / refresh
  React.useEffect(() => {
    const handleUnload = () => {
      if (documentId) {
        cleanupSession(documentId);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [documentId, cleanupSession]);

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
    const newAnnotation: Annotation = {
      id: uuidv4(),
      label: '', // Default empty label
      ...rect
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  }, []);

  const handleUpdateAnnotation = useCallback((id: string, label: string) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, label } : ann));
  }, []);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
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

  // -- Backend Handlers --

  const handleFileUpload = async (file: File) => {

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5001/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (data.status === 'success') {
        setDocumentId(data.document_id);
        setDocType(data.classification.type);
        setDocDomain(data.classification.domain);
        setPageImages(data.pages); // Store image info
        setPdfFile(file); // Load viewer
        setAnnotations([]); // Clear annotations
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
      pdf_file: pdfFile?.name || `${documentId}.pdf`,
      num_pages: pageImages.length,
      classification: {
        type: docType,
        domain: docDomain
      },
      pages: pageImages.map((pg) => ({
        page_number: pg.page_number,
        image_file: pg.image_file,
        bounding_boxes: annotations
          .filter(a => a.page === pg.page_number)
          .map((a, idx) => ({
            id: a.id,
            order: idx + 1,
            bbox: [Math.round(a.x), Math.round(a.y), Math.round(a.x + a.width), Math.round(a.y + a.height)],
            type: a.label || 'heading' // default to heading if empty
          }))
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
        setPdfFile(null);
        setAnnotations([]);
        setDocType('homework');
        setDocDomain('math_phys_cs');
        setDocumentId(null);
        setPageImages([]);
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
      const count = unlabeled.length;
      const noun = count === 1 ? "bounding box" : "bounding boxes";
      const verb = count === 1 ? "is" : "are";

      setModal({
        isOpen: true,
        title: "MISSING LABELS",
        message: (
          <span>
            Cannot submit. <strong>{count} {noun}</strong> {verb} missing labels.
            <br /><br />
            Please select a type for all boxes before proceeding.
          </span>
        ),
        type: 'alert',
        confirmText: 'GO BACK'
      });
      return;
    }

    // 2. Confirmation
    setModal({
      isOpen: true,
      title: "CONFIRM SUBMISSION",
      message: "Are you sure you want to submit this annotated document? Make sure all classifications, bounding boxes, and descriptions are accurate.",
      type: 'confirm',
      onConfirm: executeSubmit
    });
  };

  return (
    <div className="container" style={{ padding: '2rem', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {isLoading && <LoadingScreen />}

      <header style={{
        marginBottom: '1rem',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '0.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '1.5rem', letterSpacing: '-0.5px' }}>
          <span style={{ fontWeight: 600 }}>TeX Transformer</span>
        </h1>
        {pdfFile && (
          <button
            onClick={() => {
              if (documentId) {
                // Explicit fetch for button click (better valid response handling than beacon)
                fetch('http://localhost:5001/cleanup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ document_id: documentId })
                }).catch(console.error);
              }
              setPdfFile(null);
              setAnnotations([]);
              setDocType('homework');
              setDocDomain('math_phys_cs');
              setDocumentId(null);
              setPageImages([]);
            }}
            className="close-btn"
          >
            CLOSE FILE
          </button>
        )}
      </header>

      <main style={{ flex: pdfFile ? 1 : 'unset', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!pdfFile ? (
          <div style={{ maxWidth: '600px', margin: '4rem auto' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>DATA ANNOTATION PIPELINE</h2>
            <p style={{ lineHeight: '1.6', opacity: 0.8 }}>
              Upload a PDF document to begin analysis and visualization.
              System supports single and multi-page documents.
            </p>
            <FileUpload onFileSelect={handleFileUpload} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', height: '100%', overflow: 'hidden' }}>
            {/* Left Sidebar */}
            <div style={{ height: '100%', overflow: 'hidden' }}>
              <AnnotationSidebar
                annotations={annotations}
                isDrawing={isDrawing}
                onToggleDrawing={() => setIsDrawing(!isDrawing)}
                onUpdateAnnotation={handleUpdateAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
                onMoveAnnotation={handleMoveAnnotation}
                hoveredId={hoveredAnnotationId}
                onHoverAnnotation={setHoveredAnnotationId}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            </div>

            {/* Right PDF Viewer */}
            <div style={{ height: '100%', overflow: 'hidden' }}>
              <PdfViewer
                file={pdfFile}
                annotations={annotations}
                isDrawing={isDrawing}
                onAddAnnotation={handleAddAnnotation}
                onResizeAnnotation={handleResizeAnnotation}
                onFinishDrawing={() => setIsDrawing(false)}
                docType={docType}
                setDocType={setDocType}
                docDomain={docDomain}
                setDocDomain={setDocDomain}
                hoveredId={hoveredAnnotationId}
                onHoverAnnotation={setHoveredAnnotationId}
              />
            </div>
          </div>
        )}
      </main>

      <footer style={{ marginTop: !pdfFile ? '8rem' : '2rem', textAlign: 'center', fontSize: '0.85rem', opacity: 0.4 }}>
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
        message="Document annotation submitted! Thank you."
        onClose={() => setShowSuccessToast(false)}
      />
    </div >
  );
}

export default App;
