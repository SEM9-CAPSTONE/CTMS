import { SOURCE_BUTTON } from "../constants";
import { useSourceFile } from "../hooks/useSourceFile";
import type { SourceVersion } from "../types";
export function PrivateSourcePreview({ version }: { version: SourceVersion }) {
	const { url, file } = useSourceFile(version.documentId, version.id);
	return (
		<div className="space-y-3">
			<button
				type="button"
				className={SOURCE_BUTTON}
				disabled={file.isPending}
				onClick={() => file.mutate(version.id)}
			>
				Mở tệp gốc riêng tư
			</button>
			{file.error && (
				<p role="alert" className="text-red-700">
					{file.error.message}
				</p>
			)}
			{url && (
				<div>
					<a href={url} download={version.originalFilename} className="text-sm font-bold underline">
						Tải PDF về máy
					</a>
					<iframe
						title="Bản xem trước PDF"
						src={url}
						sandbox=""
						className="mt-2 h-96 w-full rounded-lg border"
					/>
				</div>
			)}
		</div>
	);
}
