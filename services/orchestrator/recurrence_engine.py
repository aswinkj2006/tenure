"""
Tenure — Recurrence Intelligence Engine (xAI Attribution)
===========================================================

When the same fault pattern appears on a machine multiple times, this module
performs structured causal reasoning to determine:

  A) MACHINE_FAULT    — The hardware is genuinely degraded. No technician
                         could have permanently fixed it; the part needs
                         replacement or deeper overhaul.

  B) TECHNICIAN_SKILL_GAP — The repair was done incorrectly or incompletely
                         due to a mismatch between this technician's skill
                         profile and the specific fault requirements.

  C) AMBIGUOUS        — Insufficient evidence to distinguish. Recommend
                         a more senior engineer + part inspection in parallel.

  D) SYSTEMIC         — Same fault appearing across MULTIPLE machines.
                         Suggests a process-level, environment, or supply
                         chain issue, not machine or technician specific.

Every decision produces a REASONING CHAIN — a step-by-step trace of exactly
why the system reached its conclusion (xAI / explainability layer).

This is NOT a black-box ML classifier. Each step is a named, inspectable
rule with evidence attached, so judges and engineers can audit the logic.
"""

import json
import uuid
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from db.init_db import get_connection


# ──────────────────────────────────────────────────────────
# Evidence Thresholds (tunable, transparent)
# ──────────────────────────────────────────────────────────

MIN_RECURRENCES_FOR_ANALYSIS = 2      # Need at least 2 prior attempts
MULTI_TECH_MACHINE_FAULT_THRESHOLD = 2  # If ≥2 different techs failed → machine fault
SAME_TECH_SKILL_GAP_THRESHOLD = 2    # If same tech failed ≥2× → skill gap
SYSTEMIC_MACHINE_COUNT = 2           # Same fault on ≥2 machines → systemic
SENIOR_LEVELS = {"Expert", "Senior"}
CERT_WEIGHTS = {"Expert": 1.0, "Senior": 0.85, "L3": 0.65, "L2": 0.45, "L1": 0.25}


def _fault_signature(flagged_sensors: list[str]) -> str:
    """Canonical, sorted JSON string to use as a fault fingerprint."""
    return json.dumps(sorted(flagged_sensors))


def _build_step(
    step_num: int,
    label: str,
    finding: str,
    evidence: dict,
    verdict_contribution: str,
    confidence_delta: float,
) -> dict:
    """Build a single reasoning step for the xAI chain."""
    return {
        "step": step_num,
        "label": label,
        "finding": finding,
        "evidence": evidence,
        "verdict_contribution": verdict_contribution,  # 'machine_fault' | 'technician_skill_gap' | 'ambiguous' | 'systemic' | 'neutral'
        "confidence_delta": round(confidence_delta, 3),
    }


def _get_repair_history(machine_id: str, fault_sig: str) -> list[dict]:
    """
    Pull all repair_outcomes for this machine+fault_signature,
    joined with technician profiles.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ro.id, ro.dispatch_id, ro.technician_id, ro.outcome,
                   ro.recurrence_count, ro.created_at, ro.notes,
                   t.name, t.certification_level, t.specializations,
                   t.experience_years, t.success_rate
            FROM repair_outcomes ro
            JOIN technicians t ON ro.technician_id = t.id
            WHERE ro.machine_id = ? AND ro.fault_signature = ?
            ORDER BY ro.created_at ASC
        """, (machine_id, fault_sig))
        rows = cursor.fetchall()

    cols = ["id", "dispatch_id", "technician_id", "outcome", "recurrence_count",
            "created_at", "notes", "tech_name", "certification_level",
            "specializations", "experience_years", "success_rate"]
    return [dict(zip(cols, r)) for r in rows]


def _get_cross_machine_count(fault_sig: str, exclude_machine: str) -> int:
    """Count how many OTHER machines have had this same fault signature."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(DISTINCT machine_id)
            FROM repair_outcomes
            WHERE fault_signature = ? AND machine_id != ?
        """, (fault_sig, exclude_machine))
        row = cursor.fetchone()
    return row[0] if row else 0


