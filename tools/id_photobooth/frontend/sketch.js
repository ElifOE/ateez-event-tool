// Schritt 2: echte Webcam-Live-Vorschau ueber p5's createCapture(VIDEO) -
// wie in FRONTEND_CONTEXT.md gefordert, statt eigenem getUserMedia/<video>.

let capture;
let canvas;

function setup() {
  const cameraArea = document.getElementById("camera-area");
  canvas = createCanvas(cameraArea.clientWidth, cameraArea.clientHeight);
  canvas.parent("camera-area");

  capture = createCapture(VIDEO);
  // p5 haengt das <video>-Element standardmaessig sichtbar ins DOM -
  // wir zeichnen es selbst ins Canvas, daher hier ausblenden.
  capture.hide();
}

function draw() {
  background(20);

  // capture.loadedmetadata wird erst true, sobald die Webcam tatsaechlich
  // Bilddaten liefert (Breite/Hoehe bekannt) - vorher waere image() leer/0x0.
  if (capture.loadedmetadata) {
    // Cover-Crop statt Strecken: die Webcam liefert i.d.R. ein Querformat
    // (z.B. 4:3), das Canvas ist aber Hochformat 2:3 (Photocard-Format).
    // Einfaches Strecken wuerde Gesichter sichtbar verzerren - daher wird
    // stattdessen wie bei CSS "background-size: cover" zentriert
    // zugeschnitten: der groessere der beiden Skalierungsfaktoren gewinnt,
    // das Bild wird mittig ueberlaufend gezeichnet.
    const coverScale = Math.max(width / capture.width, height / capture.height);
    const drawWidth = capture.width * coverScale;
    const drawHeight = capture.height * coverScale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    // Gespiegelt zeichnen (wie ein Spiegel/Selfie-Kamera) - dafuer wird das
    // Koordinatensystem horizontal geflippt, bevor das Bild gezeichnet wird.
    // Der Crop-Versatz bleibt dabei gueltig, da die Zentrierung symmetrisch ist.
    push();
    translate(width, 0);
    scale(-1, 1);
    image(capture, offsetX, offsetY, drawWidth, drawHeight);
    pop();
  } else {
    noStroke();
    fill(150);
    textAlign(CENTER, CENTER);
    textSize(20);
    text("Kamera wird gestartet ...", width / 2, height / 2);
  }
}

// Canvas an die Groesse des umgebenden Bereichs anpassen, falls sich das
// Browserfenster aendert - sonst wirkt das Layout beim Resize kaputt.
function windowResized() {
  const cameraArea = document.getElementById("camera-area");
  resizeCanvas(cameraArea.clientWidth, cameraArea.clientHeight);
}

// Schritt 4: Snapshot des aktuell angezeigten (gespiegelten) Kamerabilds.
// Greift direkt auf das zugrundeliegende <canvas>-DOM-Element zu (canvas.elt)
// und nutzt dessen natives toBlob() - das liefert einen Blob, der sich in
// Schritt 5 direkt in ein FormData fuer POST /generate einsetzen laesst,
// genau im selben Format wie eine hochgeladene Datei (beides sind Blobs).
//
// window.photobooth wird hier (statt mit "=") per "||= {}" abgesichert,
// da app.js denselben globalen State-Container nutzt und je nach
// Script-Reihenfolge zuerst oder zuletzt laeuft.
window.photobooth = window.photobooth || {};
window.photobooth.captureSnapshot = function () {
  return new Promise((resolve) => {
    canvas.elt.toBlob((blob) => resolve(blob), "image/png");
  });
};
