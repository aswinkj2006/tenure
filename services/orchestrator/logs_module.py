"""
Tenure — Logs & Audit Trail Module

Handles querying joined records across:
- anomaly_records
- diagnoses
- feedback
- conversation_logs

Provides filtering, CSV export, and PDF incident audit reports.
"""

import csv
import io
import json
import re
from typing import Any

from db.init_db import get_connection



def query_logs(
    machine_id: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    outcome: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:


    """
    Query joined issue history with flexible filtering and search.
    """
    conditions = []
    params: list[Any] = []

    if machine_id:
        conditions.append("a.machine_id = ?")
        params.append(machine_id)
    if severity:
        conditions.append("a.severity = ?")
        params.append(severity)
    if status:
        conditions.append("a.status = ?")
        params.append(status)
    if outcome:
        conditions.append("f.outcome = ?")
        params.append(outcome)
    if from_date:
        conditions.append("a.ts >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("a.ts <= ?")
        params.append(to_date)
    if search:
        conditions.append("(a.flagged_sensors LIKE ? OR d.llm_output LIKE ? OR f.confirmed_cause LIKE ?)")
        term = f"%{search}%"
        params.extend([term, term, term])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT
            a.id as anomaly_id,
            a.machine_id,
            m.name as machine_name,
            a.ts,
            a.flagged_sensors,
            a.deviation_magnitude,
            a.severity,
            a.status,
            a.created_at,
            d.id as diagnosis_id,
            d.llm_output,
            d.citations,
            d.confidence,
            f.id as feedback_id,
            f.outcome,
            f.confirmed_cause,
            f.ts as feedback_ts
        FROM anomaly_records a
        LEFT JOIN machines m ON a.machine_id = m.machine_id
        LEFT JOIN diagnoses d ON a.id = d.anomaly_id
        LEFT JOIN feedback f ON d.id = f.diagnosis_id
        {where_clause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    """

    params.extend([limit, offset])

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Count total matching
        count_query = f"""
            SELECT COUNT(*)
            FROM anomaly_records a
            LEFT JOIN diagnoses d ON a.id = d.anomaly_id
            LEFT JOIN feedback f ON d.id = f.diagnosis_id
            {where_clause}
        """
        cursor.execute(count_query, params[:-2])
        total_count = cursor.fetchone()[0]

    issues = []
    for r in rows:
        flagged = json.loads(r[4]) if r[4] else []
        deviation = json.loads(r[5]) if r[5] else {}
        citations = json.loads(r[11]) if r[11] else []
        diag_output = r[10] or ""
        
        if diag_output:
            # Clean markdown symbols, asterisks, and newlines for clean single-line summary
            clean_diag = re.sub(r'[*#_`]', '', diag_output.replace("\n", " ")).strip()
            clean_diag = re.sub(r'\s+', ' ', clean_diag)
            diag_summary = (clean_diag[:135] + "...") if len(clean_diag) > 135 else clean_diag
        elif flagged:
            sensors_fmt = ", ".join(s.replace("_", " ").title() for s in flagged)
            dev_str = ""
            if deviation:
                first_k = next(iter(deviation))
                dev_str = f" (+{deviation[first_k]} deviation)"
            diag_summary = f"{r[6].capitalize()} excursion detected on {sensors_fmt}{dev_str} exceeding nominal safety envelope."
        else:
            diag_summary = f"Mechanical anomaly flagged on {r[2] or r[1]} during active operational cycle."

        issues.append({
            "anomaly_id": r[0],
            "machine_id": r[1],
            "machine_name": r[2] or r[1],
            "timestamp": r[3],
            "ts": r[3],
            "severity": r[6],
            "status": r[7],
            "outcome": r[14],
            "flagged_sensors": flagged,
            "deviation_magnitude": deviation,
            "diagnosis_summary": diag_summary,
            "created_at": r[8],
            "diagnosis": {
                "id": r[9],
                "diagnosis_id": r[9],
                "llm_output": r[10],
                "text": r[10],
                "citations_count": len(citations),
                "confidence": r[12],
            } if r[9] else None,
            "feedback": {
                "id": r[13],
                "outcome": r[14],
                "confirmed_cause": r[15],
                "ts": r[16],
            } if r[13] else None,
        })

    page = (offset // limit) + 1 if limit > 0 else 1
    return {
        "total": total_count,
        "count": len(issues),
        "page": page,
        "per_page": limit,
        "limit": limit,
        "offset": offset,
        "issues": issues,
    }


def get_issue_detail(anomaly_id: str) -> dict[str, Any] | None:
    """
    Retrieve complete audit trail for a single anomaly incident.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        # 1. Anomaly details + machine name
        cursor.execute(
            """
            SELECT a.id, a.machine_id, a.ts, a.flagged_sensors, a.deviation_magnitude, a.severity, a.status, a.created_at, m.name
            FROM anomaly_records a
            LEFT JOIN machines m ON a.machine_id = m.machine_id
            WHERE a.id = ?
            """,
            (anomaly_id,),
        )
        a_row = cursor.fetchone()
        if not a_row:
            return None

        # 2. Diagnoses
        cursor.execute(
            """
            SELECT id, llm_output, citations, confidence, created_at
            FROM diagnoses
            WHERE anomaly_id = ?
            ORDER BY created_at DESC
            """,
            (anomaly_id,),
        )
        d_rows = cursor.fetchall()

        # 3. Feedback
        diagnosis_ids = [d[0] for d in d_rows]
        feedbacks = []
        if diagnosis_ids:
            placeholders = ",".join("?" * len(diagnosis_ids))
            cursor.execute(
                f"""
                SELECT id, diagnosis_id, outcome, confirmed_cause, ts
                FROM feedback
                WHERE diagnosis_id IN ({placeholders})
                """,
                diagnosis_ids,
            )
            f_rows = cursor.fetchall()
            for f in f_rows:
                feedbacks.append({
                    "id": f[0],
                    "diagnosis_id": f[1],
                    "outcome": f[2],
                    "confirmed_cause": f[3],
                    "ts": f[4],
                })

        # 4. Conversation logs
        cursor.execute(
            """
            SELECT id, messages, started_at, resolved_at
            FROM conversation_logs
            WHERE anomaly_id = ? OR machine_id = ?
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (anomaly_id, a_row[1]),
        )
        c_row = cursor.fetchone()
        conversation = json.loads(c_row[1]) if c_row and c_row[1] else []

    diagnoses = []
    for d in d_rows:
        diagnoses.append({
            "id": d[0],
            "diagnosis_id": d[0],
            "text": d[1],
            "llm_output": d[1],
            "citations": json.loads(d[2]) if d[2] else [],
            "confidence": d[3],
            "created_at": d[4],
        })

    flagged = json.loads(a_row[3]) if a_row[3] else []
    deviation = json.loads(a_row[4]) if a_row[4] else {}
    machine_name = a_row[8] or a_row[1]

    return {
        "anomaly_id": a_row[0],
        "machine_id": a_row[1],
        "machine_name": machine_name,
        "timestamp": a_row[2],
        "ts": a_row[2],
        "severity": a_row[5],
        "status": a_row[6],
        "anomaly_data": {
            "flagged_sensors": flagged,
            "deviation_magnitude": deviation,
        },
        "diagnosis": diagnoses[0] if diagnoses else None,
        "anomaly": {
            "id": a_row[0],
            "machine_id": a_row[1],
            "ts": a_row[2],
            "flagged_sensors": flagged,
            "deviation_magnitude": deviation,
            "severity": a_row[5],
            "status": a_row[6],
            "created_at": a_row[7],
        },
        "diagnoses": diagnoses,
        "feedback": feedbacks[0] if feedbacks else None,
        "feedbacks": feedbacks,
        "conversation": conversation,
    }


def generate_csv_export(issues: list[dict[str, Any]]) -> str:
    """Generate RFC-4180 compliant CSV string for export."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Anomaly ID",
        "Machine ID",
        "Timestamp",
        "Severity",
        "Status",
        "Flagged Sensors",
        "Deviation",
        "Diagnosis ID",
        "Confidence",
        "Feedback Outcome",
        "Confirmed Cause",
    ])

    for item in issues:
        diag = item.get("diagnosis") or {}
        fb = item.get("feedback") or {}
        writer.writerow([
            item["anomaly_id"],
            item["machine_id"],
            item["ts"],
            item["severity"],
            item["status"],
            ";".join(item["flagged_sensors"]),
            json.dumps(item["deviation_magnitude"]),
            diag.get("id", ""),
            diag.get("confidence", ""),
            fb.get("outcome", ""),
            fb.get("confirmed_cause", ""),
        ])

    return output.getvalue()


def generate_pdf_report(anomaly_id: str) -> bytes:
    """Generate a clean styled PDF report for the given incident."""
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    detail = get_issue_detail(anomaly_id)
    if not detail:
        raise ValueError(f"Anomaly {anomaly_id} not found")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle("TitleStyle", parent=styles["Heading1"], fontSize=20, leading=24, textColor=colors.HexColor("#0f766e"))
    h2_style = ParagraphStyle("H2Style", parent=styles["Heading2"], fontSize=13, leading=16, textColor=colors.HexColor("#1e293b"))
    body_style = ParagraphStyle("BodyStyle", parent=styles["Normal"], fontSize=10, leading=14, textColor=colors.HexColor("#334155"))

    story = []

    # Header
    story.append(Paragraph("Tenure — Machinery Diagnostic Incident Report", title_style))
    story.append(Spacer(1, 10))

    # Meta Table
    a = detail["anomaly"]
    meta_data = [
        ["Anomaly ID:", a["id"], "Severity:", a["severity"].upper()],
        ["Machine ID:", a["machine_id"], "Status:", a["status"].upper()],
        ["Timestamp:", a["ts"], "Created At:", a["created_at"]],
        ["Flagged Telemetry:", ", ".join(a["flagged_sensors"]), "Deviation:", json.dumps(a["deviation_magnitude"])],
    ]
    t = Table(meta_data, colWidths=[110, 160, 90, 170])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1e293b")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))

    # Diagnosis Section
    story.append(Paragraph("AI Technician Root Cause Analysis & Procedures", h2_style))
    story.append(Spacer(1, 6))

    if detail["diagnoses"]:
        diag = detail["diagnoses"][0]
        # Clean text
        text = diag["llm_output"].replace("\n", "<br/>")
        story.append(Paragraph(text, body_style))
        story.append(Spacer(1, 10))

        # Citations
        if diag.get("citations"):
            story.append(Paragraph("Verified Documentation Citations:", h2_style))
            story.append(Spacer(1, 4))
            for c in diag["citations"]:
                cite_text = f"• <b>{c.get('source_ref')}</b> (Relevance: {c.get('relevance_score')})<br/><i>{c.get('chunk_text', '')[:160]}...</i>"
                story.append(Paragraph(cite_text, body_style))
                story.append(Spacer(1, 4))
    else:
        story.append(Paragraph("No diagnosis generated yet for this incident.", body_style))

    story.append(Spacer(1, 15))

    # Technician Feedback Section
    story.append(Paragraph("Human-in-the-Loop Resolution & Feedback", h2_style))
    story.append(Spacer(1, 6))
    fb = detail.get("feedback")
    if isinstance(fb, list) and fb:
        fb = fb[0]

    if fb and isinstance(fb, dict):
        fb_text = f"Outcome: <b>{fb['outcome'].upper()}</b><br/>"
        if fb.get("confirmed_cause"):
            fb_text += f"Verified Cause by Technician: <i>{fb['confirmed_cause']}</i><br/>"
        fb_text += f"Logged at: {fb.get('ts', '')}"
        story.append(Paragraph(fb_text, body_style))
    else:
        story.append(Paragraph("Awaiting technician confirmation or correction.", body_style))

    doc.build(story)
    return buffer.getvalue()
