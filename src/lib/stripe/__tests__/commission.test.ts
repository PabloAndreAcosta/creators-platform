import { getCreatorCommissionRate, calculateCreatorPayout } from '../commission';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}`);
    failed++;
  }
}

function assertEq(actual: number, expected: number, name: string) {
  assert(actual === expected, `${name} → got ${actual}, expected ${expected}`);
}

// ─── getCreatorCommissionRate ───
console.log('\ngetCreatorCommissionRate:');

assertEq(getCreatorCommissionRate('gratis'), 0.15, 'Gratis → 15%');
assertEq(getCreatorCommissionRate('guld'), 0.08, 'Guld → 8%');
assertEq(getCreatorCommissionRate('premium'), 0.03, 'Premium → 3%');

// ─── calculateCreatorPayout: Gratis ───
console.log('\ncalculateCreatorPayout (Gratis, 1000 SEK):');

const gratis = calculateCreatorPayout(1000, 'gratis');
assertEq(gratis.gross, 1000, 'Gross = 1000');
assertEq(gratis.commission, 150, 'Commission = 150');
assertEq(gratis.net, 850, 'Net = 850');
assertEq(gratis.commissionRate, 0.15, 'Rate = 0.15');

// ─── calculateCreatorPayout: Guld ───
console.log('\ncalculateCreatorPayout (Guld, 1000 SEK):');

const guld = calculateCreatorPayout(1000, 'guld');
assertEq(guld.gross, 1000, 'Gross = 1000');
assertEq(guld.commission, 80, 'Commission = 80');
assertEq(guld.net, 920, 'Net = 920');
assertEq(guld.commissionRate, 0.08, 'Rate = 0.08');

// ─── calculateCreatorPayout: Premium ───
console.log('\ncalculateCreatorPayout (Premium, 1000 SEK):');

const premium = calculateCreatorPayout(1000, 'premium');
assertEq(premium.gross, 1000, 'Gross = 1000');
assertEq(premium.commission, 30, 'Commission = 30');
assertEq(premium.net, 970, 'Net = 970');
assertEq(premium.commissionRate, 0.03, 'Rate = 0.03');

// ─── Verify: net = gross - commission ───
console.log('\nVerify net = gross - commission:');

for (const tier of ['gratis', 'guld', 'premium'] as const) {
  const p = calculateCreatorPayout(1000, tier);
  assert(p.net === p.gross - p.commission, `${tier}: ${p.net} === ${p.gross} - ${p.commission}`);
}

// ─── Edge cases ───
console.log('\nEdge cases:');

const unknown = calculateCreatorPayout(1000, 'unknown');
assertEq(unknown.commissionRate, 0.15, 'Unknown tier defaults to 15%');
assertEq(unknown.net, 850, 'Unknown tier net = 850');

const small = calculateCreatorPayout(99.50, 'guld');
assertEq(small.commission, 7.96, 'Small amount: 99.50 * 8% = 7.96');
assertEq(small.net, 91.54, 'Small amount net: 91.54');

// ─── Summary ───
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
