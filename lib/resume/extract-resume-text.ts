import zlib from 'zlib';

const MAX_BYTES = 5 * 1024 * 1024;

export class ResumeFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeFileError';
  }
}

function pdfLiterals(content: string): string {
  const parts: string[] = [];
  const literal = /\(((?:\\.|[^\\)])*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = literal.exec(content))) {
    const text = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
    if (text.trim()) parts.push(text);
  }
  return parts.join(' ');
}

function extractPdfText(data: Buffer): string {
  const latin = data.toString('latin1');
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < data.length) {
    const marker = latin.indexOf('stream', cursor);
    if (marker < 0) break;
    let offset = marker + 'stream'.length;
    if (data[offset] === 0x0d && data[offset + 1] === 0x0a) offset += 2;
    else if (data[offset] === 0x0a || data[offset] === 0x0d) offset += 1;
    const end = latin.indexOf('endstream', offset);
    if (end < 0) break;
    let sliceEnd = end;
    if (sliceEnd > offset && (data[sliceEnd - 1] === 0x0a || data[sliceEnd - 1] === 0x0d)) sliceEnd -= 1;
    if (sliceEnd > offset && data[sliceEnd - 1] === 0x0d) sliceEnd -= 1;
    const slice = data.subarray(offset, sliceEnd);
    let decoded = '';
    try {
      decoded = zlib.inflateSync(slice).toString('latin1');
    } catch {
      decoded = slice.toString('latin1');
    }
    const text = pdfLiterals(decoded);
    if (text) parts.push(text);
    cursor = end + 'endstream'.length;
  }
  return parts.join('\n').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export async function textFromResumeFile(file: File): Promise<string> {
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new ResumeFileError('Use a resume file under 5 MB.');
  }
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = name.endsWith('.pdf') || buffer.subarray(0, 4).toString() === '%PDF';
  const isText = name.endsWith('.txt') || file.type.startsWith('text/');
  if (!isPdf && !isText) {
    throw new ResumeFileError('Upload a PDF or a text file.');
  }
  const text = isPdf ? extractPdfText(buffer) : buffer.toString('utf8');
  const cleaned = text.replace(/\u0000/g, '').trim();
  if (cleaned.length < 40) {
    throw new ResumeFileError('Could not read that file. Paste the résumé text or upload a text-based PDF.');
  }
  return cleaned.slice(0, 50000);
}
