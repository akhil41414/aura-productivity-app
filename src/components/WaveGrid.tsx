import React, { useEffect, useRef } from 'react';

interface WaveGridProps {
  state: 'login' | 'transition' | 'chat_open' | 'chat_closed';
}

export const WaveGrid: React.FC<WaveGridProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;
    
    // Resize handler
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);
    
    // State variables for animation target values
    let targetBaselineY = height * 0.9;
    let targetAmplitude = 10;
    let targetColorProgress = 0; // 0 = Red/Pink, 1 = Blue/Cyan
    let targetOpacity = 0.3;
    
    // Current animated values (for smooth lerping)
    let currentBaselineY = height * 0.9;
    let currentAmplitude = 10;
    let currentColorProgress = 0;
    let currentOpacity = 0.3;
    
    let time = 0;
    
    const tick = () => {
      time += 0.04;
      
      // Update targets based on state
      if (state === 'login') {
        targetBaselineY = height * 0.95;
        targetAmplitude = 6;
        targetColorProgress = 0; // Red
        targetOpacity = 0.25;
      } else if (state === 'transition') {
        // Wave rises up during transition state - managed by the custom timeout sequence below
      } else if (state === 'chat_open') {
        targetBaselineY = height * 0.62;
        targetAmplitude = 12;
        targetColorProgress = 1; // Blue
        targetOpacity = 0.8;
      } else if (state === 'chat_closed') {
        targetBaselineY = height * 0.85;
        targetAmplitude = 8;
        targetColorProgress = 1; // Blue
        targetOpacity = 0.45;
      }
      
      // Smoothly interpolate current values to target values
      const lerpSpeed = 0.08;
      currentBaselineY += (targetBaselineY - currentBaselineY) * lerpSpeed;
      currentAmplitude += (targetAmplitude - currentAmplitude) * lerpSpeed;
      currentColorProgress += (targetColorProgress - currentColorProgress) * lerpSpeed;
      currentOpacity += (targetOpacity - currentOpacity) * lerpSpeed;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Colors
      // Red/Pink: rgb(236, 72, 153)
      // Blue/Cyan: rgb(6, 182, 212)
      const r1 = 236, g1 = 72, b1 = 153;
      const r2 = 6, g2 = 182, b2 = 212;
      
      const r = Math.round(r1 + (r2 - r1) * currentColorProgress);
      const g = Math.round(g1 + (g2 - g1) * currentColorProgress);
      const b = Math.round(b1 + (b2 - b1) * currentColorProgress);
      
      // Draw 3 overlapping smooth fluid liquid waves for a premium glowing color flow (no dots)
      drawLiquidWave(ctx, width, height, currentBaselineY, currentAmplitude, time, r, g, b, currentOpacity * 0.4, 0.007, 0);
      drawLiquidWave(ctx, width, height, currentBaselineY + 12, currentAmplitude * 0.75, time * 0.8, r, g, b, currentOpacity * 0.28, 0.01, Math.PI * 0.5);
      drawLiquidWave(ctx, width, height, currentBaselineY - 8, currentAmplitude * 0.6, time * 1.1, r, g, b, currentOpacity * 0.18, 0.013, Math.PI);
      
      animationId = requestAnimationFrame(tick);
    };
    
    // Custom timeline logic when 'transition' state is activated
    let settleTimeout: number | undefined = undefined;
    
    if (state === 'transition') {
      // Step 1: Immediately shoot baseline Y up towards center text (Y ~ 38%) and increase amplitude
      targetBaselineY = height * 0.38;
      targetAmplitude = 24;
      targetColorProgress = 0; // Keep it Red
      targetOpacity = 0.9;
      
      // Step 2: Settle down to normal chat level and blend color to blue
      settleTimeout = window.setTimeout(() => {
        targetBaselineY = height * 0.62;
        targetAmplitude = 12;
        targetColorProgress = 1; // Shift to Blue
        targetOpacity = 0.8;
      }, 750);
    }
    
    tick();
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (settleTimeout) {
        clearTimeout(settleTimeout);
      }
    };
  }, [state]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-10" 
      style={{ mixBlendMode: 'screen' }}
    />
  );
};

function drawLiquidWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baselineY: number,
  amplitude: number,
  time: number,
  r: number,
  g: number,
  b: number,
  opacity: number,
  frequency: number,
  phase: number
) {
  ctx.beginPath();
  ctx.moveTo(0, height);
  
  for (let x = 0; x <= width; x += 4) {
    const y = baselineY + Math.sin(x * frequency + time + phase) * amplitude;
    ctx.lineTo(x, y);
  }
  
  ctx.lineTo(width, height);
  ctx.closePath();
  
  // Create gradient
  const gradient = ctx.createLinearGradient(0, baselineY - amplitude, 0, height);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
  gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${opacity * 0.45})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  
  ctx.fillStyle = gradient;
  ctx.fill();
}

export default WaveGrid;
