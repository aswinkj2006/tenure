"""
Tenure — Document Processing & Chunking

Extracts text from PDF, Markdown, and text files, and splits them into
semantically grounded chunks with source references (file + page / heading).
"""

import io
import re
from pathlib import Path
from typing import Any


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> list[dict[str, Any]]:
    """
    Extracts text sections from uploaded file bytes.
    Returns list of {"page": int, "section": str, "text": str}.
    """
    ext = Path(filename).suffix.lower()
    pages = []

    if ext == ".pdf":
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        for page_idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"page": page_idx + 1, "section": f"Page {page_idx + 1}", "text": text})
    else:
        # Markdown, TXT, or JSON
        try:
            content = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content = file_bytes.decode("latin-1", errors="ignore")

        # Split markdown by headings if possible
        sections = re.split(r"\n(?=#{1,3}\s+)", content)
        for idx, sec in enumerate(sections):
            lines = sec.strip().split("\n")
            heading = lines[0].replace("#", "").strip() if lines else f"Section {idx + 1}"
            pages.append({"page": 1, "section": heading, "text": sec})

    return pages


def chunk_document(
    sections: list[dict[str, Any]],
    filename: str,
    chunk_size: int = 800,
    overlap: int = 150,
) -> list[dict[str, Any]]:
    """
    Chunks extracted sections into overlapping chunks suitable for semantic search.
    Each chunk retains source_ref with file name, page, and section.
    """
    chunks = []

    for sec in sections:
        page_num = sec.get("page", 1)
        sec_title = sec.get("section", "")
        text = sec.get("text", "").strip()

        if not text:
            continue

        start = 0
        text_len = len(text)

        while start < text_len:
            end = min(start + chunk_size, text_len)
            # Try to break at sentence or newline if not at end
            if end < text_len:
                last_newline = text.rfind("\n", start + chunk_size // 2, end)
                last_period = text.rfind(". ", start + chunk_size // 2, end)
                break_point = max(last_newline, last_period)
                if break_point != -1:
                    end = break_point + 1

            chunk_text = text[start:end].strip()
            if len(chunk_text) > 20:
                source_ref = f"{filename}#page={page_num}"
                if sec_title and sec_title != f"Page {page_num}":
                    source_ref += f" ({sec_title[:30]})"

                chunks.append({
                    "text": chunk_text,
                    "source_ref": source_ref,
                    "page": page_num,
                    "section": sec_title,
                })

            if end >= text_len:
                break
            start = max(start + 1, end - overlap)

    return chunks
