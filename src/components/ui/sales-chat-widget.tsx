import { useState } from 'react';
import { ChatWidgetShell, type ChatMsg } from '@/components/ui/chat-widget-shell';

const GREETING: ChatMsg = {
  role: 'assistant',
  text: "Hi! I can answer questions about Presora — how AI visibility scoring works, pricing, models we query, anything like that. What would you like to know?",
};

const SUGGESTIONS = [
  'What does Presora actually do?',
  'How much does it cost?',
  'Which AI models do you check?',
];

const getRouteLink = (text: string): ChatMsg['link'] => {
  const question = text.toLowerCase();

  if (/\b(price|pricing|cost|plan|plans|cena|cennik|koszt|pakiet)\b/.test(question)) {
    return { label: 'See all plans and pricing', href: '/pricing' };
  }
  if (/\b(agency|agencies|agencj|white.label|client|clients)\b/.test(question)) {
    return { label: 'Explore Presora for agencies', href: '/agencies' };
  }
  if (/\b(api|webhook|integration|integrat|developer|developers)\b/.test(question)) {
    return { label: 'See product features', href: '/features' };
  }
  if (/\b(model|models|chatgpt|claude|gemini|perplexity|mistral|llama)\b/.test(question)) {
    return { label: 'See the AI models we query', href: '/#hero-input' };
  }
  if (/\b(report|reports|sample|action plan|recommendation)\b/.test(question)) {
    return { label: 'View a sample report', href: '/#sample-report' };
  }
  if (/\b(sign up|signup|register|start|free|trial|zał[oó]ż|zaczn)\b/.test(question)) {
    return { label: 'Start your free audit', href: '/register' };
  }

  return undefined;
};

export function SalesChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError('');
    const next = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/chat-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Something went wrong.');
      setMessages(m => [...m, {
        role: 'assistant',
        text: data.reply || "Sorry, I didn't catch that.",
        link: getRouteLink(trimmed),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ChatWidgetShell
      title="Ask Presora"
      messages={messages}
      loading={loading}
      error={error}
      input={input}
      onInputChange={setInput}
      onSend={send}
      suggestions={SUGGESTIONS}
      open={open}
      onOpenChange={setOpen}
      hideUntilScrolled
    />
  );
}

export default SalesChatWidget;
