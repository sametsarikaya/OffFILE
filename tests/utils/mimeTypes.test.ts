import { describe, it, expect } from 'vitest';
import { getMimesForAcceptedTypes, isFileTypeAllowed } from '../../src/utils/mimeTypes';

function fileOfType(type: string, name = 'sample'): File {
  return new File(['x'], name, { type });
}

describe('getMimesForAcceptedTypes', () => {
  it('maps a single extension', () => {
    expect([...getMimesForAcceptedTypes('.pdf')]).toEqual(['application/pdf']);
  });

  it('maps several extensions, including aliases that share a MIME type', () => {
    const mimes = getMimesForAcceptedTypes('.jpg,.jpeg,.png');
    expect([...mimes].sort()).toEqual(['image/jpeg', 'image/png']);
  });

  it('tolerates whitespace and a missing leading dot', () => {
    expect([...getMimesForAcceptedTypes(' pdf , .png ')].sort()).toEqual([
      'application/pdf',
      'image/png',
    ]);
  });

  it('ignores unknown extensions rather than throwing', () => {
    expect([...getMimesForAcceptedTypes('.xyz')]).toEqual([]);
  });
});

describe('isFileTypeAllowed', () => {
  it('accepts a matching MIME type', () => {
    expect(isFileTypeAllowed(fileOfType('application/pdf'), '.pdf')).toBe(true);
  });

  it('rejects a non-matching MIME type', () => {
    expect(isFileTypeAllowed(fileOfType('image/png'), '.pdf')).toBe(false);
  });

  it('accepts a file with no MIME type so the tool can decide', () => {
    // Some OS/browser combinations report an empty type for .heic, .avif etc.
    expect(isFileTypeAllowed(fileOfType(''), '.pdf')).toBe(true);
  });

  it('accepts jpeg when the accept list only mentions .jpg', () => {
    expect(isFileTypeAllowed(fileOfType('image/jpeg', 'a.jpg'), '.jpg')).toBe(true);
  });
});
