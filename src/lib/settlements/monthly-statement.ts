/**
 * Månadsavräkningen till en partner (en lokal som delar biljettintäkten).
 *
 * Pengarna går kväll för kväll dagen efter (run-payouts), men partnerns
 * ekonomi bokför per månad och behöver ett underlag: vilka kvällar, vad som
 * såldes, hur andelen räknades och vilka överföringar som hör till. Det här är
 * den rena delen — inläsning och utskick ligger i cron-rutten.
 *
 * En kväll hör till den månad den ägde rum (event_date), inte den månad
 * pengarna gick. En komplettering som betalas ut efter att månadens avräkning
 * skickats redovisas i NÄSTA månads underlag, under tidigare kvällar, så att
 * inget öre faller mellan två utskick.
 */

export interface StatementPayout {
  listingId: string;
  eventDate: string; // YYYY-MM-DD, Stockholmstid
  title: string;
  tickets: number;
  grossOre: number;
  refundedOre: number;
  vatOre: number;
  basisOre: number;
  vatRate: number;
  partnerPercent: number;
  amountOre: number;
  status: string;
  paidAt: string | null; // ISO
  transferId: string | null;
  /** Swish-försäljning samma kväll: utanför Stripe, partnerns andel via bank. */
  swishTickets?: number;
  swishGrossOre?: number;
  swishDueOre?: number;
}

export interface StatementSupplement {
  listingId: string;
  eventDate: string;
  title: string;
  seq: number;
  amountOre: number;
  dueOre: number;
  grossOre: number;
  refundedOre: number;
  vatOre: number;
  basisOre: number;
  status: string;
  paidAt: string | null;
  transferId: string | null;
}

export interface StatementRow {
  eventDate: string;
  title: string;
  tickets: number;
  grossOre: number;
  refundedOre: number;
  vatOre: number;
  basisOre: number;
  vatRate: number;
  partnerPercent: number;
  /** Partnerns andel enligt kvällens senaste underlag. */
  dueOre: number;
  /** Det som faktiskt överförts, ordinarie avräkning plus kompletteringar. */
  paidOre: number;
  /** Senaste utbetalningsdag (YYYY-MM-DD, Stockholm), om något betalats. */
  paidDate: string | null;
  transferIds: string[];
  /** Ordinarie avräkning som ännu inte gått: dry_run, pending eller failed. */
  pending: boolean;
  /** Swish-försäljning: utanför Stripe, partnerns andel regleras via bank. */
  swishTickets: number;
  swishGrossOre: number;
  swishDueOre: number;
}

export interface EarlierSupplement {
  eventDate: string;
  title: string;
  amountOre: number;
  paidDate: string;
  transferId: string | null;
}

export interface MonthlyStatement {
  period: string; // YYYY-MM
  rows: StatementRow[];
  earlier: EarlierSupplement[];
  totals: {
    evenings: number;
    tickets: number;
    grossOre: number;
    vatOre: number;
    basisOre: number;
    dueOre: number;
    paidOre: number;
    earlierOre: number;
    swishGrossOre: number;
    swishDueOre: number;
  };
}

const TZ = "Europe/Stockholm";

/** YYYY-MM-DD för ett ögonblick, i svensk tid. */
export function stockholmDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso));
}

