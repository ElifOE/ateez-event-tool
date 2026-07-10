p5.disableFriendlyErrors = true;

let currentWorld = 'A';
let song, fft, ampAnalyzer;
let particles = [];
let particleCount = 2000;
let isPlaying = false;
let noiseZoff = 0;
let fileInput;
let playBtn;

let smoothBass = 0;
let smoothMid = 0;
let smoothHigh = 0;
let smoothAmp = 0;
let smoothLaser = 0;
let prevBass = 0;
let prevHigh = 0;
let prevLaser = 0;

let musicPresence = 0;

let glitchLines = [];
let bassRings = [];

let melodyY = 0.5;
let smoothMelodyY = 0.5;

let reactSlider, densitySlider, speedSlider, countSlider;
let labelReact, labelDensity, labelSpeed, labelCount;
let showUI = true;

const worlds = {
  A: {
    bg: [255, 255, 255], pc: [0, 0, 0],
    noiseSpeed: 0.001, noiseScale: 0.004, alpha: 180, pixelSize: 3,
    react: 0.6, flow: 0.6, fade: 35, horizontalBias: 0.3,
    glitchIntensity: 0.5, scanlineAlpha: 10, bassRingForce: 0.6
  },
  Z: {
    bg: [0, 0, 0], pc: [255, 255, 255],
    noiseSpeed: 0.005, noiseScale: 0.006, alpha: 200, pixelSize: 4,
    react: 2.0, flow: 1.5, fade: 45, horizontalBias: 0.6,
    glitchIntensity: 1.0, scanlineAlpha: 18, bassRingForce: 1.0
  }
};

let currentPart = null;

const partColors = {
  default: {
    A: { bg: [255, 255, 255], pc: [0, 0, 0] },
    Z: { bg: [0, 0, 0], pc: [255, 255, 255] }
  },
  1: {
    A: { bg: [252, 251, 246], pc: [170, 125, 60] },
    Z: { bg: [25, 62, 82], pc: [170, 125, 60] }
  },
  2: {
    A: { bg: [194, 195, 199], pc: [46, 49, 56] },
    Z: { bg: [46, 49, 56], pc: [194, 195, 199] }
  },
  3: {
    A: { bg: [249, 0, 0], pc: [1, 1, 3] },
    Z: { bg: [1, 1, 3], pc: [249, 0, 0] }
  },
  4: {
    A: { bg: [241, 245, 248], pc: [3, 25, 71] },
    Z: { bg: [3, 25, 71], pc: [241, 245, 248] }
  },
  5: {
    A: { bg: [254, 123, 217], pc: [218, 217, 225] },
    Z: { bg: [48, 157, 118], pc: [254, 123, 217] }
  }
};

let partButtons = [];

