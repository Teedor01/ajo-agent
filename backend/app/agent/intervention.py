from __future__ import annotations

from strands.vended_interventions.hitl import HumanInTheLoop


def build_intervention_handler() -> HumanInTheLoop:
    return HumanInTheLoop(allowed_tools=["*", "!resolve_dispute", "!record_payment"])
