"""
classifier

Author: natelgrw
Last Edited: 01/07/2026

Handwritten document classification module using Pixtral VLM.
"""

from .classifier import DocumentClassifier, characterize_images

__all__ = ['DocumentClassifier', 'characterize_images']
__version__ = '0.3.0'
