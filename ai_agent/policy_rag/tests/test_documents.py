from pathlib import Path

import pytest

from ai_agent.policy_rag import documents
from ai_agent.policy_rag.documents import (
    DOCUMENTS,
    chunk_paragraphs,
    parse_policy_pdf,
    table_rows_to_sentences,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
POLICY_DIRECTORY = REPOSITORY_ROOT / "ai_agent" / "rag_knowledge"


@pytest.mark.parametrize("definition", DOCUMENTS)
def test_real_policy_pdfs_are_structured_without_title_pages(definition):
    chunks = parse_policy_pdf(POLICY_DIRECTORY / definition.filename, definition)

    assert chunks
    assert all(chunk.metadata["docId"] == definition.doc_id for chunk in chunks)
    assert all(chunk.metadata["collection"] == definition.collection for chunk in chunks)
    assert all(chunk.metadata["pageNumber"] >= 2 for chunk in chunks)
    assert all(chunk.metadata["chunkId"] == chunk.chunk_id for chunk in chunks)
    assert all(chunk.metadata["contentHash"] == chunk.content_hash for chunk in chunks)
    assert all("Contents" not in chunk.text for chunk in chunks)
    assert all("GENTECH" not in chunk.text for chunk in chunks)
    assert all("| GT-POL-" not in chunk.text for chunk in chunks)


@pytest.mark.parametrize(
    ("definition", "expected_count", "expected_group"),
    [
        (DOCUMENTS[0], 34, "Claims, documents and process"),
        (DOCUMENTS[1], 30, "Cancellation and refunds"),
        (DOCUMENTS[2], 28, "Damaged, lost and wrong parcels"),
    ],
)
def test_faq_pairs_are_separate_chunks_with_faq_heading_groups(
    definition,
    expected_count,
    expected_group,
):
    chunks = parse_policy_pdf(POLICY_DIRECTORY / definition.filename, definition)
    faq_chunks = [chunk for chunk in chunks if chunk.metadata["chunkType"] == "faq"]

    assert len(faq_chunks) == expected_count
    assert all(chunk.text.count("Q:") == 1 for chunk in faq_chunks)
    assert all(chunk.text.count("A:") == 1 for chunk in faq_chunks)
    assert any(expected_group in chunk.metadata["headingPath"] for chunk in faq_chunks)


def test_delivery_table_rows_keep_cell_to_header_mapping():
    definition = DOCUMENTS[2]
    chunks = parse_policy_pdf(POLICY_DIRECTORY / definition.filename, definition)
    delivery_fee_rows = [
        chunk.text
        for chunk in chunks
        if chunk.metadata["chunkType"] == "table_row"
        and chunk.metadata["sectionNumber"] == "3.1"
    ]

    assert len(delivery_fee_rows) == 1
    assert "Zone: Zone 3: Divisional cities" in delivery_fee_rows[0]
    assert "Standard fee (BDT): 120" in delivery_fee_rows[0]
    assert "Estimated delivery time after dispatch: 2 to 3 business days" in delivery_fee_rows[0]


def test_delivery_section_tree_includes_heading_path():
    definition = DOCUMENTS[2]
    chunks = parse_policy_pdf(POLICY_DIRECTORY / definition.filename, definition)

    assert any(
        chunk.metadata["headingPath"]
        == "3. Delivery Fees > 3.1 Standard delivery fees"
        for chunk in chunks
    )


def test_table_converter_preserves_headers_and_continuation_rows():
    sentences = table_rows_to_sentences(
        [
            ["Zone", "Standard fee (BDT)", "Estimated delivery"],
            ["Zone 3: Divisional cities", "120", "2 to 3 business days"],
            ["", "", "for the main areas"],
        ]
    )

    assert sentences == [
        "Zone: Zone 3: Divisional cities; Standard fee (BDT): 120; "
        "Estimated delivery: 2 to 3 business days for the main areas"
    ]


def test_chunker_respects_limit_and_keeps_overlap():
    chunks = chunk_paragraphs(
        [" ".join(f"word{i}" for i in range(120))],
        max_tokens=50,
        overlap_tokens=10,
    )

    assert len(chunks) == 3
    assert all(len(chunk.split()) <= 50 for chunk in chunks)
    assert chunks[0].split()[-10:] == chunks[1].split()[:10]
    assert chunks[1].split()[-10:] == chunks[2].split()[:10]


def test_empty_pdf_extraction_is_reported_instead_of_returning_no_chunks(
    monkeypatch,
    tmp_path,
):
    definition = DOCUMENTS[0]

    class FakeTable:
        def extract(self):
            return [
                ["Document ID", definition.doc_id],
                ["Version", "1.0"],
            ]

    class FakePage:
        height = 842

        def __init__(self, title_page=False):
            self.title_page = title_page

        def find_tables(self):
            return [FakeTable()] if self.title_page else []

        def extract_text_lines(self, *, return_chars):
            assert return_chars is True
            return []

    class FakePDF:
        pages = [FakePage(title_page=True), FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

    monkeypatch.setattr(documents.pdfplumber, "open", lambda _path: FakePDF())
    pdf_path = tmp_path / "empty.pdf"
    pdf_path.touch()
    with pytest.raises(ValueError, match="No policy chunks were extracted"):
        parse_policy_pdf(pdf_path, definition)


def test_missing_pdf_is_reported():
    with pytest.raises(FileNotFoundError, match="Policy PDF is missing"):
        parse_policy_pdf(Path("missing-policy.pdf"), DOCUMENTS[0])
