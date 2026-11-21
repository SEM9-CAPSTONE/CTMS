"""Keep Docling's native font decoding and render exact source pixels with PDFium."""

from io import BytesIO

import pypdfium2 as pdfium
from docling.backend.docling_parse_backend import (
    ThreadedDoclingParseDocumentBackend,
    ThreadedDoclingParsePageBackend,
)
from docling.utils.locks import pypdfium2_lock
from docling.datamodel.backend_options import ThreadedDoclingParseBackendOptions


class KnowledgePdfPageBackend(ThreadedDoclingParsePageBackend):
    def __init__(self, source, raster_source):
        self._source_page_no = source.page_no
        self._source_size = source.get_size().model_copy(deep=True)
        super().__init__(source._result, rendered=True)
        self._raster_source = raster_source

    @property
    def page_no(self):
        return self._source_page_no

    def get_size(self):
        return self._source_size

    def get_page_image(self, scale=1, cropbox=None):
        # Use the same source renderer as the independent audit. The threaded
        # native renderer's image buffer can be invalidated between PDF stages;
        # PDFium resources here are owned and copied inside one locked scope.
        with pypdfium2_lock:
            # A page must not borrow the parent backend's native document:
            # threaded pipeline cleanup can unload it before a later render.
            with pdfium.PdfDocument(self._raster_source) as document:
                page = document[self.page_no - 1]
                try:
                    bitmap = page.render(scale=scale)
                    try:
                        image = bitmap.to_pil().convert("RGB").copy()
                    finally:
                        bitmap.close()
                finally:
                    page.close()
        if cropbox is not None:
            box = cropbox.to_top_left_origin(self.get_size().height)
            image = image.crop(tuple(round(value * scale) for value in (box.l, box.t, box.r, box.b)))
        return image


class KnowledgePdfDocumentBackend(ThreadedDoclingParseDocumentBackend):
    def __init__(self, in_doc, path_or_stream, options=None):
        self._raster_source = path_or_stream.getvalue() if isinstance(path_or_stream, BytesIO) else path_or_stream
        settings = options.model_dump() if options is not None else {}
        # Native decoding supplies fonts/cells only. Rendering the same page
        # twice wastes CPU/memory and retains a second native image lifetime.
        settings.update(render_pages=False, parser_threads=1, max_concurrent_results=2)
        try:
            super().__init__(in_doc, path_or_stream, ThreadedDoclingParseBackendOptions(**settings))
        except BaseException:
            self._raster_source = None
            raise

    def iter_pages(self):
        for page in super().iter_pages():
            yield KnowledgePdfPageBackend(page, self._raster_source)

    def unload(self):
        try:
            super().unload()
        finally:
            self._raster_source = None
