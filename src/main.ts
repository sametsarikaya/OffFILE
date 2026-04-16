import './styles/main.css';
import './styles/motion-hover.css';
import { initRouter } from './router';

// Apply saved theme before render (prevents flash)
const saved = localStorage.getItem('ff-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.setAttribute(
  'data-theme',
  saved ?? (prefersDark ? 'dark' : 'light')
);

// Bootstrap the app
initRouter();
