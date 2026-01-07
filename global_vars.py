"""
global_vars.py

Author: natelgrw
Last Edited: 01/07/2026

Global configuration constants for the tex_transformer project.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# load environment variables from .env
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

# API key
MISTRAL_API_KEY = os.environ.get('MISTRAL_API_KEY')

# Mistral API configuration
PIXTRAL_MODEL = "pixtral-12b-2409"

# classification categories
DOCUMENT_TYPES = [
    'homework',
    'notes',
    'assessment',
    'report',
    'writing',
    'diagram'
]

DOMAINS = [
    'math_phys_cs',      
    'bio_chem_env',      
    'econ_business',     
    'humanities'         
]

# PDF processing settings
DPI = 200
MAX_IMAGE_SIZE = 2048

# image encoding quality
JPEG_QUALITY = 85

# document type descriptions
TYPE_DESCRIPTIONS = {
    'homework': 'Problems to solve, exercises, assignments with numbered questions',
    'notes': 'Lecture notes, study notes, summaries, key points',
    'assessment': 'Exams, tests, quizzes with grading, time limits, or formal structure',
    'report': 'Formal reports with sections like abstract, methodology, conclusion, references',
    'writing': 'Essays, creative writing, free-form compositions, argumentative text',
    'diagram': 'Primarily visual content like charts, graphs, flowcharts, or illustrations'
}

# academic domain descriptions
DOMAIN_DESCRIPTIONS = {
    'math_phys_cs': 'Mathematics, Physics, or Computer Science (equations, theorems, algorithms)',
    'bio_chem_env': 'Biology, Chemistry, or Environmental Science (cells, molecules, reactions)',
    'econ_business': 'Economics or Business (markets, finance, management, trade)',
    'humanities': 'Languages, History, Literature, Philosophy, Social Sciences'
}

# classification prompt template
CLASSIFICATION_PROMPT_TEMPLATE = """\
Analyze this scanned handwritten document image and classify it.

**Document Type** (choose exactly ONE):
{types_list}

**Academic Domain** (choose exactly ONE):
{domains_list}

Instructions:
1. Examine the visual layout, content structure, and any visible text
2. Consider the purpose and context of the document
3. For handwritten content, focus on overall structure and visual patterns
4. Choose the MOST appropriate category for each classification

Return your answer in EXACTLY this JSON format (no additional text):
{{"type": "...", "domain": "..."}}"""
