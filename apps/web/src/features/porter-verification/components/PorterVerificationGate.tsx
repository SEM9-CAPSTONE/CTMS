import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { porterVerificationService } from "../services/porter-verification.service";

// Approval is final from the Porter's side, so remember it for the session and skip the
// status request on later navigations between Porter pages.
const approvedPorterIds = new Set<string>();

export function resetPorterVerificationGateCache(): void {
	approvedPorterIds.clear();
}

export interface PorterVerificationGateProps {
	porterId: string;
	children: ReactNode;
	/** Called when the Porter still has to upload or wait for document approval. */
	onRequireVerification: () => void;
}

/** Renders Porter pages only after the guide certificate verification is approved. */
export function PorterVerificationGate({
	porterId,
	children,
	onRequireVerification,
}: PorterVerificationGateProps) {
	const [isApproved, setIsApproved] = useState(() => approvedPorterIds.has(porterId));
	const onRequireVerificationRef = useRef(onRequireVerification);
	onRequireVerificationRef.current = onRequireVerification;

	useEffect(() => {
		if (approvedPorterIds.has(porterId)) {
			setIsApproved(true);
			return;
		}
		let cancelled = false;
		porterVerificationService
			.getMine()
			.then((verification) => {
				if (cancelled) return;
				if (verification.status === "approved") {
					approvedPorterIds.add(porterId);
					setIsApproved(true);
				} else {
					onRequireVerificationRef.current();
				}
			})
			.catch(() => {
				// Fail closed: without a confirmed approval the Porter goes to the verification page,
				// which shows the load error and a retry button.
				if (!cancelled) onRequireVerificationRef.current();
			});
		return () => {
			cancelled = true;
		};
	}, [porterId]);

	if (!isApproved) {
		return (
			<div
				data-testid="porter-verification-gate"
				className="flex min-h-screen items-center justify-center gap-3 bg-[#f4f7f2] text-sm font-bold text-[#54655a]"
			>
				<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang kiểm tra hồ sơ Porter...
			</div>
		);
	}

	return <>{children}</>;
}
