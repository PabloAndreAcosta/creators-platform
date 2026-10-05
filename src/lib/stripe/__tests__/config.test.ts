import { describe, it, expect } from 'vitest';
import { PLANS, GRATIS_PLAN, getPlanList } from '../config';

describe('PLANS', () => {
  it('has 6 plans total', () => {
    expect(Object.keys(PLANS)).toHaveLength(6);
  });

  it('has 2 plans per role', () => {
    const roles = Object.values(PLANS).map((p) => p.role);
    expect(roles.filter((r) => r === 'customer')).toHaveLength(2);
    expect(roles.filter((r) => r === 'creator')).toHaveLength(2);
    expect(roles.filter((r) => r === 'venue')).toHaveLength(2);
  });

  it('all plans have SEK currency and monthly interval', () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.currency).toBe('SEK');
      expect(plan.interval).toBe('month');
    }
  });

  it('publik plans are cheaper than kreator/upplevelse plans', () => {
    expect(PLANS.publik_guld.price).toBeLessThan(PLANS.kreator_guld.price);
    expect(PLANS.publik_premium.price).toBeLessThan(PLANS.kreator_premium.price);
  });

  it('guld är billigare än premium bland nivåer som går att teckna', () => {
    expect(PLANS.kreator_guld.price).toBeLessThan(PLANS.kreator_premium.price);
  });

  it('publiknivåerna är avvecklade och kostar noll', () => {
    // 22 personer har någonsin köpt biljett, snitt 1,1 köp. En månadsavgift
    // på 199 kr var mer än bästa kunden spenderat totalt. Klippkortet är
    // produkten i stället.
    expect(PLANS.publik_guld.retired).toBe(true);
    expect(PLANS.publik_premium.retired).toBe(true);
    expect(PLANS.publik_guld.price).toBe(0);
    expect(PLANS.publik_premium.price).toBe(0);
  });

  it('avvecklade nivåer lovar inget som inte är byggt', () => {
    // VIP utan kö, exklusivt innehåll och prioriterad support fanns aldrig.
    const alla = Object.values(PLANS).flatMap((p) => p.features).join(" ");
    expect(alla).not.toMatch(/VIP|Exklusivt innehåll|Prioriterad support/);
  });

  it('venue-nivåerna är avvecklade och kostar noll', () => {
    // En lokal är en avtalspart, inte en abonnent. Nycklarna ligger kvar så
    // att befintliga prenumerationer och webhooken kan läsa sitt plan-id.
    expect(PLANS.upplevelse_guld.retired).toBe(true);
    expect(PLANS.upplevelse_premium.retired).toBe(true);
    expect(PLANS.upplevelse_guld.price).toBe(0);
    expect(PLANS.upplevelse_premium.price).toBe(0);
  });
});

describe('GRATIS_PLAN', () => {
  it('has price 0', () => {
    expect(GRATIS_PLAN.price).toBe(0);
  });

  it('has tier gratis', () => {
    expect(GRATIS_PLAN.tier).toBe('gratis');
  });
});

describe('getPlanList', () => {
  it('returnerar bara nivåer som går att teckna', () => {
    // Sex plan-nycklar finns, men de två avvecklade venue-nivåerna ska inte
    // dyka upp i någon prislista.
    const plans = getPlanList();
    expect(plans).toHaveLength(2);
    expect(plans.every((p) => p.role === 'creator')).toBe(true);
  });

  it('returnerar inga nivåer för publik — de är avvecklade', () => {
    expect(getPlanList('customer')).toHaveLength(0);
  });

  it('returns 2 plans for kreator role', () => {
    const plans = getPlanList('creator');
    expect(plans).toHaveLength(2);
    expect(plans.every((p) => p.role === 'creator')).toBe(true);
  });

  it('returnerar inga nivåer för venue — de är avvecklade', () => {
    expect(getPlanList('venue')).toHaveLength(0);
  });

  it('plan objects include key, name, price, features', () => {
    const plans = getPlanList('creator');
    for (const plan of plans) {
      expect(plan).toHaveProperty('key');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('price');
      expect(plan).toHaveProperty('features');
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });
});

describe('nivåerna lovar bara sådant som är byggt', () => {
  it('ingen plan lovar synlighet som rankningen inte ger', () => {
    // Rekommendationsmotorn tittar aldrig på tier. "Prioriterad synlighet"
    // och "Toppsynlighet + utvalda" var alltså löften utan täckning.
    const alla = Object.values(PLANS).flatMap((p) => p.features).join(' ');
    expect(alla).not.toMatch(/Prioriterad synlighet|Toppsynlighet|White label/);
  });

  it('ingen plan säljer något alla redan har', () => {
    // RÄTTAT 2026-10-05. Testet förbjöd tidigare "Egen profiladress" med
    // motiveringen att den finns för alla. Det var fel: dashboard/profile/
    // actions.ts kräver guld eller premium för att sätta en slug, och har
    // gjort det hela tiden. Påståendet i prislistan var alltså sant och
    // kommentaren i config.ts var det som ljög.
    //
    // Kvar i listan är det som verkligen är ogrindat. Genomgången 2026-10-05
    // flyttade sex sådana påståenden ur Guld och Premium: medarrangör,
    // delegerad skanning, digitalt material, Facebook-synk, kalender och
    // export var alla gratis för alla. De tre första är nu grindade på
    // riktigt via nivåtaken; de tre sista står kvar som Premium-löften och
    // behöver grindas eller strykas — se PR-beskrivningen.
    const alla = Object.values(PLANS).flatMap((p) => p.features).join(' ');
    expect(alla).not.toMatch(/Prioriterad support|Exklusivt innehåll|VIP/);
  });
});
