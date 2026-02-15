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
                minHeight: '300px',
                borderStyle: 'dashed',
                backgroundColor: isDragging ? '#fafafa' : 'transparent',
                cursor: 'pointer',
                flexDirection: 'column',
                gap: '1rem',
                marginTop: '2rem'
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
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>+</div>
            <p style={{ letterSpacing: '1px' }}>
                {isDragging ? 'DROP PNG HERE' : 'DRAG PNG OR CLICK TO UPLOAD'}
            </p>
        </div>
    );
};
