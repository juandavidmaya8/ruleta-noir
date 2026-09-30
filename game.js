// European wheel order (0-36)
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
// Red numbers on a real wheel
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const CHIP_VALUES = [1000, 5000, 10000, 50000];

const OUTSIDE = [
  { key: 'd1', label: '1ª docena', span: 4, pays: 3, test: n => n >= 1 && n <= 12 },
  { key: 'd2', label: '2ª docena', span: 4, pays: 3, test: n => n >= 13 && n <= 24 },
  { key: 'd3', label: '3ª docena', span: 4, pays: 3, test: n => n >= 25 },
  { key: 'low', label: '1-18', span: 2, pays: 2, test: n => n >= 1 && n <= 18 },
  { key: 'even', label: 'Par', span: 2, pays: 2, test: n => n > 0 && n % 2 === 0 },
  { key: 'red', label: 'Rojo', span: 2, pays: 2, test: n => RED.has(n) },
  { key: 'black', label: 'Negro', span: 2, pays: 2, test: n => n > 0 && !RED.has(n) },
  { key: 'odd', label: 'Impar', span: 2, pays: 2, test: n => n % 2 === 1 },
  { key: 'high', label: '19-36', span: 2, pays: 2, test: n => n >= 19 }
];

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const state = { balance: 0, chip: 5000, bets: {}, lastBets: null, spinning: false, rotation: 0, sound: true };
let dialogMode = 'deposit';

const $ = id => document.getElementById(id);
const fmt = value => money.format(value).replace(/\s/g, '');

function loadBalance() {
  try { state.balance = Number(localStorage.getItem('noir-balance')) || 0; } catch (e) { /* storage unavailable */ }
}

function saveBalance() {
  try { localStorage.setItem('noir-balance', state.balance); } catch (e) { /* storage unavailable */ }
}

function totalBet() {
  return Object.values(state.bets).reduce((sum, amount) => sum + amount, 0);
}

function render() {
  $('balance').textContent = fmt(state.balance);$('total-bet').textContent = fmt(totalBet());

  document.querySelectorAll('[data-bet]').forEach(cell => {
    const amount = state.bets[cell.dataset.bet];
    cell.classList.toggle('has-bet', Boolean(amount));
    cell.dataset.chip = amount ? fmt(amount) : '';
  });

  $('btn-spin').disabled = state.spinning || totalBet() === 0;
  
  // Habilitar / deshabilitar botón de repetir apuesta
  const btnRebet = $('btn-rebet');
  if (btnRebet) {
    btnRebet.disabled = state.spinning || !state.lastBets || totalBet() > 0;
  }

  ['btn-deposit', 'btn-withdraw', 'btn-clear'].forEach(id => {
    const el = $(id);
    if (el) el.disabled = state.spinning;
  });
}

function drawWheel() {
  const canvas = $('wheel');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const c = canvas.width / 2;
  const step = (Math.PI * 2) / ORDER.length;

  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();

  ORDER.forEach((n, i) => {
    const start = i * step - step / 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, c - 14, start, start + step);
    ctx.closePath();
    ctx.fillStyle = n === 0 ? '#0a7a3b' : RED.has(n) ? '#c1121f' : '#0a0a0a';
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(i * step);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(n, 0, -(c - 38));
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(c, c, c * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#1a0306';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#d4af37';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(c, c, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#d4af37';
  ctx.fill();
}

function makeCell(text, key, className) {
  const el = document.createElement('button');
  el.className = className;
  el.textContent = text;
  el.dataset.bet = key;
  el.addEventListener('click', () => placeBet(key));
  return el;
}

function buildBoard() {
  const board = $('board');
  if (!board) return;

  const zero = makeCell('0', 'n:0', 'cell zero');
  zero.style.gridRow = '1 / span 3';
  zero.style.gridColumn = '1';
  board.append(zero);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      const n = col * 3 + (3 - row);
      const cell = makeCell(n, `n:${n}`, `cell num ${RED.has(n) ? 'red' : 'black'}`);
      cell.style.gridRow = row + 1;
      cell.style.gridColumn = col + 2;
      board.append(cell);
    }
  }

  let dozenCol = 2;
  let sideCol = 2;
  OUTSIDE.forEach(zone => {
    const isDozen = zone.span === 4;
    const cell = makeCell(zone.label, zone.key, `cell side ${zone.key}`);
    cell.style.gridRow = isDozen ? 4 : 5;
    cell.style.gridColumn = `${isDozen ? dozenCol : sideCol} / span ${zone.span}`;
    if (isDozen) dozenCol += 4;
    else sideCol += 2;
    board.append(cell);
  });
}

function buildChips() {
  const chips = $('chips');
  if (!chips) return;
  CHIP_VALUES.forEach(value => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = `${value / 1000}K`;
    chip.addEventListener('click', () => {
      state.chip = value;
      markChip();
    });
    chips.append(chip);
  });
  markChip();
}

function markChip() {
  document.querySelectorAll('.chip').forEach((chip, i) => {
    chip.classList.toggle('active', CHIP_VALUES[i] === state.chip);
  });
}

function placeBet(key) {
  if (state.spinning) return;
  if (state.balance < state.chip) {
    $('result').textContent = 'Saldo insuficiente. Recarga o elige una ficha menor.';
    return;
  }
  state.balance -= state.chip;
  state.bets[key] = (state.bets[key] || 0) + state.chip;
  saveBalance();
  render();
}

function clearBets() {
  if (state.spinning) return;
  state.balance += totalBet();
  state.bets = {};
  saveBalance();
  render();
}

