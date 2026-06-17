# Installation Guide

## Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- MySQL server for production data
- Git

## Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000/health` and confirm the response status is `ok`.

## Frontend Setup

```bash
cd frontend\nms-book-frontend
npm install
copy .env.example .env
npm run dev
```

For local development, set this in `frontend\nms-book-frontend\.env`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Demo Mode

Demo Mode can be entered from the login page and uses sample frontend data. It is useful for school walkthroughs without touching production records.
