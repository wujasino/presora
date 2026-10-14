import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Loaded on demand — not part of the initial bundle
const fireConfetti = () =>
  import('canvas-confetti').then(({ default: confetti }) =>
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
  );
export interface NewsletterSignupProps {
  onSubmit: (email: string) => Promise<void>;
  className?: string;
}

export const NewsletterSignup: React.FC<NewsletterSignupProps> = ({
  onSubmit,
  className = "",
}) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(email);
      setIsSubmitted(true);
      fireConfetti();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-[hsl(var(--glass-border))] bg-card/60 backdrop-blur-xs shadow-lg shadow-primary/5 p-8 ${className}`}
    >
      <AnimatePresence mode="wait">
        {!isSubmitted ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
          >
            <div className="flex items-start gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <motion.h2
                  className="text-xl font-display text-foreground mb-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Subscribe to our newsletter
                </motion.h2>
                <motion.p
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.4 }}
                >
                  Stay up to date with our latest news and updates.
                </motion.p>
              </div>
            </div>

            <div className="space-y-1.5">
              <motion.label
                initial={{ opacity: 0, filter: "blur(3px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.6 }}
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider block"
                htmlFor="newsletter-email"
              >
                Email address
              </motion.label>
              <motion.div
                className="flex flex-col gap-2 sm:flex-row"
                initial={{ opacity: 0, filter: "blur(3px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.7 }}
              >
                <Input
                  type="email"
                  id="newsletter-email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                />
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Subscribe
                </Button>
              </motion.div>
            </div>
            <AnimatePresence>
              {error && (
                <motion.p
                  className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.form>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-6 text-center"
          >
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <h2 className="font-display text-foreground text-lg">Thanks for subscribing!</h2>
              <p className="text-sm text-muted-foreground mt-1">We've sent a confirmation email to your inbox.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
