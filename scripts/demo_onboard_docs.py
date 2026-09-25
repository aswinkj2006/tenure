"""
Tenure — Real-time Document Onboarding Demo Script

Demonstrates real-time onboarding of technical documentation:
1. Ingests a new machine service manual via RAG service
2. Auto-extracts machine specifications and sensor parameters
3. Runs a sample grounded diagnosis against the newly ingested manual
"""

import sys
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from services.rag_service.store import VectorStore
from services.rag_service.extractor import extract_text_from_bytes, chunk_document
from services.orchestrator.gemini_client import GeminiTechnicianClient


def demo_onboard():
    manual_path = ROOT_DIR / "data" / "sample_docs" / "UR5e_Service_Manual.md"
    if not manual_path.exists():
        print(f"Error: Manual not found at {manual_path}")
        return

    print("=" * 65)
    print("[DOCS] Real-Time Document Onboarding: Ingesting UR5e Service Manual")
    print("=" * 65)

    with open(manual_path, "rb") as f:
        file_bytes = f.read()

    # 1. Extract and chunk
    sections = extract_text_from_bytes(file_bytes, manual_path.name)
    print(f"[+] Extracted {len(sections)} sections from {manual_path.name}")

    chunks = chunk_document(sections, filename=manual_path.name, chunk_size=400, overlap=80)
    print(f"[+] Generated {len(chunks)} grounded chunks with source citations")

    # 2. Ingest into ChromaDB
    store = VectorStore()
    ingested = store.ingest_chunks("ur5e-001", chunks, doc_type="manual")
    print(f"[+] Successfully indexed {ingested} chunks into machine vector store.")

    # 3. Retrieve relevant sections for Joint 3 anomaly
    print("\n[SEARCH] Querying vector store for 'joint 3 high torque overload':")
    results = store.search("joint 3 torque spike troubleshooting", "ur5e-001", top_k=2)
    for idx, r in enumerate(results, 1):
        print(f"  [{idx}] Citation: {r['source_ref']} (Score: {r['relevance_score']})")
        print(f"      Snippet: {r['chunk_text'][:140]}...\n")

    # 4. Generate diagnosis
    print("[AI] Generating cited AI Technician diagnosis:")
    gemini = GeminiTechnicianClient()

    diag = gemini.generate_diagnosis(
        machine_id="ur5e-001",
        flagged_sensors=["joint_3_torque"],
        deviation_magnitude={"joint_3_torque": 35.0},
        severity="critical",
        citations=results,
    )
    print("\n" + diag["llm_output"])
    print(f"\nModel used: {diag['model']} | Confidence: {diag['confidence']}")
    print("=" * 65)


if __name__ == "__main__":
    demo_onboard()
