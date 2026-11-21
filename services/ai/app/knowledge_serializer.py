"""Preserve literal table headers and row/column relationships during chunking."""

from docling_core.transforms.chunker.hierarchical_chunker import ChunkingDocSerializer
from docling_core.transforms.serializer.base import BaseDocSerializer, BaseSerializerProvider
from docling_core.transforms.serializer.common import create_ser_result
from docling_core.transforms.serializer.markdown import MarkdownTableSerializer
from docling_core.types.doc import DoclingDocument


class LiteralTableSerializer(MarkdownTableSerializer):
    def serialize(self, *, item, doc_serializer, doc, **kwargs):
        if any(cell.column_header for cell in item.data.table_cells):
            return super().serialize(item=item, doc_serializer=doc_serializer, doc=doc, **kwargs)
        if item.self_ref in doc_serializer.get_excluded_refs(**kwargs):
            return create_ser_result(text="", span_source=item)
        grid = [["" for _ in range(item.data.num_cols)] for _ in range(item.data.num_rows)]
        for cell in item.data.table_cells:
            if (0 <= cell.start_row_offset_idx < item.data.num_rows and
                    0 <= cell.start_col_offset_idx < item.data.num_cols):
                grid[cell.start_row_offset_idx][cell.start_col_offset_idx] = cell.text.replace("\n", " ").replace("|", "\\|")
        text = "\n".join(" | ".join(row) for row in grid if any(value.strip() for value in row))
        parts = [doc_serializer.serialize_captions(item=item, **kwargs),
                 create_ser_result(text=text, span_source=item),
                 doc_serializer.serialize_footnotes(item=item, **kwargs)]
        return create_ser_result(text="\n\n".join(part.text for part in parts if part.text), span_source=parts)


class TablePreservingSerializerProvider(BaseSerializerProvider):
    def get_serializer(self, doc: DoclingDocument) -> BaseDocSerializer:
        serializer = ChunkingDocSerializer(doc=doc, table_serializer=LiteralTableSerializer())
        # Native labels/captions nested in figures are source text too. The
        # picture pixels themselves are not converted into invented descriptions.
        serializer.params.traverse_pictures = True
        return serializer
