# Ajo Continuity Agent | Frontend

Next.js + TypeScript + Tailwind CSS v4 console for the backend in `../ajo-continuity-agent/backend`.

## Setup

```powershell
npm install
npm run dev
```

Open http://localhost:3000. The backend must be running at http://localhost:8000.

Start it from the backend folder with:

```powershell
python -m app.run_server
```

If the backend is running elsewhere, set `NEXT_PUBLIC_API_BASE_URL` in `.env.local`.

## What's Verified

* `npm run build` is clean. All six routes statically prerender without runtime errors. React executes every component tree, including loading and error branches, during the build.
* `npx eslint .` is clean. One experimental rule is intentionally disabled and documented in `eslint.config.mjs`.
* Every API call in `lib/api.ts` matches a real, tested backend response shape. No response fields are guessed or fabricated.

**Not verified:** visual rendering against the provided mockups.

This environment has no browser or screenshot tool, so pixel-level fidelity to the design, including spacing, exact colors, and the segmented week-progress bar, has not been visually confirmed. Build, type, and API integration have been verified. Run the application and compare it against the mockups before final visual sign-off.

## Design/Backend Conflicts Resolved

Per Section 22 of the brief, design/backend conflicts are not silently resolved with fabricated frontend data. Where mockup elements lacked backend support, the implementation either added genuine backend data or substituted a truthful equivalent.

* **Evidence column** (Verified/Conflict/None) — Added `evidence_status`, derived from real `Payment.verified` values and open `Dispute` records.
* **Member column on Action Receipts** — Receipts stored only `related_contribution_id`. Added a real `member_name` lookup.
* **"Member Claim" on Disputes** — The original free-text statement was not persisted. Added `member_statement` to `Payment` and threaded it through `/demo/submit-evidence`. The UI omits the section when no statement exists.
* **"Ada Okafor" admin name** — There is no authentication system, so the UI displays the member actually marked `is_admin` in the seed data, rather than the mockup placeholder.
* **Agent Monitoring** — The backend has no background monitoring job; the agent runs when triggered through Demo Mode. Replaced "Last checked 2 minutes ago" with a genuine `/health` heartbeat polled every 30 seconds and labeled "API connected".
* **Upcoming Contributions** — The backend tracks only the current cycle and has no future-dated schedule. Replaced future dates with "Pending this cycle", based on real unpaid members.

## Known Gaps Against the Full Brief

* **Mobile views** — Not implemented. The provided design includes mobile mockups; the current frontend is desktop-focused.
* **Week progress bar** — The segmented contribution progress bar in the Group Overview mockup is not implemented. The overview uses stat cards and a table instead.
* **"Audit receipt" Demo Mode scenario** — Not implemented as a separate scripted scenario. The Action Receipts screen already functions as the audit trail, so an additional scenario would be redundant.
* **Reduced motion / keyboard focus** — Supported globally in `globals.css` through `prefers-reduced-motion` and `:focus-visible`, but no dedicated screen-reader or keyboard-only audit has been completed.

## Human-in-the-Loop Flows

Two distinct approval paths are implemented, and neither bypasses the backend.

1. **Disputes → Confirm/Reject payment** — A human administrator makes the decision directly through `POST /disputes/{id}/resolve`. The approval is an actual human action, not an agent decision.

2. **Demo Mode → "Valid evidence"** — When the agent attempts `record_payment`, Strands' `HumanInTheLoop` handler pauses execution. The interface displays the real pause reason and provides Approve/Deny controls connected to `POST /demo/resume-run`. The backend then resumes the actual paused agent run.

Both flows represent genuine human-in-the-loop controls rather than simulated approval interfaces.
