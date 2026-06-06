class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterVolume = null;
    this.isMuted = false;
    this.isSlow = false;
    this.bgmIntervalId = null;
    this.bgmIndex = 0;
    this.initialized = false;
    
    // レトロゲーム風BGMのメロディとベース
    // Cメジャー/Aマイナーキーのシンプルなフレーズ
    this.melody = [
      'E5', 'G5', 'A5', null, 'E5', 'G5', 'B5', 'A5',
      'E5', 'G5', 'A5', null, 'G5', 'E5', 'D5', 'E5',
      'C5', 'D5', 'E5', null, 'G5', 'E5', 'C5', 'A4',
      'A4', 'C5', 'D5', 'E5', 'D5', 'C5', 'A4', null
    ];
    
    this.bass = [
      'A3', 'A3', 'C3', 'C3', 'D3', 'D3', 'E3', 'E3',
      'A3', 'A3', 'C3', 'C3', 'G3', 'G3', 'E3', 'E3',
      'F3', 'F3', 'C3', 'C3', 'G3', 'G3', 'E3', 'E3',
      'F3', 'F3', 'G3', 'G3', 'A3', 'E3', 'A3', null
    ];

    // 周波数マッピング
    this.noteFreqs = {
      'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
      'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
      'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77
    };

    // スケジューリング用の変数
    this.tempo = 120; // BPM
    this.nextNoteTime = 0.0;
    this.scheduleAheadTime = 0.1; // 秒
    this.lookahead = 25.0; // ミリ秒
    this.schedulerTimerId = null;
  }

  // ユーザー操作で初期化（ブラウザポリシー対応）
  init() {
    if (this.initialized) return;
    
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.connect(this.ctx.destination);
      this.masterVolume.gain.value = 0.15; // マスター音量を控えめに
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API is not supported", e);
    }
  }

  startBGM() {
    this.init();
    if (!this.initialized) return;
    if (this.schedulerTimerId) return; // 既に再生中の場合は二重起動を防ぐ
    this.nextNoteTime = this.ctx.currentTime;
    this.startScheduler();
  }

  setMute(mute) {
    this.isMuted = mute;
    if (!this.initialized) return;
    this.masterVolume.gain.value = mute ? 0 : 0.15;
  }

  toggleMute() {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  // 8bit風シンセ単音再生
  playTone(freq, type, duration, startVol, endVol, timeOffset = 0) {
    if (!this.initialized || this.isMuted) return;
    
    const time = this.ctx.currentTime + timeOffset;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = type; // 'square', 'sawtooth', 'triangle', 'sine'
    osc.frequency.value = freq;
    
    gainNode.gain.setValueAtTime(startVol, time);
    gainNode.gain.exponentialRampToValueAtTime(endVol, time + duration);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterVolume);
    
    osc.start(time);
    osc.stop(time + duration);
  }

  // ノイズジェネレータ（被弾・爆発用）
  playNoise(duration, startVol, endVol, lowpassFreq = 1000) {
    if (!this.initialized || this.isMuted) return;
    
    const time = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // ホワイトノイズ生成
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassFreq;
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(startVol, time);
    gainNode.gain.linearRampToValueAtTime(endVol, time + duration);
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterVolume);
    
    noiseSource.start(time);
    noiseSource.stop(time + duration);
  }

  // == 効果音 (SFX) ==
  
  // 選択音（ピッ）
  playSelect() {
    this.init();
    this.playTone(600, 'square', 0.08, 0.5, 0.01);
    setTimeout(() => {
      this.playTone(900, 'square', 0.1, 0.5, 0.01);
    }, 50);
  }

  // 開始音（ピロリロリーン）
  playStart() {
    this.init();
    const notes = [261, 329, 392, 523, 659, 783, 1046];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'square', 0.12, 0.3, 0.01, idx * 0.06);
    });
  }

  // 被弾時の爆発音（ドフッ）
  playHit() {
    this.init();
    // 低音ノイズ爆発
    this.playNoise(0.4, 0.8, 0.01, 300);
    // 低周波ピッチスライド
    this.playTone(180, 'sawtooth', 0.3, 0.6, 0.01);
  }

  // アイテム回収音（ピキーン）
  playCoin() {
    this.init();
    this.playTone(987, 'square', 0.08, 0.4, 0.01);
    setTimeout(() => {
      this.playTone(1318, 'square', 0.15, 0.4, 0.01);
    }, 70);
  }

  // バリア発動音（シュィィィン）
  playShield() {
    this.init();
    if (!this.initialized || this.isMuted) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(1200, time + 0.3);
    
    gainNode.gain.setValueAtTime(0.5, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterVolume);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  // スローモーション発動音（グォォォン）
  playSlowSfx() {
    this.init();
    if (!this.initialized || this.isMuted) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, time);
    osc.frequency.linearRampToValueAtTime(80, time + 0.4);
    
    gainNode.gain.setValueAtTime(0.6, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterVolume);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  // ゲームオーバー音（テレレレ〜〜ン）
  playGameOver() {
    this.init();
    const notes = [523, 493, 440, 392, 349, 329, 293, 261];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'sawtooth', 0.25, 0.4, 0.01, idx * 0.15);
    });
  }

  // == BGM シーケンサー ==

  startScheduler() {
    const scheduler = () => {
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
        this.scheduleNextNote(this.bgmIndex, this.nextNoteTime);
        this.advanceNote();
      }
      this.schedulerTimerId = setTimeout(scheduler, this.lookahead);
    };
    scheduler();
  }

  scheduleNextNote(index, time) {
    if (!this.initialized || this.isMuted) return;

    // メロディの再生 (矩形波)
    const melNote = this.melody[index];
    if (melNote && this.noteFreqs[melNote]) {
      const freq = this.noteFreqs[melNote];
      const duration = 60.0 / this.tempo * 0.5; // 8分音符
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.value = freq;
      
      gainNode.gain.setValueAtTime(0.12, time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration - 0.02);
      
      osc.connect(gainNode);
      gainNode.connect(this.masterVolume);
      
      osc.start(time);
      osc.stop(time + duration);
    }

    // ベースの再生 (三角波)
    const bassNote = this.bass[index];
    if (bassNote && this.noteFreqs[bassNote]) {
      const freq = this.noteFreqs[bassNote];
      const duration = 60.0 / this.tempo * 0.5;
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      gainNode.gain.setValueAtTime(0.25, time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration - 0.01);
      
      osc.connect(gainNode);
      gainNode.connect(this.masterVolume);
      
      osc.start(time);
      osc.stop(time + duration);
    }

    // 簡易ノイズドラム (4拍子)
    if (index % 4 === 0) {
      // バスドラム風（サイン波スイープ）
      const bdOsc = this.ctx.createOscillator();
      const bdGain = this.ctx.createGain();
      bdOsc.frequency.setValueAtTime(150, time);
      bdOsc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
      bdGain.gain.setValueAtTime(0.3, time);
      bdGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
      bdOsc.connect(bdGain);
      bdGain.connect(this.masterVolume);
      bdOsc.start(time);
      bdOsc.stop(time + 0.1);
    } else if (index % 4 === 2) {
      // スネア風（高域カットノイズ）
      const snDuration = 0.08;
      const bufferSize = this.ctx.sampleRate * snDuration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const snSource = this.ctx.createBufferSource();
      snSource.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      const snGain = this.ctx.createGain();
      snGain.gain.setValueAtTime(0.12, time);
      snGain.gain.exponentialRampToValueAtTime(0.01, time + snDuration);
      
      snSource.connect(filter);
      filter.connect(snGain);
      snGain.connect(this.masterVolume);
      snSource.start(time);
      snSource.stop(time + snDuration);
    }
  }

  advanceNote() {
    // 8分音符進める
    const secondsPerBeat = 60.0 / this.tempo;
    
    // スローモード時は進む時間を遅くする（結果としてテンポが低下する）
    const tempoModifier = this.isSlow ? 0.35 : 1.0;
    this.nextNoteTime += 0.5 * secondsPerBeat / tempoModifier;
    
    this.bgmIndex = (this.bgmIndex + 1) % this.melody.length;
  }

  stopBGM() {
    if (this.schedulerTimerId) {
      clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
  }
}

// グローバルで利用可能なインスタンスを作成
const audio = new AudioManager();
export default audio;
