"""
classifier.py

Author: natelgrw
Last Edited: 01/07/2026

Contains the DocumentClassifier class for automated document 
classification using Mistral AI's Pixtral VLM.
"""

import base64
import io
import json
import sys
from typing import Dict, Optional, List
from pathlib import Path
from PIL import Image
from mistralai import Mistral

sys.path.insert(0, str(Path(__file__).parent.parent))

from global_vars import (
    DOCUMENT_TYPES,
    DOMAINS,
    TYPE_DESCRIPTIONS,
    DOMAIN_DESCRIPTIONS,
    CLASSIFICATION_PROMPT_TEMPLATE,
    MISTRAL_API_KEY,
    PIXTRAL_MODEL,
    MAX_IMAGE_SIZE,
    JPEG_QUALITY
)


# ===== Document Classifier ===== #


class DocumentClassifier:
    """
    Classifier for document images using Pixtral VLM.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize document classifier.
        
        Args:
            api_key: Mistral API key. If None, uses environment variable.
        """
        self.api_key = api_key or MISTRAL_API_KEY
        if not self.api_key:
            raise ValueError("Mistral API key not provided")
        
        self.client = Mistral(api_key=self.api_key)
    
    def classify_images(self, image_paths: List[str]) -> Dict[str, str]:
        """
        Classifies a list of document images (analyzes first page only).
        
        Args:
            image_paths: List of paths to image files (PNG, JPEG, etc.)
            
        Returns:
            Dictionary with 'type' and 'domain' keys
        """
        if not image_paths:
            raise ValueError("No image paths provided")
        
        # use first image for classification
        image_path = Path(image_paths[0])
        
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        # load and prepare image
        image = Image.open(image_path)
        
        # resize if too large
        if max(image.size) > MAX_IMAGE_SIZE:
            scale = MAX_IMAGE_SIZE / max(image.size)
            new_size = (int(image.width * scale), int(image.height * scale))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # convert to base64
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG", quality=JPEG_QUALITY)
        base64_image = base64.b64encode(buffered.getvalue()).decode()
        
        # classify using Pixtral
        result = self._classify_with_pixtral(base64_image)
        
        print(f"Classification: type={result['type']}, domain={result['domain']}")
        return result
    
    def _classify_with_pixtral(self, base64_image: str) -> Dict[str, str]:
        """
        Classify document using Pixtral VLM.
        
        Args:
            base64_image: Base64 encoded image string
            
        Returns:
            Dictionary with 'type' and 'domain' keys
        """
        prompt = self._create_prompt()
        
        try:
            response = self.client.chat.complete(
                model=PIXTRAL_MODEL,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": f"data:image/jpeg;base64,{base64_image}"}
                    ]
                }]
            )
            
            response_text = response.choices[0].message.content
            return self._parse_response(response_text)
            
        except Exception as e:
            raise Exception(f"Pixtral API classification failed: {str(e)}")
    
    def _create_prompt(self) -> str:
        """
        Create classification prompt for Pixtral.
        """
        types_list = "\n".join([f"- {t}: {TYPE_DESCRIPTIONS[t]}" for t in DOCUMENT_TYPES])
        domains_list = "\n".join([f"- {d}: {DOMAIN_DESCRIPTIONS[d]}" for d in DOMAINS])
        
        return CLASSIFICATION_PROMPT_TEMPLATE.format(
            types_list=types_list,
            domains_list=domains_list
        )
    
    def _parse_response(self, response_text: str) -> Dict[str, str]:
        """
        Parse Pixtral response and validate.
        """
        try:
            response_text = response_text.strip()
            
            # find JSON in response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON object found in response")
            
            json_str = response_text[start_idx:end_idx]
            result = json.loads(json_str)
            
            # validate fields
            if 'type' not in result or 'domain' not in result:
                raise ValueError("Response missing 'type' or 'domain' field")
            
            # validate values
            if result['type'] not in DOCUMENT_TYPES:
                print(f"Warning: Unknown type '{result['type']}', defaulting to 'homework'")
                result['type'] = 'homework'
            
            if result['domain'] not in DOMAINS:
                print(f"Warning: Unknown domain '{result['domain']}', defaulting to 'math_phys_cs'")
                result['domain'] = 'math_phys_cs'
            
            return {"type": result['type'], "domain": result['domain']}
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {str(e)}\nResponse: {response_text}")
        except Exception as e:
            raise ValueError(f"Failed to parse response: {str(e)}\nResponse: {response_text}")


def characterize_images(image_paths: List[str], api_key: Optional[str] = None) -> Dict[str, str]:
    """
    Convenience function to characterize a list of images.
    
    Args:
        image_paths: List of paths to image files
        api_key: Optional Mistral API key
        
    Returns:
        Dictionary with 'type' and 'domain' keys
    """
    classifier = DocumentClassifier(api_key)
    return classifier.classify_images(image_paths)
