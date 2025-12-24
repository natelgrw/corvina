import os
import io
import base64
from PIL import Image, ImageEnhance, ImageFilter
from pdf2image import convert_from_path

try:
    from mistralai import Mistral # New SDK client
except ImportError:
    Mistral = None

def preprocess_image(image):
    """
    The Enhancer: Prepare image for VLM.
    - Convert to Grayscale (L)
    - Apply Sharpening to distinguish characters
    """
    # 1. Grayscale
    image = image.convert('L')
    
    # 2. Sharpening
    # Applying unsharp mask or standard sharpen filter
    image = image.filter(ImageFilter.SHARPEN)
    
    # Optional: Contrast enhancement if needed, but simple sharpening is requested
    # enhancer = ImageEnhance.Contrast(image)
    # image = enhancer.enhance(1.5)
    
    return image

def pdf_to_processed_images(pdf_path, dpi=300):
    """
    Convert PDF to 300 DPI images and preprocess them.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
        
    print(f"Converting PDF {pdf_path} to images at {dpi} DPI...")
    raw_images = convert_from_path(pdf_path, dpi=dpi)
    
    processed_images = []
    for img in raw_images:
        processed_images.append(preprocess_image(img))
        
    return processed_images

def run_vision_ocr(pdf_path, api_key=None):
    """
    The Transcriber: Run Vision-Language Model on processed images.
    """
    if not api_key:
        api_key = os.environ.get("MISTRAL_API_KEY")
    
    if not api_key:
        raise ValueError("Mistral API Key required for VLM OCR. Set MISTRAL_API_KEY env var.")
        
    if not Mistral:
        raise ImportError("mistralai library not installed.")

    client = Mistral(api_key=api_key)
    
    # Get processed images
    images = pdf_to_processed_images(pdf_path)
    
    full_transcript = []
    
    # System Instruction for the VLM
    # Note: Mistral chat models take 'system' role or just instruction in user prompt.
    # We will prepend it to the user message for clarity or use system role if supported well.
    system_prompt = (
        "Transcribe this handwritten math homework. "
        "Strictly follow this format:\n"
        "- Use '# Problem X' for detected problems.\n"
        "- Use '## a)', '## b)' for detected problem parts. CRITICAL: The content MUST start on a separate line below the header. (e.g. '## a)\\nProof...').\n"
        "- Use '### i)', '### ii)' for detected subparts. CRITICAL: The content MUST start on a separate line below the header.\n"
        "- STRICTLY convert ALL unicode/handwritten math symbols into valid LaTeX commands (e.g. convert 'ℕ' to '\\mathbb{N}', '∈' to '\\in', '≤' to '\\leq'). NEVER output raw unicode math characters.\n"
        "- BULLET POINTS: Transcribe the EXACT symbol seen in the image (e.g. '>', '->', '*'). Do NOT normalize it to '-'. If you see an arrowhead '>', output '> '.\n"
        "- SPACING: You MUST insert TWO (2) empty lines between every single bullet point item.\n"
        "- If NO bullet points are visible, do NOT hallucinate them. Just write the text normally.\n"
        "- Wrap all mathematical expressions in LaTeX $ or $$ delimiters.\n"
        "- Do NOT use markdown code fences (```). Output raw markdown.\n\n"
        "EXAMPLE:\n"
        "Input Image shows:\n"
        "> First step\n"
        "> Second step\n\n"
        "Your Output MUST be:\n"
        "> First step\n\n\n"
        "> Second step"
    )

    for i, img in enumerate(images):
        print(f"Processing page {i+1} with Pixtral VLM...")
        
        # Encode image
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Construct Message
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": system_prompt},
                    {"type": "image_url", "image_url": f"data:image/jpeg;base64,{img_base64}"}
                ]
            }
        ]
        
        try:
            chat_response = client.chat.complete(
                model="pixtral-12b-2409", 
                messages=messages,
                temperature=0.1 # Low temp for factual transcription
            )
            content = chat_response.choices[0].message.content
            
            # Post-process: Strip markdown code fences if present
            if content.startswith("```"):
                lines = content.split('\n')
                # Remove first line if it's ```markdown or ```
                if lines[0].startswith("```"):
                    lines = lines[1:]
                # Remove last line if it's ```
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                content = "\n".join(lines)

            # FORCE User Requirements:
            # 1. Replace standard bullets '- ' or '* ' with '> '
            # 2. Add extra newlines for detected bullets
            import re
            # Regex lookbehinds/aheads to find list items at start of line
            # Pattern: newline followed by - or * and space
            # We want to replace it with "\n\n\n> " to ensure the gap
            # Note: This is an aggressive replacement to satisfy the strict requirement.
            content = re.sub(r'(^|\n)([-*])\s+', r'\1\n\n> ', content)
            
            # FORCE Newline after Headers (e.g. "## a) Proof" -> "## a)\nProof")
            # Pattern: (##... ) (text) -> \1\n\2
            content = re.sub(r'^(#+\s+[a-zA-Z0-9]+\))\s+(.+)', r'\1\n\2', content, flags=re.MULTILINE)

            full_transcript.append(content)
        except Exception as e:
            print(f"Error processing page {i+1}: {e}")
            full_transcript.append(f"[Error deriving page {i+1}]")
            
    return "\n\n".join(full_transcript)
