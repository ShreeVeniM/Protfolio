(function () {
  'use strict';

  const CONFIG = {
    glitchColors: ['#a855f7', '#7c3aed', '#c084fc', '#6d28d9', '#8b5cf6', '#ddd6fe'],
    glitchSpeed: 50,
    centerVignette: true,
    outerVignette: false,
    smooth: true,
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789'
  };

  const fontSize = 16;
  const charWidth = 10;
  const charHeight = 20;

  const container = document.getElementById('letter-glitch-bg');
  if (!container) return;

  // Build DOM
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  if (CONFIG.outerVignette) {
    const ov = document.createElement('div');
    ov.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;background:radial-gradient(circle,rgba(0,0,0,0) 60%,rgba(0,0,0,1) 100%)';
    container.appendChild(ov);
  }

  if (CONFIG.centerVignette) {
    const cv = document.createElement('div');
    cv.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;background:radial-gradient(circle,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0) 60%)';
    container.appendChild(cv);
  }

  const lettersAndSymbols = Array.from(CONFIG.characters);
  let ctx = canvas.getContext('2d');
  let letters = [];
  let grid = { columns: 0, rows: 0 };
  let animationId = null;
  let lastGlitchTime = Date.now();

  function getRandomChar() {
    return lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)];
  }

  function getRandomColor() {
    return CONFIG.glitchColors[Math.floor(Math.random() * CONFIG.glitchColors.length)];
  }

  function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
      return r + r + g + g + b + b;
    });
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null;
  }

  function interpolateColor(start, end, factor) {
    const r = Math.round(start.r + (end.r - start.r) * factor);
    const g = Math.round(start.g + (end.g - start.g) * factor);
    const b = Math.round(start.b + (end.b - start.b) * factor);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function calculateGrid(width, height) {
    return {
      columns: Math.ceil(width / charWidth),
      rows: Math.ceil(height / charHeight)
    };
  }

  function initializeLetters(columns, rows) {
    grid = { columns: columns, rows: rows };
    var total = columns * rows;
    letters = [];
    for (var i = 0; i < total; i++) {
      letters.push({
        char: getRandomChar(),
        color: getRandomColor(),
        targetColor: getRandomColor(),
        colorProgress: 1
      });
    }
  }

  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var g = calculateGrid(rect.width, rect.height);
    initializeLetters(g.columns, g.rows);
    drawLetters();
  }

  function drawLetters() {
    if (!ctx || letters.length === 0) return;
    var rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.font = fontSize + 'px monospace';
    ctx.textBaseline = 'top';

    for (var i = 0; i < letters.length; i++) {
      var x = (i % grid.columns) * charWidth;
      var y = Math.floor(i / grid.columns) * charHeight;
      ctx.fillStyle = letters[i].color;
      ctx.fillText(letters[i].char, x, y);
    }
  }

  function updateLetters() {
    if (!letters || letters.length === 0) return;
    var updateCount = Math.max(1, Math.floor(letters.length * 0.05));

    for (var i = 0; i < updateCount; i++) {
      var index = Math.floor(Math.random() * letters.length);
      if (!letters[index]) continue;

      letters[index].char = getRandomChar();
      letters[index].targetColor = getRandomColor();

      if (!CONFIG.smooth) {
        letters[index].color = letters[index].targetColor;
        letters[index].colorProgress = 1;
      } else {
        letters[index].colorProgress = 0;
      }
    }
  }

  function handleSmoothTransitions() {
    var needsRedraw = false;
    for (var i = 0; i < letters.length; i++) {
      var letter = letters[i];
      if (letter.colorProgress < 1) {
        letter.colorProgress += 0.05;
        if (letter.colorProgress > 1) letter.colorProgress = 1;

        var startRgb = hexToRgb(letter.color);
        var endRgb = hexToRgb(letter.targetColor);
        if (startRgb && endRgb) {
          letter.color = interpolateColor(startRgb, endRgb, letter.colorProgress);
          needsRedraw = true;
        }
      }
    }
    if (needsRedraw) drawLetters();
  }

  function animate() {
    var now = Date.now();
    if (now - lastGlitchTime >= CONFIG.glitchSpeed) {
      updateLetters();
      drawLetters();
      lastGlitchTime = now;
    }
    if (CONFIG.smooth) handleSmoothTransitions();
    animationId = requestAnimationFrame(animate);
  }

  // Init
  resizeCanvas();
  animate();

  var resizeTimeout;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      cancelAnimationFrame(animationId);
      resizeCanvas();
      animate();
    }, 100);
  });
})();
