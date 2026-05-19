# NewsHub Internship Project

A modern news aggregation website built with React and FastAPI.

## Features

- Global news feed from NewsAPI
- General categories: business, technology, sports, entertainment, health, science
- Search across live news articles
- User registration and login
- Saved bookmarks/favorites
- News preferences per user
- SQLite database for local demo persistence
- Minimal responsive interface

## Project Structure

```text
backend/   FastAPI API, authentication, bookmarks, NewsAPI proxy
frontend/  React + Vite user interface
```

## Setup

1. Create backend environment:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

2. Configure backend:

```powershell
Copy-Item .env.example .env
```

Put your NewsAPI key in `backend/.env`. Do not commit the real `.env` file.

3. Install frontend dependencies:

```powershell
cd ..\frontend
npm install
```

4. Run both apps in separate terminals:

```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8010
```

```powershell
cd frontend
$env:VITE_API_URL='http://127.0.0.1:8010'
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

## Render Deployment

Deploy this as two Render services.

### Backend

- Type: Web Service
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment variables:
  - `NEWS_API_KEY`: your NewsAPI key. Optional; if missing, the backend uses Google News RSS for live headlines.
  - `SECRET_KEY`: any long random string
  - `FRONTEND_ORIGINS`: allowed frontend URLs, comma-separated. Example: `https://newshub-frontend-r1ir.onrender.com,http://localhost:5173,http://127.0.0.1:5173`

### Frontend

- Type: Static Site
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variables:
  - `VITE_API_URL`: your Render backend URL, for example `https://newshub-backend-m9hg.onrender.com` with no trailing slash

If the deployed frontend shows `0 latest stories loaded`, the frontend is running but cannot reach the backend URL.
