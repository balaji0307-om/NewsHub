import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  LogOut,
  Newspaper,
  Search,
  Settings,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8010';
const DEFAULT_CATEGORIES = ['general', 'business', 'technology', 'sports', 'entertainment', 'health', 'science'];

function App() {
  const [articles, setArticles] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState('general');
  const [query, setQuery] = useState('');
  const [searchText, setSearchText] = useState('');
  const [token, setToken] = useState(localStorage.getItem('newshub_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('newshub_user') || 'null'));
  const [authMode, setAuthMode] = useState('login');
  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState(['general', 'technology']);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [apiError, setApiError] = useState('');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  const savedUrls = useMemo(() => new Set(bookmarks.map((item) => item.url)), [bookmarks]);
  const leadArticle = articles[0];
  const sideArticles = articles.slice(1, 3);
  const gridArticles = articles.slice(3);

  useEffect(() => {
    getCategories();
  }, []);

  useEffect(() => {
    getNews();
  }, [activeCategory, query]);

  useEffect(() => {
    if (token) {
      getBookmarks();
      getPreferences();
    }
  }, [token]);

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal })
      .finally(() => window.clearTimeout(timeout));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Request failed');
    return data;
  }

  async function getCategories() {
    try {
      const data = await request('/categories');
      setCategories(data.categories || DEFAULT_CATEGORIES);
    } catch {
      setCategories(DEFAULT_CATEGORIES);
    }
  }

  async function getNews() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category: activeCategory, q: query, page_size: '18' });
      const data = await request(`/news?${params}`);
      setArticles(data.articles || []);
      setApiError('');
    } catch (error) {
      const detail = error.name === 'AbortError'
        ? 'Backend request timed out. Check the deployed API URL.'
        : 'News API is not reachable. Check VITE_API_BASE_URL and backend deployment.';
      setApiError(detail);
      setMessage(detail);
    } finally {
      setLoading(false);
    }
  }

  async function getBookmarks() {
    try {
      const data = await request('/bookmarks');
      setBookmarks(data.bookmarks || []);
    } catch {
      setBookmarks([]);
    }
  }

  async function getPreferences() {
    try {
      const data = await request('/preferences');
      setPreferences(data.categories || ['general']);
    } catch {
      setPreferences(['general']);
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    try {
      const path = authMode === 'login' ? '/auth/login' : '/auth/register';
      const body = authMode === 'login'
        ? { email: authForm.email, password: authForm.password }
        : authForm;
      const data = await request(path, { method: 'POST', body: JSON.stringify(body) });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('newshub_token', data.token);
      localStorage.setItem('newshub_user', JSON.stringify(data.user));
      setAuthOpen(false);
      setMessage(`Welcome, ${data.user.name}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    setToken('');
    setUser(null);
    setBookmarks([]);
    localStorage.removeItem('newshub_token');
    localStorage.removeItem('newshub_user');
  }

  async function toggleBookmark(article) {
    if (!token) {
      setAuthOpen(true);
      return;
    }
    try {
      if (savedUrls.has(article.url)) {
        await request(`/bookmarks?url=${encodeURIComponent(article.url)}`, { method: 'DELETE' });
      } else {
        await request('/bookmarks', { method: 'POST', body: JSON.stringify(article) });
      }
      await getBookmarks();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function savePreferences(nextPreferences = preferences) {
    try {
      const data = await request('/preferences', {
        method: 'PUT',
        body: JSON.stringify({ categories: nextPreferences }),
      });
      setPreferences(data.categories);
      setMessage('Preferences saved');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    setQuery(searchText.trim());
  }

  function togglePreference(category) {
    const next = preferences.includes(category)
      ? preferences.filter((item) => item !== category)
      : [...preferences, category];
    setPreferences(next);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top">
          <span><Newspaper size={20} /></span>
          NewsHub
        </a>
        <form className="search" onSubmit={submitSearch}>
          <Search size={18} />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search global news"
          />
        </form>
        <nav className="account">
          {user ? (
            <>
              <button className="iconButton" onClick={() => setSettingsOpen(true)} title="Preferences">
                <Settings size={18} />
              </button>
              <span className="userPill"><User size={16} />{user.name}</span>
              <button className="textButton" onClick={logout}><LogOut size={16} />Logout</button>
            </>
          ) : (
            <button className="textButton dark" onClick={() => setAuthOpen(true)}><User size={16} />Login</button>
          )}
        </nav>
      </header>

      {message && (
        <button className="toast" onClick={() => setMessage('')}>
          {message}<X size={16} />
        </button>
      )}

      <section id="top" className="hero">
        <div className="heroCopy">
          <p><Sparkles size={16} /> Internship project</p>
          <h1>Global news, searchable and saved around your interests.</h1>
          <span>React + FastAPI news aggregation with login, preferences, and bookmarks.</span>
        </div>
        <div className="heroStats">
          <strong>{articles.length}</strong>
          <span>latest stories loaded</span>
        </div>
      </section>

      <section className="categoryBar" aria-label="News categories">
        {categories.map((category) => (
          <button
            key={category}
            className={category === activeCategory ? 'active' : ''}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </section>

      {loading ? (
        <section className="loadingGrid">
          {Array.from({ length: 6 }).map((_, index) => <span key={index} />)}
        </section>
      ) : (
        <>
          {apiError && articles.length === 0 && (
            <section className="emptyState">
              <h2>Connect the FastAPI backend</h2>
              <p>{apiError}</p>
              <button onClick={getNews}>Retry</button>
            </section>
          )}

          {leadArticle && (
            <section className="leadLayout">
              <ArticleCard article={leadArticle} large saved={savedUrls.has(leadArticle.url)} onBookmark={toggleBookmark} />
              <div className="sideStack">
                {sideArticles.map((article) => (
                  <ArticleCard key={article.url} article={article} compact saved={savedUrls.has(article.url)} onBookmark={toggleBookmark} />
                ))}
              </div>
            </section>
          )}

          <section className="contentSplit">
            <div>
              <div className="sectionTitle">
                <h2>{query ? `Search results for "${query}"` : `${activeCategory} headlines`}</h2>
                {query && <button onClick={() => { setQuery(''); setSearchText(''); }}>Clear search</button>}
              </div>
              <div className="articleGrid">
                {gridArticles.map((article) => (
                  <ArticleCard key={article.url} article={article} saved={savedUrls.has(article.url)} onBookmark={toggleBookmark} />
                ))}
              </div>
            </div>

            <aside className="bookmarkPanel">
              <h2>Saved stories</h2>
              {user ? (
                bookmarks.length ? bookmarks.slice(0, 6).map((item) => (
                  <a key={item.url} href={item.url} target="_blank" rel="noreferrer">
                    <span>{item.source}</span>
                    {item.title}
                  </a>
                )) : <p>Your reading list is ready when you bookmark a story.</p>
              ) : (
                <p>Login to save favorites and keep your news preferences.</p>
              )}
            </aside>
          </section>
        </>
      )}

      {authOpen && (
        <div className="modalBackdrop">
          <form className="modal" onSubmit={submitAuth}>
            <button type="button" className="closeButton" onClick={() => setAuthOpen(false)}><X size={18} /></button>
            <h2>{authMode === 'login' ? 'Login' : 'Create account'}</h2>
            {authMode === 'register' && (
              <input required placeholder="Name" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} />
            )}
            <input required type="email" placeholder="Email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} />
            <input required minLength="6" type="password" placeholder="Password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} />
            <button className="submitButton" type="submit">{authMode === 'login' ? 'Login' : 'Register'}</button>
            <button
              type="button"
              className="linkButton"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Need an account?' : 'Already registered?'}
            </button>
          </form>
        </div>
      )}

      {settingsOpen && (
        <div className="modalBackdrop">
          <section className="modal">
            <button type="button" className="closeButton" onClick={() => setSettingsOpen(false)}><X size={18} /></button>
            <h2>Preferences</h2>
            <div className="preferenceList">
              {categories.map((category) => (
                <button
                  key={category}
                  className={preferences.includes(category) ? 'selected' : ''}
                  onClick={() => togglePreference(category)}
                >
                  {preferences.includes(category) && <Check size={16} />}
                  {category}
                </button>
              ))}
            </div>
            <button className="submitButton" onClick={() => savePreferences()}>Save preferences</button>
          </section>
        </div>
      )}
    </main>
  );
}

function ArticleCard({ article, large = false, compact = false, saved, onBookmark }) {
  return (
    <article className={`articleCard ${large ? 'large' : ''} ${compact ? 'compact' : ''}`}>
      <a href={article.url} target="_blank" rel="noreferrer" className="imageLink">
        <img src={article.image_url || 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80'} alt="" />
      </a>
      <div className="articleBody">
        <div className="meta">
          <span>{article.category}</span>
          <span>{article.source}</span>
        </div>
        <h3><a href={article.url} target="_blank" rel="noreferrer">{article.title}</a></h3>
        {!compact && <p>{article.description}</p>}
      </div>
      <button className="saveButton" onClick={() => onBookmark(article)} title={saved ? 'Remove bookmark' : 'Save bookmark'}>
        {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
      </button>
    </article>
  );
}

createRoot(document.getElementById('root')).render(<App />);
