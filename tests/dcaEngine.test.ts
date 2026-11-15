import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultConfig,
  evaluateBuy,
  freshState,
  pauseAgent,
  resumeAgent,
  runScheduledCheck,
  signMessage,
  type BuyRequest,
  type DcaConfig,
} from "../src/agent/dcaEngine.ts";

const NOW = 1794000000000;
const TARGET = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

function config(): DcaConfig {
  const base = defaultConfig(NOW);
  return {
    ...base,
    windowStartMs: NOW - 3600000,
    windowEndMs: NOW + 3600000,
    maxWindowMs: 24 * 3600000,
  };
}

function signed(cfg: DcaConfig, value: number, target: string, at: number): BuyRequest {
  return {
    target,
    value,
    token: "fUSD",
    timestampMs: at,
    authTag: signMessage(cfg.agentId, target, value, at, cfg.demoSecret),
  };
}

test("buy inside limits passes", () => {
  const cfg = config();
  const decision = evaluateBuy(cfg, freshState(), signed(cfg, 25, TARGET, NOW), NOW);
  assert.equal(decision.allowed, true);
  assert.equal(decision.code, "ALLOWED");
});

test("buy at the exact value limit passes", () => {
  const cfg = config();
  const result = runScheduledCheck(cfg, freshState(), 25, TARGET, "fUSD", NOW);
  assert.equal(result.decision.allowed, true);
  assert.equal(result.state.buysExecuted, 1);
  assert.equal(result.state.totalSpent, 25);
  assert.equal(result.executedValue, 25);
});

test("buy over value limit is blocked", () => {
  const cfg = config();
  const decision = evaluateBuy(cfg, freshState(), signed(cfg, 26, TARGET, NOW), NOW);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "OVER_VALUE_LIMIT");
});

test("buy outside the scoped window is blocked", () => {
  const cfg = config();
  const before = evaluateBuy(cfg, freshState(), signed(cfg, 10, TARGET, NOW - 7200000), NOW - 7200000);
  assert.equal(before.allowed, false);
  assert.equal(before.code, "OUTSIDE_WINDOW");
  const after = evaluateBuy(cfg, freshState(), signed(cfg, 10, TARGET, NOW + 7200000), NOW + 7200000);
  assert.equal(after.allowed, false);
  assert.equal(after.code, "OUTSIDE_WINDOW");
});

test("buy to a non allowlisted target is blocked", () => {
  const cfg = config();
  const decision = evaluateBuy(cfg, freshState(), signed(cfg, 10, OTHER, NOW), NOW);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "TARGET_NOT_ALLOWLISTED");
});

test("buy with a bad auth tag is blocked", () => {
  const cfg = config();
  const request = signed(cfg, 10, TARGET, NOW);
  request.authTag = "0000000000000000";
  const decision = evaluateBuy(cfg, freshState(), request, NOW);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "BAD_AUTH");
});

test("buy that would pass the total spend limit is blocked", () => {
  const cfg = config();
  const state = { paused: false, buysExecuted: 3, totalSpent: 90, blockedCount: 0 };
  const decision = evaluateBuy(cfg, state, signed(cfg, 25, TARGET, NOW), NOW);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "OVER_TOTAL_LIMIT");
});

test("window longer than the duration limit is blocked", () => {
  const cfg = config();
  cfg.windowEndMs = NOW + 48 * 3600000;
  const decision = evaluateBuy(cfg, freshState(), signed(cfg, 10, TARGET, NOW), NOW);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "WINDOW_TOO_LONG");
});

test("agent pauses after a blocked buy", () => {
  const cfg = config();
  const result = runScheduledCheck(cfg, freshState(), 99, TARGET, "fUSD", NOW);
  assert.equal(result.decision.allowed, false);
  assert.equal(result.decision.code, "OVER_VALUE_LIMIT");
  assert.equal(result.state.paused, true);
  assert.equal(result.state.blockedCount, 1);
  assert.equal(result.executedValue, 0);
  const next = runScheduledCheck(cfg, result.state, 10, TARGET, "fUSD", NOW);
  assert.equal(next.decision.allowed, false);
  assert.equal(next.decision.code, "PAUSED");
});

test("paused agent can be resumed and then buys again", () => {
  const cfg = config();
  const blocked = runScheduledCheck(cfg, freshState(), 99, TARGET, "fUSD", NOW);
  assert.equal(blocked.state.paused, true);
  const resumed = resumeAgent(blocked.state);
  assert.equal(resumed.paused, false);
  const result = runScheduledCheck(cfg, resumed, 10, TARGET, "fUSD", NOW);
  assert.equal(result.decision.allowed, true);
  assert.equal(result.state.buysExecuted, 1);
});

test("manual pause blocks buys", () => {
  const cfg = config();
  const paused = pauseAgent(freshState());
  const decision = evaluateBuy(cfg, paused, signed(cfg, 10, TARGET, NOW), NOW);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "PAUSED");
});
