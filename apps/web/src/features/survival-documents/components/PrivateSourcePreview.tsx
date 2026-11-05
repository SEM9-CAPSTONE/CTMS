import { useSourceFile } from "../hooks/useSourceFile";
import type { SourceVersion } from "../types";
import { DocumentPreview } from "./DocumentPreview";
export function PrivateSourcePreview({ version }: { version: SourceVersion }) {
	const { url, file } = useSourceFile(version.documentId, version.id);
	return (
		<DocumentPreview
			blob={file.data}
			filename={version.originalFilename}
			downloadUrl={url}
			pending={file.isFetching}
			error={file.error?.message}
			onRetry={() => void file.refetch()}
		/>
	);
}
