const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle
} = require('discord.js');

function txt(content) {
  return new TextDisplayBuilder().setContent(content);
}

function sep() {
  return new SeparatorBuilder().setDivider(true);
}

function button(customId, label, style, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);
}

function linkButton(url, label, style = ButtonStyle.Secondary) {
  return new ButtonBuilder()
    .setLabel(label)
    .setStyle(ButtonStyle.Link)
    .setURL(url);
}

function discordTime(ms) {
  return `<t:${Math.floor(ms / 1000)}:F>`;
}

function formatMoney(amount) {
  return `${Number(amount).toLocaleString('ru-RU')} ₽`;
}

/* -------------------- плашка со ссылкой на оплату -------------------- */

function buildPaymentComponents(payment, url) {
  const expired = payment.status === 'expired' || Date.now() > payment.expiresAt;
  const paid = payment.status === 'paid';

  const container = new ContainerBuilder();

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        txt(
          [
            `## ${paid ? '✅ Оплачено' : expired ? '⌛ Срок истёк' : '💳 Счёт на оплату'}`,
            `**${payment.item}**`,
            payment.desc || '',
            '',
            `Цена: **${formatMoney(payment.price)}**`
          ].filter(Boolean).join('\n')
        )
      )
      .setButtonAccessory(
        linkButton(url, 'Перейти к оплате', ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(sep());

  if (paid) {
    container.addTextDisplayComponents(
      txt('Платёж подтверждён. Спасибо за покупку!')
    );
  } else if (expired) {
    container.addTextDisplayComponents(
      txt('Срок счёта истёк. Попросите администратора создать новый.')
    );
  } else {
    container.addTextDisplayComponents(
      txt(
        [
          `Истекает: ${discordTime(payment.expiresAt)}`,
          '-# Оплата картой, криптой или QR СБП на странице оплаты.'
        ].join('\n')
      )
    );
  }

  container.addSeparatorComponents(sep());
  container.addTextDisplayComponents(
    txt(`-# SonicWave · ${payment.id}`)
  );

  return [container];
}

/* -------------------- вспомогательные плашки -------------------- */

function buildSimpleComponents(title, lines) {
  const container = new ContainerBuilder();
  container.addTextDisplayComponents(txt(`## ${title}`));
  container.addSeparatorComponents(sep());
  container.addTextDisplayComponents(txt(lines.join('\n')));
  return [container];
}

module.exports = {
  txt,
  sep,
  button,
  linkButton,
  buildPaymentComponents,
  buildSimpleComponents
};
