import { useMemo, useState } from "react";

import { createClient, type QoreChainClient } from "@qorechain/sdk";
import {
  defaultConfig,
  evaluateBuy,
  freshState,
  pauseAgent,
  resumeAgent,
  runScheduledCheck,
  signMessage,
  type AgentState,
  type DcaConfig,
} from "./agent/dcaEngine.js";

const REST_URL = import.meta.env.VITE_QORE_REST_URL ?? "/lcd";
const EVM_RPC_URL =
  import.meta.env.VITE_QORE_EVM_RPC_URL ?? "http://localhost:8545";

const DEMO_TARGET = "0x1111111111111111111111111111111111111111";
const UNKNOWN_TARGET = "0x2222222222222222222222222222222222222222";

interface LogEntry {
  id: number;
  time: string;
  text: string;
  kind: "ok" | "blocked" | "info";
}

interface Pill {
  id: number;
  kind: "ok" | "blocked";
  text: string;
}

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

function RollingNumber({ value, suffix }: { value: number; suffix?: string }): JSX.Element {
  return (
    <span>
      <span key={value} className="rollNum">
        {value}
      </span>
      {suffix ? <span className="rollSuffix"> {suffix}</span> : null}
    </span>
  );
}

export function App(): JSX.Element {
  const client: QoreChainClient = useMemo(
    () =>
      createClient({
        network: "testnet",
        endpoints: { rest: REST_URL, evmRpc: EVM_RPC_URL },
      }),
    [],
  );

  const [config, setConfig] = useState<DcaConfig>(() => defaultConfig(Date.now()));
  const [state, setState] = useState<AgentState>(() => freshState());
  const [amount, setAmount] = useState(25);
  const [log, setLog] = useState<LogEntry[]>([
    {
      id: 0,
      time: fmtTime(Date.now()),
      text: "Guard armed. Demo mode is on, no chain transaction is sent.",
      kind: "info",
    },
  ]);
  const [wallet, setWallet] = useState("qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u");
  const [balances, setBalances] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [sdkLoading, setSdkLoading] = useState(false);
  const [lastDecision, setLastDecision] = useState<string>("No check run yet.");
  const [pill, setPill] = useState<Pill | null>(null);

  function pushLog(text: string, kind: "ok" | "blocked" | "info"): void {
    setLog((prev) => [
      { id: prev.length, time: fmtTime(Date.now()), text, kind },
      ...prev,
    ]);
  }

  function applyResult(label: string, next: AgentState, decision: string, ok: boolean): void {
    setState(next);
    setLastDecision(decision);
    setPill({
      id: Date.now(),
      kind: ok ? "ok" : "blocked",
      text: ok ? "Buy executed. Inside every limit." : "Buy blocked. Agent paused.",
    });
    pushLog(label + " " + decision, ok ? "ok" : "blocked");
  }

  function runCheck(): void {
    const now = Date.now();
    const result = runScheduledCheck(config, state, amount, DEMO_TARGET, "fUSD", now);
    if (result.decision.allowed) {
      applyResult(
        "Scheduled check: bought " + result.executedValue + " fUSD inside the limits.",
        result.state,
        "ALLOWED. Buy " + result.executedValue + " fUSD to the allowlisted demo target.",
        true,
      );
    } else {
      applyResult(
        "Scheduled check: buy blocked, agent paused.",
        result.state,
        result.decision.code + ". " + result.decision.reason,
        false,
      );
    }
  }

  function tryOverLimit(): void {
    const now = Date.now();
    const over = config.maxBuyValue + 10;
    const request = {
      target: DEMO_TARGET,
      value: over,
      token: "fUSD",
      timestampMs: now,
      authTag: signMessage(config.agentId, DEMO_TARGET, over, now, config.demoSecret),
    };
    const decision = evaluateBuy(config, state, request, now);
    const next = decision.allowed ? state : pauseAgent({ ...state, blockedCount: state.blockedCount + 1 });
    applyResult(
      "Over limit test: tried to buy " + over + " fUSD.",
      next,
      decision.code + ". " + decision.reason,
      decision.allowed,
    );
  }

  function tryOutsideWindow(): void {
    const at = config.windowEndMs + 3600000;
    const request = {
      target: DEMO_TARGET,
      value: amount,
      token: "fUSD",
      timestampMs: at,
      authTag: signMessage(config.agentId, DEMO_TARGET, amount, at, config.demoSecret),
    };
    const decision = evaluateBuy(config, state, request, at);
    const next = decision.allowed ? state : pauseAgent({ ...state, blockedCount: state.blockedCount + 1 });
    applyResult(
      "Outside window test: tried a buy one hour after the window ends.",
      next,
      decision.code + ". " + decision.reason,
      decision.allowed,
    );
  }

  function tryUnknownTarget(): void {
    const now = Date.now();
    const request = {
      target: UNKNOWN_TARGET,
      value: amount,
      token: "fUSD",
      timestampMs: now,
      authTag: signMessage(config.agentId, UNKNOWN_TARGET, amount, now, config.demoSecret),
    };
    const decision = evaluateBuy(config, state, request, now);
    const next = decision.allowed ? state : pauseAgent({ ...state, blockedCount: state.blockedCount + 1 });
    applyResult(
      "Unknown target test: tried to buy to an address that is not allowlisted.",
      next,
      decision.code + ". " + decision.reason,
      decision.allowed,
    );
  }

  function onResume(): void {
    const next = resumeAgent(state);
    setState(next);
    setLastDecision("Agent resumed by hand. Next check runs the guard rules again.");
    pushLog("Agent resumed by hand.", "info");
  }

  function onPause(): void {
    const next = pauseAgent(state);
    setState(next);
    setLastDecision("Agent paused by hand.");
    pushLog("Agent paused by hand.", "info");
  }

  async function loadBalance(): Promise<void> {
    setSdkError(null);
    setBalances(null);
    if (!wallet.trim()) {
      setSdkError("Enter a QoreX wallet address first.");
      return;
    }
    setSdkLoading(true);
    try {
      const res = await client.rest.getAllBalances(wallet.trim());
      const rows = res.balances as { denom: string; amount: string }[];
      setBalances(rows.length === 0 ? "No balances returned for this address." : rows.map((b) => b.amount + " " + b.denom).join(", "));
    } catch (err) {
      setSdkError(err instanceof Error ? err.message : String(err));
    } finally {
      setSdkLoading(false);
    }
  }

  const windowHours = Math.round((config.windowEndMs - config.windowStartMs) / 3600000);
  const spentPct = config.maxTotalSpend > 0 ? Math.min(100, Math.round((state.totalSpent / config.maxTotalSpend) * 100)) : 0;
  const taglineWords = ["Buy", "inside", "limits.", "Stop", "outside", "them."];

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">DG</span>
          <span className="brandName">DCA GUARD</span>
        </div>
        <div className="topActions">
          <span className="demoPill">DEMO MODE</span>
          <div className={state.paused ? "status paused" : "status active"}>
            <span className="statusDot" />
            {state.paused ? "PAUSED" : "ACTIVE"}
          </div>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">QoreChain testnet, qorechain-diana, EVM chain 9800</p>
          <h1 className="heroTitle">DCA GUARD</h1>
          <p className="heroProblem">A DCA bot keeps buying with no pause in a crash.</p>
          <p className="heroSub">This guard buys only inside its limits, then it stops. Set the window, the per buy limit, the total cap and the allowlist first, then let one scheduled check at a time prove it.</p>
          <div className="heroCtas">
            <button className="primary" onClick={runCheck}>Run scheduled DCA check</button>
            <a className="ghostLink" href="#limits">See the guard limits</a>
          </div>
        </div>
        <div className="mockup" aria-label="Guard dashboard preview">
          <div className="mockupTop">
            <div className="mockupDots">
              <span />
              <span />
              <span />
            </div>
            <span className="mockupTitle">GUARD DASHBOARD, LIVE STATE</span>
          </div>
          <div className="mockupBody">
            <p className="mockupLabel">Max buy, per buy limit</p>
            <p className="mockupHeroNum">
              <RollingNumber value={config.maxBuyValue} suffix="fUSD" />
            </p>
            <p className="mockupNote">One giant number, one limit. Change it in the guard limits panel and this hero number follows.</p>
            <div className="mockupRow">
              <div className="mockupTile">
                <p className="mockupTileLabel">Total cap</p>
                <p className="mockupTileValue">
                  <RollingNumber value={config.maxTotalSpend} suffix="fUSD" />
                </p>
              </div>
              <div className="mockupTile">
                <p className="mockupTileLabel">Buys done</p>
                <p className="mockupTileValue">
                  <RollingNumber value={state.buysExecuted} suffix={"of " + config.maxBuys} />
                </p>
              </div>
              <div className="mockupTile">
                <p className="mockupTileLabel">Blocked</p>
                <p className="mockupTileValue">
                  <RollingNumber value={state.blockedCount} />
                </p>
              </div>
            </div>
            <div className="progressTrack">
              <div className="progressFill" style={{ width: spentPct + "%" }} />
            </div>
            <p className="progressLabel">
              <span>Total spent vs cap</span>
              <strong>{state.totalSpent} of {config.maxTotalSpend} fUSD</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="statBand" aria-label="Guard stats">
        <div className="stat">
          <p className="statLabel">Max buy</p>
          <p className="statValue">
            <RollingNumber value={config.maxBuyValue} suffix="fUSD" />
          </p>
        </div>
        <div className="stat">
          <p className="statLabel">Total cap</p>
          <p className="statValue">
            <RollingNumber value={config.maxTotalSpend} suffix="fUSD" />
          </p>
        </div>
        <div className="stat">
          <p className="statLabel">Buys executed</p>
          <p className="statValue">
            <RollingNumber value={state.buysExecuted} />
          </p>
        </div>
        <div className="stat">
          <p className="statLabel">Blocked buys</p>
          <p className="statValue">
            <RollingNumber value={state.blockedCount} />
          </p>
        </div>
      </section>

      <section className="card">
        <h2>Live testnet proof</h2>
        <p className="muted">LIVE, complete, on testnet qorechain-diana, EVM chain 9800. The guard contract is deployed and the live buy, block and resume flow ran on chain.</p>
        <div className="chips">
          <span className="chip chipOk">Status: LIVE, complete</span>
          <span className="chip chipOk">Contract: deployed</span>
          <span className="chip chipOk">Buy 25 fUSD: executed</span>
          <span className="chip chipOk">Buy 50 fUSD: blocked as designed</span>
          <span className="chip chipOk">Agent: resumed, paused false</span>
        </div>
        <p className="muted">Contract DcaGuard: <code>0x5f2024c7802d656334d3e5a7315516eae2ae8cb6</code></p>
        <p className="muted">Deploy tx, block 10106990: <code>0x33ae91e83b2a13162cfc372b702903973fd0b5d49fcb5719cfbea1c78ca4fd77</code></p>
        <p className="muted">Buy 25 fUSD tx: <code>0xa4fe1a2a792d13d82077bb327d782452cabd01cd95721a5170425999ca0991e1</code>. Buys executed 1, total spent 25,000,000.</p>
        <p className="muted">Buy 50 fUSD blocked as designed tx: <code>0x3f22f4517da9f8de2e322112fe99a64c192ce3602487cb31d466dd8af8afd79f</code>. Agent paused.</p>
        <p className="muted">Resume tx: <code>0xfee83d5d1c3a6d5451208025e5b3d435e71100b56b1c50a64e004ea31b575f1d</code>. Paused false again.</p>
        <p className="muted">Live limits: max buy 25 fUSD, max total 100 fUSD, max 4 buys, window 24 hours.</p>
      </section>

      <section aria-label="The problem">
        <h2 className="sectionTitle">The problem it guards against</h2>
        <p className="sectionSub">Three ways an unguarded DCA bot burns its budget. Each one is a check this guard runs before any buy.</p>
        <div className="problemGrid">
          <div className="problemCard">
            <p className="problemNum">01</p>
            <h3>Buys with no pause</h3>
            <p>A bot keeps buying through a crash, with no pause and no cap check, until the budget is gone.</p>
          </div>
          <div className="problemCard">
            <p className="problemNum">02</p>
            <h3>No cap in a crash</h3>
            <p>One bad run can push total spend past the cap before anyone notices the damage.</p>
          </div>
          <div className="problemCard">
            <p className="problemNum">03</p>
            <h3>No allowlist check</h3>
            <p>A buy can go to any address, not only the one you approved in advance.</p>
          </div>
        </div>
      </section>

      <p className="demoBanner">DEMO MODE: buys are simulated against the local guard rules. No chain transaction is sent, no real money moves.</p>

      <section className="grid">
        <div className="card" id="limits">
          <h2>Guard limits</h2>
          <div className="bigRow">
            <div>
              <p className="bigLabel">Max buy</p>
              <p className="bigNumber">{config.maxBuyValue} <span>fUSD</span></p>
            </div>
            <div>
              <p className="bigLabel">Total cap</p>
              <p className="bigNumber">{config.maxTotalSpend} <span>fUSD</span></p>
            </div>
            <div>
              <p className="bigLabel">Max buys</p>
              <p className="bigNumber">{config.maxBuys}</p>
            </div>
            <div>
              <p className="bigLabel">Window</p>
              <p className="bigNumber">{windowHours} <span>hours</span></p>
            </div>
          </div>
          <label className="field">
            Max buy value, fUSD
            <input type="number" min={1} value={config.maxBuyValue} onChange={(e) => setConfig({ ...config, maxBuyValue: Number(e.target.value) })} />
          </label>
          <label className="field">
            Total spend cap, fUSD
            <input type="number" min={1} value={config.maxTotalSpend} onChange={(e) => setConfig({ ...config, maxTotalSpend: Number(e.target.value) })} />
          </label>
          <label className="field">
            Max buys in window
            <input type="number" min={1} value={config.maxBuys} onChange={(e) => setConfig({ ...config, maxBuys: Number(e.target.value) })} />
          </label>
          <label className="field">
            Window start
            <input type="datetime-local" value={toLocalInput(config.windowStartMs)} onChange={(e) => setConfig({ ...config, windowStartMs: new Date(e.target.value).getTime() })} />
          </label>
          <label className="field">
            Window end
            <input type="datetime-local" value={toLocalInput(config.windowEndMs)} onChange={(e) => setConfig({ ...config, windowEndMs: new Date(e.target.value).getTime() })} />
          </label>
          <p className="muted">Window: {fmtDate(config.windowStartMs)} to {fmtDate(config.windowEndMs)}. Duration limit: {config.maxWindowMs / 3600000} hours.</p>
          <p className="muted">Allowlisted target, demo only: <code>{DEMO_TARGET}</code></p>
        </div>

        <div className="card">
          <h2>Run one scheduled check</h2>
          <label className="field">
            Buy amount, fUSD
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <p className="muted">Target: demo fUSD vault on the allowlist. Token: fUSD, testnet only. Each request carries a signed demo message, and the guard verifies it before any other check.</p>
          <button className="primary" onClick={runCheck}>Run scheduled DCA check</button>
          <div className="buttonRow">
            <button onClick={tryOverLimit}>Try buy over limit</button>
            <button onClick={tryOutsideWindow}>Try buy outside window</button>
            <button onClick={tryUnknownTarget}>Try buy to unknown target</button>
          </div>
          <div className="buttonRow">
            {state.paused ? (
              <button className="primary" onClick={onResume}>Resume agent</button>
            ) : (
              <button onClick={onPause}>Pause agent</button>
            )}
          </div>
          <p className="decision" role="status">{lastDecision}</p>
          {pill && (
            <p key={pill.id} className={pill.kind === "ok" ? "pill pillOk" : "pill pillBlocked"} role="status">
              {pill.kind === "ok" ? "Buy executed. " : "Buy blocked. "}
              {pill.kind === "ok" ? "Inside every limit." : "Agent paused."}
            </p>
          )}
          <div className="counters">
            <p>Buys executed: <strong><RollingNumber value={state.buysExecuted} /></strong></p>
            <p>Total spent: <strong><RollingNumber value={state.totalSpent} suffix="fUSD" /></strong></p>
            <p>Blocked buys: <strong><RollingNumber value={state.blockedCount} /></strong></p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="feedHead">
          <h2>Activity log</h2>
          <span className="liveFeed"><span className="livePulse" />LIVE FEED</span>
        </div>
        {log.length === 0 && <p className="muted">No activity yet.</p>}
        <ul className="log">
          {log.map((entry) => (
            <li key={entry.id} className={entry.kind}>
              <span>{entry.time}</span> {entry.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Wallet and live testnet status</h2>
        <p className="muted">QoreX wallet address is qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u (EVM form 0xB5b7328A3981431BE72bF1282c0F08A7905fC827). Verified live Nov 15 with qore-cli on testnet qorechain-diana chain 9800: fresh account at first check, exists false, balances empty, 0 QOR, staked 0 QOR, ML-DSA-87 key not registered yet. Faucet claimed Nov 15 01:00 WAT: exists true, account number 15585, sequence 0, 100 QOR. Key registration completed Nov 15 01:13 WAT, verified live: ML-DSA-87 key registered true, sequence 2, balance 99.85 QOR, PQC account found true, algorithm dilithium5, key type hybrid, possession proven true, created at height 10102839. The live guard contract is deployed at 0x5f2024c7802d656334d3e5a7315516eae2ae8cb6, and the live buy, block and resume flow is complete, see Live testnet proof above.</p>
        <div className="chips">
          <span className="chip chipOk">Balance: 99.85 QOR</span>
          <span className="chip chipOk">ML-DSA-87 key: registered</span>
          <span className="chip chipOk">Contract: deployed</span>
          <span className="chip chipOk">Live flow: complete</span>
        </div>
        <label className="field">
          QoreX wallet address
          <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Paste Five QoreX address here" />
        </label>
        <p className="walletLine">{wallet.trim() ? "Wallet on file in this browser session: " + wallet.trim() : "No wallet address entered yet"}</p>
        <button onClick={loadBalance} disabled={sdkLoading}>Read testnet balance with the QoreChain SDK</button>
        {balances && <p className="ok">{balances}</p>}
        {sdkError && <p className="error" role="alert">{sdkError}</p>}
        <p className="muted">Network: {client.network.name} (chain {client.network.chainId ?? "n/a"}). REST: {REST_URL}. Faucet: dashboard.qorechain.io/faucet, fUSD, fETH and fBTC once every 24 hours. The MCP server and the qore CLI never sign or broadcast, and the AI precompiles for risk score and anomaly check are not active, so this guard uses plain rules in code.</p>
      </section>

      <footer className="endCard">
        <span className="endMark">DG</span>
        <p className="endName">DCA GUARD</p>
        <p className="endTagline">
          {taglineWords.map((word, i) => (
            <span key={word + i} className={i < 3 ? "endWord" : "endWord accent"} style={{ animationDelay: i * 0.12 + "s" }}>
              {word}
            </span>
          ))}
        </p>
        <p className="footerNote">Demo mode. Buys here are simulated, no live transaction is sent from this page. Testnet only, no real money. Live guard contract 0x5f2024c7802d656334d3e5a7315516eae2ae8cb6, deployed, live flow complete.</p>
      </footer>
    </main>
  );
}
