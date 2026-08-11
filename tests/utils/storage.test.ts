import { describe, it, expect, beforeEach } from 'vitest';
import { isFavorite, toggleFavorite, getFavoriteIds } from '../../src/utils/favorites';
import { recordRecentTool, getRecentToolIds, clearRecentTools } from '../../src/utils/recentTools';

beforeEach(() => {
  localStorage.clear();
});

describe('favorites', () => {
  it('starts empty', () => {
    expect(getFavoriteIds()).toEqual([]);
    expect(isFavorite('merge-pdf')).toBe(false);
  });

  it('toggles a tool on and off', () => {
    expect(toggleFavorite('merge-pdf')).toBe(true);
    expect(isFavorite('merge-pdf')).toBe(true);
    expect(toggleFavorite('merge-pdf')).toBe(false);
    expect(isFavorite('merge-pdf')).toBe(false);
  });

  it('keeps several favorites independently', () => {
    toggleFavorite('merge-pdf');
    toggleFavorite('image-resize');
    expect(getFavoriteIds().sort()).toEqual(['image-resize', 'merge-pdf']);
  });

  it('survives corrupted storage instead of throwing', () => {
    localStorage.setItem('ff-favorites', 'not json');
    expect(getFavoriteIds()).toEqual([]);
  });
});

describe('recentTools', () => {
  it('records most recent first', () => {
    recordRecentTool('merge-pdf');
    recordRecentTool('split-pdf');
    expect(getRecentToolIds()).toEqual(['split-pdf', 'merge-pdf']);
  });

  it('deduplicates by moving an existing entry to the front', () => {
    recordRecentTool('a');
    recordRecentTool('b');
    recordRecentTool('a');
    expect(getRecentToolIds()).toEqual(['a', 'b']);
  });

  it('caps the list at six entries', () => {
    for (const id of ['t1', 't2', 't3', 't4', 't5', 't6', 't7']) recordRecentTool(id);
    const ids = getRecentToolIds();
    expect(ids).toHaveLength(6);
    expect(ids[0]).toBe('t7');
    expect(ids).not.toContain('t1');
  });

  it('clears', () => {
    recordRecentTool('a');
    clearRecentTools();
    expect(getRecentToolIds()).toEqual([]);
  });

  it('survives corrupted storage instead of throwing', () => {
    localStorage.setItem('ff-recent', '{{{');
    expect(getRecentToolIds()).toEqual([]);
  });
});
