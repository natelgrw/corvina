import os
import io
import base64
import re
from PIL import Image, ImageEnhance, ImageFilter
from pdf2image import convert_from_path

try:
    from mistralai import Mistral # New SDK client
except ImportError:
    Mistral = None

import numpy as np
try:
    import cv2
except ImportError:
    cv2 = None

def preprocess_image(image):
    """
    The Enhancer: Prepare image for VLM using OpenCV.
    - Convert to Grayscale
    - Apply Adaptive Thresholding (Illumination Correction)
    - Denoise
    """
    if cv2 is None:
        # Fallback if cv2 missing
        return image.convert('L').filter(ImageFilter.SHARPEN)

    img_np = np.array(image)
    if len(img_np.shape) == 3:
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_np

    # 1. Denoising
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # 2. Illumination Correction / Adaptive Thresholding
    thresh = cv2.adaptiveThreshold(
        blurred, 
        255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 
        15, 
        10
    )
    return Image.fromarray(thresh)

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
    system_prompt = (
        r"You are a LaTeX transcription expert. Transcribe this handwritten math homework into Markdown from left to right by lines." + "\n"
        r"CRITICAL RULES:" + "\n"
        r"1. **Indentation Tags**: EVERY content line MUST start with `{0}` (even if only math)." + "\n"
        r"2. **Headers**: Use `## Problem X` or `## a)`. DO NOT use `###`. DO NOT put tags in front of headers." + "\n"
        r"   - MANDATORY: Letters like a), b), c) MUST be `## a)`, `## b)`, etc. NEVER put them inside `{0}`." + "\n"
        r"   - Note: 1), 2) etc. at the problem level are `## Problem 1`, `## Problem 2`." + "\n"
        r"3. **Math**: Use STRICT LaTeX for all mathematical expressions." + "\n"
        r"   - Logic Symbols: Use `\exists`, `\forall`, `\Rightarrow`, `\in`, `\mathbb{N}`, `\mathbb{R}`, `\square`." + "\n"
        r"   - Shorthand: Use `\g` for `>` and `\l` for `<`." + "\n"
        r"   - Delimiters: Use ONLY single dollar signs $...$ for all math. NEVER use double $$, \[, \], \(, or \)." + "\n"
        r"   - Precision: Capture subscripts ($a_n$), superscripts ($2^n$), and exact symbols ($gcd$, $\pmod$, etc.)." + "\n\n"
        r"FORMAT EXAMPLE:" + "\n"
        r"{0}Math Homework Set 5" + "\n"
        r"## Problem 5" + "\n"
        r"{0}Let $S$ be a set such that $\forall x \in S. x \g 0$." + "\n"
        r"{0}$\exists y \in \mathbb{R}$ such that $y \l x$ is true for $y = \frac{x}{2}$." + "\n"
        r"## a)" + "\n"
        r"{0}Assume $a, b \in \mathbb{N}$ such that $a + b = c$." + "\n"
        r"{0}$a^2 + b^2 = c^2$ holds by Pythagoras." + "\n"
        r"## b)" + "\n"
        r"{0}This implies $P \Rightarrow Q \equiv \text{True} \square$" + "\n"
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
                temperature=0.1 
            )
            content = chat_response.choices[0].message.content
            
            # --- Post-Processing Fixes ---
            # 1. Modulo Fix
            content = content.replace("\\%", "%").replace("%", "\\%")
            
            # 2. Definition Fix: ": =" -> ":=" 
            content = content.replace(": =", ":=")

            # 3. Unicode Math Cleanup (Common handwritten symbols)
            # Use \ensuremath to be safe in both text and math mode
            unicode_map = {
                "∨": r"\ensuremath{\lor}",
                "✓": r"\ensuremath{\checkmark}",
                "≡": r"\ensuremath{\equiv}",
                "≤": r"\ensuremath{\leq}",
                "≥": r"\ensuremath{\geq}",
                "∈": r"\ensuremath{\in}",
                "⇒": r"\ensuremath{\Rightarrow}",
                "∀": r"\ensuremath{\forall}",
                "∃": r"\ensuremath{\exists}",
                "≈": r"\ensuremath{\approx}",
                "≠": r"\ensuremath{\neq}",
                "⋅": r"\ensuremath{\cdot}",
                "×": r"\ensuremath{\times}",
                "⊂": r"\ensuremath{\subset}",
                "⊆": r"\ensuremath{\subseteq}",
                "∪": r"\ensuremath{\cup}",
                "∩": r"\ensuremath{\cap}",
                "<": r"\ensuremath{<}",
                ">": r"\ensuremath{>}"
            }
            for u_char, tex in unicode_map.items():
                if u_char not in ["<", ">"]:
                    content = content.replace(u_char, tex)

            # 3. Post-processing: Strip markdown code fences if present (hallucination)
            if content.strip().startswith("```"):
                lines = content.strip().split('\n')
                if lines[0].startswith("```"): lines = lines[1:]
                if lines and lines[-1].strip() == "```": lines = lines[:-1]
                content = "\n".join(lines)

            # 3b. Fix tagging and mismatched math delimiters
            def fix_delimiters(line):
                # Ensure every content line starts with {0} if it's missing but not a header
                if not line.startswith('#') and not line.strip().startswith('{') and line.strip():
                    line = f"{{0}}{line.strip()}"
                
                # Cleanup headers: ensure no tags leading them
                line = re.sub(r'^\{0\}##', '##', line)
                line = re.sub(r'^\{0\}#', '#', line)
                
                # Force single dollar signs
                line = line.replace(r"\[", "$").replace(r"\]", "$").replace(r"\(", "$").replace(r"\)", "$")
                line = line.replace("$$", "$")
                
                # Wrap math-heavy lines that look like they missed delimiters
                # Heuristic: if a line has \ and no $, wrap body in $
                if '\\' in line and '$' not in line:
                    match = re.match(r'^(\{0\}\s*)(.*)', line)
                    if match:
                        tag, body = match.groups()
                        line = f"{tag}${body.strip()}$"
                
                # Re-balance imbalanced dollars
                total_dollars = line.count('$')
                if total_dollars % 2 != 0:
                    match = re.match(r'^(\{0\}\s*)(.*)', line)
                    if match:
                        tag, body = match.groups()
                        body = body.strip()
                        if body.endswith('$') and not body.startswith('$'):
                            return f"{tag}${body}"
                        if body.startswith('$') and not body.endswith('$'):
                            return f"{tag}{body}$"
                
                return line

            content = "\n".join([fix_delimiters(l) for l in content.split("\n")])

            # 3c. Symbol replacement for safety (Special characters in LaTeX text mode)
            def escape_math_symbols(line):
                # Do NOT escape inside math mode (heuristic: has $)
                if '$' in line:
                    return line
                
                match = re.match(r'^(\{0\}\s*)(.*)', line)
                if not match:
                    tag, body = "", line
                else:
                    tag, body = match.groups()
                
                if body.lstrip().startswith('>') or body.lstrip().startswith('<'):
                    return line # Bullet
                
                # Escape common LaTeX problematic characters in text mode
                body = body.replace("<", r"\ensuremath{<}").replace(">", r"\ensuremath{>}")
                body = body.replace("_", r"\_").replace("^", r"\^{}")
                
                return tag + body

            content = "\n".join([escape_math_symbols(l) for l in content.split("\n")])


            # 4. Header Fixes: prevent ### as requested, convert to ##
            content = re.sub(r'^###\s*', '## ', content, flags=re.MULTILINE)

            # 5. Escape # if it's NOT a structural header recognized by the parser
            def escape_hashes(m):
                line = m.group(0)
                # Preservation Rules:
                # 1. Structural Tags: {0}, {bp_0} etc.
                if re.match(r'^\{\w+\}', line): return line
                # 2. Problem Header: # Problem 1, # 1, ## Problem 1
                if re.match(r'^(#|##)?\s*Problem\s+[a-zA-Z0-9]+', line, re.IGNORECASE): return line
                # 3. Part Header: ## a) or ## 1)
                if re.compile(r'^##\s*([a-z]|[0-9])\)', re.IGNORECASE).match(line): return line
                
                # Everything else containing # should be escaped
                return line.replace("#", "\\#")
                
            content = re.sub(r'^.*#.*$', escape_hashes, content, flags=re.MULTILINE)





            
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

            # --- Force User Requirements:
            # 1. Replace standard bullets '- ' or '* ' with '> '
            # 2. Add extra newlines for detected bullets
            content = content.replace("- ", "> ")
            content = content.replace("* ", "> ")
            content = content.replace("\n> ", "\n\n> ")
            
            full_transcript.append(content)
        except Exception as e:
            print(f"Error processing page {i+1}: {e}")
            full_transcript.append(f"[Error deriving page {i+1}]")
            
    return "\n\n".join(full_transcript)
