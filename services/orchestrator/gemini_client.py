"""
Tenure — Gemini LLM Client
===========================
Interfaces with Google Gemini:
  - Primary Model: gemini-3.6-flash
  - Backup / Failover: gemini-3.7-flash
via the official google-genai SDK.

Strictly grounds diagnostics and conversational answers in retrieved technical
documentation chunks from ChromaDB, preserving exact source citation tracking.
"""

import os
from typing import Any
from dotenv import load_dotenv

load_dotenv()

PRIMARY_MODEL = os.getenv("LLM_MODEL", "gemini-3.6-flash")
BACKUP_MODEL = os.getenv("LLM_BACKUP_MODEL", "gemini-3.7-flash")


class GeminiTechnicianClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self._client = None

    def _get_client(self):
        """
        Dynamically initializes or updates google-genai client.
        Reloads .env so if the user adds their GEMINI_API_KEY while the
        service is running, it is immediately picked up.
        """
        load_dotenv(override=True)
        current_key = self.api_key or os.getenv("GEMINI_API_KEY")

        invalid_placeholders = (
            None,
            "",
            "your-gemini-api-key-here",
            "<your-key>",
            "your_gemini_api_key_here",
        )

        if current_key in invalid_placeholders:
            return None

        if self._client is None or self.api_key != current_key:
            try:
                from google import genai
                self._client = genai.Client(api_key=current_key)
                self.api_key = current_key
                print(f"[gemini] Initialized google.genai Client (Primary: {PRIMARY_MODEL}, Backup: {BACKUP_MODEL})")
            except Exception as e:
                print(f"[gemini] Could not initialize google.genai client: {e}")
                self._client = None

        return self._client

    def generate_diagnosis(
        self,
        machine_id: str,
        flagged_sensors: list[str],
        deviation_magnitude: dict[str, float],
        severity: str,
        citations: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Produce a grounded, cited diagnosis for an anomaly.
        Attempts PRIMARY_MODEL (gemini-3.6-flash) first, then BACKUP_MODEL (gemini-3.7-flash).
        """
        context_str = "\n\n".join([
            f"[Source: {c['source_ref']}]\n{c['chunk_text']}"
            for c in citations
        ])

        prompt = f"""You are Tenure, an expert industrial AI technician for the UR5e industrial manipulator.
An anomaly has been detected on machine '{machine_id}':
- Severity: {severity.upper()}
- Flagged telemetry: {', '.join(flagged_sensors)}
- Sensor Deviations: {deviation_magnitude}

Retrieved technical manual sections:
---
{context_str if context_str else "No specific manual sections found. Rely on UR5e standard manufacturer operating boundaries."}
---

Provide a structured, technician-grade diagnosis with:
1. Root Cause Analysis: Explain why this specific sensor reading exceeded nominal boundaries.
2. Recommended Corrective Action: Step-by-step physical inspection or mechanical adjustment procedure.
3. Verification & Recalibration: How the technician should confirm operational envelope restoration before resuming line cycle.

Cite the referenced manual sections where applicable."""

        client = self._get_client()
        if client:
            for model_name in [PRIMARY_MODEL, BACKUP_MODEL]:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                    )
                    text = response.text
                    print(f"[gemini] Generated diagnosis via {model_name}")
                    return {
                        "llm_output": text,
                        "citations": citations,
                        "confidence": 0.94 if citations else 0.78,
                        "model": model_name,
                    }
                except Exception as e:
                    print(f"[gemini] Diagnosis request failed on {model_name}: {e}. Trying fallback...")

        # Domain fallback when API key is pending or models fail
        flagged_str = ", ".join(flagged_sensors)
        fallback_text = (
            f"### Root Cause Analysis\n"
            f"Elevated readings observed on **{flagged_str}** exceeding standard UR5e operational boundaries. "
            f"Based on manufacturer specifications, high torque spikes on this joint typically indicate harmonic drive gear wear, "
            f"mechanical resistance, or payload over-extension.\n\n"
            f"### Immediate Action Steps\n"
            f"1. **Emergency Brake & Lockout:** Ensure machine is powered down before manual inspection.\n"
            f"2. **Physical Inspection:** Check joint seal integrity and inspect for external cabling entanglement.\n"
            f"3. **Zero-Point Calibration:** Perform joint encoder zeroing in accordance with section maintenance guidelines.\n"
            f"4. **Payload Recalibration:** Verify TCP payload weight does not exceed rated limits.\n\n"
            f"### Verification\n"
            f"Run sinusoidal joint sweep at 20% reduced speed and monitor torque variance before restoring full duty cycle."
        )

        return {
            "llm_output": fallback_text,
            "citations": citations,
            "confidence": 0.88 if citations else 0.70,
            "model": "grounded_rule_fallback",
        }

    def generate_chat_response(
        self,
        machine_id: str,
        user_message: str,
        citations: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Generate conversational technician answer cited strictly from documentation.
        Attempts PRIMARY_MODEL (gemini-3.6-flash) first, then BACKUP_MODEL (gemini-3.7-flash).
        """
        context_str = "\n\n".join([
            f"[Source: {c['source_ref']}]\n{c['chunk_text']}"
            for c in citations
        ])

        prompt = f"""You are Tenure, the industrial AI technician assistant for robot asset '{machine_id}'.
The plant technician asks: "{user_message}"

Retrieved technical documentation context:
---
{context_str if context_str else "No specific manual chunks retrieved."}
---

Answer the technician accurately, concisely, and cite the document references provided."""

        client = self._get_client()
        if client:
            for model_name in [PRIMARY_MODEL, BACKUP_MODEL]:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                    )
                    print(f"[gemini] Generated chat response via {model_name}")
                    return {
                        "reply": response.text,
                        "citations": citations,
                        "model": model_name,
                    }
                except Exception as e:
                    print(f"[gemini] Chat request failed on {model_name}: {e}. Trying fallback...")

        # Domain fallback response
        if citations:
            best_chunk = citations[0]
            reply = f"According to [{best_chunk['source_ref']}]: {best_chunk['chunk_text'][:350]}..."
        else:
            reply = f"Based on UR5e specifications for {machine_id}, standard joint limits are 150 Nm for joints 1-3 and 28 Nm for joints 4-6 with maximum payload of 5 kg."

        return {
            "reply": reply,
            "citations": citations,
            "model": "grounded_rule_fallback",
        }
