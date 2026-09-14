# Ajo Continuity Agent — Backend

Rotating-savings (ajo/esusu) group coordination agent built with the Strands Agents SDK.

The database is the source of truth. The agent never writes financial records directly. It calls tools, which execute deterministic domain logic in `app/domain/`.

## Status

**Built and verified:**

* Full SQLAlchemy schema: Group, Member, Contribution, Payment, Dispute, ActionReceipt
* Deterministic overdue calculation in `app/domain/overdue.py`
* Deterministic evidence-conflict detection in `app/domain/disputes.py`
* Hash-chained action receipts with tamper detection in `app/domain/receipts.py`
* All 11 Strands tools tested directly against seeded demo data
* Strands `Agent` assembly with system prompt, structured output, and human intervention gates for `resolve_dispute` and `record_payment`
* Intervention handler verified against the real Strands SDK

**Not yet run end-to-end:**

The full agent loop, from model reasoning through tool selection, intervention, and structured output, has not been executed against a live model because AWS Bedrock access was unavailable in the build environment.

Everything before that boundary is real, executable code verified against the real SDK. The remaining step is validating the model's tool selection and reasoning once Bedrock access is available.


## API

FastAPI routes tested with real requests through FastAPI's `TestClient`:

* `GET /groups/{id}` and related member, contribution, dispute, and receipt views
* `GET /contributions/{id}` with live overdue evaluation
* `POST /demo/submit-evidence` for deterministic evidence evaluation
* `POST /demo/run-agent-check` to invoke the Strands agent
* `POST /demo/resume-run` to resume an interrupted agent run
* `POST /disputes/{id}/resolve` for direct human-admin resolution
* `POST /demo/reset` to reset and reseed Udo Ajo Circle

Run the server:

```powershell
python -m app.run_server
```

API docs:

`http://localhost:8000/docs`

**Demo limitation:** `/demo/resume-run` stores paused runs in memory. This is suitable for a single-process demo; production deployment would use persistent Strands session snapshots.

## Setup

```bash
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
copy .env.example .env
```

Configure `.env` with the required values.

### Model backend

The intended model backend is AWS Bedrock.

1. Enable a Claude model in AWS Bedrock Model Access.
2. Apply the hackathon's AWS credits to the account if applicable.
3. Configure `BEDROCK_MODEL_ID` and AWS credentials in `.env`.

`ANTHROPIC_API_KEY` is retained in `.env.example` only as an optional direct-Claude fallback. When `BEDROCK_MODEL_ID` is set, the agent uses Bedrock.

## First Run

Seed the demo database:

```powershell
cd backend
python -m app.seed
```

Run the module from `backend/` so Python resolves the `app` package correctly.

The seed command prints the group ID, member IDs, overdue contribution ID, and parameters needed for the demo scenarios.

With Bedrock access configured:

```powershell
python -m app.dev_test_live <contribution_id>
```

This runs the live Strands agent and prints tool calls and model output.

For the overdue scenario, verify that the agent:

1. Checks overdue status
2. Sends a reminder only when `is_overdue=True`
3. Creates an action receipt
4. Produces the expected structured output

## Why SQLite

SQLite keeps the demo self-contained, so judges can clone and run it without Docker or an external database.

The application uses standard SQLAlchemy ORM. `DATABASE_URL` can be changed to a Postgres connection string without changing the domain model.

## Architecture

```text
Member message / event
        |
   Strands Agent
   (prompt + tools)
        |
 InterventionHandler
        |
   Human confirmation
        |
     Tool call
 app/agent/tools.py
        |
 Deterministic domain logic
     app/domain/*
        |
 SQLite / Postgres
  source of truth
        |
 Action receipt
 hash-chained audit log
```
