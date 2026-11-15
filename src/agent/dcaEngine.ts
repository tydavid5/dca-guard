export interface DcaConfig {
  agentId: string;
  maxBuyValue: number;
  maxTotalSpend: number;
  maxBuys: number;
  windowStartMs: number;
  windowEndMs: number;
  maxWindowMs: number;
  allowlist: string[];
  demoSecret: string;
}

export interface BuyRequest {
  target: string;
  value: number;
  token: string;
  timestampMs: number;
  authTag: string;
}

export interface AgentState {
  paused: boolean;
  buysExecuted: number;
  totalSpent: number;
  blockedCount: number;
}

export interface Decision {
  allowed: boolean;
  code: string;
  reason: string;
}

export interface CheckResult {
  decision: Decision;
  state: AgentState;
  executedValue: number;
}

export function freshState(): AgentState {
  return { paused: false, buysExecuted: 0, totalSpent: 0, blockedCount: 0 };
}

export function defaultConfig(nowMs: number): DcaConfig {
  return {
    agentId: "dca-guard-01",
    maxBuyValue: 25,
    maxTotalSpend: 100,
    maxBuys: 4,
    windowStartMs: nowMs - 3600000,
    windowEndMs: nowMs + 23 * 3600000,
    maxWindowMs: 24 * 3600000,
    allowlist: ["0x1111111111111111111111111111111111111111"],
    demoSecret: "dca-guard-demo-secret",
  };
}

function hash53(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  const low = (h2 >>> 0).toString(16).padStart(8, "0");
  const high = (h1 >>> 0).toString(16).padStart(8, "0");
  return high + low;
}

export function signMessage(
  agentId: string,
  target: string,
  value: number,
  timestampMs: number,
  secret: string,
): string {
  const payload = [agentId, target.toLowerCase(), String(value), String(timestampMs), secret].join("|");
  return hash53(payload);
}

export function verifyMessage(config: DcaConfig, request: BuyRequest): boolean {
  const expected = signMessage(
    config.agentId,
    request.target,
    request.value,
    request.timestampMs,
    config.demoSecret,
  );
  return expected === request.authTag;
}

function blocked(code: string, reason: string): Decision {
  return { allowed: false, code, reason };
}

export function evaluateBuy(
  config: DcaConfig,
  state: AgentState,
  request: BuyRequest,
  nowMs: number,
): Decision {
  if (state.paused) {
    return blocked("PAUSED", "Agent is paused. Resume it before any buy is checked.");
  }
  if (!verifyMessage(config, request)) {
    return blocked("BAD_AUTH", "Message authentication failed. The buy request was not signed by this agent.");
  }
  if (nowMs < config.windowStartMs || nowMs > config.windowEndMs) {
    return blocked("OUTSIDE_WINDOW", "Now is outside the scoped EVM window. The agent stays paused outside its window.");
  }
  if (config.windowEndMs - config.windowStartMs > config.maxWindowMs) {
    return blocked("WINDOW_TOO_LONG", "The scoped window is longer than the duration limit.");
  }
  const target = request.target.toLowerCase();
  const allowed = config.allowlist.map((entry) => entry.toLowerCase());
  if (!allowed.includes(target)) {
    return blocked("TARGET_NOT_ALLOWLISTED", "Target is not on the allowlist. Only allowlisted targets can receive a buy.");
  }
  if (request.value <= 0) {
    return blocked("BAD_VALUE", "Buy value must be greater than zero.");
  }
  if (request.value > config.maxBuyValue) {
    return blocked("OVER_VALUE_LIMIT", "Buy value is over the per buy value limit.");
  }
  if (state.totalSpent + request.value > config.maxTotalSpend) {
    return blocked("OVER_TOTAL_LIMIT", "Buy would push total spend over the total spend limit.");
  }
  if (state.buysExecuted >= config.maxBuys) {
    return blocked("MAX_BUYS_REACHED", "Maximum number of buys in this window is already reached.");
  }
  return { allowed: true, code: "ALLOWED", reason: "Buy is inside every limit." };
}

export function runScheduledCheck(
  config: DcaConfig,
  state: AgentState,
  amount: number,
  target: string,
  token: string,
  nowMs: number,
): CheckResult {
  const request: BuyRequest = {
    target,
    value: amount,
    token,
    timestampMs: nowMs,
    authTag: signMessage(config.agentId, target, amount, nowMs, config.demoSecret),
  };
  const decision = evaluateBuy(config, state, request, nowMs);
  if (decision.allowed) {
    const next: AgentState = {
      paused: false,
      buysExecuted: state.buysExecuted + 1,
      totalSpent: state.totalSpent + amount,
      blockedCount: state.blockedCount,
    };
    return { decision, state: next, executedValue: amount };
  }
  const next: AgentState = {
    paused: true,
    buysExecuted: state.buysExecuted,
    totalSpent: state.totalSpent,
    blockedCount: state.blockedCount + 1,
  };
  return { decision, state: next, executedValue: 0 };
}

export function resumeAgent(state: AgentState): AgentState {
  return {
    paused: false,
    buysExecuted: state.buysExecuted,
    totalSpent: state.totalSpent,
    blockedCount: state.blockedCount,
  };
}

export function pauseAgent(state: AgentState): AgentState {
  return {
    paused: true,
    buysExecuted: state.buysExecuted,
    totalSpent: state.totalSpent,
    blockedCount: state.blockedCount,
  };
}
