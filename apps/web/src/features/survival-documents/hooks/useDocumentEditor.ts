import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
	type DocumentEditorValues,
	type ValidatedEditorValues,
	documentEditorSchema,
} from "../schema/source.schema";
import type { PdfSource, SourceMetadata } from "../types";

interface DocumentEditorOptions {
	initial?: SourceMetadata;
	editing: boolean;
	maxBytes?: number;
	busy: boolean;
	onSubmit: (
		metadata: SourceMetadata,
		source?: PdfSource,
		preparePublication?: boolean
	) => Promise<void>;
}

export function useDocumentEditor({
	initial,
	editing,
	maxBytes,
	busy,
	onSubmit,
}: DocumentEditorOptions) {
	const submitting = useRef(false);
	const form = useForm<DocumentEditorValues, undefined, ValidatedEditorValues>({
		resolver: zodResolver(documentEditorSchema(maxBytes)),
		defaultValues: {
			method: editing ? "edit" : "upload",
			sourceUrl: "",
			metadata: {
				sourceTitle: initial?.sourceTitle ?? "",
				classification: initial?.classification ?? "TREKKING_SAFETY",
				locale: initial?.locale && (editing || initial.locale === "en") ? initial.locale : "vi",
				publisher: initial?.publisher,
				changeSummary: initial?.changeSummary,
				sourceUrl: editing ? undefined : initial?.sourceUrl,
			},
		},
	});
	const method = useWatch({ control: form.control, name: "method" });
	const file = useWatch({ control: form.control, name: "file" });
	function selectSource(next: PdfSource["kind"]) {
		if (next === method) return;
		form.setValue("method", next);
		form.setValue("sourceUrl", "");
		form.setValue("file", undefined);
		form.clearErrors(["file", "sourceUrl", "metadata.sourceUrl"]);
		if (next === "url") form.setValue("metadata.sourceUrl", "");
	}
	const save = (preparePublication = false) =>
		form.handleSubmit(async (values) => {
			if (submitting.current || busy) return;
			submitting.current = true;
			try {
				switch (values.method) {
					case "edit":
						await onSubmit({
							...initial,
							...values.metadata,
							sourceUrl: initial?.sourceUrl,
						});
						break;
					case "upload":
						if (values.file)
							await onSubmit(
								values.metadata,
								{ kind: "upload", file: values.file },
								preparePublication
							);
						break;
					case "url":
						await onSubmit(
							values.metadata,
							{ kind: "url", sourceUrl: values.sourceUrl },
							preparePublication
						);
						break;
				}
			} finally {
				submitting.current = false;
			}
		});
	return {
		form,
		method,
		file,
		selectSource,
		submit: save(),
		preparePublication: save(true),
	};
}
