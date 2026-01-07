"""
extractor.py

Author: natelgrw
Last Edited: 01/07/2026

Contains the PDFExtractor class for extracting .png images from input PDFs.
"""

import shutil
from pathlib import Path
from typing import Dict, Optional
from pdf2image import convert_from_path

from .preprocessing import preprocess_image


# ===== PDFExtractor Class ===== #


class PDFExtractor:
    """
    Extracts .png images from input PDFs and saves to dataset directory.
    """
    
    def __init__(self, dataset_dir: str = "dataset", dpi: int = 300, preprocess: bool = True):
        """
        Initialize a PDFExtractor instance.
        
        Args:
            dataset_dir: Base dataset directory
            dpi: DPI for PDF conversion
            preprocess: Whether to apply preprocessing
        """
        self.dataset_dir = Path(dataset_dir)
        self.dpi = dpi
        self.preprocess = preprocess
        self.dataset_dir.mkdir(parents=True, exist_ok=True)
    
    def extract(self, pdf_path: str, doc_id: Optional[str] = None) -> Dict:
        """
        Extract .png images from input PDF and save to dataset directory.
        
        Args:
            pdf_path: Path to PDF file
            doc_id: Custom document ID (defaults to PDF filename)
            
        Returns:
            Dictionary with extraction info
        """
        pdf_path = Path(pdf_path)
        
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        
        # use filename as doc_id if not provided
        if doc_id is None:
            doc_id = pdf_path.stem
        
        # create document directory
        doc_dir = self.dataset_dir / doc_id
        images_dir = doc_dir / "images"
        
        # remove if exists
        if doc_dir.exists():
            shutil.rmtree(doc_dir)
        
        doc_dir.mkdir(parents=True, exist_ok=True)
        images_dir.mkdir(parents=True, exist_ok=True)
        
        # copy original PDF
        pdf_copy = doc_dir / pdf_path.name
        shutil.copy2(pdf_path, pdf_copy)
        
        print(f"Extracting: {pdf_path.name}")
        print(f"Document ID: {doc_id}")
        print(f"Output: {doc_dir}")

        # convert PDF to images
        images = convert_from_path(str(pdf_path), dpi=self.dpi)
        page_files = []
        
        for idx, image in enumerate(images, start=1):
            # preprocess if enabled
            if self.preprocess:
                image = preprocess_image(image)
            
            # save as PNG
            page_file = images_dir / f"page{idx}.png"
            image.save(page_file, format='PNG', optimize=True)
            page_files.append(str(page_file))
        
        print(f"Extracted {len(images)} pages\n")
        
        return {
            'document_id': doc_id,
            'pdf_path': str(pdf_copy),
            'images_dir': str(images_dir),
            'num_pages': len(images),
            'page_files': page_files
        }
