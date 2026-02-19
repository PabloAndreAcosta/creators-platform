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

// ─── getDiscountPercentage ───
console.log('\ngetDiscountPercentage:');

assertEq(getDiscountPercentage(null, 'a'), 0, 'Free user, tier A → 0%');
assertEq(getDiscountPercentage('silver', 'a'), 0, 'Silver user, tier A → 0%');
assertEq(getDiscountPercentage('gold', 'a'), 0.20, 'Gold user, tier A → 20%');
assertEq(getDiscountPercentage('gold', 'b'), 0.10, 'Gold user, tier B → 10%');
assertEq(getDiscountPercentage('gold', 'c'), 0.05, 'Gold user, tier C → 5%');
assertEq(getDiscountPercentage('platinum', 'a'), 0.30, 'Platinum user, tier A → 30%');
assertEq(getDiscountPercentage('platinum', 'b'), 0.20, 'Platinum user, tier B → 20%');
assertEq(getDiscountPercentage('platinum', 'c'), 0.10, 'Platinum user, tier C → 10%');
assertEq(getDiscountPercentage('invalid', 'a'), 0, 'Invalid tier → 0%');
assertEq(getDiscountPercentage('gold', 'x'), 0, 'Invalid event tier → 0%');

// ─── formatDiscount ───
console.log('\nformatDiscount:');

assert(formatDiscount(0.20) === '20%', '0.20 → "20%"');
assert(formatDiscount(0.05) === '5%', '0.05 → "5%"');
assert(formatDiscount(0) === '0%', '0 → "0%"');
assert(formatDiscount(0.30) === '30%', '0.30 → "30%"');

// ─── applyDiscount ───
console.log('\napplyDiscount:');

assertEq(applyDiscount(300, 0.20), 240, '300 SEK - 20% → 240 SEK');
assertEq(applyDiscount(300, 0.10), 270, '300 SEK - 10% → 270 SEK');
assertEq(applyDiscount(300, 0.05), 285, '300 SEK - 5% → 285 SEK');
assertEq(applyDiscount(300, 0), 300, '300 SEK - 0% → 300 SEK');
assertEq(applyDiscount(199, 0.30), 139.3, '199 SEK - 30% → 139.30 SEK');

// ─── calculateDiscountedPrice ───
console.log('\ncalculateDiscountedPrice:');

assertEq(calculateDiscountedPrice(300, 'gold', 'a'), 240, 'Gold + tier A: 300 → 240');
assertEq(calculateDiscountedPrice(300, 'gold', 'b'), 270, 'Gold + tier B: 300 → 270');
assertEq(calculateDiscountedPrice(300, 'platinum', 'a'), 210, 'Platinum + tier A: 300 → 210');
assertEq(calculateDiscountedPrice(300, null, 'a'), 300, 'No tier: 300 → 300');
assertEq(calculateDiscountedPrice(300, 'silver', 'a'), 300, 'Silver: 300 → 300');
assertEq(calculateDiscountedPrice(0, 'gold', 'a'), 0, 'Zero price → 0');

// ─── Summary ───
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
