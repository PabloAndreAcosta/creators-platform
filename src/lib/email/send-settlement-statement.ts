import { createElement } from 'react';
import { getResend, getFromEmail } from './resend';
import { renderEmailToHtml } from './render';
import SettlementStatement, { getSettlementStatementSubject } from '@/components/emails/SettlementStatement';
import { getEmailIntl } from './i18n';
import { resolveRecipientLocale } from '@/lib/i18n/recipient';
import { statementCsv, type MonthlyStatement } from '@/lib/settlements/monthly-statement';

/**
 * Mejlar månadsavräkningen till partnern, med specifikationen som CSV.
 * Språket följer partnerns konto (profiles.locale), inte mottagarens adress:
 * mottagaren är ofta ekonomin hos partnern, utan eget konto.
 */
export async function sendSettlementStatementEmail(opts: {
  to: string[];
  cc: string[];
  partnerId: string;
  partnerName: string;
  statement: MonthlyStatement;
  replyTo?: string;
}): Promise<void> {
  const { t, locale } = await getEmailIntl(await resolveRecipientLocale({ userId: opts.partnerId }));

  const html = await renderEmailToHtml(
    createElement(SettlementStatement, { partnerName: opts.partnerName, statement: opts.statement, t, locale })
  );
  const csv = statementCsv(opts.statement, {
    date: t('statementCsvDate'),
    evening: t('statementCsvEvening'),
    tickets: t('statementCsvTickets'),
    gross: t('statementCsvGross'),
    vat: t('statementCsvVat'),
    basis: t('statementCsvBasis'),
    share: t('statementCsvShare'),
    paid: t('statementCsvPaid'),
    paidDate: t('statementCsvPaidDate'),
    transfers: t('statementCsvTransfers'),
    total: t('statementCsvTotal'),
    earlier: t('statementCsvEarlier'),
  });

  const { error } = await getResend().emails.send({
    from: getFromEmail(),
    to: opts.to,
    cc: opts.cc.length ? opts.cc : undefined,
    replyTo: opts.replyTo,
    subject: getSettlementStatementSubject(t, opts.partnerName, opts.statement.period, locale),
    html,
    attachments: [{ filename: `avrakning-${opts.statement.period}.csv`, content: Buffer.from(csv, 'utf8') }],
  });
  if (error) throw new Error(`Avräkningsmejlet gick inte att skicka: ${error.message}`);
}
