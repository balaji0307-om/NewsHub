import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Clock,
  ExternalLink,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  User,
  X,
} from 'lucide-react';
import './styles.css';

const DEFAULT_API_BASE = window.location.hostname.endsWith('.onrender.com')
  ? 'https://newshub-backend-m9hg.onrender.com'
  : 'http://127.0.0.1:8010';
const API_BASE = (
  import.meta.env.VITE_API_URL
  || import.meta.env.VITE_API_BASE_URL
  || DEFAULT_API_BASE
).replace(/\/$/, '');
const DEFAULT_CATEGORIES = ['general', 'business', 'technology', 'sports', 'entertainment', 'health', 'science'];
const SAMPLE_ARTICLES = [
  {
    title: 'Global leaders meet as markets watch the next wave of policy decisions',
    description: 'A concise briefing on international developments, economic signals, and the stories shaping the day.',
    url: 'https://www.reuters.com/world/',
    image_url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80',
    source: 'NewsPulse Desk',
    published_at: new Date().toISOString(),
    category: 'general',
  },
  {
    title: 'Technology companies race to build faster and more useful AI products',
    description: 'New product launches and platform updates are changing how teams search, write, and automate work.',
    url: 'https://www.theverge.com/tech',
    image_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    source: 'Tech Wire',
    published_at: new Date().toISOString(),
    category: 'technology',
  },
  {
    title: 'Sports roundup: major fixtures bring late drama and standout performances',
    description: 'A quick look at the biggest results, key players, and what fans are watching next.',
    url: 'https://www.espn.com/',
    image_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
    source: 'Sports Desk',
    published_at: new Date().toISOString(),
    category: 'sports',
  },
  {
    title: 'Entertainment highlights: awards, releases, and streaming stories to know',
    description: 'The latest from film, music, streaming, and culture in one fast-moving digest.',
    url: 'https://variety.com/',
    image_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
    source: 'Culture Daily',
    published_at: new Date().toISOString(),
    category: 'entertainment',
  },
  {
    title: 'Business briefing: companies adjust plans amid shifting consumer demand',
    description: 'Executives and investors are tracking earnings, hiring trends, and global supply updates.',
    url: 'https://www.cnbc.com/business/',
    image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    source: 'Market Watch',
    published_at: new Date().toISOString(),
    category: 'business',
  },
  {
    title: 'Health researchers share practical guidance for everyday wellbeing',
    description: 'Public health teams continue to focus on prevention, access, and clearer information for families.',
    url: 'https://www.who.int/news',
    image_url: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
    source: 'Health Review',
    published_at: new Date().toISOString(),
    category: 'health',
  },
];

const FALLBACK_HEADLINE_TEMPLATES = [
  'Key developments to watch as the story continues to unfold',
  'Analysts explain what the latest updates mean for readers',
  'A quick briefing on the biggest signals from today',
  'Local and global reactions shape the next phase of coverage',
  'What changed today and why it matters now',
  'Fresh context around the people and decisions in focus',
  'The main questions still driving the conversation',
  'A concise update on momentum, impact, and next steps',
];

const CATEGORY_IMAGES = {
  general: [
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80',
  ],
  business: [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  ],
  technology: [
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  ],
  sports: [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?auto=format&fit=crop&w=1200&q=80',
  ],
  entertainment: [
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80',
  ],
  health: [
    'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
  ],
  science: [
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=1200&q=80',
  ],
};

function buildFallbackArticles(category, query) {
  const selected = activeFallbackSeeds(category);
  const generated = FALLBACK_HEADLINE_TEMPLATES.map((title, index) => {
    const seed = selected[index % selected.length];
    const topic = category === 'general' ? seed.category : category;
    return {
      ...seed,
      title: `${topic[0].toUpperCase()}${topic.slice(1)} briefing: ${title}`,
      description: seed.description,
      url: `${seed.url}?newspulse=${topic}-${index}`,
      published_at: new Date(Date.now() - index * 1800000).toISOString(),
      category: topic,
    };
  });

  const articles = [...selected, ...generated];
  if (!query) return articles;

  const searchTerm = query.toLowerCase();
  return articles.filter((article) => {
    const searchTarget = `${article.title} ${article.description} ${article.category} ${article.source}`.toLowerCase();
    return searchTarget.includes(searchTerm);
  });
}

function activeFallbackSeeds(category) {
  if (category === 'general') return SAMPLE_ARTICLES;

  const categoryArticle = SAMPLE_ARTICLES.find((article) => article.category === category);
  const generalArticle = SAMPLE_ARTICLES.find((article) => article.category === 'general');
  return [categoryArticle, generalArticle].filter(Boolean);
}

function imageForArticle(article) {
  if (article.image_url) return article.image_url;

  const images = CATEGORY_IMAGES[article.category] || CATEGORY_IMAGES.general;
  const key = article.url || article.title || article.category;
  const imageIndex = [...key].reduce((total, char) => total + char.charCodeAt(0), 0) % images.length;
  return images[imageIndex];
}

