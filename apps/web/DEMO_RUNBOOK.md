# NDL Demo Runbook

This checklist keeps the graduation demo deterministic and avoids mixing the
local demo lifecycle with an unstable backend or wallet session.

## Environment

1. Run the app from a terminal that has a native Node.js runtime available in
   the same environment as the project files.
2. Avoid running `next build` with Windows Node directly over the WSL UNC path.
   That path can make webpack fail to resolve Next.js internal loaders.
3. Preferred local checks before demo:

```bash
cd /home/luong/GR2_project
npm run build
cd apps/web
npm run dev
```

If Node is not installed inside WSL, install/use Node there before the final
demo rehearsal. A Windows Node executable can run `tsc`, but it is not reliable
for a Next.js production build over `\\wsl.localhost`.

## Demo Reset

1. Open the app.
2. Use the Wallet Debug panel.
3. Click `Reset demo session`.
4. Confirm the panel shows `0 pos / 0 ord / 0 alert`.

Demo state is scoped by wallet address. Without a wallet it uses the `guest`
scope.

## Data Prep

Run this before the final rehearsal after MongoDB is available:

```bash
cd /home/luong/GR2_project
npm run demo:prepare-data
```

The command runs a fast 24h-focused token price backfill, then runs proposal
backtest with no artificial delay. It is intended for demo readiness, not for a
full historical research backfill.

Equivalent manual commands:

```bash
npm run demo:backfill-prices
npm run demo:backtest
```

## Golden Path

1. Open `/overview`.d co
2. If the backend is unavailable, verify the amber demo-mode banner is visible.
3. Open `/signals`.
4. Pick the SOL ready signal and open its proposal.
5. On the proposal page, explain:
   - Layer 2 quant evidence.
   - Layer 3 AI explanation.
   - Backtest replay.
   - Risk sizing.
   - Decision blockers.
6. Click `ENTER BUY demo`.
7. Wait for the local demo order to fill and navigate to `/positions`.
8. Open `Quan ly rui ro` for the new position.
9. Navigate to `/alerts` and show the lifecycle alert/risk interrupt.
10. Return to the proposal and show the Audit Trail Preview.

## Expected Framing

- Local demo execution is the source of truth for the graduation workflow.
- Backend sync is best-effort and only enriches audit persistence when wallet
  and database are available.
- No mainnet Solana transaction is claimed or required.
