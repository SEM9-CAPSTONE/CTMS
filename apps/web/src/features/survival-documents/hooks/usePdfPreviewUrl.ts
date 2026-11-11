import { useEffect, useState } from "react";

export function usePdfPreviewUrl(blob?: Blob) {
	const [preview, setPreview] = useState<{ blob: Blob; url: string }>();
	useEffect(() => {
		if (!blob || typeof URL.createObjectURL !== "function") return;
		const url = URL.createObjectURL(blob);
		setPreview({ blob, url });
		return () => URL.revokeObjectURL(url);
	}, [blob]);
	return preview?.blob === blob ? preview?.url : undefined;
}
