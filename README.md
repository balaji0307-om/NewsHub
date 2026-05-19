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

The provided key has already been placed in `.env.example`. For production, keep it only in `.env`.

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
$env:VITE_API_BASE_URL='http://127.0.0.1:8010'
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.
