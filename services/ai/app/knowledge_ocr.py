"""CPU OCR and independent rendered-page evidence. Never invent source text.

Docling owns extraction/reading order. Separate TSV recognition checks its selected
text regions against the source raster; scans without regions use the whole page.
Confidence, agreement and residual ink are complementary evidence, not a guarantee
that an OCR engine can read every possible scan correctly.
"""

import csv
import math
import os
import re
import subprocess
from collections import Counter
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from contextlib import contextmanager

import numpy as np

from app.knowledge_chunking import CRITICAL, UNITS as TEXT_UNITS, contains_words, words
from app.knowledge_models import PageExtractionReport
from app.ocr_artifacts import OcrRuntimeError

OCR_SCALE = 3.0  # 216 dpi, in both Docling region recognition and raster audit
MIN_WORD_CONFIDENCE = 0.75
MIN_CRITICAL_CONFIDENCE = 0.90
MIN_MEAN_CONFIDENCE = 0.90
UNITS = TEXT_UNITS | {"s", "min", "°c", "%"}


def tesseract_command() -> str:
    return os.environ.get("CTMS_TESSERACT_CMD", "tesseract")


def tessdata_path() -> str | None:
    return os.environ.get("CTMS_TESSDATA_PATH") or None


def run_tesseract(arguments: list[str]) -> str:
    try:
        result = subprocess.run([tesseract_command(), *arguments], capture_output=True,
                                timeout=120, check=True, encoding="utf-8")
        return (result.stdout or result.stderr) if arguments == ["--version"] else result.stdout
    except (OSError, subprocess.SubprocessError, UnicodeError) as error:
        raise OcrRuntimeError("ocr_runtime_unavailable") from error


def check_ocr_runtime() -> None:
    # Keep recognition behavior stable across local and production deployments.
    version = run_tesseract(["--version"]).splitlines()
    if not version or not re.match(r"tesseract v?5\.5\.0(?:\D|$)", version[0]):
        raise OcrRuntimeError("ocr_runtime_version_mismatch")
    from app.ocr_artifacts import verify_models
    verify_models(tessdata_path())
    # Docling 2.148 probes --list-langs without its configured --tessdata-dir.
    # The process-wide runtime has one fixed, checksum-verified model directory.
    os.environ["TESSDATA_PREFIX"] = tessdata_path()


@dataclass(frozen=True)
class OcrWord:
    text: str
    confidence: float
    bbox: tuple[float, float, float, float]  # top-left PDF points
    line: tuple[int, int, int]


