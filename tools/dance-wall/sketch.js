let cam;
let segmenter;
let rawMaskCanvas;
let personMask;
let trail;
let ready = false;


let currentWorld = 'Z';
let currentPart = null; 


const partColors = {
  default: {
    A: { bg: [255, 255, 255], glow: [0, 0, 0] },
    Z: { bg: [0, 0, 0], glow: [255, 255, 255] }
  },
  1: {
    A: { bg: [252, 251, 246], glow: [170, 125, 60] },
    Z: { bg: [25, 62, 82], glow: [170, 125, 60] }
  },
  2: {
    A: { bg: [194, 195, 199], glow: [46, 49, 56] },
    Z: { bg: [46, 49, 56], glow: [194, 195, 199] }
  },
  3: {
    A: { bg: [249, 0, 0], glow: [1, 1, 3] },
    Z: { bg: [1, 1, 3], glow: [249, 0, 0] }
  },
  4: {
    A: { bg: [241, 245, 248], glow: [3, 25, 71] },
    Z: { bg: [3, 25, 71], glow: [241, 245, 248] }
  },
  5: {
    A: { bg: [254, 123, 217], glow: [218, 217, 225] },
    Z: { bg: [48, 157, 118], glow: [254, 123, 217] }
  }
};


function makePreset(bg, glow) {
  return {
    bg: bg,
    glow: glow,
    glowAlpha: [50, 60, 120, 210, 130],
    shadow: "rgba(" + glow[0] + "," + glow[1] + "," + glow[2] + ",0.95)",
    trailFade: [bg[0], bg[1], bg[2], 20],
    trailTint: [glow[0], glow[1], glow[2], 50],
    coreTint: [glow[0], glow[1], glow[2], 220],
    innerTint: [glow[0], glow[1], glow[2], 140]
  };
}

function getActivePreset() {
  let part = currentPart === null ? 'default' : currentPart;
  let colors = partColors[part][currentWorld];
  return makePreset(colors.bg, colors.glow);
}

let cur = {
  bg: [0, 0, 0],
  glow: [255, 255, 255],
  glowAlpha: [50, 60, 120, 210, 130],
  trailFade: [0, 0, 0, 20],
  trailTint: [255, 255, 255, 50],
  coreTint: [240, 240, 240, 220],
  innerTint: [255, 255, 255, 140]
};

let curShadow = "rgba(255,255,255,0.95)";


let partButtons = [];

function setup() {
  createCanvas(500, 700);
  pixelDensity(1);

  cam = createCapture(VIDEO, { flipped: true });
  cam.size(width, height);
  cam.hide();

  rawMaskCanvas = document.createElement("canvas");
  rawMaskCanvas.width = width;
  rawMaskCanvas.height = height;

  personMask = createGraphics(width, height);
  trail = createGraphics(width, height);

  segmenter = new SelfieSegmentation({
    locateFile: function (file) {
      return "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/" + file;
    }
  });

  segmenter.setOptions({
    modelSelection: 1,
    selfieMode: false
  });

  segmenter.onResults(gotResults);
  sendToMediaPipe();

 
  if (window === window.top) {
    let btnA = createButton('WORLD A');
    btnA.position(20, 20);
    btnA.mousePressed(() => setWorld('A'));
    btnA.style('padding', '6px 14px');
    btnA.style('font-weight', 'bold');
    btnA.style('font-size', '12px');
    btnA.id('btn-a');

    let btnZ = createButton('WORLD Z');
    btnZ.position(110, 20);
    btnZ.mousePressed(() => setWorld('Z'));
    btnZ.style('padding', '6px 14px');
    btnZ.style('font-weight', 'bold');
    btnZ.style('font-size', '12px');
    btnZ.id('btn-z');

    let partLabels = ['Pt. 1', 'Pt. 2', 'Pt. 3', 'Pt. 4', 'Pt. 5'];

    for (let p = 0; p < 5; p++) {
      let btn = createButton(partLabels[p]);
      btn.position(20 + p * 65, 55);
      btn.mousePressed(() => togglePart(p + 1));
      btn.style('padding', '5px 10px');
      btn.style('font-size', '11px');
      btn.style('cursor', 'pointer');
      btn.id('btn-pt-' + (p + 1));
      partButtons.push(btn);
    }

    updatePartButtonStyles();
  }
}

function setWorld(w) {
  currentWorld = w;
  trail.clear();
}

function togglePart(p) {
  if (currentPart === p) {
    currentPart = null;
  } else {
    currentPart = p;
  }

  trail.clear();
  updatePartButtonStyles();
}

function updatePartButtonStyles() {
  for (let i = 0; i < partButtons.length; i++) {
    let btn = partButtons[i];
    let isActive = currentPart === i + 1;

    btn.style('font-weight', isActive ? 'bold' : 'normal');
    btn.style('border', isActive ? '2px solid #888' : '1px solid #ccc');
  }
}

