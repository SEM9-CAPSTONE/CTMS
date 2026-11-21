"""Text ingestion: OCR text/table regions, never recognize photographs as prose."""

from docling.models.stages.ocr.tesseract_ocr_cli_model import TesseractOcrCliModel
from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline


class TextRegionTesseractOcrModel(TesseractOcrCliModel):
    def get_ocr_rects(self, page):
        layout = page.predictions.layout
        audit_candidates = None
        if layout is not None and not page._broken_text_layer:
            # Keep tables, captions, lists and other text detections. A picture's
            # pixels are not text evidence; native labels remain PDF text cells.
            pictures = [cluster.bbox for cluster in layout.clusters if cluster.label.value == "picture"]
            page._ctms_picture_regions = pictures
            native = [cell.rect.to_bounding_box().to_top_left_origin(page.size.height)
                      for cell in page.cells if not cell.from_ocr and any(c.isalnum() for c in cell.text)]
            bitmaps = list(page._backend.get_bitmap_rects()) if page._backend is not None and native else []
            clusters = []
            for cluster in layout.clusters:
                if cluster.label.value == "picture":
                    continue
                box = cluster.bbox
                if (native and cluster.label.value == "text" and
                        any(box.intersection_area_with(picture) >= box.area() * 0.8 for picture in pictures)):
                    # Overlapping layout detections inside a photograph/drawing
                    # are not source prose: this is a photograph/illustration,
                    # not a scan-only page. Retain separately detected headings
                    # and captions; native figure labels remain independent.
                    continue
                backed = [cell for cell in native if cell.intersection_area_with(box) > min(cell.area(), box.area()) * 0.5]
                if not backed:
                    clusters.append(cluster)
                    continue
                # Native PDF cells are the source for already readable text.
                # A colored background/outline must not force lossier OCR of it.
                # Still recognize a separate raster fragment in a mixed region.
                for bitmap in bitmaps:
                    overlap = bitmap.intersection_area_with(box)
                    if overlap <= 0 or any(bitmap.intersection_area_with(p) >= bitmap.area() * 0.8 for p in pictures):
                        continue
                    covers_region = overlap >= box.area() * 0.8
                    native_height = max(cell.b for cell in backed) - min(cell.t for cell in backed)
                    native_width = max(cell.r for cell in backed) - min(cell.l for cell in backed)
                    if covers_region and native_height >= box.height * 0.5 and native_width >= box.width * 0.5:
                        continue
                    if not covers_region and any(bitmap.intersection_area_with(cell) > 0 for cell in backed):
                        continue
                    clipped = bitmap.model_copy(update={"l": max(bitmap.l, box.l), "t": max(bitmap.t, box.t),
                                                        "r": min(bitmap.r, box.r), "b": min(bitmap.b, box.b)})
                    clusters.append(cluster.model_copy(update={"bbox": clipped}))
            # A scan can be detected as one large picture. With no native text
            # and no text detections, retain OCR rather than dropping the page.
            if not clusters and not any(not cell.from_ocr and cell.text.strip() for cell in page.cells):
                clusters = layout.clusters
            text_layout = layout.model_copy(update={"clusters": clusters})
            # Recognition expands/merges rectangles for context. Audit the
            # actual text detections, so that padding does not include artwork.
            audit_candidates = [cluster.bbox for cluster in clusters]
            selection_page = page.model_copy(update={
                "predictions": page.predictions.model_copy(update={"layout": text_layout}),
            })
        else:
            selection_page = page
        regions = super().get_ocr_rects(selection_page)
        if audit_candidates is not None and self.options.mode.value != "full_page":
            chosen = {tuple(round(value, 4) for value in box.as_tuple()): box for box in audit_candidates
                      if box.area() > 0 and any(box.intersection_area_with(region) >= box.area() * 0.5
                                               for region in regions)}
            regions = self._drop_contained_rects(list(chosen.values()))
            merged = []
            for box in regions:
                while True:
                    overlaps = [other for other in merged
                                if box.intersection_area_with(other) >= min(box.area(), other.area()) * 0.5]
                    if not overlaps:
                        break
                    for other in overlaps:
                        merged.remove(other)
                        box = box.model_copy(update={"l": min(box.l, other.l), "t": min(box.t, other.t),
                                                     "r": max(box.r, other.r), "b": max(box.b, other.b)})
                merged.append(box)
            regions = merged
            regions = [box.model_copy(update={"l": max(0, box.l - 1), "t": max(0, box.t - 1),
                                              "r": min(page.size.width, box.r + 1),
                                              "b": min(page.size.height, box.b + 1)}) for box in regions]
        page._ctms_ocr_audit_regions = regions
        # Retain the exact recognition regions for the independent raster audit.
        # This transient attribute is not part of the serialized PDF/HTTP contract.
        page._ctms_ocr_regions = regions
        return regions

    def _run_tesseract(self, ifilename, osd):
        import pandas as pd
        from PIL import Image
        from app.knowledge_ocr import has_table_grid, prepare_ocr_image, uncovered_ink
        # A tight text crop must not include an adjacent pictogram. White image
        # padding supplies recognition margins without adding source pixels.
        with Image.open(ifilename) as image:
            if not uncovered_ink(image, [], True):
                # Empty grid rules/underlines cannot supply OCR words. The
                # independent page audit still checks the original raster.
                return pd.DataFrame(columns=["text", "conf", "left", "top", "width", "height"])
            table = has_table_grid(image)
            padded, factor, border = prepare_ocr_image(image, table=table)
        padded.save(ifilename, dpi=(72 * self.scale * factor, 72 * self.scale * factor))
        options = self.options
        try:
            # A table is several aligned text blocks, not one uniform paragraph.
            # The independent audit uses the same table/page segmentation mode.
            self.options = options.model_copy(update={"psm": 11 if table else options.psm})
            result = super()._run_tesseract(ifilename, osd)
        finally:
            self.options = options
        if not result.empty:
            result = result.astype({column: float for column in ["left", "top", "width", "height"]})
            for column in ["left", "top", "width", "height"]:
                result[column] = result[column] / factor
            result["left"] = result["left"] - border
            result["top"] = result["top"] - border
        return result

    def post_process_cells(self, ocr_cells, page, conv_res, priority=None):
        # Rules/blank form underlines are not words. Keep standalone mathematical
        # and unit symbols, which may carry meaning next to a numeric value.
        symbols = {"%", "°", "±", "+", "-", "−", "=", "<", ">", "≤", "≥"}
        cells = [cell for cell in ocr_cells if any(c.isalnum() for c in cell.text) or cell.text.strip() in symbols]
        return super().post_process_cells(cells, page, conv_res, priority)


class KnowledgePdfPipeline(StandardPdfPipeline):
    def _make_ocr_model(self, art_path):
        return TextRegionTesseractOcrModel(
            enabled=self.pipeline_options.do_ocr,
            artifacts_path=art_path,
            options=self.pipeline_options.ocr_options,
            accelerator_options=self.pipeline_options.accelerator_options,
        )