def _get_tech_cross_fault_failures(technician_id: str) -> list[dict]:
    """
    Did this technician fail on OTHER fault types too?
    If yes, it's less likely to be a skill gap and more likely machine fault.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT fault_signature, COUNT(*) as failures
            FROM repair_outcomes
            WHERE technician_id = ? AND outcome IN ('recurred', 'partial')
            GROUP BY fault_signature
        """, (technician_id,))
        rows = cursor.fetchall()
    return [{"fault_signature": r[0], "failures": r[1]} for r in rows]


def _get_tech_global_success_rate(technician_id: str) -> float | None:
    """Compute technician's actual success rate from repair_outcomes."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                SUM(CASE WHEN outcome = 'resolved' THEN 1 ELSE 0 END) as successes,
                COUNT(*) as total
            FROM repair_outcomes WHERE technician_id = ?
        """, (technician_id,))
        row = cursor.fetchone()
    if row and row[1] and row[1] > 0:
        return round(row[0] / row[1], 3)
    return None


def analyze_recurrence(
    machine_id: str,
    anomaly_id: str,
    flagged_sensors: list[str],
    current_severity: str = "high",
    llm_client=None,
) -> dict:
    """
    Main entry point. Runs the full xAI reasoning pipeline.

    Returns a dict with:
      - attribution: 'machine_fault' | 'technician_skill_gap' | 'ambiguous' | 'systemic'
      - confidence: float 0–1
      - reasoning_chain: list of named reasoning steps
      - evidence: structured evidence dict
      - excluded_technicians: list of tech IDs to skip in re-dispatch
      - recommended_action: human-readable next step
      - smart_dispatch_notes: guidance for the dispatcher
    """
    fault_sig = _fault_signature(flagged_sensors)
    history = _get_repair_history(machine_id, fault_sig)
    recurrence_count = len(history)

    reasoning: list[dict] = []
    scores = {"machine_fault": 0.0, "technician_skill_gap": 0.0, "ambiguous": 0.0, "systemic": 0.0}
    excluded_tech_ids: list[str] = []
    evidence: dict = {}

    step = 1

    # ── STEP 1: Check if there's enough history to reason ────────────────
    reasoning.append(_build_step(
        step, "Recurrence Detection",
        f"Fault pattern {json.loads(fault_sig)} has triggered {recurrence_count} prior repair attempt(s) on {machine_id}.",
        {"recurrence_count": recurrence_count, "fault_signature": fault_sig, "machine_id": machine_id},
        "neutral",
        0.0,
    ))
    step += 1
    evidence["recurrence_count"] = recurrence_count
    evidence["fault_signature"] = fault_sig

    if recurrence_count < MIN_RECURRENCES_FOR_ANALYSIS:
        # Not enough data — return ambiguous with a note
        reasoning.append(_build_step(
            step, "Insufficient History",
            f"Only {recurrence_count} prior attempt(s) found. Need ≥{MIN_RECURRENCES_FOR_ANALYSIS} to perform reliable attribution. Treating as ambiguous until more data accumulates.",
            {"threshold": MIN_RECURRENCES_FOR_ANALYSIS},
            "ambiguous",
            0.5,
        ))
        return _finalize(
            machine_id, anomaly_id, fault_sig, recurrence_count,
            "ambiguous", 0.40, reasoning, evidence, [],
            "Dispatch best available technician. Flag for re-evaluation after next repair attempt.",
            "Insufficient recurrence history. Sending best-ranked technician. Monitor outcome carefully.",
            llm_client,
        )

    # ── STEP 2: Systemic cross-machine check ────────────────────────────
    other_machine_count = _get_cross_machine_count(fault_sig, machine_id)
    evidence["other_machines_affected"] = other_machine_count
    if other_machine_count >= SYSTEMIC_MACHINE_COUNT:
        scores["systemic"] += 0.60
        reasoning.append(_build_step(
            step,
            "Cross-Machine Systemic Pattern",
            f"This exact fault signature has appeared on {other_machine_count} other machine(s) in the fleet. "
            f"This strongly suggests an environmental, process, or supply-chain root cause — not isolated to this machine or any single technician.",
            {"other_machines_with_fault": other_machine_count, "threshold": SYSTEMIC_MACHINE_COUNT},
            "systemic",
            0.60,
        ))
    else:
        reasoning.append(_build_step(
            step,
            "Cross-Machine Check",
            f"This fault pattern is isolated to {machine_id} only (0 other machines affected). Systemic cause is unlikely.",
            {"other_machines_with_fault": other_machine_count},
            "neutral",
            0.0,
        ))
    step += 1

    # ── STEP 3: Count distinct technicians who failed ────────────────────
    failed_history = [h for h in history if h["outcome"] in ("recurred", "partial")]
    unique_failed_techs = {h["technician_id"] for h in failed_history}
    evidence["distinct_failed_technicians"] = len(unique_failed_techs)
    evidence["failed_technician_profiles"] = [
        {"id": h["technician_id"], "name": h["tech_name"], "cert": h["certification_level"], "outcome": h["outcome"]}
        for h in failed_history
    ]

    if len(unique_failed_techs) >= MULTI_TECH_MACHINE_FAULT_THRESHOLD:
        scores["machine_fault"] += 0.55
        tech_names = ", ".join(set(h["tech_name"] for h in failed_history))
        reasoning.append(_build_step(
            step,
            "Multi-Technician Failure Pattern",
            f"{len(unique_failed_techs)} distinct technician(s) ({tech_names}) have each attempted this repair and the fault recurred. "
            f"When multiple qualified engineers cannot resolve a fault, the underlying hardware is the primary suspect.",
            {"failed_techs": len(unique_failed_techs), "threshold": MULTI_TECH_MACHINE_FAULT_THRESHOLD, "names": tech_names},
            "machine_fault",
            0.55,
        ))
        excluded_tech_ids = list(unique_failed_techs)
    else:
        reasoning.append(_build_step(
            step,
            "Technician Diversity Check",
            f"Only {len(unique_failed_techs)} distinct technician(s) have attempted this repair. "
            f"Insufficient diversity to rule out technician-specific skill gap.",
            {"failed_techs": len(unique_failed_techs), "threshold": MULTI_TECH_MACHINE_FAULT_THRESHOLD},
            "neutral",
            0.0,
        ))
    step += 1

    # ── STEP 4: Same-technician repeated failure check ───────────────────
    tech_failure_counts = {}
    for h in failed_history:
        tid = h["technician_id"]
        tech_failure_counts[tid] = tech_failure_counts.get(tid, 0) + 1

    repeat_offenders = {tid: count for tid, count in tech_failure_counts.items() if count >= SAME_TECH_SKILL_GAP_THRESHOLD}
    evidence["repeat_technician_failures"] = repeat_offenders

    if repeat_offenders and len(unique_failed_techs) < MULTI_TECH_MACHINE_FAULT_THRESHOLD:
        scores["technician_skill_gap"] += 0.50
        bad_tech_names = [h["tech_name"] for h in failed_history if h["technician_id"] in repeat_offenders]
        reasoning.append(_build_step(
            step,
            "Repeated Single-Technician Failure",
            f"The same technician(s) ({', '.join(set(bad_tech_names))}) failed on this fault ≥{SAME_TECH_SKILL_GAP_THRESHOLD} times. "
            f"This suggests a skill or knowledge gap specific to this fault type, rather than an unresolvable hardware failure.",
            {"repeat_failures": repeat_offenders, "threshold": SAME_TECH_SKILL_GAP_THRESHOLD},
            "technician_skill_gap",
            0.50,
        ))
        excluded_tech_ids = list(repeat_offenders.keys())
    elif not repeat_offenders:
        reasoning.append(_build_step(
            step,
            "Single-Attempt Technician Check",
            "Each technician made only one attempt. Cannot yet attribute to individual skill gap — need more repeated attempts by the same engineer.",
            {"repeat_failures": repeat_offenders},
            "neutral",
            0.0,
        ))
    step += 1

    # ── STEP 5: Certification level analysis ─────────────────────────────
    highest_cert_attempted = max(
        (CERT_WEIGHTS.get(h["certification_level"], 0.25) for h in failed_history),
        default=0.0,
    )
    evidence["highest_cert_attempted"] = highest_cert_attempted
    senior_attempts = [h for h in failed_history if h["certification_level"] in SENIOR_LEVELS]

    if senior_attempts:
        scores["machine_fault"] += 0.30
        senior_names = ", ".join(set(h["tech_name"] for h in senior_attempts))
        reasoning.append(_build_step(
            step,
            "Senior Engineer Failure Analysis",
            f"Senior/Expert-level technician(s) ({senior_names}) attempted this repair and the fault recurred. "
            f"When top-tier engineers cannot resolve an issue, it strongly implies a hardware root cause beyond procedural correction.",
            {"senior_techs_failed": [h["tech_name"] for h in senior_attempts], "cert_weight": highest_cert_attempted},
            "machine_fault",
            0.30,
        ))
    else:
        scores["technician_skill_gap"] += 0.20
        reasoning.append(_build_step(
            step,
            "Certification Ceiling Analysis",
            f"No Senior or Expert engineers have attempted this fault yet. "
            f"A higher-certification technician has not been given the opportunity to succeed. Skill gap still plausible.",
            {"senior_attempts": 0, "highest_cert_weight": highest_cert_attempted},
            "technician_skill_gap",
            0.20,
        ))
    step += 1

    # ── STEP 6: Technician cross-fault failure rate ───────────────────────
    if unique_failed_techs:
        any_tech_id = next(iter(unique_failed_techs))
        global_rate = _get_tech_global_success_rate(any_tech_id)
        cross_failures = _get_tech_cross_fault_failures(any_tech_id)
        evidence["technician_global_success_rate"] = global_rate
        evidence["technician_cross_fault_failures"] = len(cross_failures)

        if global_rate is not None and global_rate < 0.60:
            scores["technician_skill_gap"] += 0.25
            reasoning.append(_build_step(
                step,
                "Technician Historical Success Rate",
                f"The primary failed technician has a global repair success rate of {global_rate*100:.0f}% — "
                f"below the 60% floor. This pattern of repeated failures across multiple fault types indicates a broader skill deficiency.",
                {"global_success_rate": global_rate, "threshold": 0.60},
                "technician_skill_gap",
                0.25,
            ))
        elif len(cross_failures) == 0:
            scores["machine_fault"] += 0.15
            reasoning.append(_build_step(
                step,
                "Technician Cross-Fault Track Record",
                "The technician who failed on this specific fault has no other failure records across different fault types. "
                "This fault appears uniquely resistant — pointing toward hardware rather than technician capability.",
                {"cross_fault_failures": 0},
                "machine_fault",
                0.15,
            ))
        else:
            reasoning.append(_build_step(
                step,
                "Technician Cross-Fault Track Record",
                f"This technician has {len(cross_failures)} failure(s) on other fault types too — mixed signal. Neutral contribution.",
                {"cross_fault_failures": len(cross_failures)},
                "neutral",
                0.0,
            ))
        step += 1

    # ── STEP 7: Time-between-recurrences analysis ─────────────────────────
    if len(history) >= 2:
        try:
            t1 = datetime.fromisoformat(history[-2]["created_at"].replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(history[-1]["created_at"].replace("Z", "+00:00"))
            hours_between = abs((t2 - t1).total_seconds()) / 3600
            evidence["hours_between_last_two_recurrences"] = round(hours_between, 1)

            if hours_between < 4:
                scores["machine_fault"] += 0.35
                reasoning.append(_build_step(
                    step,
                    "Recurrence Velocity Analysis",
                    f"The fault recurred within {hours_between:.1f} hours of the last repair. "
                    f"Ultra-short recurrence windows (< 4h) almost always indicate a hardware failure that cannot be resolved through procedural fixes — the component needs physical replacement.",
                    {"hours_between_recurrences": hours_between, "fast_recurrence_threshold_h": 4},
                    "machine_fault",
                    0.35,
                ))
            elif hours_between < 24:
                scores["machine_fault"] += 0.15
                reasoning.append(_build_step(
                    step,
                    "Recurrence Velocity Analysis",
                    f"The fault recurred within {hours_between:.1f} hours — within one operational shift. "
                    f"Short recurrence indicates an incomplete or incorrect repair procedure.",
                    {"hours_between_recurrences": hours_between},
                    "machine_fault",
                    0.15,
                ))
            else:
                scores["technician_skill_gap"] += 0.10
                reasoning.append(_build_step(
                    step,
                    "Recurrence Velocity Analysis",
                    f"The fault recurred after {hours_between:.1f} hours — suggesting the repair provided temporary relief but wasn't permanent. "
                    f"This pattern is consistent with partial fixes from a skill gap scenario.",
                    {"hours_between_recurrences": hours_between},
                    "technician_skill_gap",
                    0.10,
                ))
            step += 1
        except Exception:
            pass

    # ── STEP 8: Verdict synthesis ─────────────────────────────────────────
    total = sum(scores.values()) or 1.0
    normalized = {k: v / total for k, v in scores.items()}

    # Systemic overrides everything if strong enough
    if normalized["systemic"] >= 0.45:
        attribution = "systemic"
        raw_confidence = normalized["systemic"]
    elif normalized["machine_fault"] >= 0.50:
        attribution = "machine_fault"
        raw_confidence = normalized["machine_fault"]
    elif normalized["technician_skill_gap"] >= 0.45:
        attribution = "technician_skill_gap"
        raw_confidence = normalized["technician_skill_gap"]
    else:
        attribution = "ambiguous"
        raw_confidence = 0.45

    # Confidence is calibrated by amount of evidence
    evidence_richness = min(len(history) / 5.0, 1.0)  # more history = more confidence
    confidence = round(min(0.97, raw_confidence * (0.7 + 0.3 * evidence_richness)), 3)

    attribution_labels = {
        "machine_fault": "Hardware Fault — Component Replacement Required",
        "technician_skill_gap": "Technician Skill Gap — Escalate to Expert Engineer",
        "ambiguous": "Inconclusive — Parallel Investigation Recommended",
        "systemic": "Systemic Issue — Fleet-Wide Process Review Required",
    }

    recommended_actions = {
        "machine_fault": (
            f"Schedule immediate part inspection and replacement for the affected component. "
            f"Dispatch a senior engineer to perform physical teardown. "
            f"Do NOT re-assign this to previous technicians ({', '.join(excluded_tech_ids[:3])}) — "
            f"the fault is hardware-rooted and requires component swap, not procedural correction."
        ),
        "technician_skill_gap": (
            f"Exclude technician(s) {', '.join(excluded_tech_ids[:3])} from this fault type. "
            f"Dispatch the highest-certified available expert (Senior or Expert level). "
            f"Consider scheduling targeted training on '{json.loads(fault_sig)}' fault class for the excluded technicians."
        ),
        "ambiguous": (
            "Dispatch a Senior/Expert engineer while simultaneously ordering the suspected replacement part. "
            "Run both tracks in parallel to minimize downtime uncertainty."
        ),
        "systemic": (
            "Escalate to Plant Reliability Lead immediately. "
            "Halt similar machines for inspection. "
            "Review recent maintenance supply chain, environmental conditions, and process changes across the fleet."
        ),
    }

    smart_dispatch_notes = {
        "machine_fault": f"HARDWARE ROOT CAUSE — Exclude {excluded_tech_ids}. Assign highest-certification tech available. Trigger part procurement in parallel.",
        "technician_skill_gap": f"SKILL GAP — Exclude {excluded_tech_ids}. Re-rank without these engineers. Prefer Expert/Senior cert with specialization match.",
        "ambiguous": "AMBIGUOUS — Send best available Senior/Expert. Flag case for manual review by Plant Lead.",
        "systemic": "SYSTEMIC — Notify Plant Reliability Lead. Fleet-wide review required before dispatching any single technician.",
    }

    reasoning.append(_build_step(
        step,
        "Verdict Synthesis",
        f"Aggregating {step - 1} reasoning steps: Machine Fault score={scores['machine_fault']:.2f}, "
        f"Skill Gap score={scores['technician_skill_gap']:.2f}, Systemic score={scores['systemic']:.2f}, "
        f"Ambiguous score={scores['ambiguous']:.2f}. "
        f"Dominant signal: '{attribution}' at {confidence*100:.0f}% confidence.",
        {"raw_scores": scores, "normalized_scores": normalized, "evidence_richness": round(evidence_richness, 2)},
        attribution,
        confidence,
    ))

    return _finalize(
        machine_id, anomaly_id, fault_sig, recurrence_count,
        attribution, confidence, reasoning, evidence,
        excluded_tech_ids,
        recommended_actions[attribution],
        smart_dispatch_notes[attribution],
        llm_client,
    )


def _finalize(
    machine_id, anomaly_id, fault_sig, recurrence_count,
    attribution, confidence, reasoning, evidence,
    excluded_tech_ids, recommended_action, smart_dispatch_notes,
    llm_client=None,
) -> dict:
    """Write to DB and return the full analysis result."""
    log_id = f"attr-{uuid.uuid4().hex[:10]}"

    # Optional: enrich with LLM narrative summary
    llm_narrative = None
    if llm_client:
        try:
            summary_prompt = (
                f"You are an industrial AI reasoning engine. Summarize the following fault attribution analysis "
                f"in 2-3 crisp, technical sentences for a plant reliability engineer. "
                f"Attribution: {attribution}. Confidence: {confidence*100:.0f}%. "
                f"Reasoning steps: {json.dumps([r['finding'] for r in reasoning], indent=None)}. "
                f"Write in third-person, present tense. Be direct."
            )
            resp = llm_client.generate_chat_response(
                machine_id=machine_id,
                user_message=summary_prompt,
                citations=[],
            )
            llm_narrative = resp.get("reply", "")
        except Exception:
            pass

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO fault_attribution_log
            (id, machine_id, anomaly_id, fault_signature, recurrence_count,
             attribution, confidence, reasoning_chain, evidence,
             excluded_technicians, recommended_action)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log_id, machine_id, anomaly_id, fault_sig, recurrence_count,
            attribution, confidence,
            json.dumps(reasoning), json.dumps(evidence),
            json.dumps(excluded_tech_ids), recommended_action,
        ))
        conn.commit()

    return {
        "log_id": log_id,
        "machine_id": machine_id,
        "anomaly_id": anomaly_id,
        "fault_signature": json.loads(fault_sig),
        "recurrence_count": recurrence_count,
        "attribution": attribution,
        "attribution_label": {
            "machine_fault": "Hardware Fault",
            "technician_skill_gap": "Technician Skill Gap",
            "ambiguous": "Inconclusive",
            "systemic": "Systemic Issue",
        }.get(attribution, attribution),
        "confidence": confidence,
        "reasoning_chain": reasoning,
        "evidence": evidence,
        "excluded_technicians": excluded_tech_ids,
        "recommended_action": recommended_action,
        "smart_dispatch_notes": smart_dispatch_notes,
        "llm_narrative": llm_narrative,
    }


