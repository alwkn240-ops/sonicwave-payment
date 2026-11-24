/* ==================== HTTP-сервер для вебхуков anore ==================== */

const http = require('node:http');
const crypto = require('node:crypto');
const store = require('./store');
const config = require('./config');

/* ---------- проверка подписи (заполнить по доке anore.cc) ---------- */
function verifySignature(rawBody, headers) {
  const secret = process.env.ANORE_WEBHOOK_SECRET;
  if (!secret) return true; // если секрет не задан — не проверяем (только для теста)

  const signature = headers['x-anore-signature'] || headers['x-signature'] || '';
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

/* ---------- обработка события ---------- */
function handleEvent(event) {
  const paymentId = event?.orderId || event?.id || event?.payment_id;
  const anoreStatus = event?.status || event?.payment_status;

  if (!paymentId || !anoreStatus) {
    console.warn('[Webhook] невалидное событие:', JSON.stringify(event));
    return;
  }

  const payment = store.getPayment(paymentId);
  if (!payment) {
    console.warn(`[Webhook] платёж ${paymentId} не найден`);
    return;
  }

  if (anoreStatus === 'success' || anoreStatus === 'paid' || anoreStatus === 'completed') {
    store.setStatus(paymentId, 'paid', { paidAt: Date.now() });
    console.log(`[Webhook] платёж ${paymentId} оплачен (${anoreStatus})`);
  } else if (anoreStatus === 'failed' || anoreStatus === 'expired' || anoreStatus === 'cancelled') {
    store.setStatus(paymentId, 'expired');
    console.log(`[Webhook] платёж ${paymentId} истёк/отменён (${anoreStatus})`);
  }
}

/* ---------- HTTP-сервер ---------- */
function startWebhookServer(port = 3333) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('SonicWave webhook endpoint');
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        if (!verifySignature(body, req.headers)) {
          console.warn('[Webhook] подпись невалидна — запрос отклонён');
          res.writeHead(401);
          res.end('Unauthorized');
          return;
        }

        const event = JSON.parse(body);
        console.log('[Webhook] событие:', JSON.stringify(event).slice(0, 400));
        handleEvent(event);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        console.error('[Webhook] ошибка разбора:', error.message);
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
  });

  server.listen(port, () => {
    console.log(`[Webhook] сервер запущен на порту ${port}`);
  });

  return server;
}

module.exports = { startWebhookServer };

/* если файл запущен напрямую — стартуем сервер */
if (require.main === module) {
  const port = Number(process.env.WEBHOOK_PORT) || 3333;
  startWebhookServer(port);
}
