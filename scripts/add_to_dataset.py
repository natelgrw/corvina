import os
import sys
import argparse
import shutil
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ocr_lib import run_vision_ocr

# Configuration
DATASET_DIR = "math_homework_dataset"
PDF_DIR = os.path.join(DATASET_DIR, "pdf_input")
GT_DIR = os.path.join(DATASET_DIR, "md_output")

load_dotenv()

def main():
    parser = argparse.ArgumentParser(description="Add a new sample to the Homework Dataset")
    parser.add_argument("pdf_path", help="Path to the new handwritten PDF")
    parser.add_argument("--name", help="Custom name for the sample (defaults to base filename)")
    args = parser.parse_args()

    if not os.path.exists(args.pdf_path):
        print(f"Error: File {args.pdf_path} not found.")
        return

    name = args.name if args.name else os.path.splitext(os.path.basename(args.pdf_path))[0]
    
    target_pdf = os.path.join(PDF_DIR, f"{name}.pdf")
    target_md = os.path.join(GT_DIR, f"{name}.md")

    print(f"--- Adding '{name}' to Dataset ---")

    # 1. Copy PDF
    os.makedirs(PDF_DIR, exist_ok=True)
    shutil.copy2(args.pdf_path, target_pdf)
    print(f"1. Copied PDF to {target_pdf}")

    # 2. Run OCR to get a Draft
    try:
        print(f"2. Generating OCR draft for {name}...")
        draft = run_vision_ocr(args.pdf_path)
        
        os.makedirs(GT_DIR, exist_ok=True)
        with open(target_md, "w", encoding="utf-8") as f:
            f.write(draft)
        
        print(f"3. Draft saved to {target_md}")
        print("\nSUCCESS! New sample added.")
        print("Please review and edit the Markdown file to create Ground Truth.")

    except Exception as e:
        print(f"Failed to generate draft: {e}")

if __name__ == "__main__":
    main()
