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
  )
  .addStringOption((option) =>
    option.setName('карта').setDescription('Реквизиты карты/СБП (необязательно)').setMaxLength(64)
  )
  .addStringOption((option) =>
    option.setName('крипта').setDescription('Адрес криптокошелька (необязательно)').setMaxLength(128)
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
    crypto: payment.crypto,
    exp: String(payment.expiresAt)
  });
  return `${config.payBaseUrl}?${params.toString()}`;
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
        card: interaction.options.getString('карта') || undefined,
        crypto: interaction.options.getString('крипта') || undefined,
        createdBy: interaction.user.id
      });

      const url = payUrl(payment);
      await interaction.editReply({
        content: `Счёт **${payment.id}** создан. Ссылка для покупателя:\n${url}`
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
