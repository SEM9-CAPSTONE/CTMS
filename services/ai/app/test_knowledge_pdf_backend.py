"""Real source raster/crop fidelity without layout or embedding models."""

from io import BytesIO

import numpy as np
import pypdfium2 as pdfium
from docling.datamodel.base_models import InputFormat
from docling.datamodel.document import InputDocument
from docling_core.types.doc import BoundingBox, CoordOrigin

from app.knowledge_pdf_backend import KnowledgePdfDocumentBackend
from app.test_knowledge_page_numbers import source_pdf


def test_native_font_decoding_and_rendered_crops_share_original_page_coordinates(monkeypatch):
    data = source_pdf()
    source = InputDocument(BytesIO(data), filename="source.pdf", format=InputFormat.PDF,
                           backend=KnowledgePdfDocumentBackend)
    try:
        pages = list(source._backend.iter_pages())
        assert {page.page_no for page in pages} == {1, 2}
        # Source pixels are copied from owned PDFium resources, never the
        # threaded native renderer's retained C++ image buffer.
        def forbidden(*args, **kwargs):
            raise AssertionError("Native renderer image buffer must not be read")
        monkeypatch.setattr(type(pages[0]._result), "get_image", forbidden)
        with pdfium.PdfDocument(data) as reference:
            for page in pages:
                assert "Fictional page" in " ".join(cell.text for cell in page.get_text_cells())
                rendered = reference[page.page_no - 1]
                try:
                    bitmap = rendered.render(scale=3)
                    try:
                        expected = bitmap.to_pil().convert("RGB").copy()
                    finally:
                        bitmap.close()
                finally:
                    rendered.close()
                assert np.array_equal(np.asarray(page.get_page_image(scale=3)), np.asarray(expected))
                crop = BoundingBox(l=10, t=20, r=110, b=60, coord_origin=CoordOrigin.TOPLEFT)
                assert np.array_equal(np.asarray(page.get_page_image(scale=3, cropbox=crop)),
                                      np.asarray(expected.crop((30, 60, 330, 180))))
    finally:
        source._backend.unload()
    assert source._backend._raster_source is None
    # Page pixels remain independently owned even after parent cleanup.
    assert pages[0].get_page_image(scale=1).size == (600, 800)
    source._backend.unload()


def test_pages_render_with_owned_handles_after_parent_cleanup_across_threads():
    from concurrent.futures import ThreadPoolExecutor
    source = InputDocument(BytesIO(source_pdf()), filename="source.pdf", format=InputFormat.PDF,
                           backend=KnowledgePdfDocumentBackend)
    pages = list(source._backend.iter_pages())
    source._backend.unload()
    with ThreadPoolExecutor(max_workers=4) as executor:
        images = list(executor.map(lambda i: np.asarray(pages[i % 2].get_page_image(scale=1)), range(16)))
    assert all(np.array_equal(images[index], images[index % 2]) for index in range(16))
