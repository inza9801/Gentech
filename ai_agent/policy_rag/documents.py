"""Structure policy PDFs into citation-friendly, table-aware chunks."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pdfplumber

from ai_agent.policy_rag.settings import settings


@dataclass(frozen=True)
class DocumentDefinition:
    filename: str
    collection: str
    doc_id: str
    doc_title: str


@dataclass(frozen=True)
class PolicyChunk:
    chunk_id: str
    content_hash: str
    text: str
    metadata: dict[str, str | int]


DOCUMENTS = (
    DocumentDefinition(
        filename="gentech_warranty_and_service_policy.pdf",
        collection="warranty_service",
        doc_id="GT-POL-WS-01",
        doc_title="Warranty and Service Policy",
    ),
    DocumentDefinition(
        filename="gentech_payment_cancellation_and_refunds_policy.pdf",
        collection="payment_refunds",
        doc_id="GT-POL-PR-01",
        doc_title="Payment, Cancellation and Refunds Policy",
    ),
    DocumentDefinition(
        filename="gentech_delivery_and_shipping_policy.pdf",
        collection="delivery_shipping",
        doc_id="GT-POL-DS-01",
        doc_title="Delivery and Shipping Policy",
    ),
)

_H1 = re.compile(r"^(?P<number>\d+)\.\s+(?P<title>.+?)\s*$")
_H2 = re.compile(r"^(?P<number>\d+\.\d+)\s+(?P<title>.+?)\s*$")
_FAQ_QUESTION = re.compile(r"^Q\s*:\s*(.*)$", re.IGNORECASE)
_FAQ_ANSWER = re.compile(r"^A\s*:\s*(.*)$", re.IGNORECASE)
_WORD = re.compile(r"\S+")
_SPACE = re.compile(r"\s+")


def _clean_text(value: str | None) -> str:
    value = (value or "").replace("(cid:127)", "-")
    value = value.replace("\x7f", "-").replace("\u00a0", " ")
    return _SPACE.sub(" ", value).strip()


def _token_count(text: str) -> int:
    return len(_WORD.findall(text))


def _split_long_paragraph(
    paragraph: str,
    max_tokens: int,
    overlap_tokens: int,
) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", paragraph)
    pieces: list[str] = []
    current: list[str] = []
    for sentence in sentences:
        words = _WORD.findall(sentence)
        if len(words) > max_tokens:
            if current:
                pieces.append(" ".join(current))
                current = []
            step = max_tokens - overlap_tokens
            for start in range(0, len(words), step):
                pieces.append(" ".join(words[start : start + step]))
            continue
        if current and len(current) + len(words) > max_tokens:
            pieces.append(" ".join(current))
            current = []
        current.extend(words)
    if current:
        pieces.append(" ".join(current))
    return pieces or [paragraph]


def chunk_paragraphs(
    paragraphs: list[str],
    *,
    max_tokens: int | None = None,
    overlap_tokens: int | None = None,
) -> list[str]:
    """Pack paragraphs into bounded chunks with approximate word-token overlap."""
    limit = max_tokens or settings.policy_chunk_max_tokens
    overlap = overlap_tokens if overlap_tokens is not None else settings.policy_chunk_overlap_tokens
    if limit < 1 or overlap < 0 or overlap >= limit:
        raise ValueError("Chunk limit must be positive and overlap smaller than the limit.")

    pieces: list[str] = []
    for paragraph in paragraphs:
        cleaned_paragraph = _clean_text(paragraph)
        if cleaned_paragraph:
            pieces.extend(_split_long_paragraph(cleaned_paragraph, limit, overlap))
    chunks: list[str] = []
    current: list[str] = []
    current_count = 0
    for piece in pieces:
        piece_count = _token_count(piece)
        if current and current_count + piece_count > limit:
            chunks.append("\n\n".join(current))
            current_words = _WORD.findall(" ".join(current))
            overlap_words = current_words[-overlap:] if overlap else []
            if piece_count + len(overlap_words) > limit:
                overlap_words = []
            current = [" ".join(overlap_words)] if overlap_words else []
            current_count = len(overlap_words)
        if piece_count > limit:
            piece = " ".join(_WORD.findall(piece)[:limit])
            piece_count = limit
        current.append(piece)
        current_count += piece_count
    if current:
        chunks.append("\n\n".join(current))
    return chunks


def table_rows_to_sentences(rows: list[list[str | None]]) -> list[str]:
    """Map table cells to their extracted header names without flattening columns."""
    cleaned = [
        [_clean_text(cell) for cell in row]
        for row in rows
    ]
    cleaned = [row for row in cleaned if any(row)]
    if len(cleaned) < 2:
        return []
    headers = cleaned[0]
    width = len(headers)
    previous_row: list[str] | None = None
    sentences: list[str] = []
    for raw_row in cleaned[1:]:
        row = (raw_row + [""] * width)[:width]
        if previous_row and not row[0] and any(row[1:]):
            for index, value in enumerate(row):
                if value:
                    previous_row[index] = _clean_text(
                        f"{previous_row[index]} {value}".strip()
                    )
            continue
        if previous_row:
            sentences.append(_format_table_row(headers, previous_row))
        previous_row = row
    if previous_row:
        sentences.append(_format_table_row(headers, previous_row))
    return sentences


def _format_table_row(headers: list[str], values: list[str]) -> str:
    cells = [
        f"{header or f'Column {index + 1}'}: {value}"
        for index, (header, value) in enumerate(zip(headers, values))
        if value
    ]
    return "; ".join(cells)


def _is_inside_table(line: dict[str, Any], bounds: list[tuple[float, float, float, float]]) -> bool:
    line_top = float(line.get("top", 0))
    line_bottom = float(line.get("bottom", line_top))
    line_x0 = float(line.get("x0", 0))
    line_x1 = float(line.get("x1", line_x0))
    for x0, top, x1, bottom in bounds:
        vertical_overlap = line_bottom >= top and line_top <= bottom
        horizontal_overlap = line_x1 >= x0 and line_x0 <= x1
        if vertical_overlap and horizontal_overlap:
            return True
    return False


def _is_faq_group_heading(line: dict[str, Any]) -> bool:
    text = _clean_text(line.get("text"))
    if not text or _FAQ_QUESTION.match(text) or _FAQ_ANSWER.match(text):
        return False
    if _H1.match(text) or _H2.match(text):
        return False
    chars = line.get("chars") or []
    if not chars:
        return False
    bold_chars = [
        char
        for char in chars
        if "bold" in str(char.get("fontname", "")).casefold()
    ]
    sizes = [float(char.get("size", 0)) for char in chars]
    return len(bold_chars) / len(chars) >= 0.8 and max(sizes, default=0) >= 10.5


def _new_chunk(
    definition: DocumentDefinition,
    *,
    version: str,
    section_number: str,
    section_title: str,
    heading_path: str,
    chunk_type: str,
    page_number: int,
    text: str,
    stable_key: str,
) -> PolicyChunk:
    prefixed_text = f"{heading_path}\n{text}".strip()
    chunk_id = hashlib.sha256(
        f"{definition.doc_id}|{stable_key}".encode("utf-8")
    ).hexdigest()
    content_hash = hashlib.sha256(prefixed_text.encode("utf-8")).hexdigest()
    return PolicyChunk(
        chunk_id=chunk_id,
        content_hash=content_hash,
        text=prefixed_text,
        metadata={
            "collection": definition.collection,
            "docId": definition.doc_id,
            "docTitle": definition.doc_title,
            "docVersion": version,
            "sectionNumber": section_number,
            "sectionTitle": section_title,
            "headingPath": heading_path,
            "chunkType": chunk_type,
            "pageNumber": page_number,
            "chunkId": chunk_id,
            "contentHash": content_hash,
        },
    )


def _read_document_info(page: Any, definition: DocumentDefinition) -> str:
    version = ""
    for table in page.find_tables():
        for row in table.extract() or []:
            if len(row) >= 2 and _clean_text(row[0]).casefold() == "version":
                version = _clean_text(row[1])
            if len(row) >= 2 and _clean_text(row[0]).casefold() == "document id":
                actual_id = _clean_text(row[1])
                if actual_id != definition.doc_id:
                    raise ValueError(
                        f"{definition.filename} contains document ID {actual_id}, "
                        f"expected {definition.doc_id}."
                    )
    if not version:
        raise ValueError(f"Document version is missing from {definition.filename}.")
    return version


def parse_policy_pdf(
    pdf_path: Path,
    definition: DocumentDefinition,
    *,
    max_tokens: int | None = None,
    overlap_tokens: int | None = None,
) -> list[PolicyChunk]:
    """Extract pages 2+, section paragraphs, FAQ pairs, and structured table rows."""
    if not pdf_path.is_file():
        raise FileNotFoundError(f"Policy PDF is missing: {pdf_path}")
    chunks: list[PolicyChunk] = []
    current_h1: tuple[str, str] | None = None
    current_h2: tuple[str, str] | None = None
    section_paragraphs: dict[tuple[str, str, str], list[tuple[int, str]]] = {}
    faq_question = ""
    faq_answer = ""
    faq_page = 0
    table_index_by_section: dict[tuple[str, str], int] = {}
    section_chunk_index: dict[tuple[str, str], int] = {}

    def heading_path() -> str:
        if current_h1 is None:
            return definition.doc_title
        base = f"{current_h1[0]}. {current_h1[1]}"
        if current_h2 is not None:
            if current_h2[0] == current_h1[0]:
                return f"{base} > {current_h2[1]}"
            return f"{base} > {current_h2[0]} {current_h2[1]}"
        return base

    def active_section() -> tuple[str, str]:
        if current_h2 is not None:
            return current_h2
        if current_h1 is not None:
            return current_h1
        return ("", definition.doc_title)

    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) < 2:
            raise ValueError(f"Policy PDF has no policy body pages: {pdf_path.name}")
        version = _read_document_info(pdf.pages[0], definition)

        def flush_faq() -> None:
            nonlocal faq_question, faq_answer, faq_page
            if not faq_question:
                return
            section_number, section_title = active_section()
            if not faq_answer:
                raise ValueError(
                    f"FAQ question without an answer in {pdf_path.name}: {faq_question}"
                )
            chunks.append(
                _new_chunk(
                    definition,
                    version=version,
                    section_number=section_number,
                    section_title=section_title,
                    heading_path=heading_path(),
                    chunk_type="faq",
                    page_number=faq_page,
                    text=f"Q: {faq_question}\nA: {faq_answer}",
                    stable_key=(
                        f"faq|{section_number}|{faq_question.casefold().strip()}"
                    ),
                )
            )
            faq_question = ""
            faq_answer = ""
            faq_page = 0

        def flush_sections() -> None:
            for (number, title, path), page_paragraphs in list(section_paragraphs.items()):
                section_key = (number, path)
                text_parts = chunk_paragraphs(
                    [paragraph for _, paragraph in page_paragraphs],
                    max_tokens=max_tokens,
                    overlap_tokens=overlap_tokens,
                )
                for chunk_index, text in enumerate(text_parts):
                    page_number = page_paragraphs[0][0]
                    key = (number, path)
                    stable_index = section_chunk_index.get(key, 0)
                    section_chunk_index[key] = stable_index + 1
                    chunks.append(
                        _new_chunk(
                            definition,
                            version=version,
                            section_number=number,
                            section_title=title,
                            heading_path=path,
                            chunk_type="section",
                            page_number=page_number,
                            text=text,
                            stable_key=f"section|{section_key}|{stable_index}",
                        )
                    )
            section_paragraphs.clear()

        for page_number, page in enumerate(pdf.pages[1:], start=2):
            tables = page.find_tables()
            table_bounds = [
                tuple(map(float, table.bbox))
                for table in tables
            ]
            lines = page.extract_text_lines(return_chars=True) or []
            filtered_lines = [
                line
                for line in lines
                if float(line.get("top", 0)) >= 45
                and float(line.get("bottom", 0)) <= float(page.height) - 35
                and not _is_inside_table(line, table_bounds)
            ]
            timeline: list[tuple[float, str, Any]] = [
                (float(line.get("top", 0)), "line", line)
                for line in filtered_lines
            ] + [
                (float(table.bbox[1]), "table", table)
                for table in tables
            ]
            timeline.sort(key=lambda item: item[0])

            paragraph_lines: list[str] = []
            previous_bottom: float | None = None

            def flush_paragraph() -> None:
                nonlocal paragraph_lines
                text = _clean_text(" ".join(paragraph_lines))
                if text and current_h1 is not None and current_h1[1] != "Frequently Asked Questions":
                    number, title = active_section()
                    section_paragraphs.setdefault(
                        (number, title, heading_path()), []
                    ).append((page_number, text))
                paragraph_lines = []

            for top, kind, item in timeline:
                if kind == "table":
                    flush_paragraph()
                    section_number, section_title = active_section()
                    path = heading_path()
                    table_key = (section_number, path)
                    table_index = table_index_by_section.get(table_key, 0)
                    table_index_by_section[table_key] = table_index + 1
                    table_title = (
                        f"Table: {section_title}"
                        if section_title
                        else f"Table {table_index + 1}"
                    )
                    chunks.append(
                        _new_chunk(
                            definition,
                            version=version,
                            section_number=section_number,
                            section_title=section_title,
                            heading_path=path,
                            chunk_type="section",
                            page_number=page_number,
                            text=table_title,
                            stable_key=(
                                f"table-title|{section_number}|{table_index}"
                            ),
                        )
                    )
                    sentences = table_rows_to_sentences(item.extract() or [])
                    row_groups = chunk_paragraphs(
                        sentences,
                        max_tokens=max_tokens or settings.policy_chunk_max_tokens,
                        overlap_tokens=0,
                    )
                    for group_index, row_text in enumerate(row_groups):
                        chunks.append(
                            _new_chunk(
                                definition,
                                version=version,
                                section_number=section_number,
                                section_title=section_title,
                                heading_path=path,
                                chunk_type="table_row",
                                page_number=page_number,
                                text=row_text,
                                stable_key=(
                                    f"table-row|{section_number}|{table_index}|"
                                    f"{group_index}"
                                ),
                            )
                        )
                    previous_bottom = None
                    continue

                text = _clean_text(item.get("text"))
                if not text:
                    continue
                h1_match = _H1.match(text)
                h2_match = _H2.match(text)
                if h1_match:
                    flush_paragraph()
                    flush_faq()
                    current_h1 = (h1_match.group("number"), h1_match.group("title"))
                    current_h2 = None
                    previous_bottom = float(item.get("bottom", top))
                    continue
                if h2_match:
                    flush_paragraph()
                    flush_faq()
                    current_h2 = (h2_match.group("number"), h2_match.group("title"))
                    previous_bottom = float(item.get("bottom", top))
                    continue

                if current_h1 and current_h1[1] == "Frequently Asked Questions":
                    if _is_faq_group_heading(item):
                        flush_faq()
                        current_h2 = (current_h1[0], text)
                        previous_bottom = float(item.get("bottom", top))
                        continue
                    question_match = _FAQ_QUESTION.match(text)
                    answer_match = _FAQ_ANSWER.match(text)
                    if question_match:
                        flush_faq()
                        faq_question = question_match.group(1).strip()
                        faq_answer = ""
                        faq_page = page_number
                    elif answer_match and faq_question:
                        faq_answer = answer_match.group(1).strip()
                    elif faq_question:
                        if faq_answer:
                            faq_answer = f"{faq_answer} {text}"
                        else:
                            faq_question = f"{faq_question} {text}"
                    previous_bottom = float(item.get("bottom", top))
                    continue

                top_position = float(item.get("top", top))
                bottom_position = float(item.get("bottom", top_position))
                if (
                    paragraph_lines
                    and previous_bottom is not None
                    and top_position - previous_bottom > 6.5
                ):
                    flush_paragraph()
                paragraph_lines.append(text)
                previous_bottom = bottom_position
            flush_paragraph()
        flush_faq()
        flush_sections()

    if not chunks:
        raise ValueError(f"No policy chunks were extracted from {pdf_path.name}.")
    return chunks


def load_policy_documents(
    directory: Path | None = None,
) -> tuple[list[PolicyChunk], list[Path]]:
    """Parse every supported policy PDF and reject unexpected PDF files."""
    root = (directory or settings.policy_pdf_dir).resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"Policy PDF directory does not exist: {root}")

    supported = {definition.filename: definition for definition in DOCUMENTS}
    pdf_paths = [path for path in root.rglob("*.pdf") if path.is_file()]
    present = {path.name for path in pdf_paths}
    if len(present) != len(pdf_paths):
        raise ValueError(f"Policy PDF filenames must be unique under {root}.")
    unknown = sorted(present - supported.keys())
    if unknown:
        raise ValueError(f"Unsupported policy PDF file(s) in {root}: {', '.join(unknown)}")
    if not present:
        raise FileNotFoundError(f"No policy PDFs found in {root}")

    all_chunks: list[PolicyChunk] = []
    parsed_paths: list[Path] = []
    paths_by_name = {path.name: path for path in pdf_paths}
    for filename in sorted(present):
        path = paths_by_name[filename]
        all_chunks.extend(parse_policy_pdf(path, supported[filename]))
        parsed_paths.append(path)
    return all_chunks, parsed_paths
