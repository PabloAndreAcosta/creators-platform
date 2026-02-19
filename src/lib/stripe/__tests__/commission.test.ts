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

assertEq(getCreatorCommissionRate('silver'), 0.20, 'Silver → 20%');
assertEq(getCreatorCommissionRate('gold'), 0.10, 'Gold → 10%');
assertEq(getCreatorCommissionRate('platinum'), 0.05, 'Platinum → 5%');

// ─── calculateCreatorPayout: Silver ───
console.log('\ncalculateCreatorPayout (Silver, 1000 SEK):');

const silver = calculateCreatorPayout(1000, 'silver');
assertEq(silver.gross, 1000, 'Gross = 1000');
assertEq(silver.commission, 200, 'Commission = 200');
assertEq(silver.net, 800, 'Net = 800');
assertEq(silver.commissionRate, 0.20, 'Rate = 0.20');

// ─── calculateCreatorPayout: Gold ───
console.log('\ncalculateCreatorPayout (Gold, 1000 SEK):');

const gold = calculateCreatorPayout(1000, 'gold');
assertEq(gold.gross, 1000, 'Gross = 1000');
assertEq(gold.commission, 100, 'Commission = 100');
assertEq(gold.net, 900, 'Net = 900');
assertEq(gold.commissionRate, 0.10, 'Rate = 0.10');

// ─── calculateCreatorPayout: Platinum ───
console.log('\ncalculateCreatorPayout (Platinum, 1000 SEK):');

const platinum = calculateCreatorPayout(1000, 'platinum');
assertEq(platinum.gross, 1000, 'Gross = 1000');
assertEq(platinum.commission, 50, 'Commission = 50');
assertEq(platinum.net, 950, 'Net = 950');
assertEq(platinum.commissionRate, 0.05, 'Rate = 0.05');

// ─── Verify: net = gross - commission ───
console.log('\nVerify net = gross - commission:');

for (const tier of ['silver', 'gold', 'platinum'] as const) {
  const p = calculateCreatorPayout(1000, tier);
  assert(p.net === p.gross - p.commission, `${tier}: ${p.net} === ${p.gross} - ${p.commission}`);
}

// ─── Edge cases ───
console.log('\nEdge cases:');

const unknown = calculateCreatorPayout(1000, 'unknown');
assertEq(unknown.commissionRate, 0.20, 'Unknown tier defaults to 20%');
assertEq(unknown.net, 800, 'Unknown tier net = 800');

const small = calculateCreatorPayout(99.50, 'gold');
assertEq(small.commission, 9.95, 'Small amount: 99.50 * 10% = 9.95');
assertEq(small.net, 89.55, 'Small amount net: 89.55');

// ─── Summary ───
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
