const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  token: (process.env.DISCORD_TOKEN || '').trim(),
  // базовый URL, по которому открывается сайт оплаты (index.html)
  payBaseUrl: (process.env.PAY_BASE_URL || 'http://localhost:8377/index.html').replace(/\/+$/, ''),
  // папка с хранилищем платежей
  dataDir: path.join(__dirname, 'data'),
  // время жизни платежа, мс
  paymentTtlMs: 15 * 60 * 1000,
  // валюта
  currency: '₽',
  // реквизиты по умолчанию (можно передавать опцией команды)
  requisites: {
    card: '2202 2061 1234 5678',
  },
  discordInvite: 'https://discord.gg/mK95j8FaZg'
};

if (!config.token) {
  console.error('[PlategaBot] Не задан DISCORD_TOKEN. Скопируйте .env.example в .env и укажите токен.');
  process.exit(1);
}

module.exports = config;
