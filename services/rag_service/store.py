"""
Tenure — Vector Store Wrapper (ChromaDB)

Manages vector embeddings, document chunk ingestion, and similarity search
per machine. Stores vector indexes persistently in `chroma_data/` and mirrors
chunk metadata into SQLite `vector_documents`.
"""

import os
import uuid
from pathlib import Path
from typing import Any

from db.init_db import get_connection

CHROMA_DIR = Path(__file__).parent.parent.parent / "chroma_data"
CHROMA_DIR.mkdir(parents=True, exist_ok=True)


class VectorStore:
    """
    ChromaDB wrapper providing machine-isolated document ingestion and retrieval.
    """

    def __init__(self, persist_dir: Path = CHROMA_DIR):
        self.persist_dir = persist_dir
        self._client = None

    def _get_client(self):
        if self._client is None:
            import chromadb
            from chromadb.config import Settings
            self._client = chromadb.PersistentClient(
                path=str(self.persist_dir),
                settings=Settings(anonymized_telemetry=False),
            )
        return self._client

    def _get_collection(self, machine_id: str):
        client = self._get_client()
        # Chroma collection names must be 3-63 chars, alphanumeric or underscores/hyphens
        col_name = f"machine_{machine_id.replace('-', '_')}"
        return client.get_or_create_collection(name=col_name)

    def ingest_chunks(
        self,
        machine_id: str,
        chunks: list[dict[str, Any]],
        doc_type: str = "manual",
    ) -> int:
        """
        Ingest text chunks into vector store and SQLite vector_documents.

        Each chunk in `chunks`:
          {
            "text": str,
            "source_ref": str (e.g. "UR5e_Manual_v3.pdf#page=42"),
            "section": str (optional)
          }
        """
        if not chunks:
            return 0

        col = self._get_collection(machine_id)

        ids = []
        documents = []
        metadatas = []

        with get_connection() as conn:
            cursor = conn.cursor()
            for chunk in chunks:
                chunk_id = str(uuid.uuid4())
                text = chunk["text"]
                source_ref = chunk.get("source_ref", "unknown")
                section = chunk.get("section", "")

                ids.append(chunk_id)
                documents.append(text)
                metadatas.append({
                    "machine_id": machine_id,
                    "doc_type": doc_type,
                    "source_ref": source_ref,
                    "section": section,
                })

                # Mirror into SQLite for relational joins and tracking
                cursor.execute(
                    """
                    INSERT INTO vector_documents (machine_id, doc_type, chunk_text, source_ref)
                    VALUES (?, ?, ?, ?)
                    """,
                    (machine_id, doc_type, text, source_ref),
                )
            conn.commit()

        # Upsert into Chroma
        col.upsert(ids=ids, documents=documents, metadatas=metadatas)
        print(f"[rag_store] Ingested {len(chunks)} chunks for machine {machine_id}")
        return len(chunks)

    def search(
        self,
        query: str,
        machine_id: str,
        top_k: int = 4,
        doc_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Perform semantic similarity retrieval against a machine's collection.
        Returns top-k chunks with metadata and relevance scores.
        """
        col = self._get_collection(machine_id)
        count = col.count()
        if count == 0:
            return []

        actual_k = min(top_k, count)
        where_filter = {"doc_type": doc_type} if doc_type else None

        results = col.query(
            query_texts=[query],
            n_results=actual_k,
            where=where_filter,
        )

        formatted = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
            distances = results["distances"][0] if "distances" in results and results["distances"] else [0.0] * len(docs)

            for doc, meta, dist in zip(docs, metas, distances):
                # Convert cosine distance to similarity score
                score = round(max(0.0, 1.0 - (dist if dist is not None else 0.5)), 3)
                formatted.append({
                    "chunk_text": doc,
                    "source_ref": meta.get("source_ref", ""),
                    "doc_type": meta.get("doc_type", "manual"),
                    "section": meta.get("section", ""),
                    "relevance_score": score,
                })

        return formatted

    def count(self, machine_id: str) -> int:
        col = self._get_collection(machine_id)
        return col.count()
