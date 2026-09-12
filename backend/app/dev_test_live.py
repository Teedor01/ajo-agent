from __future__ import annotations

import sys

from app.agent.agent import build_agent


def run(contribution_id: str) -> None:
    agent = build_agent()

    prompt = (
        f"A member is asking whether their contribution (id {contribution_id}) "
        "is overdue. Check the real status and take whatever action is "
        "appropriate given your rules, then explain your decision."
    )

    print(f"--- Sending prompt ---\n{prompt}\n")
    result = agent(prompt)

    print("\n--- Raw agent result ---")
    print(result)

    print("\n--- Structured decision (facts / rule / decision / action) ---")
    if result.structured_output is not None:
        print(result.structured_output)
    else:
        print(
            "(structured_output is None... the model may not have produced a "
            "final answer in the format AgentDecision expects. This itself is "
            "useful signal: check the raw result above for what happened.)"
        )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m app.dev_test_live <contribution_id>")
        sys.exit(1)
    run(sys.argv[1])
