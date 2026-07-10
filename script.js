let currentWorld = 'A';
let currentPart = null;
let currentTool = null;

function setWorld(w) {
  currentWorld = w;

  document
    .getElementById('btn-world-a')
    .classList.toggle('active', w === 'A');

  document
    .getElementById('btn-world-z')
    .classList.toggle('active', w === 'Z');

  sendToTool();
}

function setPart(p) {
  currentPart = p;

  const buttons = document.querySelectorAll(
    '#part-toggle .toggle-btn'
  );

  buttons[0].classList.toggle('active', p === 1);
  buttons[1].classList.toggle('active', p === 2);
  buttons[2].classList.toggle('active', p === 3);
  buttons[3].classList.toggle('active', p === 4);
  buttons[4].classList.toggle('active', p === 5);

  sendToTool();
}

function openTool(name) {
  currentTool = name;

  const frame = document.getElementById('tool-frame');
  const toolView = document.getElementById('tool-view');
  const home = document.getElementById('home');
  const footer = document.getElementById('footer');

  home.style.removeProperty('display');
  footer.style.removeProperty('display');

  const version = Date.now();

  if (name === 'id_photobooth') {
    frame.src =
      'tools/id_photobooth/frontend/index.html?v=' + version;
  } else {
    frame.src =
      'tools/' + name + '/index.html?v=' + version;
  }

  home.classList.add('is-hidden');
  footer.classList.add('is-hidden');
  toolView.classList.add('open');

  frame.onload = function () {
    if (name === 'id_photobooth') {
      return;
    }

    setTimeout(function () {
      frame.contentWindow.postMessage(
        {
          type: 'ateez-hide-ui'
        },
        '*'
      );

      sendToTool();
    }, 500);
  };
}

function closeTool() {
  currentTool = null;

  const toolView = document.getElementById('tool-view');
  const frame = document.getElementById('tool-frame');
  const home = document.getElementById('home');
  const footer = document.getElementById('footer');

  toolView.classList.remove('open');
  frame.src = '';

  home.style.removeProperty('display');
  footer.style.removeProperty('display');

  home.classList.remove('is-hidden');
  footer.classList.remove('is-hidden');

  requestAnimationFrame(function () {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto'
    });
  });
}

function showHome() {
  closeTool();
}

function sendToTool() {
  const frame = document.getElementById('tool-frame');

  if (frame && frame.contentWindow && currentTool) {
    frame.contentWindow.postMessage(
      {
        type: 'ateez-config',
        world: currentWorld,
        part: currentPart
      },
      '*'
    );
  }
}

function captureInTool() {
  const frame = document.getElementById('tool-frame');

  if (
    frame &&
    frame.contentWindow &&
    currentTool === 'photobooth'
  ) {
    frame.contentWindow.postMessage(
      {
        type: 'ateez-capture'
      },
      '*'
    );
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && currentTool) {
    closeTool();
    return;
  }

  if (
    (e.key === 'c' || e.key === 'C') &&
    currentTool === 'photobooth'
  ) {
    e.preventDefault();
    captureInTool();
  }
});