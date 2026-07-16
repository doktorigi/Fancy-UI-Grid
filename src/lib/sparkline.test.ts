import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSparklineGeometry,
  coerceSparklineValues,
  nearestSparklineIndex,
} from './sparkline';

const SIZE = { width: 120, height: 28 };

test('coerceSparklineValues accepts numbers and numeric strings, drops junk', () => {
  assert.deepEqual(coerceSparklineValues([1, '2.5', 'x', null, 3]), [1, 2.5, 3]);
  assert.deepEqual(coerceSparklineValues('not an array'), []);
  assert.deepEqual(coerceSparklineValues(null), []);
});

test('line geometry maps min/max to bottom/top with padding', () => {
  const g = buildSparklineGeometry([0, 10], { type: 'line', ...SIZE });
  assert.equal(g.points.length, 2);
  const [lo, hi] = g.points;
  assert.equal(lo.y, 25); // height 28 - padding 3
  assert.equal(hi.y, 3); // padding
  assert.equal(lo.x, 3);
  assert.equal(hi.x, 117);
  assert.equal(g.linePath, 'M3 25L117 3');
  assert.equal(g.areaPath, '');
  assert.equal(g.min, 0);
  assert.equal(g.max, 10);
  assert.equal(g.last, 10);
});

test('flat series draws a midline instead of collapsing to an edge', () => {
  const g = buildSparklineGeometry([5, 5, 5], { type: 'line', ...SIZE });
  assert.ok(g.points.every(p => p.y === 14)); // vertical middle
});

test('area geometry closes the path down to the floor', () => {
  const g = buildSparklineGeometry([0, 10], { type: 'area', ...SIZE });
  assert.ok(g.areaPath.startsWith('M3 25L117 3'));
  assert.ok(g.areaPath.endsWith('L117 25L3 25Z'));
});

test('bar geometry anchors bars to a zero baseline with mixed signs', () => {
  const g = buildSparklineGeometry([10, -10], { type: 'bar', ...SIZE });
  assert.equal(g.bars.length, 2);
  const [pos, neg] = g.bars;
  assert.ok(pos.positive);
  assert.ok(!neg.positive);
  // baseline is the vertical middle for a symmetric domain
  const baseline = 3 + 22 / 2;
  assert.ok(Math.abs(pos.y + pos.height - baseline) < 0.06); // positive bar ends at baseline
  assert.ok(Math.abs(neg.y - baseline) < 0.06); // negative bar starts at baseline
  assert.ok(Math.abs(pos.height - 11) < 0.06);
  assert.ok(Math.abs(neg.height - 11) < 0.06);
});

test('all-positive bar geometry uses zero baseline at the floor', () => {
  const g = buildSparklineGeometry([5, 10], { type: 'bar', ...SIZE });
  g.bars.forEach(b => assert.ok(Math.abs(b.y + b.height - 25) < 0.06));
  assert.ok(g.bars[1].height > g.bars[0].height);
});

test('winloss encodes sign only: equal blocks, zero as a midline tick', () => {
  const g = buildSparklineGeometry([7, -2, 0, 100], { type: 'winloss', ...SIZE });
  const [w1, l1, z, w2] = g.bars;
  assert.equal(w1.height, w2.height); // magnitude ignored
  assert.equal(w1.height, l1.height);
  assert.equal(z.height, 1);
  const mid = 3 + 22 / 2;
  assert.ok(w1.y < mid && l1.y >= mid);
});

test('empty and invalid input produce empty geometry', () => {
  const g = buildSparklineGeometry([], { type: 'line', ...SIZE });
  assert.equal(g.points.length, 0);
  assert.equal(g.linePath, '');
  assert.equal(g.last, null);
});

test('nearestSparklineIndex snaps to the closest point or bar center', () => {
  const line = buildSparklineGeometry([1, 2, 3], { type: 'line', ...SIZE });
  assert.equal(nearestSparklineIndex(line, 0), 0);
  assert.equal(nearestSparklineIndex(line, 60), 1);
  assert.equal(nearestSparklineIndex(line, 119), 2);
  const bars = buildSparklineGeometry([1, 2, 3, 4], { type: 'bar', ...SIZE });
  assert.equal(nearestSparklineIndex(bars, 5), 0);
  assert.equal(nearestSparklineIndex(bars, 115), 3);
  const empty = buildSparklineGeometry([], { type: 'line', ...SIZE });
  assert.equal(nearestSparklineIndex(empty, 10), null);
});
