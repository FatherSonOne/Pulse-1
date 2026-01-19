// src/utils/animations.ts
export const animationClasses = {
  // Fade animations
  fadeIn: 'animate-fadeIn',
  fadeOut: 'animate-fadeOut',

  // Slide animations
  slideInLeft: 'animate-slideInLeft',
  slideInRight: 'animate-slideInRight',
  slideInUp: 'animate-slideInUp',
  slideInDown: 'animate-slideInDown',

  // Scale animations
  scaleIn: 'animate-scaleIn',
  scaleUp: 'animate-scaleUp',

  // Hover effects
  hoverLift: 'hover:shadow-lg hover:scale-105 transition-all duration-300',
  hoverGlow: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all duration-300',
  hoverDarken: 'hover:bg-opacity-80 transition-all duration-300',

  // Transitions
  smooth: 'transition-all duration-300 ease-out',
  smoothFast: 'transition-all duration-150 ease-out',
  smoothSlow: 'transition-all duration-500 ease-out',

  // Card effects
  cardHover: 'hover:shadow-xl hover:shadow-red-500/10 hover:-translate-y-1 transition-all duration-300',
  buttonPulse: 'hover:scale-105 active:scale-95 transition-transform duration-150',

  // Stagger delays for lists
  stagger1: 'animation-delay-100',
  stagger2: 'animation-delay-200',
  stagger3: 'animation-delay-300',
  stagger4: 'animation-delay-400',
  stagger5: 'animation-delay-500',
};

export const getAnimationStyle = (animationType: keyof typeof animationClasses) => {
  return animationClasses[animationType];
};

// Helper to combine multiple animation classes
export const combineAnimations = (...animations: (keyof typeof animationClasses)[]) => {
  return animations.map(a => animationClasses[a]).join(' ');
};
