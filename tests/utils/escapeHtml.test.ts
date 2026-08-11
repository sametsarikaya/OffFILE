import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../src/utils/escapeHtml';

describe('escapeHtml', () => {
  it('leaves plain text untouched', () => {
    expect(escapeHtml('report.pdf')).toBe('report.pdf');
  });

  it('escapes every HTML-significant character', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes ampersands before other entities so output is not double-decoded', () => {
    // A filename containing a literal "&lt;" must survive a round trip through
    // innerHTML as the literal text "&lt;", not as "<".
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('neutralises an attribute-breaking filename', () => {
    const hostile = '" onerror="alert(1)';
    expect(escapeHtml(hostile)).not.toContain('"');
    expect(escapeHtml(hostile)).toBe('&quot; onerror=&quot;alert(1)');
  });

  it('handles an empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});
