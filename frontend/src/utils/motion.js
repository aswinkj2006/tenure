/**
 * Tenure — Motion System & Physics Tokens
 * Fluid, calm springs & transitions for Framer Motion
 */

export const SPRING_INTERACTIVE = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
};

export const SPRING_SNAPPY = {
  type: 'spring',
  stiffness: 380,
  damping: 30,
};

export const SPRING_GENTLE = {
  type: 'spring',
  stiffness: 180,
  damping: 22,
};

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];

export const pageTransitionVariants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: EASE_OUT_EXPO,
      when: 'beforeChildren',
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export const itemFadeUpVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: EASE_OUT_EXPO,
    },
  },
};

export const cardHoverVariants = {
  initial: { y: 0, scale: 1 },
  hover: {
    y: -3,
    scale: 1.008,
    transition: SPRING_INTERACTIVE,
  },
  tap: {
    y: 0,
    scale: 0.985,
    transition: { duration: 0.1 },
  },
};
