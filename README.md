A DCA bot keeps buying with no pause in a crash.

## Live testnet status, Nov 15 2026

LIVE, complete. Contract DcaGuard 0x5f2024c7802d656334d3e5a7315516eae2ae8cb6, on testnet qorechain-diana, EVM chain 9800. Deploy tx 0x33ae91e83b2a13162cfc372b702903973fd0b5d49fcb5719cfbea1c78ca4fd77, block 10106990, status success, gas 1,117,492. Buy 25 fUSD tx 0xa4fe1a2a792d13d82077bb327d782452cabd01cd95721a5170425999ca0991e1, block 10107048, success, buysExecuted 1, totalSpent 25,000,000, which is 25 fUSD. Buy over limit 50 fUSD tx 0x3f22f4517da9f8de2e322112fe99a64c192ce3602487cb31d466dd8af8afd79f, block 10107063, success as a transaction but blocked as designed, buys stayed 1, totalSpent stayed 25,000,000, agent paused. Resume tx 0xfee83d5d1c3a6d5451208025e5b3d435e71100b56b1c50a64e004ea31b575f1d, block 10107076, success, setPaused(false, manual resume after blocked buy), paused false again. Limits: max buy 25 fUSD, max total 100 fUSD, max 4 buys, window 24 hours, fUSD 0x97143B771D34ddb9130b807b135Ae675A5a963CA allowlisted. Live demo: https://dca-guard.vercel.app

# DCA Guard

## How it works

DCA Guard is an autonomous DCA agent for QoreChain testnet, in the Advanced AI Agents category. You set a schedule and limits first: a scoped EVM window with a start and end time, a per buy value limit, a total spend cap, a maximum number of buys, and an allowlist of targets. The agent then runs one scheduled DCA check at a time. Every buy request carries a signed demo message, and the guard verifies that message before any other check. The guard checks, in order: is the agent paused, is the message authentic, is now inside the scoped window, is the window within the duration limit, is the target allowlisted, is the value inside the per buy limit, is the total spend inside the cap, and is the buy count inside the maximum. A buy that passes every check executes in demo mode and is logged. A buy that fails any check is blocked, logged, and the agent pauses. A paused agent stays paused until you resume it by hand.

The agent logic is plain, testable rules in code, in `src/agent/dcaEngine.ts`. There is no live AI model call in this project. The AI precompiles for risk score and anomaly check are not active, and this project does not claim to use them.

## What it does

* Set a DCA schedule and limits in the guard dashboard
* Run one scheduled DCA check in demo mode
* Execute one buy inside the limits, simulated, with no chain transaction sent
* Show a buy outside the limits being blocked and the agent pausing
* Test the three block paths by hand: buy over the value limit, buy outside the scoped window, buy to a target that is not allowlisted
* Read a testnet balance with the QoreChain SDK once a QoreX wallet address is pasted in
* Keep a reference guard contract in `contracts/DcaGuard.sol`, with the same window, value, total, count, allowlist and pause rules

## How to run it

Prerequisites: Node.js 20 or newer, and npm.

```text
npm install
npm test
npm run build
npm run dev
```

Then open http://localhost:5173 in a browser. The app starts in demo mode, with a 25 fUSD max buy, a 100 fUSD total cap, 4 max buys, and a 24 hour window that started one hour ago.

Demo flow in the app:

1. Leave the defaults, press Run scheduled DCA check, and watch one 25 fUSD buy execute inside the limits.
2. Press Try buy over limit, and watch the buy get blocked and the agent pause.
3. Press Resume agent, then Try buy outside window, and watch that buy get blocked and the agent pause.
4. Press Resume agent, then Try buy to unknown target, and watch that buy get blocked and the agent pause.

## Which QoreChain kits it uses

* Starter: `create-qorechain-dapp` 0.14.0, fullstack-web template, Vite plus React plus TypeScript. The plain `npx` download failed to extract in this VM, so the 0.14.0 tarball was downloaded and extracted by hand, and its CLI was run directly. The scaffold it produced is the base of this project.
* SDK: `@qorechain/sdk` 0.14.0, used with `createClient` on testnet to read balances. The app creates one client for its lifetime.
* MCP server: `@qorechain/mcp` 0.1.0, run as `npx -y @qorechain/mcp 0.1.0`. It gives read access to QoreChain over stdio or HTTP. It never signs or broadcasts, and this project does not claim it does.
* CLI: `@qorechain/qore-cli` 0.1.0, run as `npx -y @qorechain/qore-cli 0.1.0`. It reads chain info, blocks, accounts and fee estimates from the terminal. It never signs or broadcasts, and this project does not claim it does.
* Docs: docs.qorechain.io, SDK quickstart at docs.qorechain.io/sdk/quickstart, tutorials at docs.qorechain.io/build-before-qday.

## Chain, tokens and addresses

* Network: testnet qorechain-diana
* EVM chain id: 9800
* Faucet: dashboard.qorechain.io/faucet, fest tokens fUSD, fETH and fBTC once every 24 hours
* QoreX wallet address: qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u (Native) and 0xB5b7328A3981431BE72bF1282c0F08A7905fC827 (EVM form, same identity). Verified live Nov 15 with qore-cli on testnet qorechain-diana chain 9800: fresh account at first check, exists false, balances empty, 0 QOR, staked 0 QOR, ML-DSA-87 key not registered yet. Faucet claimed Nov 15 01:00 WAT: exists true, account number 15585, sequence 0, 100 QOR. Key registration completed Nov 15 01:13 WAT, verified live: ML-DSA-87 key registered true, sequence 2, balance 99.85 QOR, PQC account found true, algorithm dilithium5, key type hybrid, possession proven true, created at height 10102839. The EVM window was opened on the coin 60 account, used 12 of 20 as of about 03:00 WAT, 8 left, expiry height 10111245. The live deploy and buy are done, see Live testnet status, Nov 15 2026 above.
* Testnet contract address: 0x5f2024c7802d656334d3e5a7315516eae2ae8cb6, DcaGuard, deployed on testnet, see Live testnet status, Nov 15 2026 above. The reference contract is `contracts/DcaGuard.sol`, not audited.
* Demo allowlist entry, demo only, not a live contract: 0x1111111111111111111111111111111111111111

## Live step, done

The live deploy and buy are done, see Live testnet status, Nov 15 2026 above. The app still runs in demo mode, and the demo label is shown in the UI. Testnet only, no real money.

## Tests

```text
npm test
```

The suite has 11 tests in `tests/dcaEngine.test.ts`, covering: buy inside limits passes, buy at the exact value limit passes, buy over the value limit is blocked, buy outside the scoped window is blocked, buy to a non allowlisted target is blocked, buy with a bad auth tag is blocked, buy over the total spend limit is blocked, window longer than the duration limit is blocked, agent pauses after a blocked buy, paused agent can be resumed and then buys again, and manual pause blocks buys.

## Style

Near black with one bright amber accent, guard dashboard, bold numbers for caps and limits, clear paused versus active states. Framer Marketplace free templates were used only as inspiration for layout, type, spacing and components. No paid template was bought. CoinDash, free, dark DeFi dashboard, inspired the dashboard mockup hero, the three problem cards, the stat band and the live feed feel, adapted to the guard amber accent on near black. Baheet motion is applied in the app, no video: one giant bold hero number per screen in amber, numbers roll with blur then snap sharp and hold, a confirmation pill slides up when a buy executes and a blocked pill when a buy is blocked and the agent pauses, and the end card mark plus name plus tagline appear word by word. No synthesized sound, no faked results, demo mode clearly labelled.

## License

MIT, see LICENSE.
