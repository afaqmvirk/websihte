FROM python:3.12.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config libcairo2-dev libpango1.0-dev sudo bash \
    ffmpeg fonts-dejavu-core texlive-latex-base texlive-latex-extra \
    texlive-fonts-recommended poppler-utils \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir manim==0.22.0
RUN groupadd --gid 10001 renderer \
    && useradd --uid 10001 --gid 10001 --home-dir /tmp --no-create-home --shell /usr/sbin/nologin renderer
WORKDIR /app
COPY validation.py worker.py sandbox_worker.py /app/
CMD ["python", "/app/worker.py", "manim"]
