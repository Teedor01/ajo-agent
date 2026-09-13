from __future__ import annotations

import hashlib
import json


def compute_receipt_hash(
    *,
    receipt_id: str,
    sequence_number: int,
    action: str,
    facts: str,
    rule_applied: str,
    decision: str,
    prev_hash: str | None,
) -> str:
    payload = {
        "id": receipt_id,
        "seq": sequence_number,
        "action": action,
        "facts": facts,
        "rule": rule_applied,
        "decision": decision,
        "prev_hash": prev_hash or "",
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def verify_chain(receipts: list[dict]) -> tuple[bool, str | None]:
    """receipts must be pre-sorted by sequence_number ascending.
    Returns (is_valid, first_broken_receipt_id_or_None)."""
    prev_hash = None
    for r in receipts:
        expected = compute_receipt_hash(
            receipt_id=r["id"],
            sequence_number=r["sequence_number"],
            action=r["action"],
            facts=r["facts"],
            rule_applied=r["rule_applied"],
            decision=r["decision"],
            prev_hash=prev_hash,
        )
        if expected != r["hash"]:
            return False, r["id"]
        prev_hash = r["hash"]
    return True, None
