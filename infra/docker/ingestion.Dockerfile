FROM debian:bookworm-slim AS ocr-build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl cmake g++ make pkg-config libleptonica-dev && rm -rf /var/lib/apt/lists/*
RUN curl --fail --location https://codeload.github.com/tesseract-ocr/tesseract/tar.gz/refs/tags/5.5.0 -o /tmp/tesseract.tar.gz \
 && echo 'f2fb34ca035b6d087a42875a35a7a5c4155fa9979c6132365b1e5a28ebc3fc11  /tmp/tesseract.tar.gz' | sha256sum -c - \
 && tar -xzf /tmp/tesseract.tar.gz -C /tmp \
 && cmake -S /tmp/tesseract-5.5.0 -B /tmp/build -DCMAKE_BUILD_TYPE=Release -DBUILD_TRAINING_TOOLS=OFF -DBUILD_TESTS=OFF -DBUILD_SHARED_LIBS=OFF -DDISABLE_ARCHIVE=ON -DDISABLE_CURL=ON \
 && cmake --build /tmp/build --parallel 2 \
 && cmake --install /tmp/build

FROM python:3.12-slim-bookworm AS application
COPY services/ai/app /app/app
RUN find /app/app -type f -name 'test_*.py' -delete \
 && rm -rf /app/app/fixtures

FROM python:3.12-slim-bookworm AS ingestion-base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 libgomp1 liblept5 fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY --from=ocr-build /usr/local/bin/tesseract /usr/local/bin/tesseract
ENV CTMS_TESSDATA_PATH=/opt/ctms/tessdata OMP_THREAD_LIMIT=2 HF_HUB_DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 HF_HUB_DISABLE_XET=1
ENV DOCLING_ARTIFACTS_PATH=/opt/ctms/docling-models
# Compose overrides HF_HOME with a mounted cache. Keep the prefetched runtime
# artifacts inside the image so an empty/older volume cannot hide the E5 model.
ENV HF_HUB_CACHE=/opt/ctms/huggingface/hub
COPY services/ai/requirements-ingestion.txt .
RUN pip install --no-cache-dir torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements-ingestion.txt
# Keep model provisioning cached when only runtime/application code changes.
COPY services/ai/app/__init__.py services/ai/app/knowledge_artifacts.py services/ai/app/ocr_artifacts.py services/ai/app/prefetch_knowledge_models.py ./app/
RUN python -m app.ocr_artifacts
# Independent layers make interrupted pulls and changes to one artifact group
# cheaper, while document schema/application edits retain the model cache.
RUN python -m app.prefetch_knowledge_models embedding
RUN python -m app.prefetch_knowledge_models layout
RUN python -m app.prefetch_knowledge_models table
COPY --from=application /app/app ./app
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
EXPOSE 8001
CMD ["uvicorn", "app.knowledge_api:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]

# CI exercises the exact production base with tests/fixtures added separately.
FROM ingestion-base AS test
RUN pip install --no-cache-dir pytest==8.3.4
COPY services/ai/app/test_*.py ./app/
COPY services/ai/app/fixtures ./app/fixtures

FROM ingestion-base AS runtime