def record_repair_outcome(
    dispatch_id: str,
    anomaly_id: str,
    machine_id: str,
    technician_id: str,
    flagged_sensors: list[str],
    outcome: str,  # 'resolved' | 'recurred' | 'partial' | 'unknown'
    notes: str | None = None,
) -> dict:
    """
    Record the result of a repair attempt.
    Called after a technician marks their work complete and the system
    observes whether the fault re-appears.
    """
    fault_sig = _fault_signature(flagged_sensors)

    # Count existing recurrences for this fault
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM repair_outcomes
            WHERE machine_id = ? AND fault_signature = ? AND outcome IN ('recurred', 'partial')
        """, (machine_id, fault_sig))
        prior_recurrences = cursor.fetchone()[0]

    record_id = f"ro-{uuid.uuid4().hex[:10]}"
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO repair_outcomes
            (id, dispatch_id, anomaly_id, machine_id, technician_id,
             fault_signature, outcome, recurrence_count, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (record_id, dispatch_id, anomaly_id, machine_id, technician_id,
              fault_sig, outcome, prior_recurrences, notes))
        conn.commit()

    return {
        "outcome_id": record_id,
        "outcome": outcome,
        "fault_signature": json.loads(fault_sig),
        "total_recurrences": prior_recurrences + (1 if outcome in ("recurred", "partial") else 0),
        "should_analyze": prior_recurrences >= MIN_RECURRENCES_FOR_ANALYSIS - 1,
    }


def get_attribution_history(machine_id: str, limit: int = 10) -> list[dict]:
    """Retrieve past attribution analyses for a machine."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, machine_id, anomaly_id, fault_signature, recurrence_count,
                   attribution, confidence, reasoning_chain, evidence,
                   excluded_technicians, recommended_action, created_at
            FROM fault_attribution_log
            WHERE machine_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (machine_id, limit))
        rows = cursor.fetchall()

    cols = ["id", "machine_id", "anomaly_id", "fault_signature", "recurrence_count",
            "attribution", "confidence", "reasoning_chain", "evidence",
            "excluded_technicians", "recommended_action", "created_at"]
    results = []
    for r in rows:
        item = dict(zip(cols, r))
        for field in ("reasoning_chain", "evidence", "excluded_technicians"):
            try:
                item[field] = json.loads(item[field])
            except Exception:
                pass
        try:
            item["fault_signature"] = json.loads(item["fault_signature"])
        except Exception:
            pass
        results.append(item)
    return results
