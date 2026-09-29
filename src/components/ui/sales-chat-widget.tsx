import { useRef, useState } from 'react';
import { ChatWidgetShell, type ChatMsg } from '@/components/ui/chat-widget-shell';

const GREETING: ChatMsg = {
  role: 'assistant',
  text: "Hi, welcome to Presora. I can help you understand competitor insights, explore plans, or find the right next step for your team.\n\nWhat would you like to know?",
};

const SUGGESTIONS = [
  'How can Presora help my agency?',
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
  const inFlight = useRef(false);

  const send = async (text: string, retry = false) => {
    const trimmed = text.trim();
    if (!trimmed || inFlight.current) return;
    inFlight.current = true;
    setError('');
    const next = retry ? messages : [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      // Exclude the local greeting and links; keep the payload below the API's 8 KB limit.
      const history = next.slice(1).map(({ role, text }) => ({ role, text }));
      while (history.length > 1 && new TextEncoder().encode(JSON.stringify({ messages: history })).length > 7000) {
        history.shift();
        while (history[0]?.role === 'assistant') history.shift();
      }
      const res = await fetch('/.netlify/functions/chat-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(res.status === 429
        ? 'You’ve sent a few questions quickly. Please wait a moment, then try again.'
        : 'Presora couldn’t answer just now. Please try again.');
      const data = await res.json();
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('The reply was empty. Please try again.');
      setMessages(m => [...m, {
        role: 'assistant',
        text: data.reply.trim(),
        link: getRouteLink(trimmed),
      }]);
    } catch (err) {
      setError(err instanceof Error && err.name === 'AbortError'
        ? 'This answer is taking longer than expected. Please try again.'
        : err instanceof TypeError || err instanceof SyntaxError
          ? 'We couldn’t connect to the assistant. Please try again.'
          : err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <ChatWidgetShell
      title="Ask Presora"
      subtitle="AI assistant · Product & pricing"
      onRetry={() => {
        const last = messages[messages.length - 1];
        if (last?.role === 'user') void send(last.text, true);
      }}
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
