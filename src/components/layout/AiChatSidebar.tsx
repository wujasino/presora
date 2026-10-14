import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface AiChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

// Backed by netlify/functions/assistant.js — answers "how do I / where is"
// questions about the app and can navigate the user to a page (e.g.
// "find me settings" → navigates to /settings) via a `navigate` tool call.
export const AiChatSidebar = ({ open, onClose }: AiChatSidebarProps) => {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError('');
    const next = [...messages, { role: 'user' as const, text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again to use the assistant.');

      const res = await fetch('/.netlify/functions/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Something went wrong.');
      setMessages(m => [...m, { role: 'assistant', text: data.reply || "Sorry, I didn't catch that." }]);
      if (data.navigate) navigate(data.navigate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <aside
      className={cn(
        'fixed right-0 top-0 bottom-0 z-40 flex flex-col bg-background border-l border-border transition-all duration-200 overflow-hidden',
        open ? 'w-full md:w-80' : 'w-0'
      )}
    >
      {open && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">AI Assistant</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-10">
                Ask me anything about Presora — I can also take you straight to a page, e.g. "find me settings".
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground rounded-xl px-3 py-2 text-sm flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-border shrink-0">
            <input
              id="ai-chat-sidebar-input"
              name="message"
              aria-label="Type a message"
              className="flex-1 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-primary"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </aside>
  );
};
