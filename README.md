# Ajo Continuity Agent

**An agent that keeps an informal savings group's agreement intact — handles routine work on its own, and knows exactly when to stop and hand a decision to a human.**

Built for the AWS Agents for Humans Hackathon · Good Neighbor Agents track

![Architecture](./architecture-diagram.png)

---

## The problem

Ajo — also called esusu, susu, or a tontine — is an informal rotating savings
group. A fixed group of people contribute a fixed amount on a schedule, and
take turns receiving the payout. It's one of the oldest financial coordination
systems in the world, and it runs entirely on trust and someone's memory:
who paid, who's late, and what happens when the evidence doesn't add up.

The hard part was never collecting payments. It's the exceptions: a member
forgets, a member claims they paid and the group has no way to verify it, or
the payment evidence itself conflicts with the group's records. Someone has
to investigate, and someone has to decide — and that person is usually doing
it from memory, under social pressure, with no paper trail.

## What it does

1. **Observes** the group's real state — who owes what, and when it's due.
2. **Checks the group's rules** — deterministically, not by asking a model to guess.
3. **Handles routine problems on its own** — reminders for overdue contributions, verified payments recorded automatically.
4. **Verifies submitted evidence** against the group's actual registered payment details.
5. **Stops the moment evidence conflicts** — it does not guess who's right.
6. **Escalates genuine exceptions to a human**, with the evidence laid out plainly.
7. **Records every consequential action** as a tamper-evident, auditable receipt.

The story in one line: **routine → exception → evidence → decision → receipt.** AI handles the routine work. A human owns every exception.

## Why this is safe by design, not just by prompt

Most of what makes this trustworthy isn't a system prompt telling the model
to be careful — it's structural:

- **The database is the only source of truth.** The agent never writes a
  financial record directly. It calls a tool; the tool calls deterministic
  application code; the application code writes the row. Dates, overdue
  calculations, and evidence matching are plain Python, not LLM output.
- **Irreversible actions are gated at the framework level.** Resolving a
  dispute and recording a payment both run through Strands' own
  `HumanInTheLoop` intervention handler — verified directly, independent of
  whether the model even chooses to call them, that it actually blocks
  execution and waits for a human.
- **Every autonomous action leaves a hash-chained receipt.** Not a
  blockchain — a simple tamper-evident log where each receipt's hash covers
  its own content plus the previous receipt's hash. Tested by actually
  mutating a stored receipt and confirming the chain catches it.
- **Two real human-decision paths, neither of which bypasses the backend.**
  An admin can directly confirm/reject a dispute from the UI (their click
  *is* the human decision), or the agent can attempt a gated action itself
  and have Strands pause the run until a human responds.

## Tech stack

- **Agent:** Strands Agents SDK, running on Amazon Bedrock (Claude Sonnet 4)
- **Backend:** FastAPI + SQLAlchemy, SQLite by default (swaps to Postgres with one env var)
- **Frontend:** Next.js, TypeScript, Tailwind
- **Audit trail:** custom hash-chain implementation over the action log

## Getting started

### Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
copy .env.example .env
```

Fill in `.env`: enable a Claude model under AWS Console → Bedrock → Model
access, add your AWS credentials, set `BEDROCK_MODEL_ID`. See
`backend/.env.example` for currently active model IDs and a note on the
`us.` cross-region-inference prefix Bedrock requires for newer models.

```powershell
python -m app.seed
python -m app.run_server
```

API docs at `http://localhost:8000/docs`. Full details, including what's
been verified and how, in `backend/README.md`.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Requires the backend running at
`http://localhost:8000` (configurable via `NEXT_PUBLIC_API_BASE_URL`). Full
details in `frontend/README.md`.

## Demo Mode

The app ships with a seeded demo group (**Udo Ajo Circle** — 12 members,
₦20,000/week, 48-hour grace period — all fictional data, clearly labeled as
a demo environment). Demo Mode triggers the real backend, not a scripted
animation:

- **Missed payment** — routine overdue detection and reminder
- **Member claims payment** — a claim with no evidence, agent asks for proof
- **Valid evidence** — evidence matching group records, agent proposes recording the payment and pauses for human approval
- **Conflicting evidence** — evidence that doesn't match, agent creates a dispute for human review
- **Resolve dispute** — routes to the Disputes screen for the human decision
- **Reset demo** — wipes and reseeds everything

## What's verified vs. known gaps

Everything above the "known gaps" line has been tested by actually running
it — live against Bedrock, not just written and assumed correct:

- All three core demo scenarios run end-to-end against a real model
- The `HumanInTheLoop` gate tested directly (independent of model behavior) —
  confirmed it blocks `resolve_dispute` and `record_payment` and nothing else
- The hash chain tested by tampering with a stored receipt and confirming detection
- The full HTTP path — frontend → FastAPI → agent → Bedrock → tools → receipt — proven live

Known gaps: no mobile layout, the segmented week-progress visual from the
original design isn't built, and visual fidelity to the design mockups
hasn't been checked against a live render in this environment. Full detail
in `frontend/README.md`.

## License

MIT
