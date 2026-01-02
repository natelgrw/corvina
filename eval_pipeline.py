
import os
import sys
import json
import jiwer
from dotenv import load_dotenv
from ocr_lib import run_vision_ocr, preprocess_image
from pdf2image import convert_from_path

# Load environment variables
load_dotenv()

# Path Configuration
DATASET_DIR = "math_homework_dataset"
PDF_DIR = os.path.join(DATASET_DIR, "pdf_input")
GT_DIR = os.path.join(DATASET_DIR, "md_output")
REPORT_PATH = "eval_report.json"

def evaluate_sample(pdf_path, gt_path):
    """
    Runs OCR on a PDF and compares results with Ground Truth Markdown.
    Returns metrics dict.
    """
    print(f"--- Evaluating: {os.path.basename(pdf_path)} ---")
    
    # 1. Generate OCR Output
    try:
        # Run the full VLM pass from ocr_lib
        ocr_output = run_vision_ocr(pdf_path)
    except Exception as e:
        print(f"Error during OCR for {pdf_path}: {e}")
        return None

    # 2. Load Ground Truth
    with open(gt_path, 'r', encoding='utf-8') as f:
        gt_content = f.read().strip()

    # Normalize for comparison (basic cleanup)
    pred_clean = ocr_output.strip()
    gt_clean = gt_content.strip()

    # 3. Calculate Metrics
    # CER: Character Error Rate
    # WER: Word Error Rate
    try:
        cer = jiwer.cer(gt_clean, pred_clean)
        wer = jiwer.wer(gt_clean, pred_clean)
        
        # Simple string comparison (for exact matches)
        exact_match = (gt_clean == pred_clean)
        
        return {
            "filename": os.path.basename(pdf_path),
            "cer": cer,
            "wer": wer,
            "exact_match": exact_match,
            "prediction": pred_clean,
            "ground_truth": gt_clean
        }
    except Exception as e:
        print(f"Error during metric calculation: {e}")
        return None

def main():
    if not os.path.exists(PDF_DIR) or not os.path.exists(GT_DIR):
        print(f"Directory missing: {PDF_DIR} or {GT_DIR}")
        return

    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]
    results = []

    for pdf_file in sorted(pdf_files):
        base_name = os.path.splitext(pdf_file)[0]
        gt_file = base_name + ".md"
        gt_path = os.path.join(GT_DIR, gt_file)
        pdf_path = os.path.join(PDF_DIR, pdf_file)

        if os.path.exists(gt_path):
            res = evaluate_sample(pdf_path, gt_path)
            if res:
                results.append(res)
        else:
            print(f"No ground truth found for {pdf_file}")

    if not results:
        print("No evaluations completed.")
        return

    # Aggregate Results
    avg_cer = sum(r["cer"] for r in results) / len(results)
    avg_wer = sum(r["wer"] for r in results) / len(results)
    matches = sum(1 for r in results if r["exact_match"])

    summary = {
        "dataset_size": len(results),
        "avg_cer": avg_cer,
        "avg_wer": avg_wer,
        "exact_matches": matches,
        "details": results
    }

    # Save Report
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=4)

    print("\n=== Evaluation Summary ===")
    print(f"Samples Evaluated: {len(results)}")
    print(f"Avg CER: {avg_cer:.4f}")
    print(f"Avg WER: {avg_wer:.4f}")
    print(f"Exact Matches: {matches}/{len(results)}")
    print(f"Report saved to {REPORT_PATH}")

if __name__ == "__main__":
    main()
