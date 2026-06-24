import React from 'react';
import { motion } from 'framer-motion';

interface AuraOrbProps {
  isThinking: boolean;
  isFocused: boolean;
}

export const AuraOrb: React.FC<AuraOrbProps> = ({ isThinking, isFocused }) => {
  // Glow colors based on state
  const colors = isThinking
    ? ['#06b6d4', '#d946ef', '#8b5cf6'] // Dynamic gradient loop
    : isFocused
    ? ['#8b5cf6', '#d946ef', '#4c1d95'] // Focused deep violet/pink
    : ['#06b6d4', '#6366f1', '#3b82f6']; // Idle cyan/indigo

  return (
    <div className="relative flex items-center justify-center w-64 h-64 mx-auto my-6 select-none">
      {/* 1. Giant blurred backdrop aura glow */}
      <motion.div
        className="absolute rounded-full w-56 h-56 filter blur-3xl opacity-50"
        style={{
          background: `radial-gradient(circle, ${colors[0]} 0%, ${colors[1]} 50%, transparent 100%)`
        }}
        animate={{
          scale: isThinking ? [1, 1.25, 0.95, 1.1, 1] : [1, 1.1, 1],
          opacity: isThinking ? [0.4, 0.7, 0.4] : [0.45, 0.55, 0.45]
        }}
        transition={{
          duration: isThinking ? 2.5 : 6,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      {/* 2. Concentric Orbit Ring 1 (Thin dashed cyan/violet spinner) */}
      <motion.div
        className="absolute border border-dashed border-cyan-500/20 rounded-full w-52 h-52"
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      />

      {/* 3. Concentric Orbit Ring 2 (Thin solid pink spinner) */}
      <motion.div
        className="absolute border border-pink-500/10 rounded-full w-44 h-44"
        animate={{ rotate: -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      {/* 4. Glowing Particle Dots orbiting the core */}
      <motion.div
        className="absolute w-2 h-2 rounded-full bg-cyan-400 filter blur-[1px]"
        style={{ top: '15%', left: '15%' }}
        animate={{
          x: [0, 160, 160, 0, 0],
          y: [0, 0, 160, 160, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <motion.div
        className="absolute w-2 h-2 rounded-full bg-pink-400 filter blur-[1px]"
        style={{ bottom: '15%', right: '15%' }}
        animate={{
          x: [0, -160, -160, 0, 0],
          y: [0, 0, -160, -160, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* 5. Liquid Metallic Core Orb */}
      <motion.div
        className="relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center overflow-hidden border border-white/20"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(0,0,0,0.4) 100%)`,
          boxShadow: `0 0 40px ${colors[0]}70, inset 0 0 20px rgba(255,255,255,0.1), inset 0 8px 12px rgba(255,255,255,0.15)`
        }}
        animate={{
          scale: isThinking ? [1, 1.05, 0.97, 1.02, 1] : [1, 1.03, 1],
          y: [0, -4, 0]
        }}
        transition={{
          scale: { duration: isThinking ? 2 : 4, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
        }}
      >
        {/* Soft glass glare reflections */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

        {/* Dynamic color-mesh filling the core */}
        <motion.div
          className="absolute inset-2 rounded-full filter blur-md opacity-80 mix-blend-color-dodge -z-10"
          style={{
            background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`
          }}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: isThinking ? 4 : 10,
            repeat: Infinity,
            ease: 'linear'
          }}
        />

        {/* State text inside core */}
        <div className="text-[10px] font-heading font-extrabold tracking-[0.25em] text-white/95 uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] select-none">
          {isThinking ? 'Thinking' : isFocused ? 'Focusing' : 'Aura'}
        </div>
        <div className="text-[8px] font-sans font-medium text-slate-400/90 tracking-widest uppercase mt-0.5 select-none">
          {isThinking ? 'Syncing...' : isFocused ? 'Binaural' : 'Ready'}
        </div>
      </motion.div>
    </div>
  );
};
export default AuraOrb;
