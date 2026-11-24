const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('./config');

const FILE = path.join(__dirname, 'data', 'payments.json');

let state = { payments: {} };
let saveChain = Promise.resolve();

async function init() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    state = { payments: {}, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('[Store] read failed:', error.message);
    await save();
  }
  return state;
}

function save() {
  const snapshot = JSON.stringify(state, null, 2);
  saveChain = saveChain.then(async () => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    await fs.writeFile(tmp, snapshot, 'utf8');
    await fs.rename(tmp, FILE);
  }).catch((error) => console.error('[Store] save failed:', error.message));
  return saveChain;
}

function newPaymentId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function createPayment({ item, desc, price, card, crypto, createdBy }) {
  const id = newPaymentId();
  const payment = {
    id,
    item: String(item || 'SonicWave Client').slice(0, 100),
    desc: String(desc || '').slice(0, 300),
    price: Math.max(1, Math.floor(Number(price) || 500)),
    card: String(card || config.requisites.card).slice(0, 64),
    status: 'awaiting_payment',
    createdAt: Date.now(),
    expiresAt: Date.now() + config.paymentTtlMs,
    createdBy: createdBy || null
  };
  state.payments[id] = payment;
  save();
  return payment;
}

function getPayment(id) {
  return state.payments[String(id || '').toUpperCase()] || null;
}

function setStatus(id, status, extra = {}) {
  const payment = getPayment(id);
  if (!payment) return null;
  payment.status = status;
  payment.updatedAt = Date.now();
  Object.assign(payment, extra);
  save();
  return payment;
}

function listPayments(filter = {}) {
  return Object.values(state.payments)
    .filter((payment) => !filter.status || payment.status === filter.status)
    .sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  init,
  save,
  createPayment,
  getPayment,
  setStatus,
  listPayments
};