function rebet() {
  if (state.spinning || !state.lastBets) return;
  
  const requiredBalance = Object.values(state.lastBets).reduce((sum, amount) => sum + amount, 0);
  
  if (state.balance < requiredBalance) {
    $('result').textContent = 'Saldo insuficiente para repetir la última apuesta.';
    return;
  }

  state.balance -= requiredBalance;
  state.bets = { ...state.lastBets };
  saveBalance();
  render();
}

function spin() {
  if (state.spinning || totalBet() === 0) return;
  
  // Guardar la última apuesta realizada
  state.lastBets = { ...state.bets };
  
  state.spinning = true;
  $('result').textContent = 'No va más...';
  render();

  const index = Math.floor(Math.random() * ORDER.length);
  const step = 360 / ORDER.length;
  const current = ((state.rotation % 360) + 360) % 360;
  const target = (360 - index * step) % 360;

  state.rotation += 360 * 5 + ((target - current + 360) % 360);
  $('wheel').style.transform = `rotate(${state.rotation}deg)`;

  playSpinSound();
  setTimeout(() => finishSpin(ORDER[index]), 4200);
}

function finishSpin(n) {
  let payout = 0;
  const winningKeys = [];
  Object.entries(state.bets).forEach(([key, amount]) => {
    if (key.startsWith('n:')) {
      if (Number(key.slice(2)) === n) {
        payout += amount * 36;
        winningKeys.push(key);
      }
    } else {
      const zone = OUTSIDE.find(z => z.key === key);
      if (zone.test(n)) {
        payout += amount * zone.pays;
        winningKeys.push(key);
      }
    }
  });

  const net = payout - totalBet();
  state.balance += payout;
  saveBalance();

  let message = `Salió el ${n}. `;
  if (net > 0) message += `Ganaste ${fmt(net)}.`;
  else if (net === 0) message += 'Recuperaste tu apuesta.';
  else message += `Perdiste ${fmt(-net)}.`;
  $('result').textContent = message;

  flashCells([`n:${n}`], 'hit');
  if (payout > 0) flashCells(winningKeys, 'winner');
  if (net > 0) celebrate();

  addHistory(n);
  state.bets = {};
  state.spinning = false;
  render();
}

let audioCtx = null;

function getAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, start, duration, type, volume) {
  if (!state.sound) return;
  const ctx = getAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

// Ticks that slow down like the ball losing speed
function playSpinSound() {
  let time = 0;
  let gap = 0.045;
  while (time < 3.9) {
    tone(900 + Math.random() * 200, time, 0.03, 'square', 0.04);
    time += gap;
    gap *= 1.06;
  }
}

function playWinSound() {
  [523, 659, 784, 1047].forEach((freq, i) => tone(freq, i * 0.12, 0.45, 'sine', 0.12));
}

function flashCells(keys, className) {
  keys.forEach(key => {
    const cell = document.querySelector(`[data-bet="${key}"]`);
    if (cell) cell.classList.add(className);
  });
  setTimeout(() => {
    document.querySelectorAll(`.${className}`).forEach(cell => cell.classList.remove(className));
  }, 2500);
}

function celebrate() {
  playWinSound();

  const wheel = $('wheel');
  if (wheel) {
    wheel.classList.add('glow');
    setTimeout(() => wheel.classList.remove('glow'), 2500);
  }

  const colors = ['#c1121f', '#ffffff', '#d4af37', '#bdbdbd'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('i');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.animationDuration = `${2 + Math.random() * 1.5}s`;
    document.body.append(piece);
    setTimeout(() => piece.remove(), 4500);
  }
}

function addHistory(n) {
  const box = $('history');
  if (!box) return;
  const dot = document.createElement('span');
  dot.className = `dot ${n === 0 ? 'zero' : RED.has(n) ? 'red' : 'black'}`;
  dot.textContent = n;
  box.prepend(dot);
  while (box.children.length > 10) box.lastChild.remove();
}

function openDialog(mode) {
  if (state.spinning) return;
  dialogMode = mode;
  $('dialog-title').textContent = mode === 'deposit' ? 'Recargar saldo' : 'Retirar saldo';
  $('amount').value = '';$('dialog-error').textContent = '';
  $('money-dialog').showModal();$('amount').focus();
}

function confirmDialog() {
  const amount = Math.floor(Number($('amount').value));

  if (!amount || amount <= 0) {
    $('dialog-error').textContent = 'Escribe un monto mayor a cero.';
    return;
  }
  if (dialogMode === 'withdraw' && amount > state.balance) {
    $('dialog-error').textContent = `Solo tienes ${fmt(state.balance)} disponibles.`;
    return;
  }

  state.balance += dialogMode === 'deposit' ? amount : -amount;
  saveBalance();
  render();
  $('money-dialog').close();$('result').textContent = dialogMode === 'deposit'
    ? `Recargaste ${fmt(amount)}. Haz tu apuesta.`
    : `Retiraste ${fmt(amount)}.`;
}

// Listeners de botones
$('btn-spin').addEventListener('click', spin);
if ($('btn-rebet')) $('btn-rebet').addEventListener('click', rebet);$('btn-sound').addEventListener('click', () => {
  state.sound = !state.sound;
  $('btn-sound').textContent = state.sound ? 'Sonido: sí' : 'Sonido: no';
});
$('btn-clear').addEventListener('click', clearBets);
$('btn-deposit').addEventListener('click', () => openDialog('deposit'));$('btn-withdraw').addEventListener('click', () => openDialog('withdraw'));
$('dialog-ok').addEventListener('click', confirmDialog);$('dialog-cancel').addEventListener('click', () => $('money-dialog').close());$('amount').addEventListener('keydown', e => { if (e.key === 'Enter') confirmDialog(); });

// Inicialización
loadBalance();
drawWheel();
buildBoard();
buildChips();
render();