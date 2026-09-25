"""
Tenure — RAG Service

FastAPI server that:
  1. Accepts real-time document uploads (manuals, incident reports, feedback) via /ingest
  2. Extracts and chunks text with source tracking
  3. Indexes chunks into ChromaDB and SQLite vector_documents
  4. Exposes semantic similarity search via /retrieve

Port: 8003
"""

import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.init_db import get_connection
from services.rag_service.store import VectorStore
from services.rag_service.extractor import extract_text_from_bytes, chunk_document


class RetrieveRequest(BaseModel):
    query: str
    machine_id: str
    top_k: int = 4
    doc_type: str | None = None


app = FastAPI(
    title="Tenure RAG Service",
    description="Vector store management, document ingestion, and semantic retrieval.",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vector_store = VectorStore()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "rag_service"}


@app.post("/ingest")
async def ingest_document(
    machine_id: str = Form(...),
    file: UploadFile = File(...),
    doc_type: str = Form("manual"),
):
    """
    Ingest a manual or technical document for a specific machine.
    Processes PDF, Markdown, or text into grounded chunks with source references.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # 1. Extract text
    sections = extract_text_from_bytes(contents, file.filename)
    if not sections:
        raise HTTPException(status_code=400, detail="No readable text found in document.")

    # 2. Chunk document
    chunks = chunk_document(sections, filename=file.filename)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not generate valid chunks from document.")

    # 3. Store into ChromaDB + SQLite vector_documents
    stored_count = vector_store.ingest_chunks(
        machine_id=machine_id,
        chunks=chunks,
        doc_type=doc_type,
    )

    total_chunks = vector_store.count(machine_id)

    return {
        "status": "ingested",
        "machine_id": machine_id,
        "filename": file.filename,
        "doc_type": doc_type,
        "chunks_added": stored_count,
        "total_machine_chunks": total_chunks,
    }


@app.post("/retrieve")
async def retrieve_context(payload: RetrieveRequest):
    """
    Semantic similarity retrieval against machine documentation.
    Returns top-k matching chunks with citations and relevance scores.
    """
    chunks = vector_store.search(
        query=payload.query,
        machine_id=payload.machine_id,
        top_k=payload.top_k,
        doc_type=payload.doc_type,
    )

    return {
        "query": payload.query,
        "machine_id": payload.machine_id,
        "count": len(chunks),
        "chunks": chunks,
    }


@app.get("/documents/{machine_id}")
async def list_documents(machine_id: str):
    """List all ingested documents and chunk counts for a machine."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT source_ref, doc_type, COUNT(*) as chunk_count, MIN(created_at) as first_ingested
            FROM vector_documents
            WHERE machine_id = ?
            GROUP BY source_ref, doc_type
            ORDER BY first_ingested DESC
            """,
            (machine_id,),
        )
        rows = cursor.fetchall()

    docs = []
    for r in rows:
        docs.append({
            "source_ref": r[0],
            "doc_type": r[1],
            "chunk_count": r[2],
            "created_at": r[3],
        })

    return {"machine_id": machine_id, "documents": docs, "total_chunks": vector_store.count(machine_id)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.rag_service.main:app", host="0.0.0.0", port=8003, reload=True)
