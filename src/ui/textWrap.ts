export function chunkText(text: string, maxCharsPerLine: number, maxLines: number): string[][] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const lines: string[] = [];
  let cur = '';
  const pushCur = () => { if (cur.length) { lines.push(cur); cur = ''; } };
  for (let w of words) {
    while (w.length > maxCharsPerLine) { pushCur(); lines.push(w.slice(0, maxCharsPerLine)); w = w.slice(maxCharsPerLine); }
    if (cur.length === 0) cur = w;
    else if (cur.length + 1 + w.length <= maxCharsPerLine) cur += ' ' + w;
    else { pushCur(); cur = w; }
  }
  pushCur();
  if (lines.length === 0) return [['']];
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) pages.push(lines.slice(i, i + maxLines));
  return pages;
}
