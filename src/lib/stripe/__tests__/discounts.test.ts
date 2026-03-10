import { getDiscountPercentage, formatDiscount, applyDiscount } from '../discounts';
import { calculateDiscountedPrice } from '../commission';

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

// ─── getDiscountPercentage (new signature: userTier only) ───
console.log('\ngetDiscountPercentage:');

assertEq(getDiscountPercentage(null), 0, 'null → 0%');
assertEq(getDiscountPercentage('gratis'), 0, 'Gratis → 0%');
assertEq(getDiscountPercentage('guld'), 0.10, 'Guld → 10%');
assertEq(getDiscountPercentage('premium'), 0.20, 'Premium → 20%');
assertEq(getDiscountPercentage('invalid'), 0, 'Invalid tier → 0%');

// ─── formatDiscount ───
console.log('\nformatDiscount:');

assert(formatDiscount(0.20) === '20%', '0.20 → "20%"');
assert(formatDiscount(0.10) === '10%', '0.10 → "10%"');
assert(formatDiscount(0.05) === '5%', '0.05 → "5%"');
assert(formatDiscount(0) === '0%', '0 → "0%"');

// ─── applyDiscount ───
console.log('\napplyDiscount:');

assertEq(applyDiscount(300, 0.20), 240, '300 SEK - 20% → 240 SEK');
assertEq(applyDiscount(300, 0.10), 270, '300 SEK - 10% → 270 SEK');
assertEq(applyDiscount(300, 0.05), 285, '300 SEK - 5% → 285 SEK');
assertEq(applyDiscount(300, 0), 300, '300 SEK - 0% → 300 SEK');
assertEq(applyDiscount(199, 0.20), 159.2, '199 SEK - 20% → 159.20 SEK');

// ─── calculateDiscountedPrice (new signature: price + userTier) ───
console.log('\ncalculateDiscountedPrice:');

assertEq(calculateDiscountedPrice(300, 'guld'), 270, 'Guld: 300 → 270');
assertEq(calculateDiscountedPrice(300, 'premium'), 240, 'Premium: 300 → 240');
assertEq(calculateDiscountedPrice(300, 'gratis'), 300, 'Gratis: 300 → 300');
assertEq(calculateDiscountedPrice(300, null), 300, 'null: 300 → 300');
assertEq(calculateDiscountedPrice(0, 'guld'), 0, 'Zero price → 0');

// ─── Summary ───
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
