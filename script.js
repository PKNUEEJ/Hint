/**
 * K1A1 전차 실사형 공도 작전 (Vanilla JavaScript ES6+ Edition)
 * GitHub Pages /(root) 경로에서 별도의 빌드 도구(Vite, Webpack, TypeScript 등) 없이
 * index.html + script.js 만으로 즉시 실행 가능한 순수 바닐라 자바스크립트 전체 구현본입니다.
 */

(function () {
  'use strict';

  // Helper for Three.js colorSpace / encoding compatibility across CDN versions
  function setTextureSRGB(texture) {
    if (typeof THREE !== 'undefined') {
      if ('SRGBColorSpace' in THREE) {
        texture.colorSpace = THREE.SRGBColorSpace;
      } else if ('sRGBEncoding' in THREE) {
        texture.encoding = THREE.sRGBEncoding;
      }
    }
  }

  /* ========================================================================== */
  /* 1. WEB AUDIO API PROCEDURAL SOUND ENGINE (K1A1 & COMBAT SFX)               */
  /* ========================================================================== */
  class TankAudioEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.engineGain = null;
      this.engineOsc = null;
      this.engineFilter = null;
      this.turretOsc = null;
      this.turretGain = null;
      this.noiseBuffer = null;
      this.muted = false;
      this.engineStarted = false;

      try {
        this.muted = localStorage.getItem('k1a1_muted') === 'true';
      } catch (e) {
        this.muted = false;
      }
    }

    init() {
      if (!this.ctx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtxClass) return;
        this.ctx = new AudioCtxClass();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.4;
        this.masterGain.connect(this.ctx.destination);

        const bufferSize = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        this.initEngineSound();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    initEngineSound() {
      if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(42, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();

      this.turretOsc = this.ctx.createOscillator();
      this.turretOsc.type = 'triangle';
      this.turretOsc.frequency.setValueAtTime(320, this.ctx.currentTime);

      this.turretGain = this.ctx.createGain();
      this.turretGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.turretOsc.connect(this.turretGain);
      this.turretGain.connect(this.masterGain);
      this.turretOsc.start();

      this.engineStarted = true;
    }

    setMuted(muted) {
      this.muted = muted;
      try {
        localStorage.setItem('k1a1_muted', String(muted));
      } catch (e) {}
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(muted ? 0 : 0.4, this.ctx.currentTime);
      }
    }

    isMuted() {
      return this.muted;
    }

    updateEngineSound(speed, isAccelerating) {
      if (!this.engineStarted || !this.ctx || !this.engineOsc || !this.engineFilter || !this.engineGain) {
        return;
      }
      const absSpeed = Math.abs(speed);
      const speedRatio = Math.min(1, absSpeed / 0.25);
      const targetFreq = 42 + speedRatio * 45 + (isAccelerating ? 15 : 0);
      const targetFilter = 140 + speedRatio * 200 + (isAccelerating ? 60 : 0);
      const targetGain = 0.08 + speedRatio * 0.12 + (isAccelerating ? 0.05 : 0);

      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.1);
      this.engineFilter.frequency.setTargetAtTime(targetFilter, t, 0.1);
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : targetGain, t, 0.1);
    }

    setTurretTraversing(isTraversing) {
      if (!this.engineStarted || !this.ctx || !this.turretGain) return;
      const t = this.ctx.currentTime;
      const target = isTraversing && !this.muted ? 0.06 : 0;
      this.turretGain.gain.setTargetAtTime(target, t, 0.08);
    }

    playCannonFire() {
      this.init();
      if (this.muted || !this.ctx || !this.masterGain || !this.noiseBuffer) return;

      const t = this.ctx.currentTime;

      const noiseCrack = this.ctx.createBufferSource();
      noiseCrack.buffer = this.noiseBuffer;
      const crackFilter = this.ctx.createBiquadFilter();
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(1400, t);
      crackFilter.frequency.exponentialRampToValueAtTime(120, t + 0.35);

      const crackGain = this.ctx.createGain();
      crackGain.gain.setValueAtTime(0.8, t);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      noiseCrack.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.masterGain);
      noiseCrack.start(t);
      noiseCrack.stop(t + 0.46);

      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(110, t);
      subOsc.frequency.exponentialRampToValueAtTime(24, t + 0.55);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.95, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(t);
      subOsc.stop(t + 0.62);

      const ringOsc = this.ctx.createOscillator();
      ringOsc.type = 'triangle';
      ringOsc.frequency.setValueAtTime(540, t + 0.1);
      ringOsc.frequency.exponentialRampToValueAtTime(220, t + 0.5);

      const ringGain = this.ctx.createGain();
      ringGain.gain.setValueAtTime(0.001, t);
      ringGain.gain.setValueAtTime(0.15, t + 0.12);
      ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      ringOsc.connect(ringGain);
      ringGain.connect(this.masterGain);
      ringOsc.start(t + 0.1);
      ringOsc.stop(t + 0.5);
    }

    playMassiveExplosion() {
      this.init();
      if (this.muted || !this.ctx || !this.masterGain || !this.noiseBuffer) return;

      const t = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, t);
      filter.frequency.exponentialRampToValueAtTime(50, t + 0.7);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.76);
    }

    playCrash() {
      this.init();
      if (this.muted || !this.ctx || !this.masterGain) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    }

    playSuccessChime() {
      this.init();
      if (this.muted || !this.ctx || !this.masterGain) return;

      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.26);
      });
    }

    playSquish() {
      this.init();
      if (this.muted || !this.ctx || !this.masterGain || !this.noiseBuffer) return;

      const t = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + 0.35);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.39);

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.5, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.23);
    }

    playEnemyCannonFire() {
      this.init();
      if (this.muted || !this.ctx || !this.masterGain || !this.noiseBuffer) return;

      const t = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(70, t + 0.45);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.52);

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.4, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.4);
    }

    playRocketLaunch() {
      this.init();
      if (this.muted || !this.ctx || !this.masterGain || !this.noiseBuffer) return;

      const t = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(500, t);
      filter.frequency.linearRampToValueAtTime(1800, t + 0.15);
      filter.frequency.exponentialRampToValueAtTime(250, t + 0.5);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.58);
    }

    playTankHitArmor() {
      this.init();
      if (this.muted || !this.ctx || !this.masterGain || !this.noiseBuffer) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.4);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.65, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.48);

      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + 0.45);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.5);
    }

    playEnemyUnitDestroyed() {
      this.init();
      if (this.muted || !this.ctx || !this.masterGain || !this.noiseBuffer) return;

      const t = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.frequency.exponentialRampToValueAtTime(45, t + 0.85);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.85, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.92);

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(85, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.6);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.6, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.66);
    }
  }

  const tankAudioEngine = new TankAudioEngine();

  /* ========================================================================== */
  /* 2. PHYSICS, BALLISTICS, AND COMBAT RULES                                   */
  /* ========================================================================== */
  function updateTankMovement(state, inputs, dt) {
    if (inputs.throttle > 0) {
      if (state.speed < 0) {
        state.speed += state.braking * dt * 60;
      } else {
        state.speed += state.acceleration * dt * 60;
      }
    } else if (inputs.throttle < 0) {
      if (state.speed > 0) {
        state.speed -= state.braking * dt * 60;
      } else {
        state.speed -= state.acceleration * dt * 60;
      }
    } else {
      state.speed *= Math.pow(state.friction, dt * 60);
      if (Math.abs(state.speed) < 0.001) state.speed = 0;
    }

    state.speed = Math.max(state.minSpeed, Math.min(state.maxSpeed, state.speed));

    if (inputs.steer !== 0) {
      const isReversing = state.speed < -0.01;
      const steerDir = isReversing ? -inputs.steer : inputs.steer;
      state.angle -= steerDir * state.turnSpeed * dt * 60;
    }

    state.x += -Math.sin(state.angle) * state.speed * dt * 60;
    state.z += -Math.cos(state.angle) * state.speed * dt * 60;
  }

  function checkParkingSuccess(tankX, tankZ, tankSpeed, slot) {
    if (Math.abs(tankSpeed) > 0.02) return false;
    const dx = Math.abs(tankX - slot.x);
    const dz = Math.abs(tankZ - slot.z);
    return dx <= slot.width / 2 - 0.4 && dz <= slot.length / 2 - 0.6;
  }

  function checkCrushInfantry(tankX, tankZ, soldierX, soldierZ, crushRadius = 2.4) {
    const dx = tankX - soldierX;
    const dz = tankZ - soldierZ;
    return (dx * dx + dz * dz) <= (crushRadius * crushRadius);
  }

  function calculateEnemyWaveComposition(parkingWave) {
    const wave = Math.max(0, Math.floor(parkingWave));
    const tankCount = Math.min(8, 2 + Math.floor((wave + 1) / 2));
    const infantryCount = Math.min(14, 2 + wave * 2);
    return {
      tankCount,
      infantryCount,
      totalCount: tankCount + infantryCount,
    };
  }

  function calculateCraterSuspensionBump(tankX, tankZ, craters, time) {
    for (let i = 0; i < craters.length; i++) {
      const crater = craters[i];
      const dx = tankX - crater.x;
      const dz = tankZ - crater.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < crater.radius) {
        const depthFactor = 1 - dist / crater.radius;
        const vibration = Math.sin(time * 0.025) * 0.35 * depthFactor;
        return {
          yOffset: -crater.depth * depthFactor + vibration,
          tilt: (dx / crater.radius) * 0.25,
        };
      }
    }
    return { yOffset: 0, tilt: 0 };
  }

  function updateLeaderboard(records, newRecord) {
    const combined = [...records, newRecord];
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, 5).map((rec, index) => ({
      ...rec,
      rank: index + 1,
    }));
  }

  function updateEnemyAI(enemy, playerX, playerZ, dt) {
    if (!enemy.alive) return { shouldFire: false, targetAngle: enemy.turretAngle };

    const dx = playerX - enemy.x;
    const dz = playerZ - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const targetAngle = Math.atan2(-dx, -dz);

    let diff = targetAngle - enemy.turretAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    const turnStep = 2.5 * dt;
    if (Math.abs(diff) < turnStep) {
      enemy.turretAngle = targetAngle;
    } else {
      enemy.turretAngle += Math.sign(diff) * turnStep;
    }

    enemy.reloadTimer += dt;
    const inRange = dist <= enemy.attackRange;
    const aimedClose = Math.abs(diff) < 0.4;

    if (inRange && aimedClose && enemy.reloadTimer >= enemy.reloadInterval) {
      enemy.reloadTimer = 0;
      return { shouldFire: true, targetAngle };
    }

    return { shouldFire: false, targetAngle };
  }

  /* ========================================================================== */
  /* 3. 3D MODELS (K1A1, KIM JONG-UN MINIATURE, ROK SOLDIERS, KPA FORCES)       */
  /* ========================================================================== */
  function createCamoTexture(width = 1024, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#657a55';
    ctx.fillRect(0, 0, width, height);

    const camoColors = ['#495e3f', '#8c6a4e', '#9e7b5c', '#2c302e'];

    for (let i = 0; i < 48; i++) {
      const col = camoColors[i % camoColors.length];
      ctx.fillStyle = col;
      ctx.beginPath();
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      const r = 50 + Math.random() * 110;

      ctx.moveTo(cx + r, cy);
      for (let a = 0; a < Math.PI * 2; a += 0.35) {
        const dist = r * (0.65 + Math.random() * 0.75);
        ctx.lineTo(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(20, 25, 20, 0.4)';
    ctx.lineWidth = 3;
    for (let y = 150; y < height; y += 220) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.fillText('101', 120, 210);
    ctx.fillText('101', 680, 210);
    ctx.fillText('101', 400, 720);

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(250, 220);
    ctx.lineTo(270, 180);
    ctx.lineTo(290, 220);
    ctx.stroke();

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.5, 1.5);
    setTextureSRGB(texture);
    return texture;
  }

  function createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2d333b';
    ctx.fillRect(0, 0, 1024, 1024);

    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 28;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.fillStyle = 'rgba(18, 22, 28, 0.25)';
    ctx.fillRect(180, 0, 140, 1024);
    ctx.fillRect(700, 0, 140, 1024);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 16);
    setTextureSRGB(texture);
    return texture;
  }

  function createRealisticK1A1Tank() {
    const tankGroup = new THREE.Group();
    const camoTex = createCamoTexture();

    const armorMat = new THREE.MeshStandardMaterial({
      map: camoTex,
      roughness: 0.52,
      metalness: 0.28,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x24282c,
      roughness: 0.42,
      metalness: 0.65,
    });
    const gunSteelMat = new THREE.MeshStandardMaterial({
      color: 0x32373e,
      roughness: 0.38,
      metalness: 0.72,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x1e2023,
      roughness: 0.88,
      metalness: 0.08,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.1,
      metalness: 0.85,
    });

    const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.75, 6.2), darkMetalMat);
    lowerHull.position.y = 0.65;
    lowerHull.castShadow = true;
    lowerHull.receiveShadow = true;
    tankGroup.add(lowerHull);

    const upperHull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.65, 5.8), armorMat);
    upperHull.position.set(0, 1.15, 0.1);
    upperHull.castShadow = true;
    upperHull.receiveShadow = true;
    tankGroup.add(upperHull);

    const glacis = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, 1.4), armorMat);
    glacis.rotation.x = -Math.PI / 6;
    glacis.position.set(0, 1.05, -2.9);
    glacis.castShadow = true;
    tankGroup.add(glacis);

    const flapMat = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.9 });
    const flapFrontL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.1), flapMat);
    flapFrontL.position.set(-1.6, 0.75, -3.25);
    tankGroup.add(flapFrontL);

    const flapFrontR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.1), flapMat);
    flapFrontR.position.set(1.6, 0.75, -3.25);
    tankGroup.add(flapFrontR);

    const engineDeck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.8), darkMetalMat);
    engineDeck.position.set(0, 1.5, 1.9);
    engineDeck.castShadow = true;
    tankGroup.add(engineDeck);

    const auxTankMat = new THREE.MeshStandardMaterial({ map: camoTex, roughness: 0.6 });
    const auxTankL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 16), auxTankMat);
    auxTankL.rotation.z = Math.PI / 2;
    auxTankL.position.set(-1.1, 1.25, 3.2);
    auxTankL.castShadow = true;
    tankGroup.add(auxTankL);

    const auxTankR = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 16), auxTankMat);
    auxTankR.rotation.z = Math.PI / 2;
    auxTankR.position.set(1.1, 1.25, 3.2);
    auxTankR.castShadow = true;
    tankGroup.add(auxTankR);

    const skirtGeo = new THREE.BoxGeometry(0.12, 0.75, 5.6);
    const skirtL = new THREE.Mesh(skirtGeo, armorMat);
    skirtL.position.set(-1.8, 0.85, 0);
    skirtL.castShadow = true;
    tankGroup.add(skirtL);

    const skirtR = new THREE.Mesh(skirtGeo, armorMat);
    skirtR.position.set(1.8, 0.85, 0);
    skirtR.castShadow = true;
    tankGroup.add(skirtR);

    const wheels = [];
    const wheelHubMat = new THREE.MeshStandardMaterial({ map: camoTex, roughness: 0.5 });
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.85 });

    for (let i = 0; i < 6; i++) {
      const zPos = -2.1 + i * 0.84;
      for (let side = -1; side <= 1; side += 2) {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(side * 1.6, 0.42, zPos);

        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.45, 18), wheelRimMat);
        rim.rotation.z = Math.PI / 2;
        rim.castShadow = true;
        wheelGroup.add(rim);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.48, 12), wheelHubMat);
        hub.rotation.z = Math.PI / 2;
        wheelGroup.add(hub);

        tankGroup.add(wheelGroup);
        wheels.push(rim);
      }
    }

    const trackGeo = new THREE.BoxGeometry(0.65, 0.88, 6.2);
    const tracksL = new THREE.Mesh(trackGeo, rubberMat);
    tracksL.position.set(-1.6, 0.45, 0);
    tracksL.castShadow = true;
    tankGroup.add(tracksL);

    const tracksR = new THREE.Mesh(trackGeo, rubberMat);
    tracksR.position.set(1.6, 0.45, 0);
    tracksR.castShadow = true;
    tankGroup.add(tracksR);

    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.5, -0.2);

    const turretBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.85, 3.2), armorMat);
    turretBody.position.y = 0.42;
    turretBody.castShadow = true;
    turretGroup.add(turretBody);

    const cheekGeo = new THREE.BoxGeometry(0.85, 0.78, 1.8);
    const cheekL = new THREE.Mesh(cheekGeo, armorMat);
    cheekL.rotation.y = Math.PI / 12;
    cheekL.position.set(-1.1, 0.42, -0.9);
    cheekL.castShadow = true;
    turretGroup.add(cheekL);

    const cheekR = new THREE.Mesh(cheekGeo, armorMat);
    cheekR.rotation.y = -Math.PI / 12;
    cheekR.position.set(1.1, 0.42, -0.9);
    cheekR.castShadow = true;
    turretGroup.add(cheekR);

    const bustle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.1), darkMetalMat);
    bustle.position.set(0, 0.5, 1.8);
    bustle.castShadow = true;
    turretGroup.add(bustle);

    const mantlet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.8), armorMat);
    mantlet.position.set(0, 0.4, -1.8);
    mantlet.castShadow = true;
    turretGroup.add(mantlet);

    const recoilGroup = new THREE.Group();
    recoilGroup.position.set(0, 0.4, -2.1);

    const barrelGeo = new THREE.CylinderGeometry(0.14, 0.18, 5.2, 18);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMesh = new THREE.Mesh(barrelGeo, gunSteelMat);
    barrelMesh.position.set(0, 0, -2.5);
    barrelMesh.castShadow = true;
    recoilGroup.add(barrelMesh);

    const evacuatorGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.1, 16);
    evacuatorGeo.rotateX(Math.PI / 2);
    const evacuator = new THREE.Mesh(evacuatorGeo, armorMat);
    evacuator.position.set(0, 0, -2.2);
    evacuator.castShadow = true;
    recoilGroup.add(evacuator);

    const muzzleGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.35, 16);
    muzzleGeo.rotateX(Math.PI / 2);
    const muzzle = new THREE.Mesh(muzzleGeo, gunSteelMat);
    muzzle.position.set(0, 0, -5.1);
    muzzle.castShadow = true;
    recoilGroup.add(muzzle);

    turretGroup.add(recoilGroup);

    const kcps = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.45, 16), darkMetalMat);
    kcps.position.set(-0.75, 1.05, 0.3);
    kcps.castShadow = true;
    turretGroup.add(kcps);

    const opticL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.1), glassMat);
    opticL.position.set(-0.75, 1.1, 0.1);
    turretGroup.add(opticL);

    const gps = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.55), darkMetalMat);
    gps.position.set(0.75, 0.95, -0.6);
    gps.castShadow = true;
    turretGroup.add(gps);

    for (let s = -1; s <= 1; s += 2) {
      const launcherGroup = new THREE.Group();
      launcherGroup.position.set(s * 1.35, 0.65, -0.7);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const tubeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8);
          tubeGeo.rotateX(Math.PI / 3);
          const tube = new THREE.Mesh(tubeGeo, darkMetalMat);
          tube.position.set(0, r * 0.15, c * 0.15);
          tube.castShadow = true;
          launcherGroup.add(tube);
        }
      }
      turretGroup.add(launcherGroup);
    }

    const mg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 1.1), darkMetalMat);
    mg.position.set(-0.75, 1.35, 0.1);
    mg.castShadow = true;
    turretGroup.add(mg);

    const antennaGeo = new THREE.CylinderGeometry(0.02, 0.03, 2.4, 6);
    const antennaL = new THREE.Mesh(antennaGeo, darkMetalMat);
    antennaL.position.set(-1.0, 1.8, 1.4);
    turretGroup.add(antennaL);

    const antennaR = new THREE.Mesh(antennaGeo, darkMetalMat);
    antennaR.position.set(1.0, 1.8, 1.4);
    turretGroup.add(antennaR);

    tankGroup.add(turretGroup);

    const lightGeo = new THREE.BoxGeometry(0.25, 0.2, 0.15);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlMeshL = new THREE.Mesh(lightGeo, lightMat);
    hlMeshL.position.set(-1.3, 1.1, -2.85);
    tankGroup.add(hlMeshL);

    const hlMeshR = new THREE.Mesh(lightGeo, lightMat);
    hlMeshR.position.set(1.3, 1.1, -2.85);
    tankGroup.add(hlMeshR);

    const headlightL = new THREE.SpotLight(0xfff8db, 4.0, 45, Math.PI / 5, 0.35);
    headlightL.position.set(-1.3, 1.1, -2.9);
    headlightL.target.position.set(-1.3, 0, -30);
    tankGroup.add(headlightL);
    tankGroup.add(headlightL.target);

    const headlightR = new THREE.SpotLight(0xfff8db, 4.0, 45, Math.PI / 5, 0.35);
    headlightR.position.set(1.3, 1.1, -2.9);
    headlightR.target.position.set(1.3, 0, -30);
    tankGroup.add(headlightR);
    tankGroup.add(headlightR.target);

    return {
      tankGroup,
      turretGroup,
      barrelMesh,
      recoilGroup,
      wheels,
      tracksL,
      tracksR,
      headlightL,
      headlightR,
      antennaL,
      antennaR,
    };
  }

  function createKimJongUnMiniature() {
    const group = new THREE.Group();

    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x22272e,
      roughness: 0.58,
      metalness: 0.15,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfbd0b3,
      roughness: 0.42,
      metalness: 0.05,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x0c0d10,
      roughness: 0.3,
      metalness: 0.25,
    });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.7,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.25,
      metalness: 0.8,
    });
    const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.45, 28), goldMat);
    pedestal.position.y = 0.225;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    group.add(pedestal);

    const starMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.48, 5), redMat);
    starMesh.position.set(0, 0.24, 1.25);
    starMesh.rotation.x = Math.PI / 4;
    group.add(starMesh);

    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.65), shoeMat);
    shoeL.position.set(-0.35, 0.54, 0.05);
    shoeL.castShadow = true;
    group.add(shoeL);

    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.65), shoeMat);
    shoeR.position.set(0.35, 0.54, 0.05);
    shoeR.castShadow = true;
    group.add(shoeR);

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.1, 16), suitMat);
    legL.position.set(-0.35, 1.1, 0);
    legL.castShadow = true;
    group.add(legL);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.1, 16), suitMat);
    legR.position.set(0.35, 1.1, 0);
    legR.castShadow = true;
    group.add(legR);

    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 2.15, 0);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.92, 1.05), suitMat);
    chest.castShadow = true;
    torsoGroup.add(chest);

    const bellyGeo = new THREE.SphereGeometry(0.7, 18, 18);
    bellyGeo.scale(1.22, 0.92, 1.12);
    const belly = new THREE.Mesh(bellyGeo, suitMat);
    belly.position.set(0, -0.25, 0.12);
    belly.castShadow = true;
    torsoGroup.add(belly);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.25, 16), suitMat);
    collar.position.set(0, 0.5, 0);
    torsoGroup.add(collar);

    for (let i = 0; i < 5; i++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), goldMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, 0.35 - i * 0.16, 0.56 + (i > 1 ? 0.12 : 0));
      torsoGroup.add(btn);
    }

    const pocketGeo = new THREE.BoxGeometry(0.36, 0.08, 0.06);
    const pocketL = new THREE.Mesh(pocketGeo, suitMat);
    pocketL.position.set(-0.5, 0.22, 0.54);
    torsoGroup.add(pocketL);

    const pocketR = new THREE.Mesh(pocketGeo, suitMat);
    pocketR.position.set(0.5, 0.22, 0.54);
    torsoGroup.add(pocketR);

    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12), redMat);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(-0.52, 0.38, 0.56);
    torsoGroup.add(pin);

    group.add(torsoGroup);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.88, 2.45, 0);
    const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.9, 12), suitMat);
    armLMesh.rotation.z = Math.PI / 8;
    armLMesh.rotation.x = -Math.PI / 6;
    armLMesh.position.set(-0.1, -0.35, -0.2);
    leftArm.add(armLMesh);
    group.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.88, 2.45, 0);
    const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.9, 12), suitMat);
    armRMesh.rotation.z = -Math.PI / 8;
    armRMesh.rotation.x = -Math.PI / 6;
    armRMesh.position.set(0.1, -0.35, -0.2);
    rightArm.add(armRMesh);
    group.add(rightArm);

    const head = new THREE.Group();
    head.position.set(0, 2.95, 0);

    const faceGeo = new THREE.SphereGeometry(0.48, 20, 20);
    faceGeo.scale(1.15, 1.05, 1.0);
    const faceMesh = new THREE.Mesh(faceGeo, skinMat);
    faceMesh.castShadow = true;
    head.add(faceMesh);

    const jowlGeo = new THREE.SphereGeometry(0.38, 16, 16);
    jowlGeo.scale(1.2, 0.7, 0.9);
    const jowl = new THREE.Mesh(jowlGeo, skinMat);
    jowl.position.set(0, -0.24, 0.14);
    head.add(jowl);

    const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skinMat);
    cheekL.position.set(-0.28, -0.05, 0.32);
    head.add(cheekL);

    const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skinMat);
    cheekR.position.set(0.28, -0.05, 0.32);
    head.add(cheekR);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), skinMat);
    nose.position.set(0, 0.02, 0.5);
    nose.rotation.x = Math.PI / 8;
    head.add(nose);

    const earGeo = new THREE.BoxGeometry(0.1, 0.22, 0.15);
    const earL = new THREE.Mesh(earGeo, skinMat);
    earL.position.set(-0.55, 0.02, 0);
    head.add(earL);

    const earR = new THREE.Mesh(earGeo, skinMat);
    earR.position.set(0.55, 0.02, 0);
    head.add(earR);

    const undercutMat = new THREE.MeshStandardMaterial({ color: 0x1f1f22, roughness: 0.9 });
    const undercut = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.38, 18), undercutMat);
    undercut.position.set(0, 0.15, -0.05);
    head.add(undercut);

    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.44, 0.98), hairMat);
    hairTop.position.set(0, 0.46, -0.02);
    hairTop.castShadow = true;
    head.add(hairTop);

    const hairWingL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.82), hairMat);
    hairWingL.rotation.z = Math.PI / 10;
    hairWingL.position.set(-0.55, 0.42, -0.02);
    head.add(hairWingL);

    const hairWingR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.82), hairMat);
    hairWingR.rotation.z = -Math.PI / 10;
    hairWingR.position.set(0.55, 0.42, -0.02);
    head.add(hairWingR);

    const partLine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.12), undercutMat);
    partLine.position.set(-0.06, 0.46, 0.46);
    head.add(partLine);

    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(0, 0.08, 0.46);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.2 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.65,
    });

    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.04), frameMat);
    frameL.position.set(-0.24, 0, 0);
    glassesGroup.add(frameL);

    const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.02), lensMat);
    lensL.position.set(-0.24, 0, 0.02);
    glassesGroup.add(lensL);

    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.04), frameMat);
    frameR.position.set(0.24, 0, 0);
    glassesGroup.add(frameR);

    const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.02), lensMat);
    lensR.position.set(0.24, 0, 0.02);
    glassesGroup.add(lensR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), frameMat);
    bridge.position.set(0, 0.02, 0);
    glassesGroup.add(bridge);

    head.add(glassesGroup);
    group.add(head);

    return { group, body: chest, head, leftArm, rightArm, pedestal };
  }

  function createJerseyBarrier() {
    const group = new THREE.Group();
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, roughness: 0.8 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.8), concreteMat);
    base.position.y = 0.225;
    base.castShadow = true;
    group.add(base);

    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 0.35), concreteMat);
    wall.position.y = 0.8;
    wall.castShadow = true;
    group.add(wall);

    for (let i = -0.8; i <= 0.8; i += 0.8) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.38), stripeMat);
      stripe.position.set(i, 0.8, 0);
      group.add(stripe);
    }

    return group;
  }

  function createFuelDrum() {
    const group = new THREE.Group();
    const drumMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.4,
      metalness: 0.5,
    });

    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.3, 18), drumMat);
    drum.position.y = 0.65;
    drum.castShadow = true;
    group.add(drum);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.6 });
    [0.4, 0.65, 0.9].forEach((y) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.03, 8, 20), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      group.add(ring);
    });

    return group;
  }

  function createPineTree() {
    const tree = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x2d4a22, roughness: 0.7 });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x3d5f30, roughness: 0.7 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3.2, 8), trunkMat);
    trunk.position.y = 1.6;
    trunk.castShadow = true;
    tree.add(trunk);

    [
      { y: 3.2, r: 1.8, h: 2.2, mat: foliageMat1 },
      { y: 4.8, r: 1.4, h: 2.0, mat: foliageMat2 },
      { y: 6.2, r: 0.9, h: 1.8, mat: foliageMat1 },
    ].forEach((t) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 8), t.mat);
      cone.position.y = t.y;
      cone.castShadow = true;
      tree.add(cone);
    });

    return tree;
  }

  function createTaegeukgiTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 340;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 340);

    const cx = 256;
    const cy = 170;
    const r = 85;

    ctx.fillStyle = '#cd2e3a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0, false);
    ctx.arc(cx - r / 2, cy, r / 2, 0, Math.PI, false);
    ctx.arc(cx + r / 2, cy, r / 2, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0047a0';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI, false);
    ctx.arc(cx + r / 2, cy, r / 2, Math.PI, 0, false);
    ctx.arc(cx - r / 2, cy, r / 2, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#000000';
    const drawBar = (x, y, w, h, ang) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    };

    for (let i = -1; i <= 1; i++) {
      drawBar(cx - 150 + i * 18, cy - 100 - i * 12, 10, 48, -Math.PI / 6);
    }
    for (let i = -1; i <= 1; i++) {
      drawBar(cx + 150 + i * 18, cy + 100 - i * 12, 10, 22, -Math.PI / 6);
      drawBar(cx + 150 + i * 18 + 8, cy + 100 - i * 12 + 14, 10, 22, -Math.PI / 6);
    }

    const texture = new THREE.CanvasTexture(canvas);
    setTextureSRGB(texture);
    return texture;
  }

  function createCheeringROKSoldier(role = 'flag') {
    const group = new THREE.Group();

    const camoMat = new THREE.MeshStandardMaterial({ color: 0x4d5f47, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5cfb3, roughness: 0.5 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x33412f, roughness: 0.6 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x3e4f3a, roughness: 0.55 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.45), bootMat);
    bootL.position.set(-0.2, 0.11, 0.05);
    bootL.castShadow = true;
    group.add(bootL);

    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.45), bootMat);
    bootR.position.set(0.2, 0.11, 0.05);
    bootR.castShadow = true;
    group.add(bootR);

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.9, 10), camoMat);
    legL.position.set(-0.2, 0.55, 0);
    legL.castShadow = true;
    group.add(legL);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.9, 10), camoMat);
    legR.position.set(0.2, 0.55, 0);
    legR.castShadow = true;
    group.add(legR);

    const torso = new THREE.Group();
    torso.position.set(0, 1.4, 0);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 0.45), camoMat);
    chest.castShadow = true;
    torso.add(chest);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.52), vestMat);
    vest.position.set(0, -0.05, 0);
    vest.castShadow = true;
    torso.add(vest);
    group.add(torso);

    const head = new THREE.Group();
    head.position.set(0, 1.95, 0);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skinMat);
    head.add(face);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), helmetMat);
    helmet.scale.set(1.05, 0.9, 1.1);
    helmet.position.set(0, 0.08, -0.02);
    helmet.castShadow = true;
    head.add(helmet);
    group.add(head);

    const armL = new THREE.Group();
    armL.position.set(-0.52, 1.7, 0);
    const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 8), camoMat);
    armL.add(armLMesh);
    group.add(armL);

    const armR = new THREE.Group();
    armR.position.set(0.52, 1.7, 0);
    const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 8), camoMat);
    armR.add(armRMesh);
    group.add(armR);

    let flagMesh;

    if (role === 'flag') {
      armR.rotation.z = -Math.PI / 4;
      armR.rotation.x = -Math.PI / 4;

      const flagGroup = new THREE.Group();
      flagGroup.position.set(0, -0.4, 0.2);

      const poleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8), poleMat);
      pole.position.y = 0.6;
      flagGroup.add(pole);

      const flagTex = createTaegeukgiTexture();
      const flagGeo = new THREE.PlaneGeometry(1.2, 0.8, 4, 4);
      const flagBannerMat = new THREE.MeshStandardMaterial({
        map: flagTex,
        side: THREE.DoubleSide,
        roughness: 0.6,
      });
      flagMesh = new THREE.Mesh(flagGeo, flagBannerMat);
      flagMesh.position.set(0.65, 1.1, 0);
      flagMesh.castShadow = true;
      flagGroup.add(flagMesh);

      armR.add(flagGroup);

      armL.rotation.z = Math.PI / 3;
      armL.rotation.x = -Math.PI / 3;
    } else if (role === 'cheer') {
      armL.rotation.z = Math.PI * 0.75;
      armR.rotation.z = -Math.PI * 0.75;
    } else {
      armR.rotation.z = -Math.PI * 0.65;
      armR.rotation.y = Math.PI / 4;
      armL.rotation.z = 0.1;
    }

    return {
      group,
      armL,
      armR,
      head,
      flagMesh,
      role,
      phaseOffset: Math.random() * Math.PI * 2,
    };
  }

  function createBloodSplatterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const cx = 256;
    const cy = 256;
    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 220);
    grad.addColorStop(0, '#550000');
    grad.addColorStop(0.5, '#880000');
    grad.addColorStop(0.85, '#aa0a0a');
    grad.addColorStop(1, 'rgba(150, 10, 10, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    const numPoints = 36;
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = 160 + Math.sin(angle * 5) * 45 + Math.cos(angle * 7) * 35 + (Math.random() - 0.5) * 30;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#8b0000';
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 110 + Math.random() * 130;
      const dotR = 2 + Math.random() * 8;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    setTextureSRGB(texture);
    return texture;
  }

  function createNorthKoreanTank() {
    const group = new THREE.Group();
    group.name = 'NorthKorean_ChonmaHo_Tank';

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x3a4836,
      roughness: 0.65,
      metalness: 0.35,
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x222622,
      roughness: 0.7,
      metalness: 0.5,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x181a18,
      roughness: 0.9,
      metalness: 0.1,
    });
    const redStarMat = new THREE.MeshStandardMaterial({
      color: 0xdd1111,
      roughness: 0.4,
      emissive: 0x330000,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x336688,
      roughness: 0.2,
      metalness: 0.8,
    });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.95, 6.2), armorMat);
    hull.position.y = 0.85;
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);

    const glacis = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.45, 1.6), armorMat);
    glacis.position.set(0, 0.95, -2.7);
    glacis.rotation.x = -Math.PI / 6;
    glacis.castShadow = true;
    group.add(glacis);

    const skirtGeo = new THREE.BoxGeometry(0.18, 0.6, 6.0);
    const leftSkirt = new THREE.Mesh(skirtGeo, armorMat);
    leftSkirt.position.set(-1.62, 0.75, 0);
    leftSkirt.castShadow = true;
    group.add(leftSkirt);

    const rightSkirt = new THREE.Mesh(skirtGeo, armorMat);
    rightSkirt.position.set(1.62, 0.75, 0);
    rightSkirt.castShadow = true;
    group.add(rightSkirt);

    const drumGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.1, 16);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x2f3c2b, roughness: 0.7 });
    const drum1 = new THREE.Mesh(drumGeo, drumMat);
    drum1.rotation.z = Math.PI / 2;
    drum1.position.set(-0.8, 1.05, 3.25);
    drum1.castShadow = true;
    group.add(drum1);

    const drum2 = new THREE.Mesh(drumGeo, drumMat);
    drum2.rotation.z = Math.PI / 2;
    drum2.position.set(0.8, 1.05, 3.25);
    drum2.castShadow = true;
    group.add(drum2);

    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16);
    const wheels = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i++) {
        const wheel = new THREE.Mesh(wheelGeo, rubberMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 1.5, 0.45, -2.1 + i * 1.05);
        wheel.castShadow = true;
        group.add(wheel);
        wheels.push(wheel);
      }
    }

    const trackGeo = new THREE.BoxGeometry(0.45, 0.65, 6.1);
    const leftTracks = new THREE.Mesh(trackGeo, darkSteelMat);
    leftTracks.position.set(-1.5, 0.45, 0);
    leftTracks.castShadow = true;
    group.add(leftTracks);

    const rightTracks = new THREE.Mesh(trackGeo, darkSteelMat);
    rightTracks.position.set(1.5, 0.45, 0);
    rightTracks.castShadow = true;
    group.add(rightTracks);

    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.35, 0.1);

    const domeGeo = new THREE.SphereGeometry(1.6, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const dome = new THREE.Mesh(domeGeo, armorMat);
    dome.scale.set(1.15, 0.72, 1.3);
    dome.castShadow = true;
    turretGroup.add(dome);

    const bustle = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 0.9), darkSteelMat);
    bustle.position.set(0, 0.35, 1.4);
    bustle.castShadow = true;
    turretGroup.add(bustle);

    const starGeo = new THREE.CircleGeometry(0.24, 5);
    const leftStar = new THREE.Mesh(starGeo, redStarMat);
    leftStar.position.set(-1.62, 0.4, 0.1);
    leftStar.rotation.y = -Math.PI / 2;
    turretGroup.add(leftStar);

    const rightStar = new THREE.Mesh(starGeo, redStarMat);
    rightStar.position.set(1.62, 0.4, 0.1);
    rightStar.rotation.y = Math.PI / 2;
    turretGroup.add(rightStar);

    const searchlight = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 16), darkSteelMat);
    searchlight.rotation.x = Math.PI / 2;
    searchlight.position.set(-0.7, 0.75, -1.1);
    searchlight.castShadow = true;
    turretGroup.add(searchlight);

    const searchlightLens = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16), glassMat);
    searchlightLens.position.set(-0.7, 0.75, -1.28);
    turretGroup.add(searchlightLens);

    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.22, 16), armorMat);
    cupola.position.set(0.65, 0.85, 0.35);
    cupola.castShadow = true;
    turretGroup.add(cupola);

    const mgMount = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), darkSteelMat);
    mgMount.position.set(0.65, 1.05, 0.35);
    turretGroup.add(mgMount);

    const mgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), darkSteelMat);
    mgBarrel.rotation.x = Math.PI / 2 - 0.2;
    mgBarrel.position.set(0.65, 1.25, 0.05);
    mgBarrel.castShadow = true;
    turretGroup.add(mgBarrel);

    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(0, 0.38, -1.35);

    const mantlet = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.75, 14), armorMat);
    mantlet.rotation.z = Math.PI / 2;
    mantlet.castShadow = true;
    barrelGroup.add(mantlet);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 4.4, 16), darkSteelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -2.2;
    barrel.castShadow = true;
    barrelGroup.add(barrel);

    const fumeExtractor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 16), darkSteelMat);
    fumeExtractor.rotation.x = Math.PI / 2;
    fumeExtractor.position.z = -1.9;
    barrelGroup.add(fumeExtractor);

    const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.25, 16), darkSteelMat);
    muzzleTip.rotation.x = Math.PI / 2;
    muzzleTip.position.z = -4.45;
    barrelGroup.add(muzzleTip);

    const muzzleFlash = new THREE.PointLight(0xff6600, 0, 18);
    muzzleFlash.position.set(0, 0, -4.6);
    barrelGroup.add(muzzleFlash);

    turretGroup.add(barrelGroup);
    group.add(turretGroup);

    const smokeNode = new THREE.Group();
    smokeNode.position.set(0, 1.4, 2.8);
    group.add(smokeNode);

    return {
      group,
      turretGroup,
      barrelGroup,
      muzzleFlash,
      leftTracks,
      rightTracks,
      wheels,
      smokeNode,
    };
  }

  function createNorthKoreanSoldier() {
    const group = new THREE.Group();
    group.name = 'NorthKorean_KPA_Soldier';

    const uniformMat = new THREE.MeshStandardMaterial({ color: 0x6e683f, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a47a, roughness: 0.7 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x3b4731, roughness: 0.5, metalness: 0.4 });
    const bootsMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const starMat = new THREE.MeshStandardMaterial({ color: 0xdd1111, roughness: 0.4 });
    const weaponMetalMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.7 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e3b1c, roughness: 0.65 });
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x9e8964, roughness: 0.95 });

    for (let i = -1; i <= 1; i++) {
      const bagGeo = new THREE.BoxGeometry(0.75, 0.28, 0.42);
      const bag1 = new THREE.Mesh(bagGeo, sandbagMat);
      bag1.position.set(i * 0.7, 0.14, -0.6);
      bag1.castShadow = true;
      group.add(bag1);

      const bag2 = new THREE.Mesh(bagGeo, sandbagMat);
      bag2.position.set(i * 0.65, 0.38, -0.58);
      bag2.castShadow = true;
      group.add(bag2);
    }

    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.4, 0);

    const legGeo = new THREE.CylinderGeometry(0.12, 0.13, 0.55, 8);
    const leftLeg = new THREE.Mesh(legGeo, uniformMat);
    leftLeg.position.set(-0.2, 0.25, 0);
    leftLeg.rotation.x = 0.2;
    leftLeg.castShadow = true;
    torsoGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, uniformMat);
    rightLeg.position.set(0.2, 0.25, 0);
    rightLeg.rotation.x = -0.15;
    rightLeg.castShadow = true;
    torsoGroup.add(rightLeg);

    const bootGeo = new THREE.BoxGeometry(0.18, 0.14, 0.3);
    const leftBoot = new THREE.Mesh(bootGeo, bootsMat);
    leftBoot.position.set(-0.2, 0.07, 0.05);
    torsoGroup.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeo, bootsMat);
    rightBoot.position.set(0.2, 0.07, -0.05);
    torsoGroup.add(rightBoot);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.32), uniformMat);
    body.position.set(0, 0.72, 0);
    body.castShadow = true;
    torsoGroup.add(body);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.34), bootsMat);
    belt.position.set(0, 0.48, 0);
    torsoGroup.add(belt);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8), skinMat);
    neck.position.set(0, 1.05, 0);
    torsoGroup.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skinMat);
    head.position.set(0, 1.2, 0);
    head.castShadow = true;
    torsoGroup.add(head);

    const helmetGeo = new THREE.SphereGeometry(0.22, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(0, 1.24, 0);
    helmet.castShadow = true;
    torsoGroup.add(helmet);

    const helmetStar = new THREE.Mesh(new THREE.CircleGeometry(0.04, 5), starMat);
    helmetStar.position.set(0, 1.28, -0.21);
    helmetStar.rotation.x = -0.2;
    torsoGroup.add(helmetStar);

    const armsGroup = new THREE.Group();
    armsGroup.position.set(0, 0.9, 0);

    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8);
    const rightArm = new THREE.Mesh(armGeo, uniformMat);
    rightArm.position.set(0.3, 0.05, -0.15);
    rightArm.rotation.x = Math.PI / 3;
    rightArm.rotation.z = -Math.PI / 6;
    armsGroup.add(rightArm);

    const leftArm = new THREE.Mesh(armGeo, uniformMat);
    leftArm.position.set(-0.25, 0.05, -0.2);
    leftArm.rotation.x = Math.PI / 2.5;
    leftArm.rotation.z = Math.PI / 5;
    armsGroup.add(leftArm);

    const rpgMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.4, 10), weaponMetalMat);
    rpgMesh.rotation.x = Math.PI / 2;
    rpgMesh.position.set(0.28, 0.18, -0.4);
    rpgMesh.castShadow = true;

    const woodShield = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), woodMat);
    woodShield.position.y = 0;
    rpgMesh.add(woodShield);

    const warheadMat = new THREE.MeshStandardMaterial({ color: 0x485838, roughness: 0.5 });
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 10), warheadMat);
    warhead.rotation.x = Math.PI;
    warhead.position.y = 0.85;
    rpgMesh.add(warhead);

    const muzzleFlash = new THREE.PointLight(0xffaa22, 0, 10);
    muzzleFlash.position.set(0, 1.05, 0);
    rpgMesh.add(muzzleFlash);

    armsGroup.add(rpgMesh);
    torsoGroup.add(armsGroup);
    group.add(torsoGroup);

    return {
      group,
      torsoGroup,
      armsGroup,
      rpgMesh,
      muzzleFlash,
    };
  }

  /* ========================================================================== */
  /* 4. APPLICATION STATE & VANILLA JS UI + 3D ENGINE INITIALIZATION            */
  /* ========================================================================== */
  const DEFAULT_RANKINGS = [
    { rank: 1, name: '백호전차장', score: 6, miniaturesEliminated: 8, cratersCleared: 12, date: '2026.11' },
    { rank: 2, name: '맹호포수', score: 4, miniaturesEliminated: 5, cratersCleared: 7, date: '2026.11' },
    { rank: 3, name: '기갑선봉', score: 3, miniaturesEliminated: 4, cratersCleared: 5, date: '2026.11' },
    { rank: 4, name: '흑표전차', score: 2, miniaturesEliminated: 3, cratersCleared: 3, date: '2026.11' },
    { rank: 5, name: '전차조종수', score: 1, miniaturesEliminated: 2, cratersCleared: 2, date: '2026.11' },
  ];

  const appState = {
    gameActive: false,
    isPaused: false,
    isGameOver: false,
    timeLeft: 60.0,
    successCount: 0,
    miniaturesEliminated: 0,
    enemiesEliminated: 0,
    playerHp: 100,
    maxHp: 100,
    cratersClearedTotal: 0,
    nickname: '전차장',
    rankings: DEFAULT_RANKINGS.slice(),
    cameraMode: 'chase', // 'chase' | 'gunner' | 'drone'
    nightVision: false,
    isMuted: tankAudioEngine.isMuted(),
  };

  // Load saved rankings from localStorage
  try {
    const saved = localStorage.getItem('tank_crater_reset_rankings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        appState.rankings = parsed;
      }
    }
  } catch (e) {}

  function initApp() {
    // Cache DOM elements
    const elHudLayer = document.getElementById('hud-layer');
    const elModalStart = document.getElementById('modal-start');
    const elModalPause = document.getElementById('modal-pause');
    const elModalEnd = document.getElementById('modal-end');

    const elTimerBadge = document.getElementById('hud-timer');
    const elHpText = document.getElementById('hud-hp-text');
    const elHpBar = document.getElementById('hud-hp-bar');
    const elShieldIcon = document.getElementById('hud-shield-icon');
    const elArmorWarning = document.getElementById('hud-armor-warning');

    const elSuccessCount = document.getElementById('hud-success-count');
    const elMiniatureCount = document.getElementById('hud-miniature-count');
    const elEnemyCount = document.getElementById('hud-enemy-count');

    const elBtnFlir = document.getElementById('btn-flir');
    const elBtnCamera = document.getElementById('btn-camera');
    const elCameraLabel = document.getElementById('hud-camera-label');
    const elBtnMute = document.getElementById('btn-mute');
    const elBtnPause = document.getElementById('btn-pause');
    const elBtnFullReset = document.getElementById('btn-full-reset');

    const elGunnerSight = document.getElementById('gunner-sight-overlay');
    const elSightOuterRing = document.getElementById('sight-outer-ring');
    const elSightHLine = document.getElementById('sight-h-line');
    const elSightVLine = document.getElementById('sight-v-line');

    const elNicknameInput = document.getElementById('input-nickname');
    const elBtnStartGame = document.getElementById('btn-start-operation');
    const elStartLeaderboard = document.getElementById('start-leaderboard-list');

    const elEndCommander = document.getElementById('end-commander-name');
    const elEndSuccess = document.getElementById('end-stat-success');
    const elEndMiniatures = document.getElementById('end-stat-miniatures');
    const elEndCraters = document.getElementById('end-stat-craters');
    const elEndLeaderboard = document.getElementById('end-leaderboard-list');
    const elBtnEndRestart = document.getElementById('btn-end-restart');
    const elBtnEndFullReset = document.getElementById('btn-end-full-reset');

    const elBtnPauseResume = document.getElementById('btn-pause-resume');
    const elBtnPauseFullReset = document.getElementById('btn-pause-full-reset');
    const elBtnPauseRestart = document.getElementById('btn-pause-restart');
    const elBtnPauseMute = document.getElementById('btn-pause-mute');
    const elPauseMuteLabel = document.getElementById('pause-mute-label');

    const renderLeaderboards = () => {
      if (elStartLeaderboard) {
        elStartLeaderboard.innerHTML = appState.rankings
          .slice(0, 5)
          .map(
            (r, i) => `
            <div class="flex justify-between py-1 text-slate-300">
              <span>${i + 1}. ${r.name}</span>
              <span class="font-mono text-emerald-400 font-bold">정차 ${r.score}회</span>
            </div>`
          )
          .join('');
      }
      if (elEndLeaderboard) {
        elEndLeaderboard.innerHTML = appState.rankings
          .slice(0, 5)
          .map(
            (r, i) => `
            <div class="flex justify-between py-1 text-slate-300">
              <span>${i + 1}. ${r.name}</span>
              <span class="font-mono text-emerald-400 font-bold">${r.score}회</span>
            </div>`
          )
          .join('');
      }
    };

    const syncUI = () => {
      // Body dataset state for test & automation compatibility
      if (!appState.gameActive && !appState.isGameOver) {
        document.body.dataset.state = 'title';
      } else if (appState.isPaused) {
        document.body.dataset.state = 'paused';
      } else if (appState.isGameOver) {
        document.body.dataset.state = 'gameover';
      } else {
        document.body.dataset.state = 'playing';
      }

      // Visibility of main layers
      if (elHudLayer) {
        elHudLayer.classList.toggle('hidden', !(appState.gameActive && !appState.isGameOver));
      }
      if (elModalStart) {
        elModalStart.classList.toggle('hidden', !(!appState.gameActive && !appState.isGameOver));
      }
      if (elModalPause) {
        elModalPause.classList.toggle('hidden', !appState.isPaused);
      }
      if (elModalEnd) {
        elModalEnd.classList.toggle('hidden', !appState.isGameOver);
      }

      // Timer
      if (elTimerBadge) {
        elTimerBadge.textContent = `${appState.timeLeft.toFixed(1)}s`;
        elTimerBadge.setAttribute('aria-label', `Time remaining: ${appState.timeLeft.toFixed(1)} seconds`);
        const isCritical = appState.timeLeft <= 10.0;
        elTimerBadge.className = `font-mono text-xl md:text-2xl font-bold tracking-wider px-3 py-1 rounded border ${
          isCritical
            ? 'bg-red-950/90 border-red-500 text-red-400 animate-pulse'
            : 'bg-slate-950/90 border-cyan-500/60 text-cyan-300'
        }`;
      }

      // Armor HP Bar
      const hpPercent = Math.max(0, Math.min(100, (appState.playerHp / appState.maxHp) * 100));
      const isArmorCritical = hpPercent <= 30;
      if (elHpText) {
        elHpText.textContent = `${Math.round(appState.playerHp)} / ${appState.maxHp}`;
        elHpText.className = `font-bold ${
          isArmorCritical ? 'text-red-400 animate-pulse' : hpPercent > 60 ? 'text-emerald-400' : 'text-amber-400'
        }`;
      }
      if (elHpBar) {
        elHpBar.style.width = `${hpPercent}%`;
        elHpBar.className = `h-full rounded-full transition-all duration-300 ${
          isArmorCritical
            ? 'bg-gradient-to-r from-red-600 to-red-400 animate-pulse'
            : hpPercent > 60
            ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
            : 'bg-gradient-to-r from-amber-500 to-yellow-400'
        }`;
      }
      if (elShieldIcon) {
        elShieldIcon.setAttribute(
          'class',
          `w-3.5 h-3.5 ${isArmorCritical ? 'text-red-500 animate-bounce' : 'text-cyan-400'}`
        );
      }
      if (elArmorWarning) {
        elArmorWarning.classList.toggle('hidden', !isArmorCritical);
      }

      // Metrics
      if (elSuccessCount) elSuccessCount.textContent = `${appState.successCount}회`;
      if (elMiniatureCount) elMiniatureCount.textContent = `${appState.miniaturesEliminated}회`;
      if (elEnemyCount) elEnemyCount.textContent = `${appState.enemiesEliminated}기`;

      // FLIR Button
      if (elBtnFlir) {
        elBtnFlir.className = `px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
          appState.nightVision
            ? 'bg-emerald-950 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-950/80 ring-1 ring-emerald-400'
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
        }`;
      }

      // Camera Mode Button & Gunner Sight Reticle
      if (elCameraLabel) {
        elCameraLabel.textContent = appState.cameraMode;
      }
      if (elGunnerSight) {
        elGunnerSight.classList.toggle('hidden', appState.cameraMode !== 'gunner');
      }
      if (elSightOuterRing && elSightHLine && elSightVLine) {
        elSightOuterRing.className = `w-full h-full rounded-full border ${
          appState.nightVision ? 'border-emerald-400/50' : 'border-cyan-400/40'
        } flex items-center justify-center relative shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]`;
        elSightHLine.className = `absolute w-full h-[1px] ${
          appState.nightVision ? 'bg-emerald-400/60' : 'bg-cyan-400/60'
        }`;
        elSightVLine.className = `absolute h-full w-[1px] ${
          appState.nightVision ? 'bg-emerald-400/60' : 'bg-cyan-400/60'
        }`;
      }

      // Mute Button
      if (elBtnMute) {
        elBtnMute.setAttribute('aria-label', appState.isMuted ? 'Unmute Sound' : 'Mute Sound');
        elBtnMute.innerHTML = appState.isMuted
          ? `<svg class="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
          : `<svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
      }
      if (elPauseMuteLabel) {
        elPauseMuteLabel.textContent = appState.isMuted ? '음소거 해제' : '소리 끄기';
      }

      // End Modal Stats
      if (elEndCommander) elEndCommander.textContent = `전차장: ${appState.nickname || '전차장'}`;
      if (elEndSuccess) elEndSuccess.textContent = `${appState.successCount}회`;
      if (elEndMiniatures) elEndMiniatures.textContent = `${appState.miniaturesEliminated}회`;
      if (elEndCraters) elEndCraters.textContent = `${appState.cratersClearedTotal}개`;

      renderLeaderboards();
    };

    const startGame = () => {
      appState.timeLeft = 60.0;
      appState.successCount = 0;
      appState.miniaturesEliminated = 0;
      appState.enemiesEliminated = 0;
      appState.playerHp = 100;
      appState.cratersClearedTotal = 0;
      appState.isGameOver = false;
      appState.isPaused = false;
      appState.gameActive = true;
      syncUI();
    };

    const resetToInitialStage = () => {
      appState.timeLeft = 60.0;
      appState.successCount = 0;
      appState.miniaturesEliminated = 0;
      appState.enemiesEliminated = 0;
      appState.playerHp = 100;
      appState.cratersClearedTotal = 0;
      appState.isGameOver = false;
      appState.isPaused = false;
      appState.gameActive = false;
      window.dispatchEvent(new CustomEvent('k1a1_full_reset'));
      syncUI();
    };

    const handleGameOver = () => {
      if (appState.isGameOver) return;
      appState.gameActive = false;
      appState.isGameOver = true;

      const newRecord = {
        name: appState.nickname || '전차장',
        score: appState.successCount,
        miniaturesEliminated: appState.miniaturesEliminated + appState.enemiesEliminated,
        cratersCleared: appState.cratersClearedTotal,
        date: new Date().toISOString().slice(0, 7).replace('-', '.'),
      };

      appState.rankings = updateLeaderboard(appState.rankings, newRecord);
      try {
        localStorage.setItem('tank_crater_reset_rankings', JSON.stringify(appState.rankings));
      } catch (e) {}

      syncUI();
    };

    const handleToggleMute = () => {
      appState.isMuted = !appState.isMuted;
      tankAudioEngine.setMuted(appState.isMuted);
      syncUI();
    };

    const handleChangeCamera = () => {
      const modes = ['chase', 'gunner', 'drone'];
      const nextIdx = (modes.indexOf(appState.cameraMode) + 1) % modes.length;
      appState.cameraMode = modes[nextIdx];
      syncUI();
    };

    const handleToggleNightVision = () => {
      appState.nightVision = !appState.nightVision;
      syncUI();
    };

    // Countdown Timer Interval (every 100ms)
    setInterval(() => {
      if (!appState.gameActive || appState.isPaused || appState.isGameOver) return;
      if (appState.timeLeft <= 0.1) {
        appState.timeLeft = 0;
        handleGameOver();
      } else {
        appState.timeLeft = Math.max(0, appState.timeLeft - 0.1);
        syncUI();
      }
    }, 100);

    // Bind UI Event Listeners
    if (elNicknameInput) {
      elNicknameInput.value = appState.nickname;
      elNicknameInput.addEventListener('input', (e) => {
        appState.nickname = e.target.value;
      });
    }
    if (elBtnStartGame) {
      elBtnStartGame.addEventListener('click', startGame);
    }
    if (elBtnFlir) {
      elBtnFlir.addEventListener('click', handleToggleNightVision);
    }
    if (elBtnCamera) {
      elBtnCamera.addEventListener('click', handleChangeCamera);
    }
    if (elBtnMute) {
      elBtnMute.addEventListener('click', handleToggleMute);
    }
    if (elBtnPause) {
      elBtnPause.addEventListener('click', () => {
        appState.isPaused = true;
        syncUI();
      });
    }
    if (elBtnFullReset) {
      elBtnFullReset.addEventListener('click', resetToInitialStage);
    }
    if (elBtnEndRestart) {
      elBtnEndRestart.addEventListener('click', startGame);
    }
    if (elBtnEndFullReset) {
      elBtnEndFullReset.addEventListener('click', resetToInitialStage);
    }
    if (elBtnPauseResume) {
      elBtnPauseResume.addEventListener('click', () => {
        appState.isPaused = false;
        syncUI();
      });
    }
    if (elBtnPauseFullReset) {
      elBtnPauseFullReset.addEventListener('click', resetToInitialStage);
    }
    if (elBtnPauseRestart) {
      elBtnPauseRestart.addEventListener('click', startGame);
    }
    if (elBtnPauseMute) {
      elBtnPauseMute.addEventListener('click', handleToggleMute);
    }

    // Touch / Pointer Controls
    const keys = {};
    const bindHoldButton = (id, keyCode) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const setKey = (down) => {
        keys[keyCode] = down;
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setKey(true);
      });
      btn.addEventListener('pointerup', () => setKey(false));
      btn.addEventListener('pointerleave', () => setKey(false));
      btn.addEventListener('pointercancel', () => setKey(false));
    };

    bindHoldButton('btn-drive-forward', 'ArrowUp');
    bindHoldButton('btn-drive-backward', 'ArrowDown');
    bindHoldButton('btn-steer-left', 'ArrowLeft');
    bindHoldButton('btn-steer-right', 'ArrowRight');
    bindHoldButton('btn-turret-left', 'KeyA');
    bindHoldButton('btn-turret-right', 'KeyD');

    const btnFire = document.getElementById('btn-fire-cannon');
    if (btnFire) {
      btnFire.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('k1a1_fire'));
      });
    }

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Avoid intercepting keys while typing nickname
      if (document.activeElement === elNicknameInput) {
        if (e.code === 'Enter') {
          e.preventDefault();
          elNicknameInput.blur();
          startGame();
        }
        return;
      }

      // Start or Restart on Enter / Space when modal is open
      if (!appState.gameActive && !appState.isGameOver) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame();
          return;
        }
      } else if (appState.isGameOver) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame();
          return;
        }
      }

      keys[e.code] = true;

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (appState.gameActive && !appState.isGameOver) {
          appState.isPaused = !appState.isPaused;
          syncUI();
        }
      }
      if (e.code === 'KeyM') {
        handleToggleMute();
      }
      if (e.code === 'KeyV') {
        handleChangeCamera();
      }
      if (e.code === 'KeyC' || e.code === 'KeyN') {
        handleToggleNightVision();
      }
      if (e.code === 'Space') {
        if (appState.gameActive && !appState.isPaused && !appState.isGameOver) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('k1a1_fire'));
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    // Check ?autostart=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startGame();
    } else {
      syncUI();
    }

    /* ====================================================================== */
    /* 5. THREE.JS 3D SCENE, HIGHWAY, K1A1, ENEMY AI, AND BALLISTICS LOOP     */
    /* ====================================================================== */
    const container = document.getElementById('tank-canvas-3d');
    if (!container || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    const daySkyColor = new THREE.Color(0x93c5fd);
    const dayFogColor = new THREE.Color(0xcbd5e1);
    scene.background = daySkyColor;
    scene.fog = new THREE.FogExp2(dayFogColor, 0.007);

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 14, 34);
    camera.lookAt(0, 1.2, 14);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xbfdbfe, 0x64748b, 1.15);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffdf5, 2.2);
    sunLight.position.set(50, 75, 45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 190;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Terrain & Road
    const roadLength = 260;
    const roadWidth = 22;

    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x47633c, roughness: 0.9 });
    const terrainGeo = new THREE.PlaneGeometry(160, roadLength);
    const terrainL = new THREE.Mesh(terrainGeo, terrainMat);
    terrainL.rotation.x = -Math.PI / 2;
    terrainL.position.set(-65, -0.05, -20);
    terrainL.receiveShadow = true;
    scene.add(terrainL);

    const terrainR = new THREE.Mesh(terrainGeo, terrainMat);
    terrainR.rotation.x = -Math.PI / 2;
    terrainR.position.set(65, -0.05, -20);
    terrainR.receiveShadow = true;
    scene.add(terrainR);

    for (let z = -120; z <= 70; z += 16) {
      const treeL = createPineTree();
      treeL.position.set(-25 - Math.random() * 8, 0, z + (Math.random() - 0.5) * 4);
      treeL.scale.setScalar(0.85 + Math.random() * 0.35);
      scene.add(treeL);

      const treeR = createPineTree();
      treeR.position.set(25 + Math.random() * 8, 0, z + (Math.random() - 0.5) * 4);
      treeR.scale.setScalar(0.85 + Math.random() * 0.35);
      scene.add(treeR);
    }

    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
    const asphaltTex = createAsphaltTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.78,
      metalness: 0.08,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, -20);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    const centerLineMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
    for (let z = -130; z <= 90; z += 6) {
      const lineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 3.2), centerLineMat);
      lineMesh.position.set(0, 0.015, z);
      scene.add(lineMesh);
    }

    const whiteLineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const lineL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, roadLength), whiteLineMat);
    lineL.position.set(-10, 0.015, -20);
    scene.add(lineL);

    const lineR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, roadLength), whiteLineMat);
    lineR.position.set(10, 0.015, -20);
    scene.add(lineR);

    const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const sidewalkL = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, roadLength), curbMat);
    sidewalkL.position.set(-18, 0.25, -20);
    sidewalkL.receiveShadow = true;
    scene.add(sidewalkL);

    const sidewalkR = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, roadLength), curbMat);
    sidewalkR.position.set(18, 0.25, -20);
    sidewalkR.receiveShadow = true;
    scene.add(sidewalkR);

    const guardMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.8,
      roughness: 0.25,
    });
    for (let s = -1; s <= 1; s += 2) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, roadLength), guardMat);
      rail.position.set(s * 11.2, 0.75, -20);
      rail.castShadow = true;
      scene.add(rail);

      for (let z = -130; z <= 90; z += 10) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.15), guardMat);
        post.position.set(s * 11.2, 0.4, z);
        post.castShadow = true;
        scene.add(post);
      }
    }

    // Highway Gantry Sign
    const gantryGroup = new THREE.Group();
    gantryGroup.position.set(0, 0, -45);
    const gantryFrameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
    const postLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8.5, 12), gantryFrameMat);
    postLeft.position.set(-11.5, 4.25, 0);
    gantryGroup.add(postLeft);

    const postRight = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8.5, 12), gantryFrameMat);
    postRight.position.set(11.5, 4.25, 0);
    gantryGroup.add(postRight);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(23.5, 0.5, 0.5), gantryFrameMat);
    beam.position.set(0, 8.2, 0);
    gantryGroup.add(beam);

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 1024;
    signCanvas.height = 256;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = '#047857';
    sCtx.fillRect(0, 0, 1024, 256);
    sCtx.lineWidth = 12;
    sCtx.strokeStyle = '#ffffff';
    sCtx.strokeRect(10, 10, 1004, 236);
    sCtx.fillStyle = '#ffffff';
    sCtx.font = 'bold 52px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.fillText('1번 국도 · 통일로 공도 작전 구역', 512, 85);
    sCtx.font = 'bold 44px sans-serif';
    sCtx.fillStyle = '#fde047';
    sCtx.fillText('판문점 25km   |   개성 58km   |   평양 165km', 512, 180);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(14, 3.4, 0.2), signMat);
    signBoard.position.set(0, 7.0, 0);
    gantryGroup.add(signBoard);
    scene.add(gantryGroup);

    // Cheering ROK Soldiers
    const cheeringSoldiers = [];
    const soldierZPositions = [-85, -60, -35, -10, 15, 38];
    soldierZPositions.forEach((z, idx) => {
      const roleL = idx % 3 === 0 ? 'flag' : idx % 3 === 1 ? 'cheer' : 'salute';
      const soldierL = createCheeringROKSoldier(roleL);
      soldierL.group.position.set(-13.0, 0.5, z);
      soldierL.group.rotation.y = Math.PI / 2;
      scene.add(soldierL.group);
      cheeringSoldiers.push(soldierL);

      const roleR = (idx + 1) % 3 === 0 ? 'flag' : (idx + 1) % 3 === 1 ? 'cheer' : 'salute';
      const soldierR = createCheeringROKSoldier(roleR);
      soldierR.group.position.set(13.0, 0.5, z);
      soldierR.group.rotation.y = -Math.PI / 2;
      scene.add(soldierR.group);
      cheeringSoldiers.push(soldierR);
    });

    // Player K1A1 Tank
    const tankParts = createRealisticK1A1Tank();
    tankParts.tankGroup.position.set(0, 0, 18);
    scene.add(tankParts.tankGroup);

    const tankPhysics = {
      x: 0,
      z: 18,
      angle: 0,
      turretAngle: 0,
      speed: 0,
      maxSpeed: 0.32,
      minSpeed: -0.18,
      acceleration: 0.007,
      braking: 0.014,
      friction: 0.94,
      turnSpeed: 0.034,
      turretTurnSpeed: 0.04,
    };

    // Hostile North Korean Forces
    let enemyUnits = [];
    let parkingWave = 0;

    // Target Parking Slot & Kim Jong-un Miniature
    const slotState = { x: 0, z: -18, width: 4.8, length: 7.8, angle: 0 };

    const spawnEnemyForces = (waveIndex = 0) => {
      enemyUnits.forEach((e) => {
        scene.remove(e.model.group);
        if (e.destroyedGroup) scene.remove(e.destroyedGroup);
      });
      enemyUnits = [];

      const { tankCount, infantryCount } = calculateEnemyWaveComposition(waveIndex);

      const tankPresets = [
        { x: -4.5, z: -35 },
        { x: 4.0, z: -72 },
        { x: -3.8, z: -54 },
        { x: 4.2, z: -24 },
        { x: -4.2, z: -85 },
        { x: 3.6, z: -44 },
        { x: -3.5, z: -64 },
        { x: 4.5, z: -92 },
      ];

      for (let i = 0; i < tankCount; i++) {
        const preset = tankPresets[i % tankPresets.length];
        let tx = preset.x;
        let tz = preset.z;

        // Avoid spawning directly on top of the player tank or inside the target parking slot
        if (Math.hypot(tx - tankPhysics.x, tz - tankPhysics.z) < 12) {
          tz = tz - 18 < -94 ? tz + 20 : tz - 18;
        }
        if (Math.hypot(tx - slotState.x, tz - slotState.z) < 8) {
          tz = tz - 14 < -94 ? tz + 14 : tz - 14;
        }

        const tankModel = createNorthKoreanTank();
        tankModel.group.position.set(tx, 0, tz);
        tankModel.group.rotation.y = Math.PI;
        scene.add(tankModel.group);

        enemyUnits.push({
          state: {
            id: 1 + i,
            type: 'tank',
            x: tx,
            z: tz,
            angle: Math.PI,
            turretAngle: Math.PI,
            hp: 80,
            maxHp: 80,
            reloadTimer: 1.8 + (i % 3) * 0.6,
            reloadInterval: Math.max(2.6, 3.4 - waveIndex * 0.1),
            attackRange: 60 + Math.min(15, waveIndex * 2),
            speed: 0,
            alive: true,
          },
          model: tankModel,
          type: 'tank',
          dead: false,
        });
      }

      const infantryPresets = [
        { x: -9.5, z: -22, angle: Math.PI * 0.85 },
        { x: 9.5, z: -52, angle: Math.PI * 1.15 },
        { x: -3.2, z: -28, angle: Math.PI * 0.95 },
        { x: 3.4, z: -42, angle: Math.PI * 1.05 },
        { x: -8.8, z: -62, angle: Math.PI * 0.85 },
        { x: 8.8, z: -32, angle: Math.PI * 1.15 },
        { x: -2.5, z: -48, angle: Math.PI },
        { x: 2.8, z: -66, angle: Math.PI },
        { x: -9.2, z: -78, angle: Math.PI * 0.88 },
        { x: 9.2, z: -82, angle: Math.PI * 1.12 },
        { x: -4.8, z: -16, angle: Math.PI * 0.92 },
        { x: 4.8, z: -58, angle: Math.PI * 1.08 },
        { x: -1.8, z: -76, angle: Math.PI },
        { x: 1.8, z: -88, angle: Math.PI },
      ];

      for (let j = 0; j < infantryCount; j++) {
        const preset = infantryPresets[j % infantryPresets.length];
        let ix = preset.x;
        let iz = preset.z;
        const iAngle = preset.angle;

        // Avoid spawning directly under player treads or inside the target parking slot
        if (Math.hypot(ix - tankPhysics.x, iz - tankPhysics.z) < 8) {
          iz = iz - 14 < -92 ? iz + 16 : iz - 14;
        }
        if (Math.hypot(ix - slotState.x, iz - slotState.z) < 6) {
          iz = iz - 12 < -92 ? iz + 12 : iz - 12;
        }

        const soldierModel = createNorthKoreanSoldier();
        soldierModel.group.position.set(ix, 0, iz);
        soldierModel.group.rotation.y = iAngle;
        scene.add(soldierModel.group);

        enemyUnits.push({
          state: {
            id: 101 + j,
            type: 'infantry',
            x: ix,
            z: iz,
            angle: iAngle,
            turretAngle: iAngle,
            hp: 30,
            maxHp: 30,
            reloadTimer: 1.4 + (j % 4) * 0.5,
            reloadInterval: Math.max(3.0, 4.0 - waveIndex * 0.12),
            attackRange: 44 + Math.min(12, waveIndex * 2),
            speed: 0,
            alive: true,
          },
          model: soldierModel,
          type: 'infantry',
          dead: false,
        });
      }
    };
    spawnEnemyForces(0);

    const slotGeo = new THREE.PlaneGeometry(slotState.width, slotState.length);
    const slotCanvas = document.createElement('canvas');
    slotCanvas.width = 512;
    slotCanvas.height = 512;
    const slCtx = slotCanvas.getContext('2d');
    slCtx.strokeStyle = '#059669';
    slCtx.lineWidth = 26;
    slCtx.strokeRect(12, 12, 488, 488);
    slCtx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    slCtx.fillRect(12, 12, 488, 488);
    slCtx.fillStyle = '#ffffff';
    slCtx.font = 'bold 46px sans-serif';
    slCtx.textAlign = 'center';
    slCtx.fillText('TARGET SLOT', 256, 270);

    const slotTex = new THREE.CanvasTexture(slotCanvas);
    const slotMat = new THREE.MeshBasicMaterial({
      map: slotTex,
      transparent: true,
      opacity: 0.9,
    });
    const parkingSlotMesh = new THREE.Mesh(slotGeo, slotMat);
    parkingSlotMesh.rotation.x = -Math.PI / 2;
    parkingSlotMesh.position.set(slotState.x, 0.04, slotState.z);
    scene.add(parkingSlotMesh);

    let kimMiniature = createKimJongUnMiniature();
    kimMiniature.group.position.set(slotState.x, 0, slotState.z);
    scene.add(kimMiniature.group);

    let obstacles = [];
    const spawnObstacles = () => {
      obstacles.forEach((o) => scene.remove(o.group));
      obstacles = [];
      for (let i = 0; i < 6; i++) {
        const isDrum = i % 2 === 0;
        const obsGroup = isDrum ? createFuelDrum() : createJerseyBarrier();
        let ox = (Math.random() - 0.5) * 14;
        let oz = (Math.random() - 0.5) * 80 - 15;
        if (Math.abs(ox - slotState.x) < 4 && Math.abs(oz - slotState.z) < 6) {
          oz -= 16;
        }
        obsGroup.position.set(ox, 0, oz);
        scene.add(obsGroup);
        obstacles.push({ group: obsGroup, x: ox, z: oz, radius: isDrum ? 1.0 : 1.6 });
      }
    };
    spawnObstacles();

    // Projectiles, Explosions, Craters, Debris, Blood Splatters
    const projectiles = [];
    const explosions = [];
    const debrisList = [];
    const bloodPuddles = [];
    const bloodDroplets = [];
    let craters = [];
    let cameraShake = 0;

    const bloodTexture = createBloodSplatterTexture();

    const clearAllCraters = () => {
      craters.forEach((c) => {
        scene.remove(c.mesh);
        if (c.mesh.geometry) c.mesh.geometry.dispose();
      });
      craters = [];

      bloodPuddles.forEach((b) => {
        scene.remove(b.mesh);
        if (b.mesh.geometry) b.mesh.geometry.dispose();
      });
      bloodPuddles.length = 0;
    };

    const createCraterAndExplosion = (x, z) => {
      tankAudioEngine.playMassiveExplosion();

      const craterGeo = new THREE.CircleGeometry(2.4, 24);
      const craterMat = new THREE.MeshBasicMaterial({
        color: 0x080808,
        depthWrite: false,
      });
      const craterMesh = new THREE.Mesh(craterGeo, craterMat);
      craterMesh.rotation.x = -Math.PI / 2;
      craterMesh.position.set(x, 0.03, z);
      scene.add(craterMesh);

      craters.push({
        record: {
          id: Math.random(),
          x,
          z,
          radius: 2.4,
          depth: 0.35,
          createdAt: performance.now(),
        },
        mesh: craterMesh,
      });

      const expGeo = new THREE.SphereGeometry(1.5, 12, 10);
      const expMat = new THREE.MeshBasicMaterial({
        color: 0xff4500,
        transparent: true,
        opacity: 0.95,
      });
      const expMesh = new THREE.Mesh(expGeo, expMat);
      expMesh.position.set(x, 1.2, z);
      scene.add(expMesh);

      const expLight = new THREE.PointLight(0xff6600, 8, 25);
      expLight.position.set(x, 2.0, z);
      scene.add(expLight);

      explosions.push({
        mesh: expMesh,
        light: expLight,
        scale: 0.8,
        maxScale: 3.8,
        life: 0.45,
      });

      const debMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
      for (let i = 0; i < 12; i++) {
        const dMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.25), debMat);
        dMesh.position.set(x, 0.8, z);
        scene.add(dMesh);

        const ang = Math.random() * Math.PI * 2;
        const spd = 0.15 + Math.random() * 0.35;
        debrisList.push({
          mesh: dMesh,
          vx: Math.cos(ang) * spd,
          vy: 0.18 + Math.random() * 0.35,
          vz: Math.sin(ang) * spd,
          rotX: Math.random() * 0.3,
          rotY: Math.random() * 0.3,
          life: 1.5,
        });
      }
    };

    const createBloodSplatterPuddle = (x, z) => {
      tankAudioEngine.playSquish();

      const puddleGeo = new THREE.PlaneGeometry(2.8, 2.8);
      const puddleMat = new THREE.MeshBasicMaterial({
        map: bloodTexture,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      const puddleMesh = new THREE.Mesh(puddleGeo, puddleMat);
      puddleMesh.rotation.x = -Math.PI / 2;
      puddleMesh.position.set(x, 0.025, z);
      puddleMesh.scale.set(0.15, 0.15, 0.15);
      scene.add(puddleMesh);

      bloodPuddles.push({
        mesh: puddleMesh,
        scale: 0.15,
        maxScale: 3.2,
        growing: true,
      });

      const dropletMat = new THREE.MeshBasicMaterial({ color: 0x880000 });
      const dropletGeo = new THREE.SphereGeometry(0.09, 8, 8);
      for (let i = 0; i < 35; i++) {
        const dropMesh = new THREE.Mesh(dropletGeo, dropletMat);
        dropMesh.position.set(x, 0.35, z);
        scene.add(dropMesh);

        const ang = Math.random() * Math.PI * 2;
        const spd = 0.12 + Math.random() * 0.3;
        bloodDroplets.push({
          mesh: dropMesh,
          vx: Math.cos(ang) * spd,
          vy: 0.18 + Math.random() * 0.25,
          vz: Math.sin(ang) * spd,
          life: 0.9,
        });
      }
    };

    // Cannon Firing
    let lastShotTime = 0;
    let recoilTimer = 0;

    const fire120mmCannon = () => {
      if (!appState.gameActive || appState.isPaused || appState.isGameOver) return;
      const now = performance.now();
      if (now - lastShotTime < 650) return;
      lastShotTime = now;

      tankAudioEngine.playCannonFire();
      recoilTimer = 0.25;

      const totalAngle = tankPhysics.angle + tankPhysics.turretAngle;
      const barrelOffset = new THREE.Vector3(0, 1.9, -5.2);
      barrelOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), totalAngle);
      const spawnPos = new THREE.Vector3(tankPhysics.x, 0, tankPhysics.z).add(barrelOffset);

      const flashGeo = new THREE.SphereGeometry(1.4, 8, 8);
      const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa });
      const flash = new THREE.Mesh(flashGeo, flashMat);
      flash.position.copy(spawnPos);
      scene.add(flash);
      setTimeout(() => scene.remove(flash), 80);

      const bGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8);
      bGeo.rotateX(Math.PI / 2);
      const bMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.copy(spawnPos);

      const bLight = new THREE.PointLight(0xff5500, 3, 10);
      bLight.position.copy(spawnPos);
      scene.add(bLight);
      scene.add(bMesh);

      const speed = 72;
      const vx = -Math.sin(totalAngle) * speed;
      const vy = 2.0;
      const vz = -Math.cos(totalAngle) * speed;

      projectiles.push({
        mesh: bMesh,
        light: bLight,
        vx,
        vy,
        vz,
        life: 0,
        distance: 0,
        isPlayer: true,
        damage: 85,
      });
    };

    const fireEnemyWeapon = (enemy) => {
      const isTank = enemy.type === 'tank';
      const spawnPos = new THREE.Vector3();

      if (isTank) {
        const tankModel = enemy.model;
        tankAudioEngine.playEnemyCannonFire();
        tankModel.muzzleFlash.intensity = 15;
        setTimeout(() => {
          tankModel.muzzleFlash.intensity = 0;
        }, 120);

        const barrelOffset = new THREE.Vector3(0, 1.8, -4.6);
        barrelOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), enemy.state.turretAngle);
        spawnPos.set(enemy.state.x, 0, enemy.state.z).add(barrelOffset);
      } else {
        const soldierModel = enemy.model;
        tankAudioEngine.playRocketLaunch();
        soldierModel.muzzleFlash.intensity = 10;
        setTimeout(() => {
          soldierModel.muzzleFlash.intensity = 0;
        }, 150);

        spawnPos.set(enemy.state.x, 1.4, enemy.state.z);
      }

      const geo = isTank
        ? new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8)
        : new THREE.ConeGeometry(0.12, 0.9, 8);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: isTank ? 0xff5500 : 0xff2200,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(spawnPos);

      const light = new THREE.PointLight(isTank ? 0xff6600 : 0xff3300, 2.5, 8);
      light.position.copy(spawnPos);
      scene.add(light);
      scene.add(mesh);

      const dx = tankPhysics.x - spawnPos.x;
      const dz = tankPhysics.z - spawnPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const speed = isTank ? 48 : 34;

      const flightTime = dist / speed;
      const gravity = 12.0;
      const dropCompensation = 0.5 * gravity * flightTime;

      const vx = (dx / dist) * speed;
      const vz = (dz / dist) * speed;
      const vy = ((tankPhysics.speed > 0 ? 0.6 : 0.8) - spawnPos.y + dropCompensation) / Math.max(0.2, flightTime);

      projectiles.push({
        mesh,
        light,
        vx,
        vy,
        vz,
        life: 0,
        distance: 0,
        isPlayer: false,
        damage: isTank ? 22 : 15,
      });
    };

    const randomizeSlotAndMiniature = () => {
      slotState.x = (Math.random() - 0.5) * 11;
      slotState.z = -Math.random() * 55 - 15;
      parkingSlotMesh.position.set(slotState.x, 0.04, slotState.z);

      if (kimMiniature) {
        scene.remove(kimMiniature.group);
      }
      kimMiniature = createKimJongUnMiniature();
      kimMiniature.group.position.set(slotState.x, 0, slotState.z);
      scene.add(kimMiniature.group);
    };

    window.addEventListener('k1a1_fire', fire120mmCannon);

    window.addEventListener('k1a1_full_reset', () => {
      tankPhysics.x = 0;
      tankPhysics.z = 18;
      tankPhysics.angle = 0;
      tankPhysics.turretAngle = 0;
      tankPhysics.speed = 0;
      tankParts.tankGroup.position.set(0, 0, 18);
      tankParts.tankGroup.rotation.set(0, 0, 0);
      tankParts.turretGroup.rotation.set(0, 0, 0);

      clearAllCraters();

      projectiles.forEach((p) => {
        scene.remove(p.mesh);
        scene.remove(p.light);
      });
      projectiles.length = 0;

      explosions.forEach((e) => {
        scene.remove(e.mesh);
        scene.remove(e.light);
      });
      explosions.length = 0;

      debrisList.forEach((d) => scene.remove(d.mesh));
      debrisList.length = 0;

      bloodDroplets.forEach((bd) => scene.remove(bd.mesh));
      bloodDroplets.length = 0;

      slotState.x = 0;
      slotState.z = -18;
      parkingSlotMesh.position.set(0, 0.04, -18);

      if (kimMiniature) {
        scene.remove(kimMiniature.group);
      }
      kimMiniature = createKimJongUnMiniature();
      kimMiniature.group.position.set(0, 0, -18);
      scene.add(kimMiniature.group);

      parkingWave = 0;
      spawnObstacles();
      spawnEnemyForces(0);

      camera.position.set(0, 14, 34);
      camera.lookAt(0, 1.2, 14);
    });

    window.addEventListener('resize', () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // Main 60FPS Animation Loop
    let lastTime = performance.now();
    let chassisPitch = 0;

    const animate = (timestamp) => {
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      const isRunning = appState.gameActive && !appState.isPaused && !appState.isGameOver;

      if (appState.nightVision) {
        scene.background = new THREE.Color(0x021b14);
        scene.fog = new THREE.FogExp2(0x021b14, 0.013);
        renderer.toneMappingExposure = 1.7;
      } else {
        scene.background = daySkyColor;
        scene.fog = new THREE.FogExp2(dayFogColor, 0.007);
        renderer.toneMappingExposure = 1.25;
      }

      if (isRunning) {
        let throttle = 0;
        let steer = 0;
        if (keys['ArrowUp'] || keys['KeyW']) throttle += 1;
        if (keys['ArrowDown'] || keys['KeyS']) throttle -= 1;
        if (keys['ArrowLeft']) steer -= 1;
        if (keys['ArrowRight']) steer += 1;

        let isTraversing = false;
        if (keys['KeyA']) {
          tankPhysics.turretAngle += tankPhysics.turretTurnSpeed * dt * 60;
          isTraversing = true;
        }
        if (keys['KeyD']) {
          tankPhysics.turretAngle -= tankPhysics.turretTurnSpeed * dt * 60;
          isTraversing = true;
        }
        tankAudioEngine.setTurretTraversing(isTraversing);

        updateTankMovement(tankPhysics, { throttle, steer }, dt);
        tankAudioEngine.updateEngineSound(tankPhysics.speed, throttle !== 0);

        const targetPitch = throttle > 0 ? -0.025 : throttle < 0 ? 0.035 : 0;
        chassisPitch += (targetPitch - chassisPitch) * (1 - Math.exp(-8 * dt));

        // Curb collisions
        if (Math.abs(tankPhysics.x) > 9.8) {
          tankPhysics.x = Math.sign(tankPhysics.x) * 9.8;
          tankPhysics.speed = -tankPhysics.speed * 0.35;
          tankAudioEngine.playCrash();
          appState.timeLeft = Math.max(0, appState.timeLeft - 3.0);
          appState.playerHp = Math.max(0, appState.playerHp - 5);
          syncUI();
        }

        // Obstacle collisions
        obstacles.forEach((obs) => {
          const dx = tankPhysics.x - obs.x;
          const dz = tankPhysics.z - obs.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < obs.radius + 1.8) {
            tankPhysics.speed = -tankPhysics.speed * 0.4;
            tankAudioEngine.playCrash();
            appState.timeLeft = Math.max(0, appState.timeLeft - 3.0);
            appState.playerHp = Math.max(0, appState.playerHp - 5);
            obs.x = (Math.random() - 0.5) * 12;
            obs.group.position.x = obs.x;
            syncUI();
          }
        });

        // Crater bump
        const craterRecords = craters.map((c) => c.record);
        const bump = calculateCraterSuspensionBump(
          tankPhysics.x,
          tankPhysics.z,
          craterRecords,
          timestamp
        );

        tankParts.tankGroup.position.set(tankPhysics.x, bump.yOffset, tankPhysics.z);
        tankParts.tankGroup.rotation.y = tankPhysics.angle;
        tankParts.tankGroup.rotation.x = chassisPitch;
        tankParts.tankGroup.rotation.z = bump.tilt;
        tankParts.turretGroup.rotation.y = tankPhysics.turretAngle;

        if (Math.abs(tankPhysics.speed) > 0.001) {
          const wheelRot = (tankPhysics.speed / 0.42) * dt * 60;
          tankParts.wheels.forEach((w) => w.rotateY(wheelRot));
        }

        if (recoilTimer > 0) {
          recoilTimer -= dt;
          const recoilRatio = recoilTimer / 0.25;
          tankParts.recoilGroup.position.z = -2.1 + recoilRatio * 0.45;
        } else {
          tankParts.recoilGroup.position.z = -2.1;
        }

        // Cheering ROK Soldiers animation
        cheeringSoldiers.forEach((soldier) => {
          const timeVal = timestamp * 0.006 + soldier.phaseOffset;
          soldier.group.position.y = 0.5 + Math.abs(Math.sin(timeVal)) * 0.12;
          if (soldier.role === 'flag') {
            soldier.armR.rotation.z = -Math.PI / 4 + Math.sin(timeVal * 1.5) * 0.35;
            soldier.armL.rotation.z = Math.PI / 3 + Math.cos(timeVal * 1.5) * 0.25;
            if (soldier.flagMesh) soldier.flagMesh.rotation.y = Math.sin(timeVal * 2.0) * 0.25;
          } else if (soldier.role === 'cheer') {
            soldier.armL.rotation.z = Math.PI * 0.75 + Math.sin(timeVal) * 0.3;
            soldier.armR.rotation.z = -Math.PI * 0.75 - Math.sin(timeVal) * 0.3;
          } else {
            soldier.head.rotation.y = Math.sin(timeVal * 0.5) * 0.15;
          }
        });

        // Enemy AI
        enemyUnits.forEach((enemy) => {
          if (enemy.dead || !enemy.state.alive) return;
          const aiResult = updateEnemyAI(enemy.state, tankPhysics.x, tankPhysics.z, dt);
          if (enemy.type === 'tank') {
            enemy.model.turretGroup.rotation.y = enemy.state.turretAngle - enemy.state.angle;
          } else {
            enemy.model.torsoGroup.rotation.y = enemy.state.turretAngle - enemy.state.angle;
          }
          if (aiResult.shouldFire) {
            fireEnemyWeapon(enemy);
          }
        });

        // Kim Jong-un Miniature
        if (kimMiniature) {
          kimMiniature.head.rotation.y = Math.sin(timestamp * 0.0015) * 0.25;
          kimMiniature.head.rotation.x = Math.sin(timestamp * 0.003) * 0.05;

          const dxTank = tankPhysics.x - kimMiniature.group.position.x;
          const dzTank = tankPhysics.z - kimMiniature.group.position.z;
          const distTank = Math.sqrt(dxTank * dxTank + dzTank * dzTank);

          if (distTank < 2.2) {
            createBloodSplatterPuddle(
              kimMiniature.group.position.x,
              kimMiniature.group.position.z
            );
            scene.remove(kimMiniature.group);
            kimMiniature = null;
            appState.miniaturesEliminated += 1;
            syncUI();
          }
        }

        // Crushing North Korean KPA infantry squads with 55-ton tank treads
        enemyUnits.forEach((enemy) => {
          if (enemy.dead || !enemy.state.alive || enemy.type !== 'infantry') return;

          if (checkCrushInfantry(tankPhysics.x, tankPhysics.z, enemy.state.x, enemy.state.z, 2.4)) {
            enemy.dead = true;
            enemy.state.alive = false;

            // Organic squish audio and blood splatter puddle
            createBloodSplatterPuddle(enemy.state.x, enemy.state.z);
            scene.remove(enemy.model.group);

            // Award enemy elimination, score increment, and time bonus
            appState.enemiesEliminated += 1;
            appState.successCount += 1;
            appState.timeLeft = Math.min(99.0, appState.timeLeft + 3.0);
            syncUI();
          }
        });

        // Blood Splatters
        for (let i = bloodPuddles.length - 1; i >= 0; i--) {
          const bp = bloodPuddles[i];
          if (bp.growing && bp.scale < bp.maxScale) {
            bp.scale += dt * 7.5;
            bp.mesh.scale.set(bp.scale, bp.scale, bp.scale);
            if (bp.scale >= bp.maxScale) bp.growing = false;
          }
        }

        for (let i = bloodDroplets.length - 1; i >= 0; i--) {
          const bd = bloodDroplets[i];
          bd.mesh.position.x += bd.vx * dt * 60;
          bd.mesh.position.y += bd.vy * dt * 60;
          bd.mesh.position.z += bd.vz * dt * 60;
          bd.vy -= 0.015 * dt * 60;
          bd.life -= dt;
          if (bd.mesh.position.y <= 0.03 || bd.life <= 0) {
            bd.mesh.position.y = 0.03;
            if (bd.life <= 0) {
              scene.remove(bd.mesh);
              bloodDroplets.splice(i, 1);
            }
          }
        }

        // Check Parking Success
        const isParked = checkParkingSuccess(
          tankPhysics.x,
          tankPhysics.z,
          tankPhysics.speed,
          slotState
        );
        if (isParked) {
          tankAudioEngine.playSuccessChime();
          const clearedCount = craters.length;
          clearAllCraters();
          randomizeSlotAndMiniature();
          spawnObstacles();
          parkingWave += 1;
          spawnEnemyForces(parkingWave);
          appState.successCount += 1;
          appState.cratersClearedTotal += clearedCount;
          appState.playerHp = Math.min(100, appState.playerHp + 25);
          appState.timeLeft = Math.min(99.0, appState.timeLeft + 10);
          syncUI();
        }

        // Ballistic Projectiles
        for (let i = projectiles.length - 1; i >= 0; i--) {
          const p = projectiles[i];
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.vy -= 12.0 * dt;
          p.vx *= 1 - 0.04 * dt;
          p.vz *= 1 - 0.04 * dt;
          p.distance += Math.sqrt(p.vx * p.vx + p.vz * p.vz) * dt;
          p.life += dt;
          p.light.position.copy(p.mesh.position);

          let hit = false;

          if (p.isPlayer) {
            for (let j = 0; j < enemyUnits.length; j++) {
              const enemy = enemyUnits[j];
              if (enemy.dead || !enemy.state.alive) continue;

              const hitDist = p.mesh.position.distanceTo(enemy.model.group.position);
              const hitRadius = enemy.type === 'tank' ? 2.4 : 1.4;

              if (hitDist < hitRadius) {
                hit = true;
                enemy.dead = true;
                enemy.state.alive = false;

                tankAudioEngine.playEnemyUnitDestroyed();
                createCraterAndExplosion(enemy.state.x, enemy.state.z);

                if (enemy.type === 'tank') {
                  const tankModel = enemy.model;
                  scene.remove(enemy.model.group);

                  const wreckGeo = new THREE.BoxGeometry(3.1, 0.95, 6.2);
                  const wreckMat = new THREE.MeshStandardMaterial({
                    color: 0x111111,
                    roughness: 0.9,
                  });
                  const wreck = new THREE.Mesh(wreckGeo, wreckMat);
                  wreck.position.set(enemy.state.x, 0.85, enemy.state.z);
                  scene.add(wreck);
                  enemy.destroyedGroup = wreck;

                  const poppedTurret = tankModel.turretGroup.clone();
                  poppedTurret.position.set(enemy.state.x, 2.5, enemy.state.z);
                  scene.add(poppedTurret);
                  debrisList.push({
                    mesh: poppedTurret,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: 0.45,
                    vz: (Math.random() - 0.5) * 0.3,
                    rotX: 0.25,
                    rotY: 0.3,
                    life: 4.0,
                  });

                  appState.enemiesEliminated += 1;
                  appState.successCount += 2;
                  appState.timeLeft = Math.min(99.0, appState.timeLeft + 6.0);
                  syncUI();
                } else {
                  scene.remove(enemy.model.group);
                  appState.enemiesEliminated += 1;
                  appState.successCount += 1;
                  appState.timeLeft = Math.min(99.0, appState.timeLeft + 3.0);
                  syncUI();
                }
                break;
              }
            }

            if (!hit) {
              for (let j = obstacles.length - 1; j >= 0; j--) {
                const obs = obstacles[j];
                const distObs = p.mesh.position.distanceTo(obs.group.position);
                if (distObs < obs.radius + 0.6) {
                  createCraterAndExplosion(obs.x, obs.z);
                  scene.remove(obs.group);
                  obstacles.splice(j, 1);
                  hit = true;
                  break;
                }
              }
            }

            if (!hit && kimMiniature) {
              const distKim = p.mesh.position.distanceTo(kimMiniature.group.position);
              if (distKim < 2.5) {
                createCraterAndExplosion(
                  kimMiniature.group.position.x,
                  kimMiniature.group.position.z
                );
                createBloodSplatterPuddle(
                  kimMiniature.group.position.x,
                  kimMiniature.group.position.z
                );
                scene.remove(kimMiniature.group);
                kimMiniature = null;
                appState.miniaturesEliminated += 1;
                syncUI();
                hit = true;
              }
            }
          } else {
            const distPlayer = p.mesh.position.distanceTo(tankParts.tankGroup.position);
            if (distPlayer < 2.3) {
              hit = true;
              tankAudioEngine.playTankHitArmor();
              cameraShake = 0.35;
              appState.playerHp = Math.max(0, appState.playerHp - p.damage);
              syncUI();
              if (appState.playerHp <= 0) {
                setTimeout(() => handleGameOver(), 300);
              }

              const hitExp = new THREE.PointLight(0xffaa00, 6, 12);
              hitExp.position.copy(p.mesh.position);
              scene.add(hitExp);
              setTimeout(() => scene.remove(hitExp), 100);
            }
          }

          if (!hit && (p.mesh.position.y <= 0.15 || p.distance > 160)) {
            createCraterAndExplosion(p.mesh.position.x, p.mesh.position.z);
            hit = true;
          }

          if (hit) {
            scene.remove(p.mesh);
            scene.remove(p.light);
            projectiles.splice(i, 1);
          }
        }

        // Explosions
        for (let i = explosions.length - 1; i >= 0; i--) {
          const exp = explosions[i];
          exp.scale += 0.45;
          exp.mesh.scale.set(exp.scale, exp.scale, exp.scale);
          exp.life -= dt * 2.2;
          exp.mesh.material.opacity = Math.max(0, exp.life);
          exp.light.intensity = exp.life * 6;

          if (exp.life <= 0) {
            scene.remove(exp.mesh);
            scene.remove(exp.light);
            explosions.splice(i, 1);
          }
        }

        // Debris
        for (let i = debrisList.length - 1; i >= 0; i--) {
          const d = debrisList[i];
          d.mesh.position.x += d.vx * dt * 60;
          d.mesh.position.y += d.vy * dt * 60;
          d.mesh.position.z += d.vz * dt * 60;
          d.mesh.rotation.x += d.rotX;
          d.mesh.rotation.y += d.rotY;
          d.vy -= 0.018 * dt * 60;
          d.life -= dt;

          if (d.life <= 0 || d.mesh.position.y <= 0) {
            scene.remove(d.mesh);
            debrisList.splice(i, 1);
          }
        }

        // Camera Shake
        let shakeOffsetX = 0;
        let shakeOffsetY = 0;
        if (cameraShake > 0) {
          cameraShake -= dt * 1.5;
          shakeOffsetX = (Math.random() - 0.5) * cameraShake * 0.8;
          shakeOffsetY = (Math.random() - 0.5) * cameraShake * 0.8;
        }

        // Camera Modes (V Key)
        if (appState.cameraMode === 'gunner') {
          const totalAngle = tankPhysics.angle + tankPhysics.turretAngle;
          camera.position.set(
            tankPhysics.x - Math.sin(totalAngle) * 0.5 + shakeOffsetX,
            tankParts.tankGroup.position.y + 2.3 + shakeOffsetY,
            tankPhysics.z - Math.cos(totalAngle) * 0.5
          );
          camera.lookAt(
            tankPhysics.x - Math.sin(totalAngle) * 60,
            tankParts.tankGroup.position.y + 1.8,
            tankPhysics.z - Math.cos(totalAngle) * 60
          );
        } else if (appState.cameraMode === 'drone') {
          camera.position.set(tankPhysics.x + shakeOffsetX, 34 + shakeOffsetY, tankPhysics.z + 6);
          camera.lookAt(tankPhysics.x, 0, tankPhysics.z - 4);
        } else {
          const targetCamX = tankPhysics.x + shakeOffsetX;
          const targetCamY = 14 + bump.yOffset + shakeOffsetY;
          const targetCamZ = tankPhysics.z + 16;
          camera.position.x += (targetCamX - camera.position.x) * (1 - Math.exp(-6 * dt));
          camera.position.y += (targetCamY - camera.position.y) * (1 - Math.exp(-6 * dt));
          camera.position.z += (targetCamZ - camera.position.z) * (1 - Math.exp(-6 * dt));
          camera.lookAt(tankPhysics.x, bump.yOffset + 1.2, tankPhysics.z - 4);
        }
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
