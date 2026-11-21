"""Fixture assertions run even when the opt-in model integration suite is off."""

import ast
import hashlib
import json
from pathlib import Path

import pytest
from pypdf import PdfReader

ROOT = Path(__file__).parent / "fixtures" / "ocr"


@pytest.mark.parametrize("name", ["scan-vi.pdf", "scan-en.pdf", "scan-multipage.pdf", "scan-blank.pdf",
                                  "scan-table.pdf", "scan-warning.pdf", "scan-unreadable.pdf"])
def test_scan_fixtures_have_no_native_text(name):
    pages = PdfReader(ROOT / name).pages
    assert all(not p.extract_text().strip() for p in pages)
    assert any(p.images for p in pages)


def test_mixed_fixtures_have_real_native_and_raster_regions():
    pages = PdfReader(ROOT / "mixed.pdf").pages
    assert pages[0].extract_text().strip() and not pages[1].extract_text().strip() and pages[1].images
    page = PdfReader(ROOT / "mixed-page.pdf").pages[0]
    assert page.extract_text().strip() and page.images


def test_review_ground_truth_is_literal_generator_text_bound_to_original_pdfs():
    truth = json.loads((ROOT / "ground_truth.json").read_text(encoding="utf-8"))
    source = ast.parse((ROOT / "generate.py").read_text(encoding="utf-8"))
    vi = next(node.value for node in ast.walk(source) if isinstance(node, ast.Assign)
              and any(isinstance(target, ast.Name) and target.id == "vi" for target in node.targets))
    title, lines = [ast.literal_eval(arg) for arg in vi.args]
    assert [line["text"] for line in truth["lines"]] == [title, *lines]
    assert [line["y"] for line in truth["lines"]] == [
        round((180 + 35) / 3, 6), *[round((330 + 85 * i + 25) / 3, 6) for i in range(len(lines))]]
    for name, expected in truth["sources"].items():
        pdf = (ROOT / name).read_bytes()
        assert hashlib.sha256(pdf).hexdigest() == expected["sha256"]
        page = PdfReader(ROOT / name).pages[expected["vietnamese_page"] - 1]
        assert not page.extract_text().strip() and page.images
