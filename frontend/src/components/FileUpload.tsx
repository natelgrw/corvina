import React, { useCallback, useState } from 'react';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'image/png') {
                onFileSelect(file);
            } else {
                alert('Please upload a PNG file.');
            }
        }
    }, [onFileSelect]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    }, [onFileSelect]);

    return (
        <div
            className={`tech-border flex-center`}
            style={{
                width: '100%',
                minHeight: '260px',
                backgroundColor: isDragging ? 'rgba(168, 85, 247, 0.04)' : 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                flexDirection: 'column',
                gap: '0.75rem',
                marginTop: '1.5rem',
                backdropFilter: 'blur(8px)',
                borderColor: isDragging ? 'var(--color-purple)' : undefined,
                transition: 'all 0.3s ease'
            }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
        >
            <input
                type="file"
                id="file-input"
                accept="image/png"
                style={{ display: 'none' }}
                onChange={handleChange}
            />
            <div style={{ fontSize: '1.75rem', color: '#ccc', marginBottom: '0.5rem' }}>+</div>
            <p style={{ letterSpacing: '0.06em', fontSize: '0.8rem', color: '#999', fontWeight: 500 }}>
                {isDragging ? 'Drop PNG here' : 'Drag PNG or click to upload'}
            </p>
        </div>
    );
};
