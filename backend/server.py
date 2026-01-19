from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import shutil
from pathlib import Path
from extractor.extractor import PDFExtractor
from classifier.classifier import DocumentClassifier

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
# Configuration
DATASET_DIR = Path("dataset")
DATASET_DIR.mkdir(exist_ok=True)
TEMP_DIR = Path("temp_docs")
TEMP_DIR.mkdir(exist_ok=True)

# Initialize modules (extractor used for temp as well now)
# We can create instances on the fly or just use one if output path was param (it isn't).
# So we will create temp instance in route.
# Keep global for if we need it? Maybe not needed globally anymore if we always upload first.
# But let's keep it to avoid breaking other things if any.
extractor = PDFExtractor(dataset_dir=str(DATASET_DIR), preprocess=False)
try:
    classifier = DocumentClassifier()
except Exception as e:
    print(f"Warning: Classifier init failed (likely no API key): {e}")
    classifier = None

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file:
        filename = file.filename
        # Simple doc_id derived from filename (strip extension)
        doc_id = Path(filename).stem
        
        # Use a temporary extractor to output to TEMP_DIR
        temp_extractor = PDFExtractor(dataset_dir=str(TEMP_DIR), preprocess=False)
        
        # Save to temp location first
        temp_pdf_path = Path(filename)
        file.save(temp_pdf_path)
        
        # 1. Extract Images to TEMP_DIR
        try:
            extraction_result = temp_extractor.extract(str(temp_pdf_path), doc_id=doc_id)
            page_files = extraction_result['page_files']
            
            # Clean up temp pdf file
            if temp_pdf_path.exists():
                temp_pdf_path.unlink()
        except Exception as e:
            if temp_pdf_path.exists():
                temp_pdf_path.unlink()
            return jsonify({"error": f"Extraction failed: {str(e)}"}), 500

        # 2. Classify (using first page)
        classification = {"type": "homework", "domain": "math_phys_cs"} # Default
        if classifier and page_files:
            try:
                # Classify using the first extracted image
                cls_result = classifier.classify_images([page_files[0]])
                classification = cls_result
            except Exception as e:
                print(f"Classification failed: {e}")

        # Return paths relative to the doc_dir (now in temp)
        # This allows the frontend to have the correct relative path if it ever needed it,
        # but mainly establishes the payload structure.
        doc_dir = TEMP_DIR / doc_id
        return jsonify({
            "status": "success",
            "document_id": doc_id,
            "pdf_file": filename,
            "num_pages": len(page_files),
            "classification": classification,
            "pages": [{"page_number": i+1, "image_file": str(Path(p).relative_to(doc_dir))} for i, p in enumerate(page_files)]
        })

@app.route('/submit', methods=['POST'])
def submit_annotation():
    data = request.json
    if not data:
        return jsonify({"error": "No JSON data"}), 400
    
    doc_id = data.get('document_id')
    if not doc_id:
        return jsonify({"error": "Missing document_id"}), 400
    
    # 1. Move from Temp to Dataset (Commit)
    temp_path = TEMP_DIR / doc_id
    final_path = DATASET_DIR / doc_id
    
    # If temp exists, move it to final (overwriting if necessary)
    if temp_path.exists():
        if final_path.exists():
            shutil.rmtree(final_path)
        shutil.move(str(temp_path), str(final_path))
    elif not final_path.exists():
        # If neither exists, we have nothing to save
        return jsonify({"error": f"Document data not found for {doc_id}. Please upload again."}), 404
    
    # Path to save JSON
    json_path = final_path / f"{doc_id}.json"
    
    try:
        with open(json_path, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({"status": "success", "message": f"Saved to {json_path}"})
    except Exception as e:
        return jsonify({"error": f"Failed to save JSON: {e}"}), 500

@app.route('/cleanup', methods=['POST'])
def cleanup_temp():
    """
    Deletes the temporary document folder for the given document_id.
    """
    try:
        # Handle both JSON (fetch) and Form/Beacon (sendBeacon)
        # sendBeacon sends as text/plain or explicit blob, Flask might not parse .json auto
        if request.is_json:
            data = request.json
        else:
            # Fallback for sendBeacon if it sends as text/plain or similar
            # force=True might allow parsing if mimetype is wrong but content is json
            data = request.get_json(force=True, silent=True)
            
        if not data:
            return jsonify({"error": "No data"}), 400

        doc_id = data.get('document_id')
        if not doc_id:
            return jsonify({"error": "Missing document_id"}), 400
            
        tgt_dir = TEMP_DIR / doc_id
        if tgt_dir.exists():
            shutil.rmtree(tgt_dir)
            print(f"Cleaned up temp dir: {tgt_dir}")
        else:
            print(f"Cleanup requested but not found: {tgt_dir}")
            
        return jsonify({"status": "cleaned"})
    except Exception as e:
        print(f"Cleanup verification failed: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001, host='0.0.0.0')
