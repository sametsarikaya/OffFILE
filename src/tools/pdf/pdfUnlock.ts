/* ============================================
   Tool: PDF Unlock (Remove Password)
   Removes the password from a password-protected PDF using pdf-lib.
   Only works when you know the user password - cannot brute-force.
   Fully local - no upload.
   ============================================ */

import type { Tool } from '../../types';

const pdfUnlock: Tool = {
  id: 'pdf-unlock',
  title: 'Unlock PDF',
  description: 'Remove password protection from a PDF you own. Enter the current password.',
  icon: `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>`,
  color: '#43A047',
  category: 'pdf',
  acceptedTypes: '.pdf',
  multiple: false,
};

export default pdfUnlock;
