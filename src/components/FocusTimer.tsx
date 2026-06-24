import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Compass, Radio } from 'lucide-react';
import { focusSound } from '../services/sound';
import { motion } from 'framer-motion';

interface FocusTimerProps {
  isFocused: boolean;
  onFocusChange: (focused: boolean) => void;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({ isFocused, onFocusChange }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 mins in seconds
  const [timerRunning, setTimerRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [soundType, setSoundType] = useState<'binaural' | 'ambient'>('binaural');
  const timerRef = useRef<any>(null);

  // Sync state with parent focus mode
  useEffect(() => {
    if (isFocused) {
      setTimerRunning(true);
      if (!isMuted) {
        focusSound.start(soundType);
      }
    } else {
      setTimerRunning(false);
      focusSound.stop();
    }
  }, [isFocused]);

  // Handle timer tick
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            onFocusChange(false);
            setTimerRunning(false);
            focusSound.stop();
            // Optional: trigger completion alert/sound
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, onFocusChange]);

  // Handle mute/unmute
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (isFocused) {
        focusSound.start(soundType);
      }
    } else {
      setIsMuted(true);
      focusSound.stop();
    }
  };

  // Change sound type
  const handleSoundTypeChange = (type: 'binaural' | 'ambient') => {
    setSoundType(type);
    if (isFocused && !isMuted) {
      focusSound.start(type);
    }
  };

  const handleStartPause = () => {
    const nextState = !timerRunning;
    setTimerRunning(nextState);
    onFocusChange(nextState);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    onFocusChange(false);
    setTimeLeft(25 * 60);
    focusSound.stop();
  };

  // Format time (MM:SS)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-panel p-6 flex flex-col h-full justify-between relative overflow-hidden">
      {/* Absolute top decoration */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
      
      <div>
        <h3 className="text-white font-semibold text-lg font-heading tracking-wide mb-2 flex items-center justify-between">
          <span>Focus Core</span>
          <span className={`w-2 h-2 rounded-full ${timerRunning ? 'bg-purple-500 animate-pulse' : 'bg-zinc-600'}`} />
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Binaural hums sync brain waves to lock in deep concentration.
        </p>

        {/* Large Countdown */}
        <div className="text-center my-6">
          <motion.div 
            className="text-6xl font-extrabold font-heading text-white tracking-tighter"
            animate={{ scale: timerRunning ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            {formatTime(timeLeft)}
          </motion.div>
          <div className="text-xs text-purple-400 font-semibold tracking-widest mt-1 uppercase">
            {timerRunning ? 'Deep Focus Session Active' : 'Session Paused'}
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div className="flex justify-center gap-4 my-6">
          <button 
            onClick={handleStartPause}
            className={`flex items-center justify-center w-12 h-12 rounded-full ${
              timerRunning 
                ? 'bg-zinc-800 text-white hover:bg-zinc-700' 
                : 'bg-white text-black hover:bg-slate-200'
            }`}
            title={timerRunning ? 'Pause Session' : 'Start Focus Session'}
          >
            {timerRunning ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
          </button>
          
          <button 
            onClick={resetTimer}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 text-slate-300 hover:text-white hover:border-zinc-700"
            title="Reset Timer"
          >
            <RotateCcw size={18} />
          </button>

          <button 
            onClick={toggleMute}
            className={`flex items-center justify-center w-12 h-12 rounded-full border transition-all ${
              isMuted 
                ? 'bg-red-950/40 border-red-500/30 text-red-400 hover:bg-red-900/40' 
                : 'bg-zinc-900 border-zinc-800 text-slate-300 hover:text-white'
            }`}
            title={isMuted ? 'Unmute Focus Sound' : 'Mute Focus Sound'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      {/* Sound Type Selector */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">
          Focus Frequency
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSoundTypeChange('binaural')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
              soundType === 'binaural'
                ? 'bg-purple-900/30 border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(124,58,237,0.15)]'
                : 'bg-zinc-950/40 border-zinc-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio size={14} />
            <span>Binaural Beats</span>
          </button>
          
          <button
            onClick={() => handleSoundTypeChange('ambient')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
              soundType === 'ambient'
                ? 'bg-purple-900/30 border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(124,58,237,0.15)]'
                : 'bg-zinc-950/40 border-zinc-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass size={14} />
            <span>Deep Hum</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default FocusTimer;
