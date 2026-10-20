FROM python:3.12.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config libcairo2-dev libpango1.0-dev \
    ffmpeg fonts-dejavu-core texlive-latex-base texlive-latex-extra \
    texlive-fonts-recommended poppler-utils \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir manim==0.22.0
WORKDIR /app
COPY validation.py worker.py /app/
CMD ["python", "/app/worker.py", "manim"]
