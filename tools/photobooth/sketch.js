let cam;
let faceMesh;
let faces = [];

let currentWorld = "Z";
let currentPart = null;
let partButtons = [];

let hasStableFace = false;
let faceLostCounter = 0;

let cropX = 0;
let cropY = 0;
let cropW = 500;
let cropH = 700;

let targetCropX = 0;
let targetCropY = 0;
let targetCropW = 500;
let targetCropH = 700;

let lyricData = [];
let lyricIndex = 0;
let charIndex = 0;
let currentTypedLine = "";

let typeSpeed = 3;
let linePause = 35;
let linePauseCounter = 0;
let maxLyricLines = 7;

let eyeSpin = 0;
let blinkAmount = 0;
let targetBlinkAmount = 0;
let prevRawFaceX = 250;
let prevRawFaceY = 350;

let reticleX = 250;
let reticleY = 350;
let reticleRot = 0;
let lockAnim = 0;
let hadFaceLastFrame = false;

let lyricLines = [
  "ATEEZ SIGNAL 01",
  "EYE TOWER ACTIVE",
  "GOLDEN HOUR MODE",
  "FACE LOCK ENABLED",
  "WORLD Z TRANSMISSION",
  "SCAN // TARGET FOUND",
  "LIGHT ON // FIX ON"
];

let targetX = 250;
let targetY = 350;
let eyeX = 250;
let eyeY = 350;
let zoom = 1;
let targetZoom = 1;
let smoothFaceX = 250;
let smoothFaceY = 350;



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

function getColors() {
  let part = currentPart === null ? "default" : currentPart;
  return partColors[part][currentWorld];
}

function preload() {
  let options = {
    maxFaces: 1,
    refineLandmarks: false,
    flipped: true
  };

  faceMesh = ml5.faceMesh(options);
}

