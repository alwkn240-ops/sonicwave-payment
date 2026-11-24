const {
  Client,
  GatewayIntentBits,
  Events,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags
} = require('discord.js');

const config = require('./config');
const store = require('./store');
const ui = require('./ui');
const { createAnorePayment } = require('./anore');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ------------------------ команда /newplatega ------------------------ */

const newPlategaCommand = new SlashCommandBuilder()
  .setName('newplatega')
  .setDescription('Создать ссылку на оплату (только для админов)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addStringOption((option) =>
    option.setName('товар').setDescription('Название товара').setRequired(true).setMaxLength(100)
  )
  .addStringOption((option) =>
    option.setName('описание').setDescription('Описание товара').setRequired(true).setMaxLength(300)
  )
  .addIntegerOption((option) =>
    option.setName('цена').setDescription('Цена в рублях').setRequired(true).setMinValue(1).setMaxValue(1000000)
  );

async function registerCommands() {
  try {
    await client.application.commands.set([newPlategaCommand.toJSON()]);
    console.log('[PlategaBot] Слэш-команда /newplatega зарегистрирована глобально.');
  } catch (error) {
    console.error('[PlategaBot] Не удалось зарегистрировать команду:', error.message);
  }
}

function isAdminMember(member) {
  return Boolean(
    member?.permissions?.has?.(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has?.(PermissionFlagsBits.ManageGuild)
  );
}

function payUrl(payment) {
  const params = new URLSearchParams({
    id: payment.id,
    item: payment.item,
    desc: payment.desc,
    price: String(payment.price),
    to: payment.card,
    exp: String(payment.expiresAt)
  });
  return `${config.payBaseUrl}?${params.toString()}`;
}

function siteUrl(payment) {
  return payUrl(payment); // deprecated, kept for compatibility
}

function shortUrl(payment) {
  // формат /pay/<ID>?... — без index.html
  const base = config.payBaseUrl.replace(/\/+$/, '').replace(/\/index\.html$/, '');
  const params = new URLSearchParams({
    item: payment.item,
    desc: payment.desc,
    price: String(payment.price),
    to: payment.card,
    exp: String(payment.expiresAt)
  });
  if (payment.anoreUrl) {
    params.set('anoreUrl', payment.anoreUrl);
  }
  return `${base}/pay/${payment.id}?${params.toString()}`;
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('SonicWave · оплата', { type: 0 });
  await registerCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    /* ------------------- /newplatega ------------------- */
    if (interaction.isChatInputCommand() && interaction.commandName === 'newplatega') {
      if (!isAdminMember(interaction.member)) {
        return interaction.reply({
          content: 'Команда доступна только администраторам.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const payment = store.createPayment({
        item: interaction.options.getString('товар'),
        desc: interaction.options.getString('описание'),
        price: interaction.options.getInteger('цена'),
        card: config.requisites.card,
        createdBy: interaction.user.id
      });

      /* если задан ключ anore — создаём платёж на их стороне (карта + СБП) */
      let anoreUrl = null;
      if (process.env.ANORE_SECRET_KEY) {
        const anore = await createAnorePayment({
          amount: payment.price,
          currency: 'RUB',
          description: payment.item,
          orderId: payment.id,
          successUrl: siteUrl(payment),
          failUrl: siteUrl(payment),
          callbackUrl: (process.env.WEBHOOK_PUBLIC_URL || '') + '/webhook/anore'
        });
        if (anore) {
          anoreUrl = anore.confirmation_url;
          payment.anoreUrl = anoreUrl;
          store.setStatus(payment.id, 'awaiting_payment', {
            anoreId: anore.id,
            anoreStatus: anore.status,
            anoreUrl
          });
        }
      }

      /* покупателю всегда даём короткую ссылку /pay/<ID>; 
         кнопка на сайте сама уведёт на форму anore (если она есть) */
      const url = shortUrl(payment);

      await interaction.editReply({
        content: `Счёт **${payment.id}** создан${anoreUrl ? ' (оплата через anore.cc: карта/СБП)' : ''}.\nСсылка для покупателя:\n${url}`
      });

      // публичное сообщение со ссылкой
      await interaction.channel.send({
        components: ui.buildPaymentComponents(payment, url),
        flags: MessageFlags.IsComponentsV2
      }).catch((error) => console.error('[PlategaBot] send failed:', error.message));
      return;
    }
  } catch (error) {
    console.error('[PlategaBot] Interaction error:', error);
    const reply = { content: `Ошибка: ${error.message}`, flags: MessageFlags.Ephemeral };
    if (interaction.deferred) await interaction.editReply(reply).catch(() => {});
    else if (!interaction.replied) await interaction.reply(reply).catch(() => {});
  }
});

client.on(Events.Error, (error) => {
  console.error('[Discord Error]', error?.message || error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled]', reason);
});

(async () => {
  await store.init();
  await client.login(config.token);
})();
