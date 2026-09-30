// European wheel order (0-36)
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
// Numbers that are red in a real wheel; here they are drawn white
const WHITE = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const CHIP_VALUES = [1000, 5000, 10000, 50000];

const OUTSIDE = [
  { key: 'd1', label: '1ª docena', span: 4, pays: 3, test: n => n >= 1 && n <= 12 },
  { key: 'd2', label: '2ª docena', span: 4, pays: 3, test: n => n >= 13 && n <= 24 },
  { key: 'd3', label: '3ª docena', span: 4, pays: 3, test: n => n >= 25 },
  { key: 'low', label: '1-18', span: 2, pays: 2, test: n => n >= 1 && n <= 18 },
  { key: 'even', label: 'Par', span: 2, pays: 2, test: n => n > 0 && n % 2 === 0 },
  { key: 'black', label: 'Negro', span: 2, pays: 2, test: n => n > 0 && !WHITE.has(n) },
  { key: 'white', label: 'Blanco', span: 2, pays: 2, test: n => WHITE.has(n) },
  { key: 'odd', label: 'Impar', span: 2, pays: 2, test: n => n % 2 === 1 },
  { key: 'high', label: '19-36', span: 2, pays: 2, test: n => n >= 19 }
];
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const state = { balance: 0, chip: 5000, bets: {}, spinning: false, rotation: 0 };
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
  $('balance').textContent = fmt(state.balance);
  $('total-bet').textContent = fmt(totalBet());

  document.querySelectorAll('[data-bet]').forEach(cell => {
    const amount = state.bets[cell.dataset.bet];
    cell.classList.toggle('has-bet', Boolean(amount));
    cell.dataset.chip = amount ? fmt(amount) : '';
  });

  $('btn-spin').disabled = state.spinning || totalBet() === 0;
  ['btn-deposit', 'btn-withdraw', 'btn-clear'].forEach(id => { $(id).disabled = state.spinning; });
}
