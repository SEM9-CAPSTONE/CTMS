# CTMS AI Service

Python service for AI Survival Assistant, rule-based weather scoring, LLM advisories, and future RAG retrieval.

## Local Development

```bash
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
