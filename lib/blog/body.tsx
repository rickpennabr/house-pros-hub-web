import type { ReactNode } from 'react';

export type BlogBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export function parseBlogBody(body: string): BlogBlock[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: BlogBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ type: 'ul', items: list });
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      list.push(line.slice(2).trim());
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-black">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function BlogBody({ body }: { body: string }) {
  const blocks = parseBlogBody(body);
  const nodes: ReactNode[] = blocks.map((block, index) => {
    if (block.type === 'h2') {
      return (
        <h2 key={index} className="text-xl font-bold text-black pt-3">
          <RichText text={block.text} />
        </h2>
      );
    }
    if (block.type === 'h3') {
      return (
        <h3 key={index} className="text-lg font-bold text-black pt-2">
          <RichText text={block.text} />
        </h3>
      );
    }
    if (block.type === 'ul') {
      return (
        <ul key={index} className="list-disc space-y-1 pl-5 text-gray-800">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={index} className="text-gray-800 leading-relaxed">
        <RichText text={block.text} />
      </p>
    );
  });

  return <div className="space-y-4">{nodes}</div>;
}
