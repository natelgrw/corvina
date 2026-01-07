"""
preprocessing.py

Author: natelgrw
Last Edited: 01/07/2026

Image preprocessing functions for enhancing scanned document quality.
"""

import cv2
import numpy as np
from PIL import Image


# ===== Functions ===== #


def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Preprocess scanned document to remove artifacts and enhance clarity.
    
    Applies background normalization, bilateral filtering, adaptive thresholding,
    morphological operations, unsharp masking, and contrast enhancement.
    
    Args:
        image: PIL Image to preprocess
        
    Returns:
        Cleaned and sharpened PIL Image
    """
    img_array = np.array(image)
    
    if len(img_array.shape) == 3:
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_array.copy()
    
    # background normalization
    kernel_large = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (51, 51))
    background = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel_large)
    normalized = cv2.divide(gray, background, scale=255)
    
    # bilateral filter
    smooth = cv2.bilateralFilter(normalized, d=9, sigmaColor=75, sigmaSpace=75)
    
    # adaptive thresholding
    adaptive = cv2.adaptiveThreshold(
        smooth,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=15,
        C=10
    )
    
    # removing noise
    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    cleaned = cv2.morphologyEx(adaptive, cv2.MORPH_OPEN, kernel_small, iterations=1)
    
    # dilate slightly to thicken text
    kernel_dilate = np.ones((1, 1), np.uint8)
    thickened = cv2.dilate(cleaned, kernel_dilate, iterations=1)
    
    # unsharp masking for sharpening
    blurred = cv2.GaussianBlur(thickened, (0, 0), 4.0)
    sharpened = cv2.addWeighted(thickened, 2.0, blurred, -1.0, 0)
    
    # CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    final = clahe.apply(sharpened)
    
    # convert back to PIL
    return Image.fromarray(final)
