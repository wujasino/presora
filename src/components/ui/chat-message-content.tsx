import { Fragment } from 'react';

// Deliberately supports only text, emphasis and lists: model output is never HTML.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>,
  );
}

export function ChatMessageContent({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return <div className="space-y-3 [overflow-wrap:anywhere]">
    {blocks.map((block, index) => {
      const lines = block.split('\n');
      const unordered = lines.every(line => /^\s*[-*] /.test(line));
      const ordered = lines.every(line => /^\s*\d+[.)] /.test(line));
      if (unordered || ordered) {
        const List = ordered ? 'ol' : 'ul';
        return <List key={index} className={ordered ? 'list-decimal pl-5 space-y-1.5' : 'list-disc pl-5 space-y-1.5'}>
          {lines.map((line, item) => <li key={item}>{inline(line.replace(/^\s*(?:[-*]|\d+[.)]) /, ''))}</li>)}
        </List>;
      }
      return <p key={index} className="whitespace-pre-wrap">{inline(block)}</p>;
    })}
  </div>;
}