async function sendToMediaPipe() {
  if (cam.elt.readyState >= 2) {
    await segmenter.send({ image: cam.elt });
  }

  requestAnimationFrame(sendToMediaPipe);
}

function gotResults(results) {
  let ctx = rawMaskCanvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(results.segmentationMask, 0, 0, width, height);

  personMask.clear();
  personMask.push();
  personMask.translate(width, 0);
  personMask.scale(-1, 1);
  personMask.drawingContext.drawImage(rawMaskCanvas, 0, 0, width, height);
  personMask.pop();

  personMask.loadPixels();

  for (let i = 0; i < personMask.pixels.length; i += 4) {
    let a = personMask.pixels[i];

    personMask.pixels[i + 0] = 255;
    personMask.pixels[i + 1] = 255;
    personMask.pixels[i + 2] = 255;
    personMask.pixels[i + 3] = a;
  }

  personMask.updatePixels();

  ready = true;
}

function draw() {
  
  let target = getActivePreset();
  let l = 0.04;

  for (let i = 0; i < 3; i++) {
    cur.bg[i] = lerp(cur.bg[i], target.bg[i], l);
  }

  for (let i = 0; i < 3; i++) {
    cur.glow[i] = lerp(cur.glow[i], target.glow[i], l);
  }

  for (let i = 0; i < 4; i++) {
    cur.trailFade[i] = lerp(cur.trailFade[i], target.trailFade[i], l);
  }

  for (let i = 0; i < 4; i++) {
    cur.trailTint[i] = lerp(cur.trailTint[i], target.trailTint[i], l);
  }

  for (let i = 0; i < 4; i++) {
    cur.coreTint[i] = lerp(cur.coreTint[i], target.coreTint[i], l);
  }

  for (let i = 0; i < 4; i++) {
    cur.innerTint[i] = lerp(cur.innerTint[i], target.innerTint[i], l);
  }

  for (let i = 0; i < 5; i++) {
    cur.glowAlpha[i] = lerp(cur.glowAlpha[i], target.glowAlpha[i], l);
  }

  curShadow = target.shadow;

  background(cur.bg[0], cur.bg[1], cur.bg[2]);

  if (!ready) {
    fill(128);
    textAlign(CENTER, CENTER);
    text("Kamera lädt...", width / 2, height / 2);
    return;
  }

  
  trail.noStroke();
  trail.fill(
    cur.trailFade[0],
    cur.trailFade[1],
    cur.trailFade[2],
    cur.trailFade[3]
  );
  trail.rect(0, 0, width, height);

  trail.push();
  trail.tint(
    cur.trailTint[0],
    cur.trailTint[1],
    cur.trailTint[2],
    cur.trailTint[3]
  );
  trail.image(personMask, random(-3, 3), random(-2, 2));
  trail.image(personMask, random(-8, 8), random(-4, 4));
  trail.pop();

  image(trail, 0, 0);

  
  drawingContext.shadowBlur = 45;
  drawingContext.shadowColor = curShadow;

  tint(cur.glow[0], cur.glow[1], cur.glow[2], cur.glowAlpha[0]);
  image(personMask, -8, 0);
  image(personMask, 8, 0);
  image(personMask, 0, -8);
  image(personMask, 0, 8);

  
  drawingContext.shadowBlur = 25;
  tint(cur.glow[0], cur.glow[1], cur.glow[2], cur.glowAlpha[2]);
  image(personMask, 0, 0);

  
  drawingContext.shadowBlur = 12;
  tint(cur.coreTint[0], cur.coreTint[1], cur.coreTint[2], cur.coreTint[3]);
  image(personMask, 0, 0);

  
  drawingContext.shadowBlur = 0;
  noTint();

  tint(cur.innerTint[0], cur.innerTint[1], cur.innerTint[2], cur.innerTint[3]);
  image(personMask, 0, 0);

  noTint();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('dancewall-output', 'png');
    return false;
  }

  if (key === 'a' || key === 'A') {
    setWorld('A');
  }

  if (key === 'z' || key === 'Z') {
    setWorld('Z');
  }

  if (key === '0') {
    currentPart = null;
    trail.clear();
    updatePartButtonStyles();
  }

  if (key === '1') togglePart(1);
  if (key === '2') togglePart(2);
  if (key === '3') togglePart(3);
  if (key === '4') togglePart(4);
  if (key === '5') togglePart(5);
}

window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'ateez-config') {
    if (e.data.world) setWorld(e.data.world);
    if (e.data.part !== undefined) {
      if (e.data.part === null) {
        currentPart = null;
      } else {
        currentPart = e.data.part;
      }
      if (typeof updatePartButtonStyles === 'function') updatePartButtonStyles();
      if (typeof trail !== 'undefined' && trail) trail.clear();
    }
  }
  if (e.data && e.data.type === 'ateez-hide-ui') {
    
    selectAll('button').forEach(b => b.hide());
    selectAll('input').forEach(b => b.hide());
    selectAll('p').forEach(b => b.hide());
    if (typeof fileInput !== 'undefined') fileInput.hide();
  }
});