function getDateTimeString() {
  let now = new Date();

  let day = String(now.getDate()).padStart(2, "0");
  let month = String(now.getMonth() + 1).padStart(2, "0");
  let year = now.getFullYear();

  let hours = String(now.getHours()).padStart(2, "0");
  let minutes = String(now.getMinutes()).padStart(2, "0");
  let seconds = String(now.getSeconds()).padStart(2, "0");

  return `${day}.${month}.${year} // ${hours}:${minutes}:${seconds}`;
}
function getFileTimestamp() {
  let now = new Date();

  let year = now.getFullYear();
  let month = String(now.getMonth() + 1).padStart(2, "0");
  let day = String(now.getDate()).padStart(2, "0");

  let hours = String(now.getHours()).padStart(2, "0");
  let minutes = String(now.getMinutes()).padStart(2, "0");
  let seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

function setup() {
  let photoCanvas = createCanvas(500, 700);
  let canvasHost = document.getElementById("canvas-container");
  if (canvasHost) photoCanvas.parent(canvasHost);
  pixelDensity(1);

  cam = createCapture(VIDEO, { flipped: true });
  cam.size(width, height);
  cam.hide();

  cropW = width;
  cropH = height;
  targetCropW = width;
  targetCropH = height;

  faceMesh.detectStart(cam, gotFaces);

  initPhotoBoothUI();
  createUI();
}

function gotFaces(results) {
  faces = results;
}

function draw() {
  let c = getColors();

  background(c.bg[0], c.bg[1], c.bg[2]);

  updateFaceTracking();

  drawCameraProjection(c);
  // drawTower(c);
  drawFaceReticle(c);
  drawEyeScanner(c, eyeX, eyeY, zoom);

  drawPosterText(c);

  updateLyricTicker();
  drawTechInterface(c);
  updateCountdown();
  drawCountdown(c);
}

function drawScene(cleanExport) {
  let c = getColors();

  background(c.bg[0], c.bg[1], c.bg[2]);

  updateFaceTracking();

  drawCameraProjection(c);
  // drawTower(c);
  drawFaceReticle(c);
  drawEyeScanner(c, eyeX, eyeY, zoom);


  if (!cleanExport) {
    drawPosterText(c);
    updateLyricTicker();
    drawTechInterface(c);
  }
}

function updateFaceTracking() {
  if (faces.length > 0) {
    faceLostCounter = 0;

    

    let box = faces[0].box;
    let rawX = box.xMin + box.width / 2;
    let rawY = box.yMin + box.height / 2;

    let faceSpeed = dist(rawX, rawY, prevRawFaceX, prevRawFaceY);
    prevRawFaceX = rawX;
    prevRawFaceY = rawY;

    
    eyeSpin += 0.012 + faceSpeed * 0.012;

    
    targetBlinkAmount = getBlinkAmount(faces[0]);

    if (!hasStableFace) {
      smoothFaceX = rawX;
      smoothFaceY = rawY;
      hasStableFace = true;
    }

    
    smoothFaceX = lerp(smoothFaceX, rawX, 0.07);
    smoothFaceY = lerp(smoothFaceY, rawY, 0.07);

    targetX = smoothFaceX;
    targetY = smoothFaceY;
    targetZoom = 1.45;
  } else {
    faceLostCounter++;
    targetBlinkAmount = 0;



    if (faceLostCounter > 25) {
      targetX = width / 2;
      targetY = height / 2;
      targetZoom = 1;
      hasStableFace = false;
    }

    
    eyeSpin += 0.01;
  }

  
  eyeX = lerp(eyeX, targetX, 0.18);
  eyeY = lerp(eyeY, targetY, 0.18);

  
  zoom = lerp(zoom, targetZoom, 0.015);

  
  blinkAmount = lerp(blinkAmount, targetBlinkAmount, 0.35);


}

function drawCameraProjection(c) {
  push();

  let screenX = 45;
  let screenY = 115;
  let screenW = width - 90;
  let screenH = height - 210;

  noStroke();
  fill(0, 120);
  rect(screenX, screenY, screenW, screenH);

  targetCropX = 0;
  targetCropY = 0;
  targetCropW = cam.width;
  targetCropH = cam.height;

  if (faces.length > 0) {
    let b = faces[0].box;

    let faceCenterX = b.xMin + b.width / 2;
    let faceCenterY = b.yMin + b.height / 2;

    targetCropW = cam.width / 1.45;
    targetCropH = cam.height / 1.45;

    targetCropX = constrain(
      faceCenterX - targetCropW / 2,
      0,
      cam.width - targetCropW
    );

    targetCropY = constrain(
      faceCenterY - targetCropH / 2,
      0,
      cam.height - targetCropH
    );
  }

  cropX = lerp(cropX, targetCropX, 0.035);
  cropY = lerp(cropY, targetCropY, 0.035);
  cropW = lerp(cropW, targetCropW, 0.035);
  cropH = lerp(cropH, targetCropH, 0.035);

  tint(255, 120);
  image(cam, screenX, screenY, screenW, screenH, cropX, cropY, cropW, cropH);
  noTint();

  fill(c.bg[0], c.bg[1], c.bg[2], 90);
  rect(screenX, screenY, screenW, screenH);

  drawingContext.shadowBlur = 35;
  drawingContext.shadowColor =
    "rgba(" + c.glow[0] + "," + c.glow[1] + "," + c.glow[2] + ",0.9)";

  noFill();
  stroke(c.glow[0], c.glow[1], c.glow[2], 120);
  strokeWeight(2);
  rect(screenX, screenY, screenW, screenH);

  drawingContext.shadowBlur = 0;
  stroke(c.glow[0], c.glow[1], c.glow[2], 25);
  strokeWeight(1);

  for (let y = screenY; y < screenY + screenH; y += 14) {
    line(screenX, y, screenX + screenW, y);
  }

  pop();
}

function drawFaceReticle(c) {
  let screenX = 45;
  let screenY = 115;
  let screenW = width - 90;
  let screenH = height - 210;

  let targetReticleX = screenX + screenW / 2;
  let targetReticleY = screenY + screenH / 2;

  if (faces.length > 0) {
    targetReticleX = map(
      smoothFaceX,
      cropX,
      cropX + cropW,
      screenX,
      screenX + screenW
    );

    targetReticleY = map(
      smoothFaceY,
      cropY,
      cropY + cropH,
      screenY,
      screenY + screenH
    );

    targetReticleX = constrain(
      targetReticleX,
      screenX + 60,
      screenX + screenW - 60
    );

    targetReticleY = constrain(
      targetReticleY,
      screenY + 60,
      screenY + screenH - 60
    );
  }

  
  let d = dist(reticleX, reticleY, targetReticleX, targetReticleY);

  if (d > 18) {
    let followSpeed = map(d, 12, 120, 0.02, 0.07);
    followSpeed = constrain(followSpeed, 0.02, 0.07);

    reticleX = lerp(reticleX, targetReticleX, followSpeed);
    reticleY = lerp(reticleY, targetReticleY, followSpeed);
  }

  let pulse = sin(frameCount * 0.05) * 0.8;

  let outerR = 96 + pulse;
  let innerOffset = 42;
  let cornerLen = 30;
  let crossOuter = 36;
  let crossInner = 30;
  let innerCircle = 114;

  
  let blinkScaleY = 1 - blinkAmount * 0.06;

  push();
  translate(reticleX, reticleY);
  scale(1, blinkScaleY);

  drawingContext.shadowBlur = 16;
  drawingContext.shadowColor =
    "rgba(" + c.glow[0] + "," + c.glow[1] + "," + c.glow[2] + ",0.8)";

  stroke(c.glow[0], c.glow[1], c.glow[2], 220);
  strokeWeight(2);
  noFill();

  
  ellipse(0, 0, outerR * 2, outerR * 2);

  
  line(-outerR - crossOuter, 0, -outerR + crossInner, 0);
  line(outerR - crossInner, 0, outerR + crossOuter, 0);

  line(0, -outerR - crossOuter, 0, -outerR + crossInner);
  line(0, outerR - crossInner, 0, outerR + crossOuter);

  
  line(-innerOffset, -innerOffset, -innerOffset + cornerLen, -innerOffset);
  line(-innerOffset, -innerOffset, -innerOffset, -innerOffset + cornerLen);

  line(innerOffset, -innerOffset, innerOffset - cornerLen, -innerOffset);
  line(innerOffset, -innerOffset, innerOffset, -innerOffset + cornerLen);

  line(-innerOffset, innerOffset, -innerOffset + cornerLen, innerOffset);
  line(-innerOffset, innerOffset, -innerOffset, innerOffset - cornerLen);

  line(innerOffset, innerOffset, innerOffset - cornerLen, innerOffset);
  line(innerOffset, innerOffset, innerOffset, innerOffset - cornerLen);

  
  stroke(c.glow[0], c.glow[1], c.glow[2], 95);
  strokeWeight(1.2);
  ellipse(0, 0, innerCircle, innerCircle);

  
  noStroke();
  fill(c.glow[0], c.glow[1], c.glow[2], 235);
  ellipse(0, 0, 6, 6);

  drawingContext.shadowBlur = 0;
  pop();
}

function drawTower(c) {
  push();
  translate(width / 2, height / 2 + 80);

  stroke(c.glow[0], c.glow[1], c.glow[2], 140);
  strokeWeight(2);
  noFill();

  for (let i = -120; i <= 120; i += 30) {
    line(i, 230, i * 0.35, -190);
  }

  for (let y = -170; y < 220; y += 45) {
    ellipse(0, y, map(y, -170, 220, 90, 280), 28);
  }

  pop();
}

function drawEyeScanner(c, x, y, z) {
  push();
  translate(width / 2, 135);

  
  scale(1, 1 - blinkAmount * 0.65);

  drawingContext.shadowBlur = 35;
  drawingContext.shadowColor =
    "rgba(" + c.glow[0] + "," + c.glow[1] + "," + c.glow[2] + ",0.9)";

  
  fill(0, 180);
  stroke(c.glow[0], c.glow[1], c.glow[2]);
  strokeWeight(3);

  
  noFill();
  stroke(c.glow[0], c.glow[1], c.glow[2], 230);
  strokeWeight(5);
  ellipse(0, 0, 75 * z, 75 * z);

  
  let pupilX = map(x, 0, width, -25, 25);
  let pupilY = map(y, 0, height, -15, 15);

  fill(c.glow[0], c.glow[1], c.glow[2]);
  noStroke();
  ellipse(pupilX, pupilY, 22 * z);

  
  fill(255, 255, 255, 170);
  ellipse(pupilX - 4 * z, pupilY - 4 * z, 5 * z, 5 * z);

  
  noFill();
  stroke(c.glow[0], c.glow[1], c.glow[2], 90);
  strokeWeight(1);

  push();
  rotate(eyeSpin);

  for (let r = 30; r < 110; r += 20) {
    ellipse(0, 0, r * z);

    
    line(r * 0.42 * z, 0, r * 0.55 * z, 0);
    line(-r * 0.42 * z, 0, -r * 0.55 * z, 0);
  }

  pop();

  
  push();
  rotate(-eyeSpin * 0.65);

  stroke(c.glow[0], c.glow[1], c.glow[2], 60);
  strokeWeight(1);

  arc(0, 0, 95 * z, 95 * z, 0, PI * 0.45);
  arc(0, 0, 95 * z, 95 * z, PI, PI + PI * 0.45);

  pop();

  drawingContext.shadowBlur = 0;
  pop();
}

function drawPosterText(c) {
  fill(c.glow[0], c.glow[1], c.glow[2]);
  noStroke();
  textAlign(CENTER);
  textSize(14);

  text(getDateTimeString(), width / 2, height - 55);
  

  textSize(11);

  let part =
    currentPart === null ? "DEFAULT" : "GOLDEN HOUR PT. " + currentPart;

  text("WORLD " + currentWorld + " / " + part, width / 2, height - 35);
}

function createUI() {
  if (window !== window.top) return;
  let btnA = createButton("WORLD A");
  btnA.addClass("standalone-only");
  btnA.position(20, 20);
  btnA.mousePressed(function () {
    setWorld("A");
  });

  let btnZ = createButton("WORLD Z");
  btnZ.addClass("standalone-only");
  btnZ.position(110, 20);
  btnZ.mousePressed(function () {
    setWorld("Z");
  });

  for (let p = 1; p <= 5; p++) {
    let btn = createButton("Pt. " + p);
    btn.addClass("standalone-only");
    btn.position(20 + (p - 1) * 65, 55);

    btn.mousePressed(function () {
      togglePart(p);
    });

    partButtons.push(btn);
  }

  updatePartButtonStyles();
}

function setWorld(w) {
  currentWorld = w;
}

function togglePart(p) {
  if (currentPart === p) {
    currentPart = null;
  } else {
    currentPart = p;
  }

  updatePartButtonStyles();
}

function updatePartButtonStyles() {
  for (let i = 0; i < partButtons.length; i++) {
    let active = currentPart === i + 1;

    partButtons[i].style("font-weight", active ? "bold" : "normal");
    partButtons[i].style("border", active ? "2px solid #888" : "1px solid #ccc");
    partButtons[i].style("cursor", "pointer");
  }
}

function keyPressed() {
  if (key === "c" || key === "C") {
    startCountdown();
    return false;
  }

  if (key === "s" || key === "S") {
    saveCanvas("ateez-output-" + getFileTimestamp(), "png");
    return false;
  }

  if (key === "a" || key === "A") setWorld("A");
  if (key === "z" || key === "Z") setWorld("Z");

  if (key === "0") {
    currentPart = null;
    updatePartButtonStyles();
  }

  if (key === "1") togglePart(1);
  if (key === "2") togglePart(2);
  if (key === "3") togglePart(3);
  if (key === "4") togglePart(4);
  if (key === "5") togglePart(5);
}

function updateLyricTicker() {
  if (linePauseCounter > 0) {
    linePauseCounter--;
    return;
  }

  if (frameCount % typeSpeed !== 0) return;

  let line = lyricLines[lyricIndex];

  if (charIndex < line.length) {
    currentTypedLine += line.charAt(charIndex);
    charIndex++;
  } else {
    lyricData.push(currentTypedLine);

    if (lyricData.length > maxLyricLines) {
      lyricData.shift();
    }

    currentTypedLine = "";
    charIndex = 0;

    lyricIndex++;

    if (lyricIndex >= lyricLines.length) {
      lyricIndex = 0;
    }

    linePauseCounter = linePause;
  }
}

function drawTechInterface(c) {
  push();

  let ui = c.glow;

  stroke(ui[0], ui[1], ui[2]);
  strokeWeight(2);
  noFill();

  drawingContext.shadowBlur = 12;
  drawingContext.shadowColor =
    "rgba(" + ui[0] + "," + ui[1] + "," + ui[2] + ",0.8)";

  line(25, 40, width - 140, 40);
  line(width - 140, 40, width - 115, 25);
  line(width - 115, 25, width - 25, 25);

  fill(ui[0], ui[1], ui[2]);
  noStroke();
  rect(width - 105, 18, 14, 14);
  rect(width - 75, 18, 22, 14);
  rect(width - 40, 14, 20, 20);

  push();
  translate(28, 105);
  rotate(HALF_PI);
  textAlign(LEFT, CENTER);
  textFont("monospace");
  textStyle(BOLD);
  textSize(32);
  fill(ui[0], ui[1], ui[2]);
  noStroke();
  text("ATEEZ", 0, 0);
  pop();

  stroke(ui[0], ui[1], ui[2]);
  strokeWeight(2);
  noFill();

  //line(25, height - 70, width - 230, height - 70);
  //line(width - 230, height - 70, width - 205, height - 50);
  //line(width - 205, height - 50, width - 25, height - 50);

  line(25, height - 115, width - 255, height - 115);
  line(width - 255, height - 115, width - 230, height - 95);
  line(width - 230, height - 95, width - 25, height - 95);

  rect(25, height - 190, 95, 95);

  let boxW = 165;
  let boxH = 135;
  let boxX = width - boxW - 25;
  let boxY = height - boxH - 115;

  stroke(ui[0], ui[1], ui[2]);
  strokeWeight(2);
  noFill();

  line(boxX, boxY, boxX + boxW, boxY);
  line(boxX, boxY, boxX, boxY + boxH);

  fill(ui[0], ui[1], ui[2], 220);
  noStroke();
  textFont("monospace");
  textStyle(NORMAL);
  textSize(11);
  textAlign(LEFT, TOP);

  let startX = boxX + 8;
  let startY = boxY + 8;
  let lineHeight = 15;

  let visibleLines = lyricData.slice();

  let cursor = "";
  if (frameCount % 40 < 20) {
    cursor = "_";
  }

  visibleLines.push(currentTypedLine + cursor);

  for (let i = 0; i < visibleLines.length; i++) {
    text(visibleLines[i], startX, startY + i * lineHeight);
  }

  drawingContext.shadowBlur = 0;

  pop();
}

function getBlinkAmount(face) {
  if (!face || !face.keypoints) return 0;

  let p = face.keypoints;

  let leftTop = p[159];
  let leftBottom = p[145];
  let leftOuter = p[33];
  let leftInner = p[133];

  let rightTop = p[386];
  let rightBottom = p[374];
  let rightOuter = p[362];
  let rightInner = p[263];

  if (!leftTop || !leftBottom || !leftOuter || !leftInner) return 0;
  if (!rightTop || !rightBottom || !rightOuter || !rightInner) return 0;

  let leftOpen = dist(leftTop.x, leftTop.y, leftBottom.x, leftBottom.y);
  let leftWidth = dist(leftOuter.x, leftOuter.y, leftInner.x, leftInner.y);

  let rightOpen = dist(rightTop.x, rightTop.y, rightBottom.x, rightBottom.y);
  let rightWidth = dist(rightOuter.x, rightOuter.y, rightInner.x, rightInner.y);

  let leftRatio = leftOpen / leftWidth;
  let rightRatio = rightOpen / rightWidth;

  let eyeRatio = (leftRatio + rightRatio) / 2;

  let blink = map(eyeRatio, 0.14, 0.27, 1, 0);
  return constrain(blink, 0, 1);
}

// ─── Photo Capture System ─────────────────────
let countdown = 0;
let countdownStart = 0;
let isCountingDown = false;
let capturedPhotos = [];
let maxPhotos = 4;
let selectedPhotoId = null;

let captureButtonEl = null;
let galleryEl = null;
let emptyStateEl = null;
let downloadButtonEl = null;
let printButtonEl = null;
let shareButtonEl = null;

function initPhotoBoothUI() {
  captureButtonEl = document.getElementById("capture-button");
  galleryEl = document.getElementById("photo-gallery");
  emptyStateEl = document.getElementById("photo-empty-state");
  downloadButtonEl = document.getElementById("download-button");
  printButtonEl = document.getElementById("print-button");
  shareButtonEl = document.getElementById("share-button");

  if (captureButtonEl) captureButtonEl.addEventListener("click", startCountdown);
  if (downloadButtonEl) downloadButtonEl.addEventListener("click", downloadSelectedPhoto);
  if (printButtonEl) printButtonEl.addEventListener("click", printSelectedPhoto);
  if (shareButtonEl) shareButtonEl.addEventListener("click", shareSelectedPhoto);

  updatePhotoActionState();
}

function startCountdown() {
  if (isCountingDown) return;

  isCountingDown = true;
  countdown = 3;
  countdownStart = millis();

  if (captureButtonEl) {
    captureButtonEl.disabled = true;
    captureButtonEl.setAttribute("aria-label", "Foto wird in drei Sekunden aufgenommen");
  }
}

function updateCountdown() {
  if (!isCountingDown) return;

  let elapsed = millis() - countdownStart;
  countdown = 3 - floor(elapsed / 1000);

  if (countdown <= 0) {
    capturePhoto();
    isCountingDown = false;
    countdown = 0;

    if (captureButtonEl) {
      captureButtonEl.disabled = false;
      captureButtonEl.setAttribute("aria-label", "Foto aufnehmen");
    }
  }
}

function drawCountdown(c) {
  if (!isCountingDown) return;

  fill(c.glow[0], c.glow[1], c.glow[2], 30);
  noStroke();
  rect(0, 0, width, height);

  fill(c.glow[0], c.glow[1], c.glow[2]);
  noStroke();
  textAlign(CENTER, CENTER);
  textFont("monospace");
  textSize(120);
  text(countdown, width / 2, height / 2);
  textSize(14);
}

function capturePhoto() {
  let photo = get();
  let dataURL = photo.canvas.toDataURL("image/png");
  let timestamp = getFileTimestamp();

  let capturedPhoto = {
    id: timestamp + "-" + Date.now(),
    dataURL: dataURL,
    filename: "ateez-photo-" + timestamp + ".png"
  };

  capturedPhotos.unshift(capturedPhoto);
  if (capturedPhotos.length > maxPhotos) capturedPhotos.pop();

  selectedPhotoId = capturedPhoto.id;
  renderPhotoGallery();
  flashCamera();
}

function renderPhotoGallery() {
  if (!galleryEl) return;

  galleryEl.querySelectorAll(".photo-thumb").forEach(function (thumb) {
    thumb.remove();
  });

  if (emptyStateEl) {
    emptyStateEl.hidden = capturedPhotos.length > 0;
  }

  capturedPhotos.forEach(function (photo, index) {
    let thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "photo-thumb";
    thumb.dataset.photoId = photo.id;
    thumb.setAttribute("aria-label", "Foto " + (index + 1) + " auswählen");

    if (photo.id === selectedPhotoId) thumb.classList.add("is-selected");

    let image = document.createElement("img");
    image.src = photo.dataURL;
    image.alt = "Aufgenommenes Eye-Booth-Foto";
    thumb.appendChild(image);

    thumb.addEventListener("click", function () {
      selectedPhotoId = photo.id;
      renderPhotoGallery();
    });

    galleryEl.appendChild(thumb);
  });

  updatePhotoActionState();
}

function getSelectedPhoto() {
  return capturedPhotos.find(function (photo) {
    return photo.id === selectedPhotoId;
  }) || null;
}

function updatePhotoActionState() {
  let disabled = !getSelectedPhoto();

  if (downloadButtonEl) downloadButtonEl.disabled = disabled;
  if (printButtonEl) printButtonEl.disabled = disabled;
  if (shareButtonEl) shareButtonEl.disabled = disabled;
}

function downloadSelectedPhoto() {
  let photo = getSelectedPhoto();
  if (!photo) return;

  let link = document.createElement("a");
  link.download = photo.filename;
  link.href = photo.dataURL;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function printSelectedPhoto() {
  let photo = getSelectedPhoto();
  if (!photo) return;

  let printWindow = window.open("", "_blank", "width=700,height=900");
  if (!printWindow) return;

  printWindow.document.write(
    "<!doctype html><html><head><title>" +
      photo.filename +
      "</title><style>html,body{margin:0;background:#fff}body{display:flex;align-items:center;justify-content:center;min-height:100vh}img{display:block;max-width:100%;max-height:100vh;object-fit:contain}@media print{img{width:100%;height:auto}}</style></head><body><img src=\"" +
      photo.dataURL +
      "\" alt=\"Eye Booth Foto\"></body></html>"
  );
  printWindow.document.close();

  let printImage = printWindow.document.querySelector("img");
  printImage.addEventListener("load", function () {
    printWindow.focus();
    printWindow.print();
  });
}

async function shareSelectedPhoto() {
  let photo = getSelectedPhoto();
  if (!photo) return;

  try {
    let blob = await fetch(photo.dataURL).then(function (response) {
      return response.blob();
    });
    let file = new File([blob], photo.filename, { type: "image/png" });

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: "ATEEZ Eye Booth",
        text: "Mein Foto aus der ATEEZ Eye Booth",
        files: [file]
      });
      return;
    }

    downloadSelectedPhoto();
    window.alert("Direktes Teilen wird von diesem Browser nicht unterstützt. Das Foto wurde stattdessen heruntergeladen.");
  } catch (error) {
    if (error && error.name === "AbortError") return;
    console.error("Teilen fehlgeschlagen:", error);
  }
}

function flashCamera() {
  let canvasHost = document.getElementById("canvas-container");
  if (!canvasHost) return;

  canvasHost.classList.remove("is-flashing");
  void canvasHost.offsetWidth;
  canvasHost.classList.add("is-flashing");

  window.setTimeout(function () {
    canvasHost.classList.remove("is-flashing");
  }, 240);
}

window.addEventListener("message", function (e) {
  if (e.data && e.data.type === "ateez-config") {
    if (e.data.world) setWorld(e.data.world);
    if (e.data.part !== undefined) {
      if (e.data.part === null) {
        currentPart = null;
      } else {
        currentPart = e.data.part;
      }
      if (typeof updatePartButtonStyles === "function") updatePartButtonStyles();
      if (typeof trail !== "undefined" && trail) trail.clear();
    }
  }

  if (e.data && e.data.type === "ateez-hide-ui") {
    document.querySelectorAll(".standalone-only").forEach(function (element) {
      element.style.display = "none";
    });
  }

  if (e.data && e.data.type === "ateez-capture") {
    startCountdown();
  }
});