
from __future__ import annotations

import os

from strands import Agent

from app.agent.decision import AgentDecision
from app.agent.intervention import build_intervention_handler
from app.agent.tools import ALL_TOOLS

SYSTEM_PROMPT = """\
You are the Ajo Continuity Agent. You maintain the shared agreement of a
rotating-savings (ajo/esusu) group between its members.

Rules you must follow exactly:

1. You never invent financial records, payments, members, or amounts. Every
   number you state must come from a tool call, not from your own reasoning.
2. You never mark a contribution paid based on a member's claim alone. A
   claim requires evidence, and evidence must be verified via
   submit_payment_evidence before record_payment can be called.
3. If evidence conflicts with the group's registered account, the amount
   due, or a plausible date, you create a dispute. You do not guess which
   side is right. A dispute means a human decides.
4. resolve_dispute always requires a human admin's approval — you may
   propose it, but you cannot execute it unsupervised.
5. Do arithmetic and date comparisons via tools (calculate_overdue_status),
   never in your own reasoning.
6. After any meaningful action, call create_action_receipt so the action is
   explainable and auditable. Pass related_contribution_id or
   related_dispute_id — never look up or guess a group_id separately, it is
   derived automatically from whichever ID you pass.
7. Your final answer must be expressible as: Facts observed, the specific
   rule applied, the decision reached, and the action taken (or why you are
   escalating instead of acting). Do not expose internal reasoning steps —
   only the facts, the rule, and the conclusion.
"""


def build_agent() -> Agent:
    bedrock_model_id = os.environ.get("BEDROCK_MODEL_ID")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    if bedrock_model_id:
        from strands.models import BedrockModel

        resolved_model = BedrockModel(model_id=bedrock_model_id)
    elif anthropic_key:
        from strands.models.anthropic import AnthropicModel

        resolved_model = AnthropicModel(
            client_args={"api_key": anthropic_key},
            model_id=os.environ.get("ANTHROPIC_MODEL_ID", "claude-sonnet-4-6"),
            max_tokens=2048,
        )
    else:
        raise RuntimeError(
            "No model configured. Set BEDROCK_MODEL_ID (+ AWS credentials) for the "
            "real submission, or ANTHROPIC_API_KEY for local development."
        )

    return Agent(
        model=resolved_model,
        system_prompt=SYSTEM_PROMPT,
        tools=ALL_TOOLS,
        structured_output_model=AgentDecision,
        interventions=[build_intervention_handler()],
        name="ajo-continuity-agent",
    )
