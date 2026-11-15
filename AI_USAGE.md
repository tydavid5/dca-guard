# AI Usage, DCA Guard

## Agent used

Muse, called Little 5, Meta's personal AI agent. It worked from the brief and concept pick of the human builder, Five (Taiwo John), in a chat session on Nov 14 to 15, 2026.

## Workflow

1. Five picked the concept, AA-B DCA Guard, and the Advanced AI Agents category.
2. Little 5 scaffolded the guard contract, the demo app, the test suite and the docs, and ran the tests locally.
3. Five did every wallet and chain step himself through MetaMask on the deploy page: contract deploy, one in-limit buy, one over-limit buy, and the manual resume.
4. Little 5 verified each step on chain from the public EVM RPC and explorer, then wrote the live status into the README and build report.
5. Five approved the demo video narration and the final submission.

## What the AI generated

- The DcaGuard Solidity contract, with max buy, max total, max buys and window limits, and the self pause on a blocked buy.
- The demo web app (Vite, TypeScript, React).
- The test suite, 11 tests, all passing.
- The deploy helper scripts and the deploy page used to coordinate the live steps.
- The README, BUILD-REPORT and STORYBOARD drafts, and the narration script for the demo video.

## Human contribution

- The concept, the category choice and every design decision, including the limits: max buy 25 fUSD, max total 100 fUSD, max 4 buys, window 24 hours.
- All signing: the deploy and all four live steps were sent by Five in MetaMask. Contract 0x5f2024c7802d656334d3e5a7315516eae2ae8cb6, deploy tx 0x33ae91e83b2a13162cfc372b702903973fd0b5d49fcb5719cfbea1c78ca4fd77, buy 25 fUSD tx 0xa4fe1a2a792d13d82077bb327d782452cabd01cd95721a5170425999ca0991e1, over-limit 50 fUSD buy blocked as designed, resume tx 0xfee83d5d1c3a6d5451208025e5b3d435e71100b56b1c50a64e004ea31b575f1d.
- Key management and the faucet claim.
- Approval of the demo video and of the final submission.

## Verification

No contract address, transaction hash or limit in this repo was invented. Every live step was read back from the QoreChain testnet by the agent and is checkable on the explorer.
