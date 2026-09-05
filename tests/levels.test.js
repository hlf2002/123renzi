'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { normalCdf, gradeOf, levelWithPercentile } = require('../src/core/levels');

test('normalCdf 已知点', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6, 'cdf(0)=0.5');
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3, 'cdf(1.96)≈0.975');
  assert.ok(Math.abs(normalCdf(-1) - 0.1587) < 1e-3, 'cdf(-1)≈0.1587');
  assert.ok(normalCdf(100) > 0.9999);
  assert.ok(normalCdf(-100) < 0.0001);
});

test('gradeOf 边界（年级基线表）', () => {
  assert.equal(gradeOf(0).grade, '幼小衔接');
  assert.equal(gradeOf(699).grade, '幼小衔接');
  assert.equal(gradeOf(700).grade, '一年级');
  assert.equal(gradeOf(1499).grade, '一年级');
  assert.equal(gradeOf(1500).grade, '二年级');
  assert.equal(gradeOf(2499).grade, '三年级');
  assert.equal(gradeOf(2500).grade, '四年级');
  assert.equal(gradeOf(3500).grade, '高中');
});

test('levelWithPercentile 单调上升 + clamp 1..99', () => {
  const a = levelWithPercentile(50).percentile;
  const b = levelWithPercentile(300).percentile;
  const c = levelWithPercentile(600).percentile;
  assert.ok(a >= 1, '下限 clamp');
  assert.ok(b >= a, '单调');
  assert.ok(c >= b, '单调');
  assert.ok(levelWithPercentile(-5).percentile >= 1, '非法输入 clamp');
  assert.ok(levelWithPercentile(100000).percentile <= 99, '上限 clamp');
});
