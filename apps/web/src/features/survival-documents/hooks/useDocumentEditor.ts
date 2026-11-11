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

const vietnameseDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

function dateInputValue(value?: string) {
	if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : vietnameseDate.format(date);
}

export function useDocumentEditor({
	initial,
	editing,
	maxBytes,
	busy,
	onSubmit,
}: DocumentEditorOptions) {
	const submitting = useRef(false);
	const publicationDate = dateInputValue(initial?.sourcePublishedAt);
	const retrievalDate = dateInputValue(initial?.retrievedAt);
	const form = useForm<DocumentEditorValues, undefined, ValidatedEditorValues>({
		resolver: zodResolver(documentEditorSchema(maxBytes)),
		defaultValues: {
			method: editing ? "edit" : "upload",
			sourceUrl: "",
			metadata: {
				sourceTitle: "",
				classification: "TREKKING_SAFETY",
				...initial,
				locale: initial?.locale && (editing || initial.locale === "en") ? initial.locale : "vi",
				sourcePublishedAt: publicationDate,
				retrievedAt: retrievalDate,
			},
		},
	});
	const method = useWatch({ control: form.control, name: "method" });
	const file = useWatch({ control: form.control, name: "file" });
	const locale = useWatch({ control: form.control, name: "metadata.locale" });
	const originalLocale = useWatch({ control: form.control, name: "metadata.originalLocale" });
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
							...values.metadata,
							sourcePublishedAt:
								values.metadata.sourcePublishedAt === publicationDate
									? initial?.sourcePublishedAt
									: values.metadata.sourcePublishedAt,
							retrievedAt:
								values.metadata.retrievedAt === retrievalDate
									? initial?.retrievedAt
									: values.metadata.retrievedAt,
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
		translated: !!originalLocale && locale !== originalLocale,
	};
}
