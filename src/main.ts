import './styles/main.css';
import './styles/motion-hover.css';
import { initRouter } from './router';
import { purgeStaleResults } from './worker/opfs';

// Apply saved theme before render (prevents flash)
const saved = localStorage.getItem('ff-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.setAttribute('data-theme', saved ?? (prefersDark ? 'dark' : 'light'));

// A crashed or closed tab skips the per-download cleanup, and OPFS survives
// both, so clear anything left over before this session writes its own.
void purgeStaleResults();

// Bootstrap the app
initRouter();