/** Månaden före den givna dagen, som YYYY-MM. */
export function previousPeriod(today: string): string {
  const [y, m] = today.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

/** Första vardagen (mån–fre) i månaden, som dag i månaden. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  for (let d = 1; d <= 7; d++) {
    // Mitt på dagen i UTC, så att veckodagen inte glider över dygnsgränsen.
    const dow = new Date(Date.UTC(year, month - 1, d, 12)).getUTCDay();
    if (dow !== 0 && dow !== 6) return d;
  }
  return 1;
}

/** Är det dags att skicka förra månadens avräkning? Från första vardagen och framåt. */
export function statementIsDue(today: string): boolean {
  const [y, m, d] = today.split("-").map(Number);
  return d >= firstWeekdayOfMonth(y, m);
}

function inPeriod(date: string, period: string): boolean {
  return date.slice(0, 7) === period;
}

export function buildMonthlyStatement(
  period: string,
  payouts: readonly StatementPayout[],
  supplements: readonly StatementSupplement[],
): MonthlyStatement {
  const paidSupps = supplements.filter((s) => s.status === "paid");

  const rows: StatementRow[] = payouts
    .filter((p) => inPeriod(p.eventDate, period))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .map((p) => {
      // Bara kompletteringar betalade senast i perioden. En som betalas ut
      // månaden efter redovisas i den månadens underlag, under tidigare
      // kvällar — annars skulle samma belopp stå i två avräkningar.
      const own = paidSupps
        .filter((s) => s.listingId === p.listingId && s.paidAt && stockholmDate(s.paidAt).slice(0, 7) <= period)
        .sort((a, b) => a.seq - b.seq);
      const latest = own[own.length - 1];
      const ordinaryPaid = p.status === "paid";
      const paidOre = (ordinaryPaid ? p.amountOre : 0) + own.reduce((n, s) => n + s.amountOre, 0);
      const paidDates = [
        ...(ordinaryPaid && p.paidAt ? [stockholmDate(p.paidAt)] : []),
        ...own.filter((s) => s.paidAt).map((s) => stockholmDate(s.paidAt!)),
      ].sort();
      return {
        eventDate: p.eventDate,
        title: p.title,
        tickets: p.tickets,
        grossOre: latest ? latest.grossOre : p.grossOre,
        refundedOre: latest ? latest.refundedOre : p.refundedOre,
        vatOre: latest ? latest.vatOre : p.vatOre,
        basisOre: latest ? latest.basisOre : p.basisOre,
        vatRate: p.vatRate,
        partnerPercent: p.partnerPercent,
        dueOre: latest ? latest.dueOre : p.amountOre,
        paidOre,
        paidDate: paidDates[paidDates.length - 1] ?? null,
        transferIds: [
          ...(ordinaryPaid && p.transferId ? [p.transferId] : []),
          ...own.map((s) => s.transferId).filter((x): x is string => !!x),
        ],
        pending: !ordinaryPaid,
        swishTickets: p.swishTickets ?? 0,
        swishGrossOre: p.swishGrossOre ?? 0,
        swishDueOre: p.swishDueOre ?? 0,
      };
    });

  const earlier: EarlierSupplement[] = paidSupps
    .filter((s) => s.paidAt && inPeriod(stockholmDate(s.paidAt), period) && s.eventDate.slice(0, 7) < period)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.seq - b.seq)
    .map((s) => ({
      eventDate: s.eventDate,
      title: s.title,
      amountOre: s.amountOre,
      paidDate: stockholmDate(s.paidAt!),
      transferId: s.transferId,
    }));

  const sum = (f: (r: StatementRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  return {
    period,
    rows,
    earlier,
    totals: {
      evenings: rows.length,
      tickets: sum((r) => r.tickets),
      grossOre: sum((r) => r.grossOre),
      vatOre: sum((r) => r.vatOre),
      basisOre: sum((r) => r.basisOre),
      dueOre: sum((r) => r.dueOre),
      paidOre: sum((r) => r.paidOre),
      earlierOre: earlier.reduce((n, e) => n + e.amountOre, 0),
      swishGrossOre: sum((r) => r.swishGrossOre),
      swishDueOre: sum((r) => r.swishDueOre),
    },
  };
}

/** Kronor med två decimaler och decimalkomma — det svenskt Excel läser som tal. */
function krCell(ore: number): string {
  return (ore / 100).toFixed(2).replace(".", ",");
}

function csvCell(v: string): string {
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Specifikationen som fil. Semikolon och decimalkomma, med BOM, så att den
 * öppnas rätt i svenskt Excel och går att klistra in i bokföringen.
 * Kolumnrubrikerna kommer utifrån (mottagarens språk).
 */
export function statementCsv(
  s: MonthlyStatement,
  headers: {
    date: string; evening: string; tickets: string; gross: string; vat: string; basis: string;
    share: string; paid: string; paidDate: string; transfers: string; total: string; earlier: string;
    swishGross?: string; swishShare?: string;
  },
): string {
  // Swish-kolumnerna sist, så att de som redan läser in filen inte får sina
  // kolumner förskjutna. De fylls bara när någon kväll i perioden hade Swish.
  const swish = s.rows.some((r) => r.swishGrossOre > 0) && headers.swishGross && headers.swishShare;
  const tail = (a: string, b: string) => (swish ? [a, b] : []);
  const lines: string[][] = [[
    headers.date, headers.evening, headers.tickets, headers.gross, headers.vat, headers.basis,
    headers.share, headers.paid, headers.paidDate, headers.transfers, ...tail(headers.swishGross!, headers.swishShare!),
  ]];
  for (const r of s.rows) {
    lines.push([
      r.eventDate, r.title, String(r.tickets), krCell(r.grossOre), krCell(r.vatOre), krCell(r.basisOre),
      krCell(r.dueOre), krCell(r.paidOre), r.paidDate ?? "", r.transferIds.join(" + "),
      ...tail(krCell(r.swishGrossOre), krCell(r.swishDueOre)),
    ]);
  }
  const t = s.totals;
  lines.push([
    headers.total, "", String(t.tickets), krCell(t.grossOre), krCell(t.vatOre), krCell(t.basisOre),
    krCell(t.dueOre), krCell(t.paidOre), "", "", ...tail(krCell(t.swishGrossOre), krCell(t.swishDueOre)),
  ]);
  if (s.earlier.length) {
    lines.push([]);
    lines.push([headers.earlier]);
    for (const e of s.earlier) {
      lines.push([e.eventDate, e.title, "", "", "", "", "", krCell(e.amountOre), e.paidDate, e.transferId ?? ""]);
    }
  }
  return "﻿" + lines.map((l) => l.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
