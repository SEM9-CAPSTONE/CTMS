"""Fixture assertions run even when the opt-in model integration suite is off."""

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
