/* ==================== anore.cc интеграция ==================== */

const ANORE_API = 'https://api.anore.cc';

/* создаёт платёж в anore.cc и возвращает { id, status, confirmation_url } или null при ошибке */
async function createAnorePayment({ amount, currency = 'RUB', description, orderId, successUrl, failUrl, callbackUrl, methods = ['sbp', 'card'] }) {
  const key = process.env.ANORE_SECRET_KEY;
  if (!key) {
    console.error('[Anore] ANORE_SECRET_KEY не задан — оплата через anore недоступна');
    return null;
  }

  const body = {
    amount,
    currency,
    description,
    orderId,
    return_url: successUrl,
    successurl: successUrl,
    failurl: failUrl,
    callbackUrl: callbackUrl,
    methods
  };

  try {
    const resp = await fetch(`${ANORE_API}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[Anore] API error ${resp.status}: ${text}`);
      return null;
    }

    const data = await resp.json();
    console.log('[Anore] платёж создан:', data.id, data.status, data.confirmation_url);
    return {
      id: data.id,
      status: data.status,
      confirmation_url: data.confirmation_url || data.paymentUrl
    };
  } catch (error) {
    console.error('[Anore] request failed:', error.message);
    return null;
  }
}

module.exports = { createAnorePayment };
