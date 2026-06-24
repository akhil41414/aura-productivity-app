class FocusSoundManager {
  private ctx: AudioContext | null = null;
  private primaryOsc: OscillatorNode | null = null;
  private secondaryOsc: OscillatorNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;

  start(type: 'binaural' | 'ambient' = 'binaural') {
    this.stop();

    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.filterNode = this.ctx.createBiquadFilter();

      // Low-pass filter to make it soft and warm
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(300, this.ctx.currentTime);

      if (type === 'binaural') {
        // Binaural beats (120Hz left, 126Hz right for a 6Hz theta brainwave focus state)
        this.primaryOsc = this.ctx.createOscillator();
        this.primaryOsc.type = 'sine';
        this.primaryOsc.frequency.setValueAtTime(120, this.ctx.currentTime);

        this.secondaryOsc = this.ctx.createOscillator();
        this.secondaryOsc.type = 'sine';
        this.secondaryOsc.frequency.setValueAtTime(126, this.ctx.currentTime);

        const leftGain = this.ctx.createGain();
        const rightGain = this.ctx.createGain();
        leftGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        rightGain.gain.setValueAtTime(0.5, this.ctx.currentTime);

        this.primaryOsc.connect(leftGain);
        this.secondaryOsc.connect(rightGain);

        // Map left osc to left channel, right osc to right channel
        // For simple output we can just merge them or connect directly
        leftGain.connect(this.filterNode);
        rightGain.connect(this.filterNode);

        this.primaryOsc.start();
        this.secondaryOsc.start();
      } else {
        // Ambient soft deep hum (simulating rain/waves via frequency modulation)
        this.primaryOsc = this.ctx.createOscillator();
        this.primaryOsc.type = 'triangle';
        this.primaryOsc.frequency.setValueAtTime(80, this.ctx.currentTime);

        // Low frequency modulator to create "wave" breathing effect
        const modulator = this.ctx.createOscillator();
        const modulatorGain = this.ctx.createGain();
        modulator.frequency.setValueAtTime(0.2, this.ctx.currentTime); // 0.2Hz
        modulatorGain.gain.setValueAtTime(10, this.ctx.currentTime); // modulate frequency by 10Hz

        modulator.connect(modulatorGain);
        modulatorGain.connect(this.primaryOsc.frequency);

        this.primaryOsc.connect(this.filterNode);
        
        modulator.start();
        this.primaryOsc.start();
      }

      // Very low volume, background focus sound
      this.gainNode.gain.setValueAtTime(0.06, this.ctx.currentTime);
      
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);
    } catch (e) {
      console.error('Failed to initialize focus sound:', e);
    }
  }

  setVolume(volume: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  stop() {
    if (this.primaryOsc) {
      try { this.primaryOsc.stop(); } catch(e) {}
      this.primaryOsc.disconnect();
      this.primaryOsc = null;
    }
    if (this.secondaryOsc) {
      try { this.secondaryOsc.stop(); } catch(e) {}
      this.secondaryOsc.disconnect();
      this.secondaryOsc = null;
    }
    if (this.filterNode) {
      this.filterNode.disconnect();
      this.filterNode = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const focusSound = new FocusSoundManager();
