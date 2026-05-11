import { describe, it, expect } from 'vitest';
import { chunkText } from '../../src/ui/textWrap';

describe('chunkText', () => {
  it('wraps on word boundaries to maxCharsPerLine', () => {
    const pages = chunkText('the quick brown fox jumps', 10, 5);
    expect(pages).toEqual([['the quick', 'brown fox', 'jumps']]);
  });
  it('pages into groups of at most maxLines lines', () => {
    const pages = chunkText('a a a a a a a a', 3, 2); // each "a a" line is 3 chars; many lines, 2 per page
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(2);
    expect(pages.flat().join(' ').replace(/\s+/g, ' ').trim()).toBe('a a a a a a a a');
  });
  it('a single over-long word is hard-split', () => {
    const pages = chunkText('supercalifragilistic', 5, 3);
    const firstPage = pages[0] ?? [];
    expect(firstPage.every(l => l.length <= 5)).toBe(true);
    expect(pages.flat().join('')).toBe('supercalifragilistic');
  });
  it('empty string -> one empty page', () => { expect(chunkText('', 10, 3)).toEqual([['']]); });
});
