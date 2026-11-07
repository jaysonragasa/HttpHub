import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid } from 'lucide-react';

export default function AnimatedLogo() {
  const [isPlay, setIsPlay] = useState(false);
  const [isRed, setIsRed] = useState(false);
  const isAnimatingRef = useRef(false);

  const runAnimationCycle = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    // Step 1: Morph into Play button and turn background Red
    setIsRed(true);
    setIsPlay(true);

    // Step 2: Hold for 1.3s, then morph back to Hub and return to original accent color
    setTimeout(() => {
      setIsPlay(false);
      setIsRed(false);

      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 500);
    }, 1300);
  }, []);

  // Play animation once on initial mount after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      runAnimationCycle();
    }, 1000);
    return () => clearTimeout(timer);
  }, [runAnimationCycle]);

  return (
    <div 
      className="flex items-center space-x-2 font-bold text-lg shrink-0 select-none cursor-pointer group"
      onClick={runAnimationCycle}
      onMouseEnter={runAnimationCycle}
      title="HttpHub - Click to animate"
    >
      <LayoutGrid size={20} className="text-text-primary group-hover:text-accent-hover transition-colors" />
      
      <div className="flex items-center tracking-tight">
        <span className="text-text-primary font-black text-[18px]">Http</span>
        
        {/* Animated "Hub" / "Play" Badge */}
        <motion.div
          animate={{
            backgroundColor: isRed ? '#dc2626' : 'var(--theme-accent-primary)',
            boxShadow: isRed 
              ? '0 0 12px rgba(220, 38, 38, 0.5)' 
              : '0 0 0px rgba(0, 0, 0, 0)',
            scale: isRed ? [1, 1.1, 1.05] : 1,
            borderRadius: isRed ? '6px' : '3px',
          }}
          transition={{
            duration: 0.35,
            ease: [0.34, 1.56, 0.64, 1], // Spring-like overshoot
          }}
          className="relative flex items-center justify-center ml-1 px-1.5 min-w-[38px] h-[22px] overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {isPlay ? (
              <motion.div
                key="play-icon"
                initial={{ scale: 0.2, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.2, rotate: 30, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'backOut' }}
                className="flex items-center justify-center text-white"
              >
                {/* SVG Play Triangle */}
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-3.5 h-3.5 drop-shadow-sm translate-x-[1px]"
                >
                  <path d="M7 5.24v13.52c0 .8.88 1.28 1.56.86l10.98-6.76a1 1 0 0 0 0-1.72L8.56 4.38A1 1 0 0 0 7 5.24z" />
                </svg>
              </motion.div>
            ) : (
              <motion.span
                key="hub-text"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="text-black font-extrabold text-[15px] tracking-tight leading-none"
              >
                Hub
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
