# DCA Guard demo video storyboard

True screencast, demo mode labelled on screen in every beat, no faked results, no video recorded yet.

## Beat 1, about 3 seconds, problem first

On screen: the guard dashboard, near black with amber, status ACTIVE, with the line "A DCA bot keeps buying with no pause in a crash." in large type.
Claim: a DCA bot keeps buying with no pause in a crash.
Sound: none recorded, use the live screen only.

## Beat 2, about 3 seconds, the limits

On screen: the guard limits panel, bold numbers, max buy 25 fUSD, total cap 100 fUSD, max buys 4, window 24 hours, allowlisted demo target shown.
Claim: DCA Guard buys only inside a scoped window, with value and target limits.
Sound: none recorded, use the live screen only.

## Beat 3, about 3 seconds, one buy inside the limits

On screen: press Run scheduled DCA check, one 25 fUSD buy executes, buys executed changes to 1, total spent changes to 25 fUSD, status stays ACTIVE, DEMO MODE label visible.
Claim: one scheduled check, one buy inside the limits.
Sound: none recorded, use the live screen only.

## Beat 4, about 3 seconds, one buy blocked

On screen: press Try buy over limit, the 35 fUSD buy is blocked with OVER_VALUE_LIMIT, blocked buys changes to 1, status flips to PAUSED in red.
Claim: a buy outside the limits is blocked, and the agent pauses.
Sound: none recorded, use the live screen only.

## Beat 5, about 3 seconds, resume and the ask

On screen: press Resume agent, status flips back to ACTIVE, then the wallet panel showing Five QoreX address qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u and the demo mode label.
Claim: resume it by hand, live testnet buys wait for fUSD from the faucet and a deployed guard contract for Five QoreX address qor1kkmn9z3es9p3heet7y5zcrcg57g9ljp8909r5u. ML-DSA-87 key registration is done, balance 99.85 QOR, EVM window still false.
Sound: none recorded, use the live screen only.
