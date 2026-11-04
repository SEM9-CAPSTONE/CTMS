import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { survivalDocumentsService } from "../services/survival-documents.service";
export function useSourceFile(documentId: string, versionId: string) {
	const [preview, setPreview] = useState<{ versionId: string; url: string } | null>(null);
	const url = preview?.versionId === versionId ? preview.url : null;
	useEffect(
		() => () => {
			if (preview) URL.revokeObjectURL(preview.url);
		},
		[preview]
	);
	const file = useMutation({
		mutationKey: [documentId, versionId, "private-file"],
		mutationFn: (requestedId: string) => survivalDocumentsService.file(documentId, requestedId),
		onSuccess: (blob, requestedId) =>
			setPreview({ versionId: requestedId, url: URL.createObjectURL(blob) }),
	});
	return { url, file };
}