def binarize(image):
    """Separate foreground glyphs from uniform paper, including reversed labels."""
    import cv2
    pixels = np.asarray(image.convert("L"))
    _, binary = cv2.threshold(pixels, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    border = np.concatenate([binary[0], binary[-1], binary[:, 0], binary[:, -1]])
    if binary.min() != binary.max() and np.mean(border == 0) > 0.5:
        binary = 255 - binary
    return binary


def prepare_ocr_image(image, *, table=False):
    """Normalize source contrast before supplying white recognition margins."""
    from PIL import Image, ImageOps
    pixels = np.asarray(image.convert("L"))
    paper = np.concatenate([pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]])
    # Preserve anti-aliasing on ordinary white paper. Hard thresholding tiny
    # Vietnamese accents would discard useful evidence. Colored/reversed labels
    # need foreground separation rather than recognition of their background.
    normalized = image.convert("L") if np.median(paper) >= 245 else Image.fromarray(binarize(image))
    if table:
        import cv2
        ink = (binarize(image) == 0).astype(np.uint8)
        rules = np.zeros_like(ink)
        for shape in [(max(30, image.width // 3), 1), (1, max(30, image.height // 20))]:
            rules |= cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, shape))
        clean = np.asarray(normalized).copy()
        clean[cv2.dilate(rules, np.ones((3, 3), np.uint8)) > 0] = 255
        normalized = Image.fromarray(clean)
    # Small raster labels need the same glyph resolution as normal prose.
    factor = 2 if image.height < 120 else 1
    if factor != 1:
        normalized = normalized.resize((image.width * factor, image.height * factor), Image.Resampling.LANCZOS)
    border = round(OCR_SCALE * 2)
    return ImageOps.expand(normalized, border=border * factor, fill="white"), factor, border


def recognize(image, *, psm: int = 3, language: str = "vie+eng", table: bool = False) -> list[OcrWord]:
    table = table and has_table_grid(image)
    if table:
        psm = 11
    image, factor, border = prepare_ocr_image(image, table=table)
    with TemporaryDirectory(prefix="ctms-ocr-") as folder:
        filename = Path(folder) / "page.png"
        image.save(filename, dpi=(216 * factor, 216 * factor))
        args = [str(filename), "stdout", "-l", language, "--psm", str(psm)]
        if tessdata_path():
            args.extend(["--tessdata-dir", tessdata_path()])
        output = run_tesseract([*args, "tsv"])
    result = []
    try:
        for row in csv.DictReader(StringIO(output), delimiter="\t", quoting=csv.QUOTE_NONE):
            if row["level"] != "5" or not row["text"].strip():
                continue
            if not any(c.isalnum() for c in row["text"]) and row["text"].strip() not in {"%", "°", "±", "+", "-", "−", "=", "<", ">", "≤", "≥"}:
                continue
            left, top, width, height = [float(row[key]) / (OCR_SCALE * factor)
                                       for key in ("left", "top", "width", "height")]
            left -= border / OCR_SCALE
            top -= border / OCR_SCALE
            confidence = float(row["conf"]) / 100
            if not math.isfinite(confidence) or not 0 <= confidence <= 1 or width <= 0 or height <= 0:
                raise ValueError("invalid OCR evidence")
            result.append(OcrWord(row["text"], confidence, (left, top, left + width, top + height),
                                  tuple(int(row[key]) for key in ("block_num", "par_num", "line_num"))))
    except (KeyError, TypeError, ValueError) as error:
        raise OcrRuntimeError("ocr_invalid_evidence") from error
    return result


def uncovered_ink(image, boxes, has_table: bool) -> bool:
    """Account for raster marks outside recognized text; do not erase diagrams.

    Table rules may be removed only on pages actually containing an extracted
    table. Large unexplained components remain blocking even on full-page scans.
    """
    import cv2
    ink = (binarize(image) == 0).astype(np.uint8)
    total = int(ink.sum())
    rules = np.zeros_like(ink)
    if has_table:
        # Detect both directions on the intact raster; removing one direction
        # first would break intersecting rules into short unrecognizable stubs.
        for shape in [(max(30, ink.shape[1] // 20), 1), (1, max(30, ink.shape[0] // 20))]:
            rules |= cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, shape))
    for left, top, right, bottom in boxes:
        l, t = max(0, int((left - 1) * OCR_SCALE)), max(0, int((top - 1) * OCR_SCALE))
        r, b = int((right + 1) * OCR_SCALE), int((bottom + 1) * OCR_SCALE)
        ink[t:b, l:r] = 0
    if has_table:
        ink[cv2.dilate(rules, np.ones((3, 3), np.uint8)) > 0] = 0
    count, _, stats, _ = cv2.connectedComponentsWithStats(ink, 8)
    residual = sum(int(stats[i, cv2.CC_STAT_AREA]) for i in range(1, count)
                   if stats[i, cv2.CC_STAT_AREA] >= 12)
    return residual > max(24, total * 0.01)


def has_table_grid(image):
    """Select table segmentation only with multiple long rules in both axes."""
    import cv2
    ink = (binarize(image) == 0).astype(np.uint8)
    counts = []
    for horizontal in [True, False]:
        shape = (max(30, image.width // 3), 1) if horizontal else (1, max(30, image.height // 20))
        rules = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, shape))
        projection = np.any(rules, axis=1 if horizontal else 0).astype(np.int8)
        counts.append(int(np.count_nonzero(np.diff(np.pad(projection, 1)) == 1)))
    return all(count >= 2 for count in counts)


def validate_page(image, page: int, native: str, ocr_cells, output: str,
                  has_table: bool = False, *, psm: int = 3, language: str = "vie+eng", audit_words=None, audit_evidence=None) -> PageExtractionReport:
    pixels = np.asarray(image.convert("L"))
    if pixels.min() >= 250:
        # No visible marks, and neither extraction path is allowed to hallucinate.
        return PageExtractionReport(page=page, mode="blank", issues=["blank_page_has_text"]
                                    if native.strip() or output.strip() or ocr_cells else [])
    if audit_words is not None:
        audit = audit_words
    elif has_table:
        audit = recognize(image, psm=psm, language=language, table=True)
    elif language == "vie+eng":
        audit = recognize(image) if psm == 3 else recognize(image, psm=psm)
    else:
        audit = recognize(image, psm=psm, language=language)
    if audit_evidence is not None:
        audit_evidence.extend(audit)
    if (not any(any(c.isalnum() for c in word.text) for word in audit)
            and not any(any(c.isalnum() for c in cell.text) for cell in ocr_cells)
            and not native.strip() and has_table and not uncovered_ink(image, [], True)):
        # An empty template can contain table rules without any source text.
        # Do not invent OCR words from its blank form rows.
        return PageExtractionReport(page=page, mode="ocr")
    mode = ("mixed" if ocr_cells else "native") if native.strip() else "ocr"
    issues = set()
    if not audit or not ocr_cells and not native.strip():
        issues.add("ocr_text_unverifiable")
    confidences = [word.confidence for word in audit] + [cell.confidence for cell in ocr_cells]
    if (not confidences or any(not math.isfinite(c) or c < MIN_WORD_CONFIDENCE for c in confidences)
            or sum(confidences) / len(confidences) < MIN_MEAN_CONFIDENCE):
        issues.add("ocr_low_confidence")
    lines = {}
    for word in audit:
        lines.setdefault(word.line, []).append(word)
    for line in lines.values():
        critical = CRITICAL.search(" ".join(w.text for w in line))
        for word in line:
            if (critical or re.search(r"\d", word.text) or word.text.casefold().strip("()[]:.,") in UNITS
                    ) and word.confidence < MIN_CRITICAL_CONFIDENCE:
                issues.add("ocr_critical_content_unverified")
        if critical and not contains_words(" ".join(w.text for w in line), output):
            issues.add("missing_critical_pdf_text")
    reference = Counter(words(" ".join(w.text for w in audit)))
    missing = reference - Counter(words(output))
    coverage = 1 - sum(missing.values()) / max(1, reference.total())
    # OCR has no native reference to justify ignoring even a small omission.
    if missing:
        issues.add("ocr_text_coverage_incomplete")
    if any(re.search(r"\d", token) or CRITICAL.search(token) for token in missing):
        issues.add("ocr_critical_content_unverified")
    if any(not contains_words(cell.text, output) for cell in ocr_cells):
        issues.add("missing_ocr_content")
    if "\ufffd" in output or "\0" in output:
        issues.add("ocr_text_unverifiable")
    if uncovered_ink(image, [w.bbox for w in audit], has_table):
        issues.add("ocr_unverified_visual_content")
    return PageExtractionReport(page=page, mode=mode if audit else "unverified", ocr_words=len(audit),
                                minimum_confidence=min(confidences) if confidences and all(math.isfinite(c) for c in confidences) else None,
                                text_coverage=coverage, issues=sorted(issues))


def recover_region(image, page, finding, outcome, output, has_table, locale):
    """One distinct alternative per source region; agreement never edits values."""
    from types import SimpleNamespace
    from app.knowledge_integrity import fingerprint
    if (len(finding["attempts"]) >= 2 or any(a["method"] == "tesseract_psm13" for a in finding["attempts"])
            or finding["kind"] not in {"caption", "text", "formula"} or not finding["original_text"]):
        return outcome
    finding["assessment"] = "recoverable"
    try:
        candidate = recognize(image, psm=13, language="eng" if locale == "en" else "vie+eng")
        text = " ".join(word.text for word in candidate)
        finding["recovery_text"] = text
        original = finding["original_text"]
        same = words(text) == words(original)
        if same and not finding["critical"]:
            cells = [SimpleNamespace(text=w.text, confidence=w.confidence) for w in candidate]
            checked = validate_page(image, page, "", cells, output, has_table, audit_words=candidate)
            if not checked.issues:
                outcome = checked
    except OcrRuntimeError:
        pass
    finding["assessment"] = "verified" if not outcome.issues else "requires_manual_verification"
    finding["attempts"].append(dict(method="tesseract_psm13", outcome=finding["assessment"], input=fingerprint([finding["id"], "psm13"])))
    return outcome


@contextmanager
def source_raster(pdf):
    import pypdfium2 as pdfium
    from docling.utils.locks import pypdfium2_lock
    with pypdfium2_lock:
        document = pdfium.PdfDocument(pdf)
    try:
        yield document
    finally:
        with pypdfium2_lock:
            document.close()


def validate_ocr_pages(pdf: bytes, conversion, native_pages: list[str], prepared,
                       bitmap_pages: list[bool], *, locale: str = "vi"):
    from docling.utils.locks import pypdfium2_lock
    from functools import partial
    from types import SimpleNamespace
    from app.knowledge_integrity import fingerprint, make_region
    import logging
    validate = partial(validate_page, language="eng") if locale == "en" else validate_page
    reports = []
    safe_backgrounds = set()
    # Docling conversion Page/page confidence are one-based; PDFium indexing is zero-based.
    pages = {p.page_no: p for p in conversion.pages}
    tables = {p.page_no for item, _ in conversion.document.iterate_items()
              if item.label.value in {"table", "document_index"} for p in item.prov}
    with source_raster(pdf) as rendered:
        for number, native in enumerate(native_pages, 1):
            page = pages.get(number)
            cells = [c for c in page.cells if c.from_ocr] if page else []
            regions = (getattr(page, "_ctms_ocr_audit_regions", None)
                       or getattr(page, "_ctms_ocr_regions", None)) if page else None
            if native.strip() and not cells and not regions:
                reports.append(PageExtractionReport(page=number, mode="native"))
                continue
            # Count actual page content only, not the uploaded title/context from another page.
            output = "\n".join("\n".join([*c.headings, c.content]) for c in prepared
                               if any(loc.page == number for loc in c.locations))
            with pypdfium2_lock:
                rendered_page = rendered[number - 1]
                try:
                    bitmap = rendered_page.render(scale=OCR_SCALE)
                    try:
                        image = bitmap.to_pil().copy()
                    finally:
                        bitmap.close()
                finally:
                    # PdfPage in PDFium 5.14 is not a context manager.
                    rendered_page.close()
            if regions:
                region_reports = []
                findings = []
                audit_boxes = []
                for region in regions:
                    box = region.to_top_left_origin(image.height / OCR_SCALE)
                    crop = image.crop((round(box.l * OCR_SCALE), round(box.t * OCR_SCALE),
                                       round(box.r * OCR_SCALE), round(box.b * OCR_SCALE)))
                    region_cells = [cell for cell in cells if cell.rect.to_bounding_box()
                                    .to_top_left_origin(image.height / OCR_SCALE).intersection_area_with(box) > 0]
                    # The independent recognizer's coordinates are crop-local,
                    # just like the raster passed to the residual-ink check.
                    full_page = box.area() >= image.width * image.height / OCR_SCALE**2 * 0.8
                    evidence = []
                    outcome = validate(crop, number, "", region_cells,
                                                        output if region_cells else "", number in tables,
                                                        psm=3 if full_page or number in tables else 6, audit_evidence=evidence)
                    audit_boxes.extend((word.bbox[0]+box.l, word.bbox[1]+box.t, word.bbox[2]+box.l, word.bbox[3]+box.t) for word in evidence)
                    if outcome.issues:
                        finding = make_region(conversion.document, number, box.model_dump(mode="json"), outcome.issues)
                        finding["attempts"] = [dict(method="primary", outcome="unverified", input=fingerprint(finding["bbox"]))]
                        if finding["original_text"]:
                            outcome = recover_region(crop, number, finding, outcome, output, number in tables, locale)
                            logging.getLogger("uvicorn.error").info("integrity_recovery page=%s region=%s outcome=%s", number, finding["id"], finding["attempts"][-1]["outcome"])
                        findings.append(finding)
                    region_reports.append(outcome)
                confidences = [r.minimum_confidence for r in region_reports if r.minimum_confidence is not None]
                count = sum(r.ocr_words for r in region_reports)
                report = PageExtractionReport(
                    page=number, mode="mixed" if native.strip() else "ocr", ocr_words=count,
                    minimum_confidence=min(confidences) if confidences else None,
                    text_coverage=(sum((r.text_coverage or 0) * r.ocr_words for r in region_reports) / count
                                   if count else None),
                    issues=sorted({issue for r in region_reports for issue in r.issues}),
                    regions=findings,
                )
                if not native.strip() and audit_boxes and uncovered_ink(image, audit_boxes, number in tables):
                    # Clean text crops cannot prove that the rest of a scanned
                    # page contains no diagram or visual-only instruction.
                    report.issues = sorted(set([*report.issues, "ocr_unverified_visual_content"]))
                    picture = next((item for item in conversion.document.pictures if any(p.page_no == number and p.bbox.area() >= image.width * image.height / OCR_SCALE**2 * .9 for p in item.prov)), None)
                    report.regions.append(make_region(conversion.document, number,
                        dict(l=0, t=0, r=image.width/OCR_SCALE, b=image.height/OCR_SCALE, coord_origin="TOPLEFT"),
                        ["ocr_unverified_visual_content"], refs=[picture.self_ref] if picture else None, kind="image" if picture else "page"))
                if not native.strip() and not cells and not count:
                    # Empty selected crops do not prove that the original page
                    # is blank. A missed scan must not disappear behind a clean ROI.
                    report = validate(image, number, "", cells, output, number in tables)
            else:
                # No usable text layer/region evidence: audit the full raster,
                # including for blank pages and missing layout detections.
                report = validate(image, number, native, cells, output, number in tables)
            # A chunk may span several pages. Check the page-local structured
            # items too, so a repeated sentence on another page cannot mask loss.
            extracted = []
            for item, _ in conversion.document.iterate_items(traverse_pictures=True):
                if any(p.page_no == number for p in item.prov):
                    extracted.append(" ".join(c.text for c in item.data.table_cells)
                                     if item.label.value in {"table", "document_index"} else
                                     " ".join([getattr(item, "marker", ""), getattr(item, "text", "")]))
            page_text = "\n".join(extracted)
            if any(not contains_words(cell.text, page_text) for cell in cells):
                report.issues = sorted(set([*report.issues, "missing_ocr_content"]))
            reports.append(report)
            if not report.issues:
                safe_backgrounds.add(number)
    return reports, safe_backgrounds
