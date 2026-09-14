
from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.agent.agent import build_agent
from app.agent.tools import (
    calculate_overdue_status,
    create_dispute,
    get_contribution_status,
    get_group,
    get_members,
    record_payment,
    resolve_dispute,
    send_reminder,
    submit_payment_evidence,
)
from app.queries import (
    get_dispute_detail,
    get_group_overview,
    list_contributions,
    list_disputes,
    list_groups,
    list_receipts,
)
from app.schemas import (
    ResolveDisputeRequest,
    ResumeRunRequest,
    RunAgentCheckRequest,
    SubmitEvidenceRequest,
)

app = FastAPI(title="Ajo Continuity Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "https://ajo-continuity-agent.vercel.app",
],  
    allow_methods=["*"],
    allow_headers=["*"],
)


_PAUSED_RUNS: dict[str, dict] = {}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}




@app.get("/groups")
def read_groups() -> list[dict]:
    """List every seeded group with its id -- the starting point for finding
    the IDs everything else needs. Nothing else in this API can discover a
    group_id from scratch, so start here."""
    return list_groups()


@app.get("/groups/{group_id}")
def read_group(group_id: str) -> dict:
    result = get_group_overview(group_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@app.get("/groups/{group_id}/members")
def read_members(group_id: str) -> list[dict]:
    return get_members(group_id)



@app.get("/groups/{group_id}/contributions")
def read_contributions(group_id: str) -> list[dict]:
    return list_contributions(group_id)


@app.get("/contributions/{contribution_id}")
def read_contribution(contribution_id: str) -> dict:
    result = get_contribution_status(contribution_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    result["overdue_check"] = calculate_overdue_status(contribution_id)
    return result




@app.get("/groups/{group_id}/disputes")
def read_disputes(group_id: str) -> list[dict]:
    return list_disputes(group_id)


@app.get("/disputes/{dispute_id}")
def read_dispute(dispute_id: str) -> dict:
    result = get_dispute_detail(dispute_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@app.post("/disputes/{dispute_id}/resolve")
def resolve_dispute_endpoint(dispute_id: str, body: ResolveDisputeRequest) -> dict:
    """A human admin's direct decision -- calls the tool function directly,
    not through the agent. See module docstring."""
    result = resolve_dispute(
        dispute_id=dispute_id,
        resolved_by_member_id=body.resolved_by_member_id,
        accept_payment=body.accept_payment,
        resolution_note=body.resolution_note,
    )
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result



@app.get("/groups/{group_id}/receipts")
def read_receipts(group_id: str) -> dict:
    return list_receipts(group_id)



@app.post("/demo/submit-evidence")
def demo_submit_evidence(body: SubmitEvidenceRequest) -> dict:
    """Simulates a member submitting payment evidence -- e.g. the 'Submit
    valid payment evidence' / 'Submit conflicting payment evidence' demo
    buttons. Deterministic evaluation only; does not invoke the agent."""
    result = submit_payment_evidence(
        contribution_id=body.contribution_id,
        claimed_amount=body.claimed_amount,
        claimed_recipient_account=body.claimed_recipient_account,
        claimed_date_iso=body.claimed_date_iso,
        evidence_type=body.evidence_type,
        member_statement=body.member_statement,
    )
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result




@app.post("/demo/run-agent-check")
def demo_run_agent_check(body: RunAgentCheckRequest) -> dict:
    """This is the one endpoint that actually invokes the Strands agent.
    Everything else in Demo Mode manipulates state directly so the judge
    can set up a scenario without burning model calls; this button is where
    the real reasoning happens."""
    contribution = get_contribution_status(body.contribution_id)
    if "error" in contribution:
        raise HTTPException(404, contribution["error"])

    agent = build_agent()
    prompt = (
        f"Contribution id: {body.contribution_id}. Member message: "
        f"\"{body.member_message}\" Check the real status and take whatever "
        "action is appropriate given your rules, then explain your decision."
    )
    result = agent(prompt)

    response = {
        "structured_decision": result.structured_output.model_dump() if result.structured_output else None,
        "stop_reason": result.stop_reason,
        "interrupted": bool(result.interrupts),
    }

    if result.interrupts:
        run_id = str(uuid.uuid4())
        _PAUSED_RUNS[run_id] = {"agent": agent}
        response["run_id"] = run_id
        response["interrupts"] = [
            {"id": i.id, "name": i.name, "reason": i.reason} for i in result.interrupts
        ]

    return response


@app.post("/demo/resume-run")
def demo_resume_run(body: ResumeRunRequest) -> dict:
    """Resumes a paused agent run after a human approves/denies a gated tool
    call (e.g. the agent itself attempted resolve_dispute or record_payment,
    which is different from a human directly clicking Approve in the
    Disputes view -- see /disputes/{id}/resolve for that path)."""
    paused = _PAUSED_RUNS.get(body.run_id)
    if not paused:
        raise HTTPException(404, f"No paused run found for run_id {body.run_id}")

    from strands.types.interrupt import InterruptResponse, InterruptResponseContent

    agent = paused["agent"]
    response_content = [
        InterruptResponseContent(
            interruptResponse=InterruptResponse(interruptId=body.interrupt_id, response=body.approve)
        )
    ]
    result = agent(response_content)

    response = {
        "structured_decision": result.structured_output.model_dump() if result.structured_output else None,
        "stop_reason": result.stop_reason,
        "interrupted": bool(result.interrupts),
    }
    if not result.interrupts:
        _PAUSED_RUNS.pop(body.run_id, None)
    return response




@app.post("/demo/reset")
def demo_reset() -> dict:
    from app.db import engine
    from app.models import Base
    from app.seed import run as seed_run

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    _PAUSED_RUNS.clear()
    seed_run()
    return {"status": "reset complete"}
