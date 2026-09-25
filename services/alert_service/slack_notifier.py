"""
Tenure — Slack Escalation & Real-Time Technician Alerting
Connects via Slack SDK to post structured breakdown notifications and technician dispatch links.
"""

import os
from pathlib import Path
from typing import Any
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv(Path(__file__).parent.parent.parent / ".env")

SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")
SLACK_CHANNEL_ID = os.getenv("SLACK_CHANNEL_ID", "C0C2R3H1VJA")


def send_slack_breakdown_alert(
    anomaly_id: str,
    machine_id: str,
    severity: str,
    flagged_sensors: list[str],
    deviation_magnitude: dict[str, float],
    message: str = "",
    portal_base_url: str = "http://localhost:5173",
) -> dict[str, Any]:
    """
    Sends an immediate automated Slack alert to the on-call technician channel.
    Includes machine state, sensor drift metrics, and a direct portal link.
    """
    if not SLACK_BOT_TOKEN or SLACK_BOT_TOKEN.startswith("xoxb-your"):
        print("[slack] Warning: SLACK_BOT_TOKEN not configured. Skipping Slack push.")
        return {"status": "skipped", "reason": "token_missing"}

    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError

        client = WebClient(token=SLACK_BOT_TOKEN)
        technician_url = f"{portal_base_url}/technician/{anomaly_id}"

        flagged_str = ", ".join(flagged_sensors) if flagged_sensors else "Joint 3 Harmonic Reducer"
        dev_lines = []
        for k, v in deviation_magnitude.items():
            dev_lines.append(f"• *{k}*: `{v:+.1f}` deviation above nominal")
        dev_text = "\n".join(dev_lines) if dev_lines else "• *joint_3_torque*: `148.5 Nm` (Critical limit: 150 Nm)"

        severity_upper = severity.upper()
        severity_icon = "🔴" if severity == "critical" else "🟠" if severity == "high" else "🟡"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🚨 EMERGENCY BREAKDOWN PREDICTED — {machine_id.upper()}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Machine:* {machine_id}\n*Severity:* {severity_icon} `{severity_upper}`",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Action Taken:* `AUTOMATIC E-STOP ENGAGED`\n*Kinematic State:* FROZEN",
                    },
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Anomaly Summary:*\n{message or 'Slowly rising torque envelope detected on harmonic drive gearbox. Machine halted to prevent catastrophic gear tooth shear.'}\n\n*Flagged Telemetry:*\n{dev_text}",
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"🛠️ *Technician Action Required:*\nInspect Joint 3 elbow harmonic drive, verify grease level, and clear safety stop.",
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Open Fixer Portal",
                        "emoji": True,
                    },
                    "url": technician_url,
                    "style": "danger",
                },
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Incident ID: `{anomaly_id}` | Portal: <{technician_url}|Click here to launch 3D Twin & Diagnostic Chat>",
                    }
                ],
            },
        ]

        resp = client.chat_postMessage(
            channel=SLACK_CHANNEL_ID,
            text=f"🚨 [{severity_upper}] Emergency Breakdown predicted on {machine_id}: Automatic E-Stop engaged. Technician assistance required.",
            blocks=blocks,
        )
        ts = resp["ts"]
        print(f"[slack] Breakdown alert successfully posted to Slack channel {SLACK_CHANNEL_ID}, ts={ts}")

        # Post thread response with preliminary RAG checklist
        try:
            client.chat_postMessage(
                channel=SLACK_CHANNEL_ID,
                thread_ts=ts,
                text=(
                    f"*Automated RAG Guidance for Incident `{anomaly_id}`:*\n"
                    "1. Engage physical LOTO lock on UR5e main control box prior to cell entry.\n"
                    "2. Remove Joint 3 cosmetic shroud (4x M4 hex screws, 2.5 Nm).\n"
                    "3. Check for metallic particulates or grease discoloration in harmonic drive teeth.\n"
                    "4. Consult AI Assistant in the Technician Portal for torque wrench calibration and restart approval."
                ),
            )
        except Exception as te:
            print(f"[slack] Could not post thread reply: {te}")

        return {"status": "sent", "channel": SLACK_CHANNEL_ID, "ts": ts}

    except Exception as e:
        print(f"[slack] Failed to send Slack alert: {e}")
        return {"status": "error", "error": str(e)}
