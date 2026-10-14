import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle2, Loader2, Mail, Zap, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getRecaptchaToken } from '@/lib/recaptcha';

type Status = 'idle' | 'sending' | 'success' | 'error';

interface ContactFormProps {
  /** Pre-fills the subject field — e.g. "Agency plan inquiry" from the pricing page. */
  defaultSubject?: string;
  /** Hides the left "Get in touch" info panel — for embedding inside a Dialog,
      where that context is already obvious from the surrounding modal. */
  compact?: boolean;
}

export function ContactForm({ defaultSubject = '', compact = false }: ContactFormProps) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setErrorMsg('Please confirm you agree to be contacted about this inquiry.');
      setStatus('error');
      return;
    }
    setStatus('sending');
    setErrorMsg('');
    try {
      const recaptchaToken = await getRecaptchaToken('contact');
      // contact_messages has no separate company column — folding it into
      // the message body keeps the sales inbox reading it inline without a
      // migration, since it's just context around the inquiry, not a field
      // anything queries on.
      const fullMessage = company.trim() ? `Company/Agency: ${company.trim()}\n\n${message}` : message;
      const res = await fetch('/.netlify/functions/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message: fullMessage, recaptchaToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus('success');
      setName(''); setCompany(''); setEmail(''); setSubject(defaultSubject); setMessage(''); setAgreed(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className={compact ? '' : 'grid grid-cols-1 lg:grid-cols-2 gap-10 items-start'}>
      {/* Left — info */}
      {!compact && (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-display text-foreground mb-2">
            Get in touch
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Have a question about the product, want to discuss an Enterprise plan, or just want to say hello? We reply within 24 hours.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { icon: Mail, label: 'Email', value: 'contact.presora@gmail.com', href: 'mailto:contact.presora@gmail.com' },
            { icon: Zap, label: 'Response time', value: '< 24h', href: null },
            { icon: Globe, label: 'Languages', value: 'EN', href: null },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
                <item.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                {item.href ? (
                  <a href={item.href} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                    {item.value}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-foreground">{item.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Right — form */}
      <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/60 backdrop-blur-xs shadow-lg shadow-primary/5 p-6">
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-4 py-10 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <div>
                <h4 className="font-display text-foreground text-lg">Message sent!</h4>
                <p className="text-sm text-muted-foreground mt-1">We'll get back to you within 24 hours.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStatus('idle')}>
                Send another
              </Button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Full name *
                  </Label>
                  <Input
                    id="contact-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Smith"
                    required
                    minLength={2}
                    maxLength={120}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Work email *
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    required
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-company" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Company / Agency name
                </Label>
                <Input
                  id="contact-company"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="Acme Agency"
                  maxLength={120}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-subject" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Subject
                </Label>
                <Input
                  id="contact-subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Question about Enterprise plan..."
                  maxLength={200}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-message" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Message *
                </Label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe your question or needs..."
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={5}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
                <p className="text-[10px] text-muted-foreground/50 text-right">{message.length}/4000</p>
              </div>

              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="contact-consent"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="contact-consent" className="text-xs font-normal text-muted-foreground leading-relaxed cursor-pointer">
                  I agree to be contacted about this inquiry, in line with the{' '}
                  <Link to="/regulamin" target="_blank" className="text-primary hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/polityka-prywatnosci" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.
                </Label>
              </div>

              {status === 'error' && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5"
                >
                  {errorMsg}
                </motion.p>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={status === 'sending' || !agreed}
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send message
                  </>
                )}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
