"""Version-bound content evidence, human verification and incremental chunk recovery.

The original PDF and each region's original text never change. Human decisions
are applied to the cached derived document. No selected chunk becomes eligible
until all required regions and the independent source checks pass.
"""

import copy
import hashlib
import json
import re
import unicodedata

from app.knowledge_chunking import CRITICAL, NUMBERS, contains_words, split_document
from app.knowledge_models import PageExtractionReport, PreparedChunk


def fingerprint(value):
    # PostgreSQL/JavaScript serialize 10.0 as 10. Normalize numeric evidence so
    # a harmless JSON round trip cannot invalidate a source-bound region ID.
    def stable(item):
        if isinstance(item, dict):
            return {key: stable(part) for key, part in item.items()}
        if isinstance(item, (list, tuple)):
            return [stable(part) for part in item]
        if isinstance(item, (int, float)) and not isinstance(item, bool):
            return format(item, ".9f").rstrip("0").rstrip(".") or "0"
        return item
    return hashlib.sha256(json.dumps(stable(value), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def item_text(item):
    return " | ".join(cell.text for cell in item.data.table_cells) if item.label.value in {"table", "document_index"} else getattr(item, "text", "")


def region_refs(document, page, box):
    return [item.self_ref for item, _ in document.iterate_items(traverse_pictures=True)
            if any(p.page_no == page and p.bbox.to_top_left_origin(document.pages[page].size.height)
                   .intersection_area_with(box) > min(box.area(), p.bbox.area()) * 0.5 for p in item.prov)]


def make_region(document, page, bbox, issues, refs=None, kind=None):
    from docling_core.types.doc import BoundingBox
    box = BoundingBox.model_validate(bbox).to_top_left_origin(document.pages[page].size.height)
    refs = refs if refs is not None else region_refs(document, page, box)
    items = {item.self_ref: item for item, _ in document.iterate_items(traverse_pictures=True)}
    texts = [item_text(items[ref]) for ref in refs if ref in items and items[ref].label.value != "picture"]
    original = "\n".join(value for value in texts if value.strip())
    labels = {items[ref].label.value for ref in refs if ref in items}
    if not refs and any(code.startswith("ocr_") or code == "missing_ocr_content" for code in issues) and kind in {None, "page", "text"}:
        kind = "image"
    if kind == "page" and labels and labels <= {"picture"}:
        kind = "image"
    kind = kind or ("table" if labels & {"table", "document_index"} else "caption" if labels & {"caption"} else "text")
    related = []
    for item in document.pictures:
        for p in item.prov:
            if p.page_no != page:
                continue
            picture = p.bbox.to_top_left_origin(document.pages[page].size.height)
            horizontal = min(picture.r, box.r) > max(picture.l, box.l)
            explicit = any(ref.cref in refs for ref in getattr(item, "captions", []))
            if explicit or picture.intersection_area_with(box) > 0 or horizontal and min(abs(picture.b - box.t), abs(box.b - picture.t)) < 30:
                related.append(item.self_ref)
    normalized = "".join(char for char in unicodedata.normalize("NFKD", original).casefold()
                         if not unicodedata.combining(char))
    short_label = bool(re.fullmatch(r"\s*(?:hinh|figure|fig\.?)[\s.]*[a-z]\s*", normalized))
    if kind == "text" and related and short_label:
        kind = "caption"
    label = kind == "caption" and bool(related) and short_label
    critical = bool(CRITICAL.search(original) or re.search(NUMBERS, original) or kind in {"table", "image", "formula", "page"}
                    or set(issues) & {"missing_numeric_pdf_text", "missing_critical_pdf_text", "missing_critical_content"})
    identity = dict(page=page, bbox=box.model_dump(mode="json"), item_refs=refs, kind=kind, original_text=original)
    return dict(**identity, id=fingerprint(identity), issues=sorted(set(issues)), related_figures=sorted(set(related)),
                critical=critical, excludable=label and not critical, assessment="requires_manual_verification",
                attempts=[], decision=None)


def build_regions(document, reports, issues, scan_backgrounds, literal_tables=(), native_pages=()):
    regions = []
    for report in reports:
        regions.extend(report.regions)
        if report.issues and not report.regions:
            size = document.pages.get(report.page)
            if size:
                regions.append(make_region(document, report.page,
                    dict(l=0, t=0, r=size.size.width, b=size.size.height, coord_origin="TOPLEFT"), report.issues,
                    refs=[] if report.mode == "unverified" else None, kind="image" if report.mode == "unverified" else "page"))
    for item, _ in document.iterate_items(traverse_pictures=True):
        if item.label.value not in {"picture", "formula", "table", "document_index"}:
            continue
        # Correct headers/confidence alone do not verify row/column semantics.
        # Literal forms already proved to have no data relationship to infer.
        if (item.label.value in {"table", "document_index"} and item.self_ref in literal_tables
                and any(cell.text.strip() for cell in item.data.table_cells)
                and item.prov and all(p.page_no <= len(native_pages) and native_pages[p.page_no-1].strip()
                    and all(contains_words(cell.text, native_pages[p.page_no-1]) for cell in item.data.table_cells if cell.text.strip())
                    for p in item.prov)):
            continue
        for p in item.prov:
            size = document.pages[p.page_no].size
            if (item.label.value == "picture" and p.page_no in scan_backgrounds and
                    p.bbox.area() >= size.width * size.height * 0.90):
                continue
            code = "table_relationships_unverified" if item.label.value in {"table", "document_index"} else "visual_content_requires_review"
            finding = make_region(document, p.page_no, p.bbox.model_dump(mode="json"), [code],
                                       refs=[item.self_ref], kind="image" if item.label.value == "picture" else "table" if item.label.value == "document_index" else item.label.value)
            if item.label.value in {"table", "document_index"} and item.self_ref in literal_tables and not any(cell.text.strip() for cell in item.data.table_cells):
                finding["empty_form"] = True
            regions.append(finding)
    unique = {}
    for region in regions:
        key = (region["page"], region["kind"], tuple(region["item_refs"])) if region["kind"] in {"image", "table"} else region["id"]
        previous = unique.get(key)
        if previous:
            region["issues"] = sorted(set([*previous["issues"], *region["issues"]]))
            region["attempts"] = [*previous["attempts"], *region["attempts"]]
        unique[key] = region
    return sorted(unique.values(), key=lambda r: (r["page"], r["bbox"]["t"], r["bbox"]["l"], r["id"]))


def snapshot_for(request, document, native_pages, reports, prepared, regions, issues):
    return dict(format=1, document_version_id=str(request.document_version_id), checksum=request.checksum,
                configuration=request.configuration.model_dump(), revision=0, document=document.model_dump(mode="json"),
                native_pages=native_pages, reports=[report.model_dump() for report in reports],
                prepared=[chunk.model_dump() for chunk in prepared], regions=regions, base_issues=sorted(set(issues)))


def check_snapshot(request, snapshot):
    expected = request.configuration.model_dump()
    actual = dict(snapshot.get("configuration", {}))
    expected.pop("verification_revision", None)
    actual.pop("verification_revision", None)
    if (snapshot.get("format") != 1 or snapshot.get("checksum") != request.checksum or
            snapshot.get("document_version_id") != str(request.document_version_id) or actual != expected):
        raise ValueError("integrity_snapshot_source_mismatch")
    for region in snapshot.get("regions", []):
        identity = {key: region[key] for key in ["page", "bbox", "item_refs", "kind", "original_text"]}
        if fingerprint(identity) != region.get("id"):
            raise ValueError("integrity_region_fingerprint_mismatch")


def apply_decisions(document, regions, applied=None, decision_refs=None):
    from docling_core.types.doc import BoundingBox, DocItemLabel, ProvenanceItem, TableCell, TableData
    items = {item.self_ref: item for item, _ in document.iterate_items(traverse_pictures=True)}
    changed = set()
    applied = applied if applied is not None else {}
    decision_refs = decision_refs if decision_refs is not None else {}
    for region in regions:
        decision = region.get("decision")
        if not decision:
            continue
        if applied.get(region["id"]) == fingerprint(decision):
            continue
        action, value = decision.get("action"), decision.get("text", "").strip()
        if not decision.get("source_checked") or not decision.get("context_checked"):
            raise ValueError("integrity_source_confirmation_required")
        if region.get("related_figures") and not decision.get("visual_checked"):
            raise ValueError("integrity_figure_confirmation_required")
        if action == "exclude":
            if not region.get("excludable") or region.get("critical") or len(decision.get("reason", "").strip()) < 10:
                raise ValueError("integrity_exclusion_forbidden")
            if any(not any(r["kind"] == "image" and ref in r["item_refs"] and (r.get("decision") or {}).get("action") == "describe"
                           for r in regions) for ref in region["related_figures"]):
                raise ValueError("integrity_related_figure_unverified")
        elif action not in {"confirm", "correct", "describe"} or not value and not (action == "confirm" and region.get("empty_form")):
            raise ValueError("integrity_verified_text_required")
        if action == "confirm" and value != region["original_text"].strip():
            raise ValueError("integrity_confirmation_changed_text")
        if action == "confirm":
            # A confirmation never rewrites structure or merges adjacent blocks.
            if region["kind"] == "image" or region["kind"] == "table" and not (region.get("empty_form") and decision.get("visual_checked") and len(decision.get("reason", "").strip()) >= 10):
                raise ValueError("integrity_structured_confirmation_required")
            applied[region["id"]] = fingerprint(decision)
            continue
        targets = [items[ref] for ref in region["item_refs"] if ref in items and items[ref].label.value != "picture"
                   and (region["kind"] == "table" or items[ref].label.value not in {"table", "document_index"})]
        if region["kind"] == "image":
            if action != "describe" or not decision.get("visual_checked") or len(value) < 10:
                raise ValueError("integrity_visual_description_required")
            added = items.get(decision_refs.get(region["id"]))
            if added is not None:
                added.text = value
            else:
                picture = items.get(region["item_refs"][0]) if region["item_refs"] else None
                if picture is None:
                    # A visible source page can have no recognized Docling
                    # items. A human description still cites that exact page
                    # and rectangle; no synthetic source pixels are created.
                    anchors = [item for item, _ in document.iterate_items(traverse_pictures=True) if item.prov]
                    previous = next((item for item in reversed(anchors) if max(p.page_no for p in item.prov) <= region["page"]), None)
                    following = next((item for item in anchors if min(p.page_no for p in item.prov) > region["page"]), None)
                    anchor = previous or following
                    picture = document.add_picture(prov=ProvenanceItem(page_no=region["page"], charspan=(0, 0), bbox=BoundingBox.model_validate(region["bbox"])))
                    if anchor is not None:
                        child = document.body.children.pop()
                        parent = anchor.parent.resolve(document)
                        offset = next(i for i, ref in enumerate(parent.children) if ref.cref == anchor.self_ref)
                        parent.children.insert(offset + (1 if previous else 0), child)
                        picture.parent = anchor.parent
                    changed.add(picture.self_ref)
                added = document.add_text(label=DocItemLabel.TEXT, text=value, parent=picture,
                    prov=ProvenanceItem(page_no=region["page"], charspan=(0, len(value)), bbox=BoundingBox.model_validate(region["bbox"])))
                decision_refs[region["id"]] = added.self_ref
            changed.update([*region["item_refs"], added.self_ref])
        elif region["kind"] == "table":
            if len(targets) != 1 or targets[0].label.value not in {"table", "document_index"} or action == "exclude":
                raise ValueError("integrity_table_source_required")
            rows = [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in value.splitlines() if line.strip()]
            if len(rows) < 3 or not all(re.fullmatch(r":?-{3,}:?", cell) for cell in rows[1]) or any(len(row) != len(rows[0]) for row in rows):
                raise ValueError("integrity_table_relationships_required")
            rows.pop(1)
            targets[0].data = TableData(num_rows=len(rows), num_cols=len(rows[0]), table_cells=[TableCell(
                text=text, start_row_offset_idx=r, end_row_offset_idx=r+1, start_col_offset_idx=c,
                end_col_offset_idx=c+1, column_header=r == 0) for r, row in enumerate(rows) for c, text in enumerate(row)])
            changed.add(targets[0].self_ref)
        elif targets:
            if any(item.label.value in {"table", "document_index"} for item in targets):
                raise ValueError("integrity_structured_source_requires_review")
            if len(targets) > 1:
                replacements = decision.get("block_texts", {})
                if set(replacements) != {item.self_ref for item in targets} or not all(isinstance(value, str) for value in replacements.values()):
                    raise ValueError("integrity_block_relationships_required")
                for item in targets:
                    item.text = replacements[item.self_ref]
            else:
                targets[0].text = "" if action == "exclude" else value
            changed.update(item.self_ref for item in targets)
        else:
            # An omission has no structured target. Its replacement is explicitly
            # anchored after a source item selected by the reviewer, never guessed.
            anchor = decision.get("after_item_ref")
            if not anchor or anchor not in items or not any(p.page_no == region["page"] for p in items[anchor].prov):
                raise ValueError("integrity_reading_order_anchor_required")
            added = items.get(decision_refs.get(region["id"]))
            if added is not None:
                if added.self_ref == anchor:
                    raise ValueError("integrity_cyclic_reading_order_anchor")
                old_parent = added.parent.resolve(document)
                child = next(ref for ref in old_parent.children if ref.cref == added.self_ref)
                old_parent.children = [ref for ref in old_parent.children if ref.cref != added.self_ref]
                added.text = value
            else:
                added = document.add_text(label=DocItemLabel.TEXT, text=value,
                    prov=ProvenanceItem(page_no=region["page"], charspan=(0, len(value)), bbox=BoundingBox.model_validate(region["bbox"])))
                child = document.body.children.pop()
                decision_refs[region["id"]] = added.self_ref
            parent = items[anchor].parent.resolve(document)
            position = next(i for i, ref in enumerate(parent.children) if ref.cref == anchor) + 1
            parent.children.insert(position, child)
            added.parent = items[anchor].parent
            changed.update([anchor, added.self_ref])
        applied[region["id"]] = fingerprint(decision)
    return changed


def validate_content(document, prepared, tokenizer, max_tokens=480, literal_tables=()):
    """Recheck every item against its own derived chunks after any human edit."""
    from app.knowledge_chunking import NON_BODY_LABELS, invalid_bbox
    issues = set()
    outputs = {}
    procedures = {}
    contexts = {}
    for chunk in prepared:
        if len(tokenizer.encode(chunk.embedding_text, add_special_tokens=True)) != chunk.token_count or chunk.token_count > max_tokens:
            issues.add("token_budget_or_empty_chunk")
        contexts.setdefault(tuple(chunk.headings), []).append(chunk)
        for loc in chunk.locations:
            outputs.setdefault(loc.item_ref, []).append(chunk)
    for item, _ in document.iterate_items(traverse_pictures=True):
        value = item_text(item)
        if item.label.value in {"picture", "formula"}:
            continue
        if value and (not item.prov or any(invalid_bbox(p.bbox, document.pages.get(p.page_no)) for p in item.prov)):
            issues.add("invalid_source_bbox")
        if item.label.value in {"table", "document_index"} and value and not any(c.column_header for c in item.data.table_cells):
            # Literal contents/forms retain their previously validated structural eligibility.
            if item.data.num_cols != 1 and item.self_ref not in literal_tables:
                issues.add("table_header_unverified")
        own = outputs.get(item.self_ref, [])
        if item.label.value not in NON_BODY_LABELS and value and not contains_words(value, "\n".join(c.content for c in own)):
            issues.add("missing_critical_content" if CRITICAL.search(value) else "missing_extracted_content")
        if item.label.value == "list_item" and getattr(item, "enumerated", False):
            key = item.parent.cref if item.parent else item.self_ref
            procedures.setdefault(key, set()).update(c.chunk_index for c in own)
            for chunk in own:
                if any(CRITICAL.search(c.content) for c in contexts[tuple(chunk.headings)]) and len(contexts[tuple(chunk.headings)]) > 1:
                    issues.add("procedure_context_split_requires_review")
    if any(len(indices) > 1 for indices in procedures.values()):
        issues.add("procedure_split_requires_review")
    return sorted(issues)


def incremental_split(document, chunker, tokenizer, title, page_count, snapshot, changed, **kwargs):
    """Rechunk the dependent semantic interval; untouched chunks stay cached."""
    previous = [PreparedChunk.model_validate(chunk) for chunk in snapshot.get("prepared", [])]
    if not previous:
        return split_document(document, chunker, tokenizer, title, page_count, check_visuals=False, **kwargs)
    if not changed:
        return previous, []
    affected = {i for i, chunk in enumerate(previous) if any(loc.item_ref in changed for loc in chunk.locations)}
    # New picture descriptions inherit the associated semantic block's context.
    if not affected:
        order = {item.self_ref: i for i, (item, _) in enumerate(document.iterate_items(traverse_pictures=True))}
        position = min((order.get(ref, len(order)) for ref in changed), default=0)
        affected = {min(range(len(previous)), key=lambda i: abs(min(order.get(loc.item_ref, len(order)) for loc in previous[i].locations) - position))}
    headings = {tuple(previous[i].headings) for i in affected}
    affected.update(i for i, chunk in enumerate(previous) if tuple(chunk.headings) in headings)
    first, last = min(affected), max(affected)
    refs = {loc.item_ref for chunk in previous[first:last+1] for loc in chunk.locations} | changed
    context = {heading for chunk in previous[first:last+1] for heading in chunk.headings}
    refs.update(item.self_ref for item in document.texts if item.label.value in {"title", "section_header"} and item.text in context)
    scoped = copy.deepcopy(document)

    def prune(item):
        if hasattr(item, "children"):
            item.children = [ref for ref in item.children if prune(ref.resolve(scoped))]
        return item.self_ref in refs or bool(getattr(item, "children", []))

    prune(scoped.body)
    prune(scoped.furniture)
    replacement, issues = split_document(scoped, chunker, tokenizer, title, page_count,
                                        check_visuals=False, scope_refs=refs, **kwargs)
    combined = [*previous[:first], *replacement, *previous[last+1:]]
    for index, chunk in enumerate(combined):
        chunk.chunk_index = index
    return combined, issues


def integrity_summary(regions, revision):
    return dict(revision=revision, regions=[{**region, "assessment": "verified" if region.get("decision") else region["assessment"]}
                                          for region in regions],
                complete=all(region.get("decision") or region.get("assessment") == "verified" for region in regions))


def comparison_pages(native_pages, regions):
    """An explicitly excluded figure label is not missing required knowledge.

    This only removes the exact checked label on its source page. Warnings,
    values, prose and unverified figures cannot enter this exception.
    """
    result = list(native_pages)
    for region in regions:
        if (region.get("decision") or {}).get("action") != "exclude":
            continue
        if region.get("critical") or not region.get("excludable"):
            raise ValueError("integrity_exclusion_forbidden")
        original = region["original_text"].strip()
        pattern = r"(?<!\w)" + r"\s+".join(re.escape(part) for part in original.split()) + r"(?!\w)"
        result[region["page"] - 1] = re.sub(pattern, "", result[region["page"] - 1], count=1, flags=re.I)
    return result
