FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 libgomp1 && rm -rf /var/lib/apt/lists/*
COPY services/ai/requirements-ingestion.txt .
RUN pip install --no-cache-dir torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements-ingestion.txt
COPY services/ai/app ./app
EXPOSE 8001
CMD ["uvicorn", "app.knowledge_api:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
