import React from 'react';
import { motion } from 'framer-motion';

interface AuraOrbProps {
  isThinking: boolean;
  isFocused: boolean;
}

export const AuraOrb: React.FC<AuraOrbProps> = ({ isThinking, isFocused }) => {
  // Select color combinations based on state
  const colors = isThinking
    ? ['#3b82f6', '#ec4899', '#8b5cf6'] // Dynamic cycling
    : isFocused
    ? ['#7c3aed', '#5b21b6', '#3b0764'] // Deep focus purples
    : ['#3b82f6', '#8b5cf6', '#1d4ed8']; // Cool blue/indigo defaults

  return (
    <div className="relative flex items-center justify-center w-52 h-52 mx-auto my-8">
      {/* Background soft blur rings */}
      <motion.div
        className="absolute rounded-full w-full h-full filter blur-xl opacity-40"
        style={{ background: `radial-gradient(circle, ${colors[0]} 0%, transparent 70%)` }}
        animate={{
          scale: isThinking ? [1, 1.2, 1] : [1, 1.08, 1],
          opacity: isThinking ? [0.4, 0.6, 0.4] : [0.35, 0.45, 0.35],
        }}
        transition={{
          duration: isThinking ? 1.5 : 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute rounded-full w-40 h-40 filter blur-lg opacity-60"
        style={{ background: `radial-gradient(circle, ${colors[1] || colors[0]} 0%, transparent 70%)` }}
        animate={{
          scale: isThinking ? [1, 1.15, 1] : [1, 1.05, 1],
          rotate: [0, 360],
        }}
        transition={{
          scale: { duration: isThinking ? 2 : 5, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 15, repeat: Infinity, ease: 'linear' }
        }}
      />

      {/* Main Core Orb */}
      <motion.div
        className="relative z-10 w-28 h-28 rounded-full flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1] || colors[0]} 50%, ${colors[2] || colors[0]} 100%)`,
          boxShadow: `0 0 35px ${colors[0]}80, inset 0 0 15px rgba(255, 255, 255, 0.3)`
        }}
        animate={{
          scale: isThinking ? [1, 1.08, 0.96, 1.02, 1] : [1, 1.02, 1],
        }}
        transition={{
          duration: isThinking ? 1.8 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Soft moving specular shine inside */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20 rounded-full" />
        
        {/* State Label */}
        <div className="text-white text-xs font-semibold tracking-widest uppercase opacity-90 select-none">
          {isThinking ? 'AURA...' : isFocused ? 'FOCUS' : 'READY'}
        </div>
      </motion.div>

      {/* Outer spinning orbital dust/dots */}
      {isThinking && (
        <motion.div
          className="absolute border border-dashed border-white/20 rounded-full w-44 h-44"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
};
export default AuraOrb;
