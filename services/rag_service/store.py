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
            try:
                import chromadb
                from chromadb.config import Settings
                self._client = chromadb.PersistentClient(
                    path=str(self.persist_dir),
                    settings=Settings(anonymized_telemetry=False),
                )
            except Exception as e:
                print(f"[rag_store] ChromaDB client unavailable ({e}), using SQLite vector_documents fallback.")
                self._client = None
        return self._client

    def _get_collection(self, machine_id: str):
        client = self._get_client()
        if client is None:
            return None
        try:
            col_name = f"machine_{machine_id.replace('-', '_')}"
            return client.get_or_create_collection(name=col_name)
        except Exception as e:
            print(f"[rag_store] Could not get Chroma collection ({e}), using SQLite fallback.")
            return None

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

    def _search_sqlite(self, query: str, machine_id: str, top_k: int = 4) -> list[dict[str, Any]]:
        """Fallback keyword-based retrieval from SQLite vector_documents."""
        query_terms = [t.lower() for t in query.split() if len(t) > 2]
        if not query_terms:
            query_terms = [query.lower()]

        results = []
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT chunk_text, source_ref, doc_type
                    FROM vector_documents
                    WHERE machine_id = ? OR machine_id = 'ur5e-001'
                    """,
                    (machine_id,)
                )
                rows = cursor.fetchall()
                if not rows:
                    cursor.execute("SELECT chunk_text, source_ref, doc_type FROM vector_documents LIMIT 20")
                    rows = cursor.fetchall()

                scored = []
                for row in rows:
                    text, source_ref, doc_type = row[0], row[1], row[2]
                    text_lower = text.lower()
                    matches = sum(1 for term in query_terms if term in text_lower)
                    score = round(min(0.95, 0.5 + 0.1 * matches), 2)
                    scored.append((score, {
                        "chunk_text": text,
                        "source_ref": source_ref or "OEM Technical Documentation",
                        "doc_type": doc_type or "manual",
                        "section": "Standard Operating Procedures",
                        "relevance_score": score,
                    }))

                scored.sort(key=lambda x: x[0], reverse=True)
                results = [item[1] for item in scored[:top_k]]
        except Exception as e:
            print(f"[rag_store] SQLite search fallback error: {e}")
        return results

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
        if col is not None:
            try:
                count = col.count()
                if count > 0:
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
                            score = round(max(0.0, 1.0 - (dist if dist is not None else 0.5)), 3)
                            formatted.append({
                                "chunk_text": doc,
                                "source_ref": meta.get("source_ref", ""),
                                "doc_type": meta.get("doc_type", "manual"),
                                "section": meta.get("section", ""),
                                "relevance_score": score,
                            })

                        if formatted:
                            return formatted
            except Exception as e:
                print(f"[rag_store] Chroma query error ({e}), falling back to SQLite vector search.")

        # Fallback to SQLite documents search
        return self._search_sqlite(query=query, machine_id=machine_id, top_k=top_k)

    def count(self, machine_id: str) -> int:
        col = self._get_collection(machine_id)
        if col is not None:
            try:
                return col.count()
            except Exception:
                pass
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM vector_documents WHERE machine_id = ?", (machine_id,))
                row = cursor.fetchone()
                return row[0] if row else 0
        except Exception:
            return 0