function formatTime(value) {
  if (!value) return 'Live';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Live';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

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
  const [theme, setTheme] = useState(localStorage.getItem('newshub_theme') || 'light');
  const [lastUpdated, setLastUpdated] = useState('');
  const [visibleCount, setVisibleCount] = useState(9);
  const [readingHistory, setReadingHistory] = useState(
    JSON.parse(localStorage.getItem('newshub_history') || '[]'),
  );

  const savedUrls = useMemo(() => new Set(bookmarks.map((item) => item.url)), [bookmarks]);
  const leadArticle = articles[0];
  const sideArticles = articles.slice(1, 3);
  const gridArticles = articles.slice(3, visibleCount);
  const hasMoreArticles = visibleCount < articles.length;

  useEffect(() => {
    getCategories();
  }, []);

  useEffect(() => {
    setVisibleCount(9);
    getNews();
  }, [activeCategory, query]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('newshub_theme', theme);
  }, [theme]);

  useEffect(() => {
    const refresh = window.setInterval(() => getNews(false), 120000);
    return () => window.clearInterval(refresh);
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

  async function getNews(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const params = new URLSearchParams({ category: activeCategory, q: query, page_size: '18' });
      const data = await request(`/news?${params}`);
      setArticles(data.articles || []);
      setApiError('');
      setLastUpdated(new Date().toISOString());
    } catch {
      const fallbackArticles = buildFallbackArticles(activeCategory, query);
      setArticles(fallbackArticles.length ? fallbackArticles : buildFallbackArticles(activeCategory, ''));
      setApiError('');
      setLastUpdated(new Date().toISOString());
    } finally {
      if (showLoader) setLoading(false);
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

  function openArticle(article) {
    const nextHistory = [
      { title: article.title, url: article.url, source: article.source, read_at: new Date().toISOString() },
      ...readingHistory.filter((item) => item.url !== article.url),
    ].slice(0, 6);
    setReadingHistory(nextHistory);
    localStorage.setItem('newshub_history', JSON.stringify(nextHistory));
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top">
          <span>N</span>
          <strong>NewsPulse</strong>
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
          <button className="iconButton" onClick={() => getNews()} title="Refresh headlines">
            <RefreshCw size={18} />
          </button>
          <button className="iconButton" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle dark mode">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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

      <section className="tickerBar" aria-label="Breaking news ticker">
        <div>
          Breaking News - Latest Updates - Global Headlines - Trending Stories - Business - Technology - Sports - Entertainment -
          Breaking News - Latest Updates - Global Headlines - Trending Stories - Business - Technology - Sports - Entertainment -
        </div>
      </section>

      {message && (
        <button className="toast" onClick={() => setMessage('')}>
          {message}<X size={16} />
        </button>
      )}

      <section id="top" className="hero">
        <div className="heroCopy">
          <h1>Fresh headlines, smart search, and saved stories in one place.</h1>
          <span>Follow live global news, explore categories, and keep your favorite articles ready for later.</span>
        </div>
        <div className="heroStats">
          <strong>{articles.length}</strong>
          <span>latest stories loaded</span>
          {lastUpdated && <small>Updated {formatTime(lastUpdated)}</small>}
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
          {Array.from({ length: 6 }).map((_, index) => (
            <article className="skeletonCard" key={index}>
              <span />
              <div>
                <i />
                <strong />
                <p />
                <p />
              </div>
            </article>
          ))}
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
              <ArticleCard article={leadArticle} large saved={savedUrls.has(leadArticle.url)} onBookmark={toggleBookmark} onOpen={openArticle} />
              <div className="sideStack">
                {sideArticles.map((article) => (
                  <ArticleCard key={article.url} article={article} compact saved={savedUrls.has(article.url)} onBookmark={toggleBookmark} onOpen={openArticle} />
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
                  <ArticleCard key={article.url} article={article} saved={savedUrls.has(article.url)} onBookmark={toggleBookmark} onOpen={openArticle} />
                ))}
              </div>
              {hasMoreArticles && (
                <button className="loadMoreButton" onClick={() => setVisibleCount((count) => count + 6)}>
                  Load more headlines
                </button>
              )}
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
              <div className="historyPanel">
                <h3>Reading history</h3>
                {readingHistory.length ? readingHistory.map((item) => (
                  <a key={item.url} href={item.url} target="_blank" rel="noreferrer">
                    <span>{item.source}</span>
                    {item.title}
                  </a>
                )) : <p>Open a story to build your recent reads.</p>}
              </div>
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

function ArticleCard({ article, large = false, compact = false, saved, onBookmark, onOpen }) {
  return (
    <article className={`articleCard ${large ? 'large' : ''} ${compact ? 'compact' : ''}`}>
      <a href={article.url} target="_blank" rel="noreferrer" className="imageLink" onClick={() => onOpen(article)}>
        <img src={imageForArticle(article)} alt="" />
      </a>
      <div className="articleBody">
        <div className="meta">
          <span>{article.category}</span>
          <span>{article.source}</span>
        </div>
        <h3><a href={article.url} target="_blank" rel="noreferrer" onClick={() => onOpen(article)}>{article.title}</a></h3>
        {!compact && <p>{article.description}</p>}
        <div className="articleActions">
          <span><Clock size={15} />{formatTime(article.published_at)}</span>
          <a href={article.url} target="_blank" rel="noreferrer" onClick={() => onOpen(article)}>
            Read <ExternalLink size={15} />
          </a>
        </div>
      </div>
      <button className="saveButton" onClick={() => onBookmark(article)} title={saved ? 'Remove bookmark' : 'Save bookmark'}>
        {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
      </button>
    </article>
  );
}

createRoot(document.getElementById('root')).render(<App />);
