# Ajo Continuity Agent — Backend

Rotating-savings (ajo/esusu) group coordination agent built on the real
Strands Agents SDK. The database is the source of truth; the agent never
writes financial records directly — it calls tools, and tools call
deterministic domain logic (`app/domain/`).

## Status (honest, as of this build)

**Built and verified by direct execution (no live LLM needed for this part):**
- Full SQLAlchemy schema (`app/models.py`) — Group, Member, Contribution,
  Payment, Dispute, ActionReceipt
- Deterministic overdue calculation (`app/domain/overdue.py`)
- Deterministic evidence-conflict detection (`app/domain/disputes.py`)
- Hash-chained action receipts with tamper detection
  (`app/domain/receipts.py`) — verified by actually mutating a stored
  receipt and confirming `verify_chain()` catches it
- All 11 Strands tools (`app/agent/tools.py`), each run directly against
  the seeded demo data and confirmed to produce the exact outputs the
  three demo scenarios need
- Strands `Agent` assembly with system prompt, `structured_output_model`,
  and an `InterventionHandler` that gates `resolve_dispute` and
  `record_payment` behind human confirmation at the framework level
  (`app/agent/intervention.py`) — built and verified against the real
  Strands SDK's actual class signatures (`BeforeToolCallEvent`,
  `Confirm`/`Deny`/`Proceed`), not guessed from memory

**Not yet run end-to-end:** the full agent loop (model reasoning → tool
selection → intervention gate → structured decision output) has not been
executed against a live model in this environment, because no AWS Bedrock
access was available in the sandbox this was built in. Everything up to
that boundary — every tool, every domain rule, the intervention handler's
logic — is real code verified against the real SDK, not a mock. The one
untested step is the model actually choosing to call these tools in the
right order, which you should confirm as your first step once your Bedrock
model access is approved. See "First run" below.

**Not yet built:** Next.js frontend, seed data for the full 12-member
disputed/resolved-dispute variety described in the spec (current seed
covers the three critical demo scenarios only).

## API

FastAPI layer built and tested (via FastAPI's TestClient — real requests
through real routes, not mocked):
- `GET /groups/{id}`, `/groups/{id}/members`, `/groups/{id}/contributions`,
  `/groups/{id}/disputes`, `/groups/{id}/receipts` — the five UI views
- `GET /contributions/{id}` — single contribution + live overdue check
- `POST /demo/submit-evidence` — deterministic evidence evaluation (Demo Mode button)
- `POST /demo/run-agent-check` — the one endpoint that actually invokes the
  Strands agent; everything else manipulates state directly so you don't
  burn model calls setting up a scenario
- `POST /demo/resume-run` — resumes a paused agent run after an interrupt
  (agent itself attempted a gated tool)
- `POST /disputes/{id}/resolve` — direct human-admin resolution, bypasses
  the agent entirely (a human clicking Approve IS the human decision the
  intervention gate is waiting for, not something that itself needs gating)
- `POST /demo/reset` — wipes and reseeds Udo Ajo Circle

Run it:
```powershell
python -m app.run_server
```
Then open http://localhost:8000/docs for interactive API docs.

**Known simplification:** `/demo/resume-run` keeps paused agent runs in an
in-memory dict keyed by run_id. Fine for a single-process demo; a real
deployment would persist via Strands' session snapshot mechanism instead.

## Setup

```bash
python -m venv venv
venv\Scripts\activate.bat        REM Windows cmd.exe
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` with real values. The app loads it automatically (via
`app/__init__.py`) — no need to `set` variables by hand in every session.

**Model backend — use Bedrock, not a paid API key:**
1. In the AWS console: Bedrock → Model access → enable a Claude model.
   Approval can take anywhere from instant to a few hours, so do this
   first, before anything else.
2. The hackathon gives participants $50 in AWS credits — apply those to
   the account you're using before this costs you anything out of pocket.
3. Fill in `BEDROCK_MODEL_ID` + your AWS credentials in `.env`.

The `ANTHROPIC_API_KEY` fallback in `.env.example` exists only in case you
ever want to test locally against Claude directly — Anthropic's API is
paid per token, so skip it entirely and go straight to Bedrock. The agent
never looks at that variable when `BEDROCK_MODEL_ID` is set.

## First run

```powershell
cd backend
python -m app.seed
```

Run it as a module (`-m app.seed`) from inside `backend/`, not by executing
the `.py` file directly — `-m` automatically adds your current directory to
Python's import path, which is what lets `from app.db import ...` resolve.
Running the file by its path only puts `app/` itself on the path, not its
parent, and you'll get `ModuleNotFoundError: No module named 'app'`.

This prints the group ID, member IDs, and the overdue contribution ID
you'll use to drive the demo scenarios, plus the exact tool-call
parameters for the conflicting-evidence scenario.

Then, with `.env` filled in (Bedrock model access approved, credentials set):

```powershell
python -m app.dev_test_live con_ebd82e30f4    # use YOUR contribution_id from seed output
```

Strands prints tool calls and model output live as they happen (the SDK's
default `PrintingCallbackHandler`) — no extra code needed to see the
sequence. Watch for: does it call `calculate_overdue_status` before
concluding anything, does it call `send_reminder` only if that came back
`is_overdue=True`, does it call `create_action_receipt` afterward, and does
the final `structured_output` block have all five fields populated.

## Why SQLite, not Postgres/Supabase

So a judge can clone the repo and run it with zero external accounts or
Docker. The schema is plain SQLAlchemy ORM — swap `DATABASE_URL` to a
Postgres connection string and nothing else changes.

## Architecture

```
Member message / event
        |
   Strands Agent (system prompt + tools)
        |
   InterventionHandler.before_tool_call
        |  (Confirm required for resolve_dispute, record_payment)
        v
   Tool call (app/agent/tools.py)
        |
   Deterministic domain logic (app/domain/*)
        |
   SQLite/Postgres (source of truth)
        |
   create_action_receipt -> hash-chained, inspectable log
```
