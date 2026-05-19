import base64
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus
from xml.etree import ElementTree

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me").encode()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./newshub.db")
DEFAULT_FRONTEND_ORIGINS = [
    "https://newshub-frontend-r1ir.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", os.getenv("FRONTEND_ORIGIN", "")).split(",")
    if origin.strip()
]
ALLOWED_FRONTEND_ORIGINS = list(dict.fromkeys([*FRONTEND_ORIGINS, *DEFAULT_FRONTEND_ORIGINS]))
DB_PATH = DATABASE_URL.replace("sqlite:///", "", 1)

CATEGORIES = ["general", "business", "technology", "sports", "entertainment", "health", "science"]
GOOGLE_NEWS_TOPICS = {
    "business": "BUSINESS",
    "technology": "TECHNOLOGY",
    "sports": "SPORTS",
    "entertainment": "ENTERTAINMENT",
    "health": "HEALTH",
    "science": "SCIENCE",
}

app = FastAPI(title="NewsHub API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class BookmarkRequest(BaseModel):
    title: str
    url: str
    source: str = ""
    image_url: str | None = None
    published_at: str | None = None
    description: str | None = None
    category: str = "general"


class PreferencesRequest(BaseModel):
    categories: list[str] = Field(default_factory=lambda: ["general"])


@contextmanager
def db() -> Any:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                source TEXT,
                image_url TEXT,
                published_at TEXT,
                description TEXT,
                category TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(user_id, url),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS preferences (
                user_id INTEGER PRIMARY KEY,
                categories TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            """
        )


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return base64.urlsafe_b64encode(digest).decode(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    candidate, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate, password_hash)


def sign_token(payload: dict[str, Any]) -> str:
    body = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode()
    signature = hmac.new(SECRET_KEY, body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def read_token(token: str) -> dict[str, Any]:
    try:
        body, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    expected = hmac.new(SECRET_KEY, body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    payload = json.loads(base64.urlsafe_b64decode(body.encode()).decode())
    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    return payload


def current_user(authorization: str = Header(default="")) -> sqlite3.Row:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    payload = read_token(authorization.removeprefix("Bearer ").strip())
    with db() as conn:
        user = conn.execute("SELECT id, name, email FROM users WHERE id = ?", (payload["sub"],)).fetchone()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def user_response(user: sqlite3.Row, token: str | None = None) -> dict[str, Any]:
    data = {"id": user["id"], "name": user["name"], "email": user["email"]}
    if token:
        data["token"] = token
    return data


async def fetch_news(category: str, query: str, page_size: int) -> list[dict[str, Any]]:
    if not NEWS_API_KEY:
        return await fetch_rss_news(category, query, page_size)

    params: dict[str, Any] = {
        "apiKey": NEWS_API_KEY,
        "language": "en",
        "pageSize": page_size,
        "sortBy": "publishedAt",
    }
    endpoint = "https://newsapi.org/v2/top-headlines"
    if query:
        endpoint = "https://newsapi.org/v2/everything"
        params["q"] = query
    else:
        params["category"] = category
        params["country"] = "us"

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(endpoint, params=params)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return await fetch_rss_news(category, query, page_size)

    articles = []
    for item in payload.get("articles", []):
        if not item.get("title") or not item.get("url"):
            continue
        articles.append(
            {
                "title": item["title"],
                "description": item.get("description") or "Open the full story to read more from the original source.",
                "url": item["url"],
                "image_url": item.get("urlToImage"),
                "source": (item.get("source") or {}).get("name") or "News source",
                "published_at": item.get("publishedAt"),
                "category": category,
            }
        )
    return articles or await fetch_rss_news(category, query, page_size)


async def fetch_rss_news(category: str, query: str, page_size: int) -> list[dict[str, Any]]:
    if query:
        rss_url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
    elif category == "general":
        rss_url = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"
    else:
        topic = GOOGLE_NEWS_TOPICS.get(category, "NATION")
        rss_url = f"https://news.google.com/rss/topstories/section/topic/{topic}?hl=en-US&gl=US&ceid=US:en"

    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            response = await client.get(rss_url)
            response.raise_for_status()
    except Exception:
        return fallback_articles(category, query)

    articles = parse_rss_articles(response.text, category, page_size)
    return articles or fallback_articles(category, query)


def parse_rss_articles(xml_text: str, category: str, page_size: int) -> list[dict[str, Any]]:
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return []

    articles = []
    for item in root.findall(".//item"):
        title = text_from_xml(item, "title")
        url = text_from_xml(item, "link")
        if not title or not url:
            continue

        source = text_from_xml(item, "source") or source_from_title(title)
        description = clean_html(text_from_xml(item, "description"))
        articles.append(
            {
                "title": title,
                "description": description or "Open the full story to read the latest update from the original publisher.",
                "url": url,
                "image_url": None,
                "source": source or "Google News",
                "published_at": text_from_xml(item, "pubDate") or now_iso(),
                "category": category,
            }
        )
        if len(articles) >= page_size:
            break

    return articles


def text_from_xml(element: ElementTree.Element, tag: str) -> str:
    child = element.find(tag)
    return child.text.strip() if child is not None and child.text else ""


def clean_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html.unescape(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def source_from_title(title: str) -> str:
    if " - " not in title:
        return ""
    return title.rsplit(" - ", 1)[-1].strip()


def fallback_articles(category: str, query: str) -> list[dict[str, Any]]:
    topic = query or category
    return [
        {
            "title": f"{topic.title()} briefing: live source temporarily unavailable",
            "description": "This demo article appears when the external news service is unreachable. Search, categories, login, and bookmarks still work locally.",
            "url": "https://newsapi.org/",
            "image_url": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
            "source": "NewsHub Demo",
            "published_at": now_iso(),
            "category": category,
        },
        {
            "title": "How digital newsrooms organize fast-moving stories",
            "description": "A sample story for presenting the project's aggregation workflow, user preferences, and saved reading list.",
            "url": "https://www.theguardian.com/international",
            "image_url": "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
            "source": "Demo Wire",
            "published_at": now_iso(),
            "category": category,
        },
    ]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/categories")
def categories() -> dict[str, list[str]]:
    return {"categories": CATEGORIES}


@app.get("/news")
async def news(
    category: str = Query("general"),
    q: str = Query(""),
    page_size: int = Query(18, ge=1, le=50),
) -> dict[str, Any]:
    clean_category = category if category in CATEGORIES else "general"
    return {"articles": await fetch_news(clean_category, q.strip(), page_size)}


@app.post("/auth/register")
def register(payload: RegisterRequest) -> dict[str, Any]:
    password_hash, salt = hash_password(payload.password)
    email = payload.email.lower().strip()
    name = (payload.name or email.split("@", 1)[0]).strip()
    if len(name) < 2:
        name = "NewsPulse User"
    with db() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (name, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
                (name, email, password_hash, salt, now_iso()),
            )
            conn.execute(
                "INSERT INTO preferences (user_id, categories) VALUES (?, ?)",
                (cursor.lastrowid, json.dumps(["general", "technology"])),
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="Email already registered") from exc
        user = conn.execute("SELECT id, name, email FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()

    token = sign_token({"sub": user["id"], "exp": int(time.time()) + 60 * 60 * 24})
    return {"user": user_response(user), "token": token}


@app.post("/register")
def register_alias(payload: RegisterRequest) -> dict[str, Any]:
    return register(payload)


@app.post("/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    with db() as conn:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (payload.email.lower().strip(),)).fetchone()
    if not user or not verify_password(payload.password, user["password_hash"], user["salt"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = sign_token({"sub": user["id"], "exp": int(time.time()) + 60 * 60 * 24})
    return {"user": user_response(user), "token": token}


@app.post("/login")
def login_alias(payload: LoginRequest) -> dict[str, Any]:
    return login(payload)


@app.get("/me")
def me(user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    return {"user": user_response(user)}


@app.get("/bookmarks")
def list_bookmarks(user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()
    return {"bookmarks": [dict(row) for row in rows]}


@app.post("/bookmarks")
def save_bookmark(payload: BookmarkRequest, response: Response, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO bookmarks
            (user_id, title, url, source, image_url, published_at, description, category, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["id"],
                payload.title,
                payload.url,
                payload.source,
                payload.image_url,
                payload.published_at,
                payload.description,
                payload.category,
                now_iso(),
            ),
        )
        bookmark = conn.execute(
            "SELECT * FROM bookmarks WHERE user_id = ? AND url = ?",
            (user["id"], payload.url),
        ).fetchone()
    response.status_code = status.HTTP_201_CREATED
    return {"bookmark": dict(bookmark)}


@app.delete("/bookmarks")
def delete_bookmark(url: str, user: sqlite3.Row = Depends(current_user)) -> dict[str, str]:
    with db() as conn:
        conn.execute("DELETE FROM bookmarks WHERE user_id = ? AND url = ?", (user["id"], url))
    return {"status": "removed"}


@app.get("/preferences")
def get_preferences(user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("SELECT categories FROM preferences WHERE user_id = ?", (user["id"],)).fetchone()
    return {"categories": json.loads(row["categories"]) if row else ["general"]}


@app.put("/preferences")
def update_preferences(payload: PreferencesRequest, user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    valid = [category for category in payload.categories if category in CATEGORIES]
    categories = valid or ["general"]
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO preferences (user_id, categories) VALUES (?, ?)",
            (user["id"], json.dumps(categories)),
        )
    return {"categories": categories}
