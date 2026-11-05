from __future__ import annotations

import io
import re

SUPPORTED = {
    "txt", "md", "markdown", "docx", "pdf", "rtf",
}


def file_kind(filename: str) -> str:
    if not filename:
        return ""
    name = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    return name


def extract_text(filename: str, data: bytes) -> str:
    """Extract plain text from an uploaded file (PDF / Word / text / Google-Docs export)."""
    kind = file_kind(filename)

    if kind in ("txt", "md", "markdown", "rtf"):
        return _decode(data)

    if kind == "docx":
        try:
            from docx import Document
            doc = Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception:
            return ""

    if kind == "pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            parts = []
            for page in reader.pages:
                parts.append(page.extract_text() or "")
            return "\n".join(parts)
        except Exception:
            return ""

    return _decode(data)


def _decode(data: bytes) -> str:
    for enc in ("utf-8", "utf-16", "cp1255", "windows-1252"):
        try:
            return data.decode(enc)
        except (UnicodeDecodeError, ValueError):
            continue
    return data.decode("utf-8", errors="replace")


def looks_like_recipe(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in ("ingredients", "מצרכים", "recipe", "מתכון", "מרכיבים")) \
        or bool(re.search(r"\d", text))
