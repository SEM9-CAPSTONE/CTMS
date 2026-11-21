"""Verify literal layout tables and repeat proven headers across page breaks."""

import re

from app.knowledge_chunking import CRITICAL


def continuation_columns(document, previous, table):
    """Map text columns only when source geometry proves a page continuation."""
    if not previous.prov or not table.prov:
        return None
    before, after = previous.prov[-1], table.prov[0]
    if after.page_no != before.page_no + 1:
        return None
    old_size, size = document.pages[before.page_no].size, document.pages[after.page_no].size
    old_box = before.bbox.to_top_left_origin(old_size.height)
    box = after.bbox.to_top_left_origin(size.height)
    if (abs(old_size.width - size.width) > 1 or
            abs(old_box.l - box.l) > size.width * 0.02 or abs(old_box.r - box.r) > size.width * 0.02 or
            old_box.b < old_size.height * 0.80 or box.t > size.height * 0.12):
        return None
    # A new section between the tables disqualifies a continuation even when
    # it happens to use the same number of columns and page margins.
    for item in document.texts:
        if item.label.value not in {"section_header", "title"}:
            continue
        if any((p.page_no == before.page_no and p.bbox.to_top_left_origin(old_size.height).t >= old_box.b) or
               (p.page_no == after.page_no and p.bbox.to_top_left_origin(size.height).b <= box.t)
               for p in item.prov):
            return None
    columns = []
    for index in range(previous.data.num_cols):
        boxes = [cell.bbox.to_top_left_origin(old_size.height) for cell in previous.data.table_cells
                 if cell.bbox is not None and cell.text.strip() and
                 cell.start_col_offset_idx == index and cell.end_col_offset_idx == index + 1]
        if not boxes:
            return None
        columns.append((min(b.l for b in boxes), max(b.r for b in boxes)))
    if any(left[1] >= right[0] for left, right in zip(columns, columns[1:])):
        return None
    edges = [old_box.l, *[(left[1] + right[0]) / 2 for left, right in zip(columns, columns[1:])], old_box.r]
    mapping = {}
    for cell in table.data.table_cells:
        if not cell.text.strip():
            continue
        if cell.bbox is None or cell.end_col_offset_idx != cell.start_col_offset_idx + 1:
            return None
        bounds = cell.bbox.to_top_left_origin(size.height)
        matches = [index for index in range(len(columns))
                   if bounds.l >= edges[index] - 2 and bounds.r <= edges[index + 1] + 2]
        if len(matches) != 1:
            return None
        index = cell.start_col_offset_idx
        if index in mapping and mapping[index] != matches[0]:
            return None
        mapping[index] = matches[0]
    if len(mapping) != table.data.num_cols or list(mapping[index] for index in sorted(mapping)) != sorted(set(mapping.values())):
        return None
    return mapping


def prepare_tables(document, pages):
    header_sources = {}
    literal_tables = set()
    by_page = {page.page_no: page for page in pages}
    previous = None
    for table, _ in document.iterate_items(traverse_pictures=True):
        if table.label.value not in {"table", "document_index"}:
            continue
        cells = table.data.table_cells
        if not cells:
            # This is only structural eligibility. The independent raster audit
            # must still prove that an OCR region contains no unread source text.
            has_text = False
            for origin in table.prov:
                page = by_page.get(origin.page_no)
                if page is None:
                    has_text = True
                    continue
                box = origin.bbox.to_top_left_origin(page.size.height)
                has_text |= any(any(c.isalnum() for c in cell.text) and
                                cell.rect.to_bounding_box().to_top_left_origin(page.size.height)
                                .intersection_area_with(box) > 0 for cell in page.cells)
            if not has_text:
                literal_tables.add(table.self_ref)
        elif not any(cell.column_header for cell in cells):
            # A continuation must be on the next physical page, with the same
            # column count and aligned horizontal edges. Never borrow headers
            # just because two tables have similar words or values.
            if previous is not None and previous.prov and table.prov:
                headers = [cell for cell in previous.data.table_cells if cell.column_header]
                mapping = continuation_columns(document, previous, table) if headers else None
                if mapping is not None:
                    depth = max(cell.end_row_offset_idx for cell in headers)
                    table.data.table_cells = [cell.model_copy(deep=True) for cell in headers] + [
                        cell.model_copy(update={"start_row_offset_idx": cell.start_row_offset_idx + depth,
                                                "end_row_offset_idx": cell.end_row_offset_idx + depth,
                                                "start_col_offset_idx": mapping.get(cell.start_col_offset_idx, cell.start_col_offset_idx),
                                                "end_col_offset_idx": mapping.get(cell.start_col_offset_idx, cell.start_col_offset_idx) + 1}, deep=True)
                        for cell in cells
                    ]
                    table.data.num_rows += depth
                    table.data.num_cols = previous.data.num_cols
                    header_sources[table.self_ref] = header_sources.get(previous.self_ref, previous)
            if not any(cell.column_header for cell in table.data.table_cells):
                # A one-column list/contents page has no column relationship to
                # infer. A blank form has source labels but no populated data
                # rows. Serialize both literally rather than inventing headings.
                rows = {}
                for cell in cells:
                    if cell.text.strip():
                        rows.setdefault(cell.start_row_offset_idx, set()).add(cell.start_col_offset_idx)
                first = min(rows, default=0)
                blank_form = (not any(re.search(r"\d", cell.text) or CRITICAL.search(cell.text) for cell in cells)
                              and all(len(columns) <= 1 for row, columns in rows.items() if row != first))
                if table.data.num_cols == 1 or blank_form:
                    literal_tables.add(table.self_ref)
        previous = table
    return header_sources, literal_tables
