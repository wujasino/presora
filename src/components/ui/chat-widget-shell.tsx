import { useRef, useEffect, useState, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X, ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessageContent } from './chat-message-content';

export interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  link?: {
    label: string;
    href: string;
  };
}

interface ChatWidgetShellProps {
  title: string;
  subtitle?: string;
  onRetry?: () => void;
  messages: ChatMsg[];
  loading: boolean;
  error: string;
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text: string) => void;
  suggestions?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Positioning classes for the fixed wrapper — lets callers avoid colliding with other floating UI (e.g. the cookie banner). */
  positionClassName?: string;
  /**
   * Keeps the launcher hidden until the page is scrolled roughly past the
   * first viewport. Landing's hero has above-the-fold CTAs/example chips
   * that sit in the same bottom-right corner the launcher occupies on
   * short mobile viewports — the fixed launcher would otherwise land right
   * on top of them from the very first paint. Default off (unchanged
   * behavior for result-chat-widget, which never renders over a hero).
   */
  hideUntilScrolled?: boolean;
}

// Shared visual chrome (launcher button, panel, message list, input) for
// the two support-bot chat widgets: sales/FAQ (no auth) and result
// interpreter (authenticated, per-scan). Callers own the actual
// send-a-message logic — this component only renders state it's given.
export function ChatWidgetShell({
  title,
  subtitle,
  onRetry,
  messages,
  loading,
  error,
  input,
  onInputChange,
  onSend,
  suggestions,
  open,
  onOpenChange,
  positionClassName = 'bottom-24 right-6',
  hideUntilScrolled = false,
}: ChatWidgetShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [pastFold, setPastFold] = useState(!hideUntilScrolled);

  useEffect(() => {
    if (!hideUntilScrolled) return;
    const check = () => setPastFold(window.scrollY > window.innerHeight * 0.6);
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [hideUntilScrolled]);
  const launcherVisible = pastFold || open;

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
        launcherRef.current?.focus();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(input);
  };

  return (
    <div
      className={cn(
        'fixed z-40 flex flex-col items-end gap-3 transition-opacity duration-300',
        positionClassName,
        launcherVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            id={panelId}
            role="dialog"
            aria-label={title}
            className="w-[min(calc(100vw-3rem),420px)] h-[min(65dvh,600px)] flex flex-col rounded-2xl border border-[hsl(var(--glass-border))] bg-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--glass-border))] bg-card/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                  {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { onOpenChange(false); launcherRef.current?.focus(); }}
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={scrollRef} role="log" aria-label="Conversation" aria-live="polite" className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-5 space-y-5">
              {messages.map((m, i) => (
                <div key={i} className="space-y-1.5">
                  <div className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[92%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed [overflow-wrap:anywhere]',
                        m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap' : 'bg-muted/60 text-foreground rounded-bl-sm'
                      )}
                    >
                      {m.role === 'assistant' ? <ChatMessageContent text={m.text} /> : m.text}
                    </div>
                  </div>
                  {m.link && (
                    <div className="flex justify-start">
                      <a
                        href={m.link.href}
                        className="text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                      >
                        {m.link.label} →
                      </a>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-xl px-3 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    Thinking…
                  </div>
                </div>
              )}
              {error && (
                <div role="alert" className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-3">
                  <p>{error}</p>
                  {onRetry && <button type="button" onClick={onRetry} disabled={loading} className="mt-2 font-semibold underline underline-offset-4 disabled:opacity-50">Try again</button>}
                </div>
              )}
              {messages.length === 1 && !loading && suggestions && suggestions.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSend(s)}
                      className="text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-[hsl(var(--glass-border))] rounded-xl px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3 border-t border-[hsl(var(--glass-border))]">
              <textarea
                ref={inputRef}
                id={`${panelId}-input`}
                name="message"
                rows={2}
                value={input}
                onChange={e => onInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (!loading && input.trim()) onSend(input);
                  }
                }}
                placeholder="Ask a question…"
                aria-label="Ask a question"
                maxLength={2000}
                className="flex-1 min-w-0 resize-none px-3 py-2 rounded-xl bg-background border border-[hsl(var(--glass-border))] text-base sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-9 h-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-[0.96]"
                aria-label="Send"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        ref={launcherRef}
        type="button"
        tabIndex={launcherVisible ? 0 : -1}
        aria-hidden={!launcherVisible}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => onOpenChange(!open)}
        whileTap={{ scale: 0.94 }}
        className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? 'close' : 'open'}
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 45 }}
            transition={{ duration: 0.15 }}
          >
            {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

export default ChatWidgetShell;