let cur = {
  bg: [255, 255, 255], pc: [0, 0, 0],
  noiseSpeed: 0.001, noiseScale: 0.004, alpha: 180, pixelSize: 3,
  react: 0.6, flow: 0.6, fade: 35, horizontalBias: 0.3,
  glitchIntensity: 0.5, scanlineAlpha: 10, bassRingForce: 0.6
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255);
  noiseSeed(42);
  noSmooth();

  fft = new p5.FFT(0.8, 256);
  ampAnalyzer = new p5.Amplitude(0.85);

  
  fileInput = createFileInput(handleFile);
  fileInput.style('display', 'none');

  let uploadBtn = createButton('Upload Audio');
  uploadBtn.position(20, 20);
  uploadBtn.mousePressed(() => fileInput.elt.click());
  uploadBtn.style('padding', '8px 16px');
  uploadBtn.style('font-family', 'Inter, sans-serif');
  uploadBtn.style('font-size', '12px');
  uploadBtn.style('background', '#111');
  uploadBtn.style('color', '#fff');
  uploadBtn.style('border', 'none');
  uploadBtn.style('border-radius', '4px');
  uploadBtn.style('cursor', 'pointer');
  uploadBtn.addClass('ui-element');

  
  playBtn = createButton('▶ Play');
  playBtn.position(150, 20);
  playBtn.mousePressed(() => {
    togglePlay();
    playBtn.html(isPlaying ? '⏸ Pause' : '▶ Play');
  });
  playBtn.style('padding', '8px 16px');
  playBtn.style('font-family', 'Inter, sans-serif');
  playBtn.style('font-size', '12px');
  playBtn.style('background', '#111');
  playBtn.style('color', '#fff');
  playBtn.style('border', 'none');
  playBtn.style('border-radius', '4px');
  playBtn.style('cursor', 'pointer');
  playBtn.addClass('ui-element');

  
  if (window === window.top) {
    let btnA = createButton('WORLD A');
    btnA.position(20, 60);
    btnA.mousePressed(() => setWorld('A'));
    btnA.style('padding', '8px 16px');
    btnA.style('font-weight', 'bold');
    btnA.id('btn-a');

    let btnZ = createButton('WORLD Z');
    btnZ.position(120, 60);
    btnZ.mousePressed(() => setWorld('Z'));
    btnZ.style('padding', '8px 16px');
    btnZ.style('font-weight', 'bold');
    btnZ.id('btn-z');

    let partLabels = ['Pt. 1', 'Pt. 2', 'Pt. 3', 'Pt. 4', 'Pt. 5'];
    for (let p = 0; p < 5; p++) {
      let btn = createButton(partLabels[p]);
      btn.position(220 + p * 60, 60);
      btn.mousePressed(() => togglePart(p + 1));
      btn.style('padding', '6px 10px');
      btn.style('font-size', '11px');
      btn.style('cursor', 'pointer');
      btn.id('btn-pt-' + (p + 1));
      partButtons.push(btn);
    }
    updatePartButtonStyles();
  }

  
  let sliderX = 20;
  let sliderW = 180;
  let sliderStartY = window === window.top ? 90 : 55;

  labelReact = createP('Reactivity');
  labelReact.position(sliderX, sliderStartY);
  labelReact.style('font-size', '12px');
  labelReact.addClass('ui-label');
  reactSlider = createSlider(0, 100, 70);
  reactSlider.position(sliderX, sliderStartY + 30);
  reactSlider.style('width', sliderW + 'px');
  reactSlider.addClass('ui-element');

  labelDensity = createP('Noise Density');
  labelDensity.position(sliderX, sliderStartY + 50);
  labelDensity.style('font-size', '12px');
  labelDensity.addClass('ui-label');
  densitySlider = createSlider(10, 100, 50);
  densitySlider.position(sliderX, sliderStartY + 80);
  densitySlider.style('width', sliderW + 'px');
  densitySlider.addClass('ui-element');

  labelSpeed = createP('Speed');
  labelSpeed.position(sliderX, sliderStartY + 100);
  labelSpeed.style('font-size', '12px');
  labelSpeed.addClass('ui-label');
  speedSlider = createSlider(1, 100, 35);
  speedSlider.position(sliderX, sliderStartY + 130);
  speedSlider.style('width', sliderW + 'px');
  speedSlider.addClass('ui-element');

  labelCount = createP('Particles');
  labelCount.position(sliderX, sliderStartY + 150);
  labelCount.style('font-size', '12px');
  labelCount.addClass('ui-label');
  countSlider = createSlider(200, 1800, 900, 100);
  countSlider.position(sliderX, sliderStartY + 180);
  countSlider.style('width', sliderW + 'px');
  countSlider.addClass('ui-element');

  initParticlesAtEdges(particleCount);
  background(cur.bg[0], cur.bg[1], cur.bg[2]);
}

function initParticlesAtEdges(count) {
  particles = [];
  for (let i = 0; i < count; i++) {
    let edge = random() < 0.7 ? (random() < 0.5 ? 2 : 3) : (random() < 0.5 ? 0 : 1);
    let x, y;
    if (edge === 0) { x = random(width); y = -random(20, 200); }
    else if (edge === 1) { x = random(width); y = height + random(20, 200); }
    else if (edge === 2) { x = -random(20, 200); y = random(height); }
    else { x = width + random(20, 200); y = random(height); }
    particles.push({
      x: x, y: y, prevX: x, prevY: y,
      homeX: random(width), homeY: random(height),
      edgeX: x, edgeY: y,
      speed: random(0.3, 1.5), phase: random(TWO_PI),
      pushX: 0, pushY: 0, flicker: random(0.4, 1.8)
    });
  }
}

