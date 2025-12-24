
import argparse
import os
import sys
import json
from dotenv import load_dotenv
from ocr_lib import run_vision_ocr
from homework_parser import HomeworkParser
from latex_generator import LaTeXGenerator

# Load env vars from .env file if present
load_dotenv()

def main():
    parser = argparse.ArgumentParser(description="Tex Transformer: Handwritten Math to PDF Pipeline")
    parser.add_argument("input_pdf", help="Path to the input PDF file")
    parser.add_argument("--api-key", help="Mistral API Key (optional if MISTRAL_API_KEY env var is set)")
    parser.add_argument("--output", help="Base path for output files (optional)")
    parser.add_argument("--skip-ocr", action="store_true", help="Skip OCR if Markdown exists")
    args = parser.parse_args()
    
    input_path = args.input_pdf
    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
        
    # Determine base output path (without extension)
    if args.output:
        base_output_path = os.path.splitext(args.output)[0]
    else:
        results_dir = "results"
        if not os.path.exists(results_dir):
            os.makedirs(results_dir)
        basename = os.path.splitext(os.path.basename(input_path))[0]
        base_output_path = os.path.join(results_dir, basename)
        
    md_path = f"{base_output_path}.md"
    json_path = f"{base_output_path}.json"
    pdf_path = f"{base_output_path}.pdf"
    
    print(f"=== Tex Transformer Pipeline ===")
    print(f"Input: {input_path}")
    print(f"Output Base: {base_output_path}")
    
    try:
        # --- Step 1: VLM OCR (The Transcriber) ---
        markdown_content = ""
        if args.skip_ocr and os.path.exists(md_path):
            print(f"\n[Step 1] Skipping OCR (Using existing {md_path})...")
            with open(md_path, 'r', encoding='utf-8') as f:
                markdown_content = f.read()
        else:
            print(f"\n[Step 1] Running Vision-OCR...")
            markdown_content = run_vision_ocr(input_path, api_key=args.api_key)
            # Save Raw Markdown
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(markdown_content)
            print(f"-> Saved Semantic Draft: {md_path}")
            
        # --- Step 2: Parsing (The Parser) ---
        print(f"\n[Step 2] Parsing Structure...")
        hw_parser = HomeworkParser()
        hw_parser.parse(markdown_content)
        json_data = json.loads(hw_parser.to_json()) # Get dict back
        
        # Save JSON
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=4)
        print(f"-> Saved Structured Data: {json_path}")
        
        # --- Step 3: Generation (The Generator) ---
        print(f"\n[Step 3] Generating PDF...")
        generator = LaTeXGenerator()
        result_msg = generator.compile_pdf(json_data, pdf_path)
        print(f"-> {result_msg}")
        
        if "Success" in result_msg:
             print(f"\n=== Pipeline Completed Successfully ===")
             print(f"Final PDF: {pdf_path}")
        elif "pdflatex not found" in result_msg:
             print(f"\n=== Pipeline Completed (Partial) ===")
             print(f"Compiler missing. LaTeX source saved to: {pdf_path.replace('.pdf', '.tex')}")
        else:
             print(f"\n=== Pipeline Failed at Generation ===")
             
    except Exception as e:
        print(f"\nError occurred: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
