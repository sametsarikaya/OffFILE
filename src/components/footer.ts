import { getAllTools } from '../tools/registry';

interface Pillar {
  label: string;
  description: string;
  icon: string;
}

const PILLARS: Pillar[] = [
  {
    label: 'No Upload',
    description: 'All processing happens locally — files never leave your device',
    icon: `<ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>`,
  },
  {
    label: 'No Tracking',
    description: 'Zero analytics, no cookies, no data collection of any kind',
    icon: `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>`,
  },
  {
    label: 'Works Offline',
    description: 'No internet required after first load — fully self-contained',
    icon: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  },
  {
    label: 'Open Source',
    description: 'AGPL-3.0 licensed — fully auditable code, no hidden behavior',
    icon: `<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`,
  },
];

const REPO_URL = 'https://github.com/sametsarikaya/OffFILE';

export function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'footer';

  const pillars = PILLARS.map(
    (pillar) => `
    <div class="privacy-bar__pillar">
      <div class="privacy-bar__pillar-icon">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${pillar.icon}
        </svg>
      </div>
      <strong class="privacy-bar__pillar-label">${pillar.label}</strong>
      <span class="privacy-bar__pillar-desc">${pillar.description}</span>
    </div>`
  ).join('');

  footer.innerHTML = `
    <section class="privacy-bar" aria-label="Privacy guarantee">
      <div class="privacy-bar__inner">
        <div class="privacy-bar__lead">
          <div class="privacy-bar__shield">
            <svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div class="privacy-bar__lead-copy">
            <div class="privacy-bar__eyebrow">100% Client-Side</div>
            <h2 class="privacy-bar__heading">Privacy<br>First.</h2>
            <p class="privacy-bar__tagline">Your files never leave this browser — no servers, no uploads, no tracking.</p>
          </div>
        </div>
        <div class="privacy-bar__pillars">${pillars}</div>
      </div>
      <div class="privacy-bar__bottom">
        <span class="privacy-bar__bottom-brand">OffFILE</span>
        <span class="privacy-bar__bottom-sep">|</span>
        <a class="privacy-bar__bottom-link" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">github.com/sametsarikaya/OffFILE</a>
        <span class="privacy-bar__bottom-sep">|</span>
        <span class="privacy-bar__bottom-tag">Open Source File Tools</span>
        <span class="privacy-bar__bottom-sep">|</span>
        <span class="privacy-bar__bottom-count">${getAllTools().length} Tools</span>
      </div>
    </section>
  `;

  return footer;
}
