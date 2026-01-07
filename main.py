"""
main.py

Author: natelgrw
Last Edited: 01/07/2026

The main pipeline for the TeX Transformer project.
Extracts clean, processed .png images from an input PDF 
scan, and characterizes the document using Pixtral VLM.
"""

import json
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from extractor import PDFExtractor
from classifier import characterize_images


def main():
    """
    Runs the complete TeX Transformer processing pipeline.
    """
    if len(sys.argv) != 2:
        print("Usage: python main.py <pdf_path>")
        sys.exit(1)
    
    pdf_path = Path(sys.argv[1])
    
    # validate PDF path
    if not pdf_path.exists():
        print(f"Error: PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    
    if not pdf_path.suffix.lower() == '.pdf':
        print(f"Error: Must be a PDF file: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    
    try:
        # extract PDF
        extractor = PDFExtractor(dataset_dir="dataset", dpi=200, preprocess=True)
        extraction_result = extractor.extract(str(pdf_path))
        
        doc_id = extraction_result['document_id']
        num_pages = extraction_result['num_pages']
        page_files = extraction_result['page_files']
        
        # characterize document
        classification = characterize_images(page_files)
        
        # create page list with relative paths
        doc_dir = Path(extraction_result['pdf_path']).parent
        pages = []
        for i, page_file in enumerate(page_files):
            relative_path = Path(page_file).relative_to(doc_dir)
            pages.append({
                'page_number': i + 1,
                'image_file': str(relative_path)
            })
        
        # create output JSON
        output_data = {
            'document_id': doc_id,
            'pdf_file': Path(extraction_result['pdf_path']).name,
            'num_pages': num_pages,
            'classification': classification,
            'pages': pages
        }
        
        # save JSON
        json_file = doc_dir / f"{doc_id}.json"
        with json_file.open('w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"{doc_id}: {classification['type']} / {classification['domain']}")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
