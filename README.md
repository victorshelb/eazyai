# EazyAI

**A no-code machine learning platform: train text and image classifiers from a dataset in a few clicks.**

Pick a dataset (Hugging Face Hub, Kaggle, or your own CSV / image folder), choose a model, and EazyAI fine-tunes it in the background, reports the metrics, and lets you test the trained model or download it. No notebooks, no code.

## Features

- **Three dataset sources**: search the Hugging Face Hub, search and import from **Kaggle** (with your own API key), or **upload** a CSV or image set
- **Text and image classification**: fine-tunes Hugging Face Transformers models (`AutoModelForSequenceClassification` / `AutoModelForImageClassification`) with PyTorch
- **Dataset preview**: shows sample rows and the available columns, so you can pick the text and label columns
- **Background training jobs**: live status and progress, **cancel** at any time, full job history
- **Results**: accuracy, precision, recall, F1 and a confusion matrix; try the model on new text or images, then download it
- **Accounts and security**: JWT auth, bcrypt password hashing, **TOTP multi-factor authentication** (QR setup), personal API keys, profile and password management

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | FastAPI, Uvicorn, Pydantic |
| ML | PyTorch, Hugging Face Transformers, Datasets, Accelerate, scikit-learn |
| Data | SQLite, Kaggle API, Hugging Face Hub |
| Security | PyJWT, bcrypt, pyotp (TOTP MFA) |

## Architecture

```
Next.js frontend (:3000) ──/api/* (rewrite)──▶ FastAPI backend (:8000)
                                                 ├── routes/      auth, users, datasets, training, settings
                                                 ├── services/    trainer (Transformers), inference, hf_search, kaggle, auth
                                                 ├── db/          SQLite (users, jobs, API keys)
                                                 └── trained_models/<job-id>/  checkpoints + metrics (git-ignored)
```

## Run it locally

**Backend**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set JWT_SECRET
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

The API docs are at http://localhost:8000/docs.

## API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, MFA setup / enable / disable |
| Datasets | `GET /api/datasets/search`, `GET /api/datasets/popular`, `GET /api/datasets/preview/{id}`, `GET /api/datasets/columns/{id}`, `POST /api/datasets/upload`, Kaggle search and columns |
| Training | `POST /api/training/start`, `GET /api/training/status/{job}`, `POST /api/training/cancel/{job}`, `GET /api/training/results/{job}`, `GET /api/training/history`, `GET /api/training/download/{job}` |
| Inference | `POST /api/training/predict/{job}`, `POST /api/training/predict-image/{job}` |
| Settings | Kaggle credentials, personal API keys, profile, password, delete account |

## Security notes

- Secrets live in `backend/.env` (git-ignored). The JWT secret has a development default, so **set `JWT_SECRET` before exposing the app**.
- Kaggle credentials are stored locally in `backend/.credentials.json` (git-ignored) and are only used to call the Kaggle API.
- The database, uploads and trained models are git-ignored.

## Roadmap

- GPU or cloud training workers
- Regression and multi-label tasks
- Shareable model endpoints
