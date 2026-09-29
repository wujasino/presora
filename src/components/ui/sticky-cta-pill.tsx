import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A small floating "Compare my brand" pill that appears once the reader has
 * scrolled past the hero (so it never duplicates the hero's own CTA) and
 * hides again near the footer (so it doesn't stack with the newsletter
 * form / footer CTA down there). Clicking it scrolls back UP to the same
 * #hero-input the "Learn more" and mid-page CTAs already target, rather
 * than navigating away — the point is to bring a scrolling-but-undecided
 * reader back to the one action that matters, without ever leaving this
 * page.
 *
 * Mirrors SalesChatWidget's bottom-24 offset (clears the cookie consent
 * bar the same way) but on the opposite corner, so the two floating
 * elements never compete for the same space.
 */
export const StickyCtaPill = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      const pastHero = window.scrollY > window.innerHeight * 0.9;
      const nearFooter = window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 700;
      setVisible(pastHero && !nearFooter);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const scrollToScan = () => {
    document.getElementById('hero-input')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToScan}
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className={cn(
            'fixed z-40 bottom-24 left-4 sm:left-6 inline-flex items-center gap-2 pl-4 pr-5 py-3 rounded-full',
            'bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors'
          )}
        >
          <Sparkles className="w-4 h-4" />
          Compare my brand
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default StickyCtaPill;