function draw() {
  let w = worlds[currentWorld];
  let lerpAmt = 0.035;

  let partKey = currentPart === null ? 'default' : currentPart;
  let partCol = partColors[partKey][currentWorld];
  let targetBg = partCol.bg;
  let targetPc = partCol.pc;

  cur.bg[0] = lerp(cur.bg[0], targetBg[0], lerpAmt);
  cur.bg[1] = lerp(cur.bg[1], targetBg[1], lerpAmt);
  cur.bg[2] = lerp(cur.bg[2], targetBg[2], lerpAmt);
  cur.pc[0] = lerp(cur.pc[0], targetPc[0], lerpAmt);
  cur.pc[1] = lerp(cur.pc[1], targetPc[1], lerpAmt);
  cur.pc[2] = lerp(cur.pc[2], targetPc[2], lerpAmt);
  cur.noiseSpeed = lerp(cur.noiseSpeed, w.noiseSpeed, lerpAmt);
  cur.noiseScale = lerp(cur.noiseScale, w.noiseScale, lerpAmt);
  cur.alpha = lerp(cur.alpha, w.alpha, lerpAmt);
  cur.pixelSize = lerp(cur.pixelSize, w.pixelSize, lerpAmt);
  cur.react = lerp(cur.react, w.react, lerpAmt);
  cur.flow = lerp(cur.flow, w.flow, lerpAmt);
  cur.fade = lerp(cur.fade, w.fade, lerpAmt);
  cur.horizontalBias = lerp(cur.horizontalBias, w.horizontalBias, lerpAmt);
  cur.glitchIntensity = lerp(cur.glitchIntensity, w.glitchIntensity, lerpAmt);
  cur.scanlineAlpha = lerp(cur.scanlineAlpha, w.scanlineAlpha, lerpAmt);
  cur.bassRingForce = lerp(cur.bassRingForce, w.bassRingForce, lerpAmt);

  fill(cur.bg[0], cur.bg[1], cur.bg[2], cur.fade);
  noStroke();
  rect(0, 0, width, height);

  let spectrum = fft.analyze();
  let bassEnergy = fft.getEnergy("bass") / 255;
  let midEnergy = fft.getEnergy("mid") / 255;
  let highEnergy = fft.getEnergy("treble") / 255;
  let ampLevel = ampAnalyzer.getLevel();
  let laserEnergy = fft.getEnergy(1000, 4000) / 255;

  let maxVal = 0;
  let maxIdx = 0;
  for (let s = 10; s < 120; s++) {
    if (spectrum[s] > maxVal) { maxVal = spectrum[s]; maxIdx = s; }
  }
  melodyY = map(maxIdx, 10, 120, 1, 0);
  smoothMelodyY = lerp(smoothMelodyY, melodyY, 0.08);

  smoothBass = lerp(smoothBass, bassEnergy, 0.18);
  smoothMid = lerp(smoothMid, midEnergy, 0.14);
  smoothHigh = lerp(smoothHigh, highEnergy, 0.12);
  smoothAmp = lerp(smoothAmp, ampLevel, 0.15);
  smoothLaser = lerp(smoothLaser, laserEnergy, 0.15);

  let bassJump = smoothBass - prevBass;
  prevBass = smoothBass;
  let highJump = smoothHigh - prevHigh;
  prevHigh = smoothHigh;

  if (bassJump > 0.04 && musicPresence > 0.2) {
    let intensity = map(bassJump, 0.04, 0.3, 0.5, 1.5);
    bassRings.push({
      radius: 5,
      maxRadius: random(250, 600) * cur.bassRingForce * intensity,
      speed: random(8, 18) * intensity,
      alpha: 255 * intensity,
      weight: random(2, 6) * cur.bassRingForce,
      shake: bassJump * 40 * cur.bassRingForce
    });
    let cx = width / 2;
    let cy = height / 2;
    for (let j = 0; j < particles.length; j += 2) {
      let p = particles[j];
      let dx = p.x - cx;
      let dy = p.y - cy;
      let d = max(1, sqrt(dx * dx + dy * dy));
      let force = map(d, 0, 500, 10, 2) * cur.bassRingForce * intensity;
      p.pushX += (dx / d) * force;
      p.pushY += (dy / d) * force;
    }
  }

  if (highJump > 0.03 && musicPresence > 0.2) {
    let lineCount = floor(random(8, 25) * cur.glitchIntensity);
    for (let g = 0; g < lineCount; g++) {
      glitchLines.push({
        y: random(height),
        h: random(2, 35) * cur.glitchIntensity,
        xOffset: random(-250, 250) * cur.glitchIntensity,
        w: random(width * 0.1, width * 1.1),
        xStart: random(-width * 0.15, width * 0.15),
        alpha: random(160, 255),
        life: 1.0,
        decay: random(0.06, 0.2),
        isBar: random() < 0.3,
        slideSpeed: random(-15, 15) * cur.glitchIntensity
      });
    }
    for (let j = 0; j < particles.length; j += 2) {
      let p = particles[j];
      p.pushX += (random() < 0.5 ? -1 : 1) * random(4, 15) * cur.glitchIntensity;
    }
  }

  let targetPresence = (isPlaying && smoothAmp > 0.005) ? 1 : 0;
  let presenceLerp = targetPresence > musicPresence ? 0.02 : 0.01;
  musicPresence = lerp(musicPresence, targetPresence, presenceLerp);

  let reactivity = reactSlider.value() / 100;
  let densityMod = densitySlider.value() / 50;
  let speedMod = speedSlider.value() / 30;

  let newCount = countSlider.value();
  if (newCount > particles.length) {
    for (let i = particles.length; i < newCount; i++) {
      let edge = random() < 0.7 ? (random() < 0.5 ? 2 : 3) : (random() < 0.5 ? 0 : 1);
      let x, y;
      if (edge === 0) { x = random(width); y = -random(20, 200); }
      else if (edge === 1) { x = random(width); y = height + random(20, 200); }
      else if (edge === 2) { x = -random(20, 200); y = random(height); }
      else { x = width + random(20, 200); y = random(height); }
      particles.push({
        x: x, y: y, prevX: x, prevY: y,
        homeX: random(width), homeY: random(height),
        edgeX: x, edgeY: y,
        speed: random(0.3, 1.5), phase: random(TWO_PI),
        pushX: 0, pushY: 0, flicker: random(0.4, 1.8)
      });
    }
  } else if (newCount < particles.length) {
    particles.length = newCount;
  }

  noiseZoff += cur.noiseSpeed * speedMod * (1 + smoothBass * cur.react * reactivity * 3) * musicPresence;
  let noiseScl = cur.noiseScale * densityMod;

  // LAYER 1: TV NOISE PIXELS
  noStroke();
  let maxParticlesThisFrame = min(particles.length, 800);
  for (let i = 0; i < maxParticlesThisFrame; i++) {
    if (musicPresence < 0.05) { if (i % 4 !== 0) continue; }

    let p = particles[i];
    p.prevX = p.x; p.prevY = p.y;
    p.pushX *= 0.88; p.pushY *= 0.92;

    if (musicPresence > 0.01) {
      let angle = noise(p.x * noiseScl, p.y * noiseScl, noiseZoff) * TWO_PI * 2;
      let distToCenter = dist(p.x, p.y, width / 2, height / 2);
      let waveOffset = sin(distToCenter * 0.006 - frameCount * 0.025) * smoothMid * cur.react * reactivity * 2;
      angle += waveOffset;
      let targetAngle = cos(angle) > 0 ? 0 : PI;
      angle = lerp(angle, targetAngle, cur.horizontalBias * 0.3);
      let speedFactor = p.speed * cur.flow * speedMod * (1 + smoothMid * reactivity * 0.8);
      let pullStrength = max(0, 1 - musicPresence * 1.5);
      if (pullStrength > 0.01) {
        let dx = p.homeX - p.x; let dy = p.homeY - p.y;
        p.x += dx * 0.02 * pullStrength + cos(angle) * speedFactor * (1 - pullStrength);
        p.y += dy * 0.02 * pullStrength + sin(angle) * speedFactor * (1 - pullStrength);
      } else {
        p.x += cos(angle) * speedFactor + p.pushX;
        p.y += sin(angle) * speedFactor + p.pushY;
      }
      if (musicPresence > 0.8) {
        if (p.x < 0) p.x = width; if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height; if (p.y > height) p.y = 0;
      }
      p.homeX += (noise(i * 0.1, frameCount * 0.001) - 0.5) * 2;
      p.homeY += (noise(i * 0.1 + 500, frameCount * 0.001) - 0.5) * 2;
      p.homeX = constrain(p.homeX, 50, width - 50);
      p.homeY = constrain(p.homeY, 50, height - 50);
    } else {
      let dx = p.edgeX - p.x; let dy = p.edgeY - p.y;
      p.x += dx * 0.008 + sin(frameCount * 0.005 + p.phase) * 0.3;
      p.y += dy * 0.008 + cos(frameCount * 0.005 + p.phase) * 0.3;
    }

    let presenceAlpha = musicPresence;
    if (musicPresence < 0.1) {
      let distFromCenter = dist(p.x, p.y, width / 2, height / 2);
      let maxDistance = dist(0, 0, width / 2, height / 2);
      presenceAlpha = map(distFromCenter, maxDistance * 0.5, maxDistance, 0, 0.15);
      presenceAlpha = constrain(presenceAlpha, 0, 0.15);
    }

    let flickerNoise = noise(i * 0.5, frameCount * 0.3 * p.flicker);
    let flickerAlpha = flickerNoise * cur.alpha * presenceAlpha;
    flickerAlpha *= (0.5 + smoothMid * reactivity * 2);

    let melodyZoneY = smoothMelodyY * height;
    let distToMelody = abs(p.y - melodyZoneY);
    let melodyBoost = map(distToMelody, 0, height * 0.25, 1.8, 1.0);
    melodyBoost = constrain(melodyBoost, 1.0, 1.8);
    flickerAlpha *= melodyBoost;

    let pSize = cur.pixelSize * (1 + smoothBass * reactivity * 0.5);
    pSize *= map(distToMelody, 0, height * 0.2, 1.5, 1.0);
    pSize = constrain(pSize, cur.pixelSize * 0.8, cur.pixelSize * 2.5);

    let randOff = pSize * 0.2;
    let snapX = floor(p.x / pSize) * pSize + random(-randOff, randOff);
    let snapY = floor(p.y / pSize) * pSize + random(-randOff, randOff);

    if (flickerAlpha > 5) {
      let brightness = flickerNoise;
      let r = lerp(cur.bg[0], cur.pc[0], brightness);
      let g = lerp(cur.bg[1], cur.pc[1], brightness);
      let b = lerp(cur.bg[2], cur.pc[2], brightness);
      fill(r, g, b, flickerAlpha);
      rect(snapX, snapY, pSize, pSize);

      if (smoothLaser > 0.2 && musicPresence > 0.3) {
        let mirrorAlpha = flickerAlpha * map(smoothLaser, 0.2, 0.8, 0.1, 0.8);
        let mx = width - snapX; let my = height - snapY;
        let mSnapX = floor(mx / pSize) * pSize + random(-randOff, randOff);
        let mSnapY = floor(my / pSize) * pSize + random(-randOff, randOff);
        fill(r, g, b, mirrorAlpha);
        rect(mSnapX, mSnapY, pSize, pSize);
      }
    }
  }

  // LAYER 2: GYROSCOPE BASS RINGS (Ateez Lightstick inspiriert)
  let cx = width / 2;
  let cy = height / 2;
  for (let i = bassRings.length - 1; i >= 0; i--) {
    let br = bassRings[i];
    br.radius += br.speed; br.alpha *= 0.94; br.shake *= 0.85;
    let shakeX = random(-br.shake, br.shake);
    let shakeY = random(-br.shake, br.shake);
    noFill();
    let orbitAngles = [0, PI / 3, PI * 2 / 3, PI / 6];
    let orbitTilts = [1.0, 0.35, 0.5, 0.7];
    for (let o = 0; o < 4; o++) {
      let rot = orbitAngles[o] + frameCount * 0.003 * (o % 2 === 0 ? 1 : -1);
      let squeeze = orbitTilts[o];
      stroke(cur.pc[0], cur.pc[1], cur.pc[2], br.alpha * (0.6 + o * 0.1));
      strokeWeight(1 + br.weight * 0.2);
      push(); translate(cx + shakeX, cy + shakeY); rotate(rot);
      ellipse(0, 0, br.radius * 2, br.radius * 2 * squeeze);
      pop();
    }
    if (br.alpha < 2 || br.radius > br.maxRadius) bassRings.splice(i, 1);
  }

  if (smoothBass > 0.1 && musicPresence > 0.3) {
    let pulseSize = 30 + smoothBass * 350 * cur.bassRingForce;
    let pulseAlpha = smoothBass * 50 * musicPresence;
    noFill();
    let pulseOrbits = [
      { angle: frameCount * 0.008, squish: 0.3, alphaM: 1.0, weightM: 1.0 },
      { angle: frameCount * -0.006, squish: 0.5, alphaM: 0.7, weightM: 0.8 },
      { angle: frameCount * 0.004 + PI / 2, squish: 0.7, alphaM: 0.5, weightM: 0.6 },
      { angle: frameCount * -0.01, squish: 1.0, alphaM: 0.3, weightM: 0.5 }
    ];
    for (let o = 0; o < pulseOrbits.length; o++) {
      let orb = pulseOrbits[o];
      stroke(cur.pc[0], cur.pc[1], cur.pc[2], pulseAlpha * orb.alphaM);
      strokeWeight((1 + smoothBass * 3) * orb.weightM);
      push(); translate(cx, cy); rotate(orb.angle);
      ellipse(0, 0, pulseSize * 2, pulseSize * 2 * orb.squish);
      pop();
    }
  }

  // LAYER 3: GLITCH LINES
  noStroke();
  for (let i = glitchLines.length - 1; i >= 0; i--) {
    let gl = glitchLines[i];
    gl.life -= gl.decay; gl.xStart += gl.slideSpeed;
    if (gl.life <= 0) { glitchLines.splice(i, 1); continue; }
    let glAlpha = gl.alpha * gl.life * musicPresence;
    if (gl.isBar) {
      fill(cur.pc[0], cur.pc[1], cur.pc[2], glAlpha);
      rect(gl.xStart, gl.y, gl.w, gl.h);
    } else {
      fill(cur.pc[0], cur.pc[1], cur.pc[2], glAlpha * 0.7);
      rect(gl.xStart + gl.xOffset, gl.y, gl.w * 0.5, gl.h);
      fill(cur.pc[0], cur.pc[1], cur.pc[2], glAlpha * 0.3);
      rect(gl.xStart + gl.xOffset * 1.8, gl.y + gl.h, gl.w * 0.25, gl.h * 0.6);
      fill(cur.pc[0], cur.pc[1], cur.pc[2], glAlpha * 0.5);
      for (let px = 0; px < 6; px++) {
        rect(gl.xStart + gl.xOffset + random(-40, gl.w * 0.4), gl.y + random(-10, gl.h + 10), random(2, 6), random(2, 6));
      }
    }
  }
  if (glitchLines.length > 80) glitchLines.splice(0, glitchLines.length - 80);

  // LAYER 5: MELODY PITCH BAND
  if (smoothMid > 0.1 && musicPresence > 0.2) {
    let bandY = smoothMelodyY * height;
    let bandHeight = 80 + smoothMid * 160;
    let bandAlpha = smoothMid * reactivity * 130 * musicPresence;
    noStroke();
    let pxS = cur.pixelSize;
    for (let py = bandY - bandHeight / 2; py < bandY + bandHeight / 2; py += pxS * 5) {
      for (let px = 0; px < width; px += pxS * 6) {
        if (random() < 0.65) {
          let distFromCenter = abs(py - bandY) / (bandHeight / 2);
          let pixAlpha = bandAlpha * (1 - distFromCenter * distFromCenter) * random(0.6, 1.4);
          let brightness = random(0.3, 1.0);
          let r = lerp(cur.bg[0], cur.pc[0], brightness);
          let g = lerp(cur.bg[1], cur.pc[1], brightness);
          let b = lerp(cur.bg[2], cur.pc[2], brightness);
          fill(r, g, b, pixAlpha);
          rect(px + random(-pxS, pxS), py, pxS * random(1, 4), pxS * random(1, 2));
        }
      }
    }
    stroke(cur.pc[0], cur.pc[1], cur.pc[2], bandAlpha * 0.8); strokeWeight(3);
    line(0, bandY, width, bandY);
    stroke(cur.pc[0], cur.pc[1], cur.pc[2], bandAlpha * 0.5); strokeWeight(1.5);
    line(0, bandY - bandHeight * 0.3, width, bandY - bandHeight * 0.3);
    line(0, bandY + bandHeight * 0.3, width, bandY + bandHeight * 0.3);
  }

  // LAYER 6: SCANLINES
  if (musicPresence > 0.1) {
    let scanAlpha = cur.scanlineAlpha * musicPresence * (1 + smoothBass * 0.8);
    stroke(cur.pc[0], cur.pc[1], cur.pc[2], scanAlpha); strokeWeight(1);
    let gap = 5;
    let scrollOffset = (frameCount * 1.5) % gap;
    let jitter = smoothHigh * cur.glitchIntensity * 3;
    for (let sy = scrollOffset; sy < height; sy += gap) {
      let xShift = 0;
      if (jitter > 0.2) xShift = (noise(sy * 0.1, frameCount * 0.15) - 0.5) * jitter * 15;
      line(xShift, sy, width + xShift, sy);
    }
  }

  
  if (labelReact) {
    let labelCol = 'rgb(' + Math.round(cur.pc[0]) + ',' + Math.round(cur.pc[1]) + ',' + Math.round(cur.pc[2]) + ')';
    labelReact.style('color', labelCol);
    labelDensity.style('color', labelCol);
    labelSpeed.style('color', labelCol);
    labelCount.style('color', labelCol);
  }

  // LAYER 7: BASS FLASH
  if (currentWorld === 'Z' && smoothBass > 0.65 && musicPresence > 0.4) {
    let flashAlpha = map(smoothBass, 0.65, 1, 0, 15) * reactivity * musicPresence;
    fill(cur.pc[0], cur.pc[1], cur.pc[2], flashAlpha); noStroke();
    rect(0, 0, width, height);
  }
}

