# TeX Transformer: Data Pipeline for LaTeX Model Training

A document processing pipeline that extracts PDF pages, classifies them using Mistral AI's Pixtral VLM, and generates structured JSON output.

Current Version: **0.3.0**

## 💬 Features

TeX Transformer is under active development. It currently supports the following features:

```
PDF Input
   ↓
Extract Pages (pdf2image + preprocessing)
   ↓
Classify Document (Pixtral VLM)
   ↓
Save JSON Output + Images
```

Each document is first sorted into 1 of 6 document types:

- `homework`: Problems, exercises, assignments
- `notes`: Lecture notes, study summaries
- `assessment`: Exams, tests, quizzes
- `report`: Formal reports with structured sections
- `writing`: Essays, compositions
- `diagram`: Visual content (charts, graphs)

Then sorted into 1 of 4 academic domains:

- `math_phys_cs`: Mathematics, Physics, Computer Science
- `bio_chem_env`: Biology, Chemistry, Environmental Science
- `econ_business`: Economics, Business
- `humanities`: Languages, History, Social Sciences

## Docker Setup

1. Set up your API key

Create a `.env` file:
```bash
echo "MISTRAL_API_KEY=your_mistral_api_key" > .env
```

Or get your API key at: https://console.mistral.ai/

2. Build Docker image

```bash
docker build -t tex_transformer .
```

3. Run the pipeline

```bash
docker run --rm \
  -v $(pwd)/input_data:/app/input_data \
  -v $(pwd)/dataset:/app/dataset \
  tex_transformer \
  python main.py input_data/sample_1.pdf --dpi 200
```