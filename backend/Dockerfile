# Start from python base image
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (poppler for pdf2image, opencv libs)
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY extractor/ extractor/
COPY classifier/ classifier/
COPY global_vars.py .
COPY .env .
COPY server.py .

# Create dataset dir
RUN mkdir dataset

EXPOSE 5001

CMD ["python", "server.py"]
