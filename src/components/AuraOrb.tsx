import React from 'react';

interface AuraOrbProps {
  isThinking?: boolean;
  isFocused?: boolean;
}

export const AuraOrb: React.FC<AuraOrbProps> = ({ isThinking = false }) => {
  return (
    <div className={`relative select-none cursor-pointer flex items-center justify-center w-28 h-28 ${
      isThinking ? 'animate-bounce' : ''
    }`}>
      {/* Dinosaur Emoji with Hue shifting animation */}
      <span className="text-[64px] animate-emoji-glow relative z-10 select-none leading-none">🦖</span>
    </div>
  );
};

export default AuraOrb;
