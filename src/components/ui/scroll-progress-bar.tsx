import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Slim progress bar tracking how far down the page the reader has scrolled.
 * A purely visual orientation/engagement cue — no data, no claims, nothing
 * that could go stale — the kind of "hook" that keeps someone reading by
 * showing them there's more below and how much is left, rather than by
 * withholding or inventing anything.
 */
export const ScrollProgressBar = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] bg-primary origin-left z-60 pointer-events-none"
      style={{ scaleX }}
    />
  );
};

export default ScrollProgressBar;