function handleFile(file) {
  if (file.type === 'audio') {
    if (song && song.isPlaying()) song.stop();
    song = loadSound(file.data, () => { isPlaying = false; });
  }
}

function togglePlay() {
  if (!song) return;
  if (getAudioContext().state !== 'running') getAudioContext().resume();
  if (isPlaying) { song.pause(); isPlaying = false; }
  else { song.play(); isPlaying = true; }
}

function setWorld(w) { currentWorld = w; }

function togglePart(p) {
  currentPart = (currentPart === p) ? null : p;
  updatePartButtonStyles();
}

function updatePartButtonStyles() {
  for (let i = 0; i < partButtons.length; i++) {
    let btn = partButtons[i];
    let isActive = currentPart === (i + 1);
    btn.style('font-weight', isActive ? 'bold' : 'normal');
    btn.style('border', isActive ? '2px solid #888' : '1px solid #ccc');
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') { saveCanvas('visual-output', 'png'); return false; }
  if (key === 'a' || key === 'A') setWorld('A');
  if (key === 'z' || key === 'Z') setWorld('Z');
  if (key === 'f' || key === 'F') fullscreen(!fullscreen());
  if (key === ' ') {
    togglePlay();
    if (playBtn) playBtn.html(isPlaying ? '⏸ Pause' : '▶ Play');
    return false;
  }
  if (key === '0') { currentPart = null; updatePartButtonStyles(); }
  if (key === '1') togglePart(1);
  if (key === '2') togglePart(2);
  if (key === '3') togglePart(3);
  if (key === '4') togglePart(4);
  if (key === '5') togglePart(5);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(cur.bg[0], cur.bg[1], cur.bg[2]);
}

window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'ateez-config') {
    if (e.data.world) setWorld(e.data.world);
    if (e.data.part !== undefined) {
      currentPart = e.data.part;
      if (typeof updatePartButtonStyles === 'function') updatePartButtonStyles();
    }
  }
});