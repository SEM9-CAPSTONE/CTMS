import { CheckCircle2, FileText } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button, Modal, StatusBadge, useToast } from "../../../shared/components";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import {
	formatTermsDate,
	formatTermsVersionLabel,
	isTermsVersionOutdatedError,
} from "../constants";
import { termsService } from "../services/terms.service";
import type { AcceptTermsResponse, MyTermsStatus, TermsVersionDetail } from "../types";

const DEFER_STORAGE_PREFIX = "ctms_terms_deferred_";

function getDeferredKey(userId: string, version: string): string {
	return `${DEFER_STORAGE_PREFIX}${userId}_${version}`;
}

function isDeferredInSession(userId: string, version: string): boolean {
	try {
		return sessionStorage.getItem(getDeferredKey(userId, version)) === "1";
	} catch {
		return false;
	}
}

function markDeferredInSession(userId: string, version: string): void {
	try {
		sessionStorage.setItem(getDeferredKey(userId, version), "1");
	} catch {
		// Ignore storage restrictions
	}
}

export interface TermsReconsentModalProps {
	isOpen: boolean;
	status: MyTermsStatus;
	termsDetail: TermsVersionDetail | undefined;
	isLoadingTerms: boolean;
	isTermsError: boolean;
	onRetryLoadTerms: () => void;
	onDefer: () => void;
	onAccept: (version: string) => Promise<AcceptTermsResponse>;
	isAccepting: boolean;
	onDone: () => void;
}

type ReconsentStep = "prompt" | "review" | "confirmed";

export const TermsReconsentModal: React.FC<TermsReconsentModalProps> = ({
	isOpen,
	status,
	termsDetail,
	isLoadingTerms,
	isTermsError,
	onRetryLoadTerms,
	onDefer,
	onAccept,
	isAccepting,
	onDone,
}) => {
	const toast = useToast();
	const [step, setStep] = useState<ReconsentStep>("prompt");
	const [hasCheckedAgree, setHasCheckedAgree] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [acceptedReceipt, setAcceptedReceipt] = useState<AcceptTermsResponse | null>(null);

	useEffect(() => {
		if (!isOpen) {
			setStep("prompt");
			setHasCheckedAgree(false);
			setSubmitError(null);
			setAcceptedReceipt(null);
		}
	}, [isOpen]);

	const activeVersion = termsDetail?.version ?? status.currentVersion;
	const activeEffectiveDate = termsDetail?.effectiveDate ?? status.currentEffectiveDate;

	const handleConfirmAccept = async () => {
		if (!hasCheckedAgree || isAccepting) return;
		setSubmitError(null);
		try {
			const receipt = await onAccept(activeVersion);
			setAcceptedReceipt(receipt);
			setStep("confirmed");
			toast.success(
				`Bạn đã đồng ý Điều khoản ${formatTermsVersionLabel(receipt.version)} vào ngày ${formatTermsDate(receipt.acceptedAt)}.`
			);
		} catch (error) {
			if (isTermsVersionOutdatedError(error)) {
				setHasCheckedAgree(false);
				setSubmitError(
					"Điều khoản sử dụng vừa được cập nhật phiên bản mới hơn. Vui lòng đọc lại phiên bản mới nhất trước khi xác nhận."
				);
				onRetryLoadTerms();
				toast.warning("Phiên bản điều khoản vừa thay đổi, vui lòng xem lại.");
				return;
			}
			setSubmitError("Không thể lưu xác nhận lúc này. Vui lòng thử lại.");
			toast.error("Không thể lưu xác nhận điều khoản. Vui lòng thử lại.");
		}
	};

	const handleClose = () => {
		if (step === "confirmed") {
			onDone();
			return;
		}
		onDefer();
	};

	const modalTitle =
		step === "confirmed"
			? "Đã đồng ý điều khoản"
			: step === "review"
				? `Xem và đồng ý Điều khoản ${formatTermsVersionLabel(activeVersion)}`
				: "Cập nhật Điều khoản sử dụng";

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title={modalTitle}
			icon={
				step === "confirmed" ? (
					<CheckCircle2 className="size-5 text-emerald-700" />
				) : (
					<FileText className="size-5" />
				)
			}
			size={step === "review" ? "xl" : "md"}
			isCloseDisabled={isAccepting}
		>
			{step === "prompt" && (
				<div className="space-y-5">
					<div className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<StatusBadge tone="info">
								{formatTermsVersionLabel(status.currentVersion)} (mới)
							</StatusBadge>
							<span className="text-xs font-medium text-[#54655a]">
								Hiệu lực: {formatTermsDate(status.currentEffectiveDate)}
							</span>
						</div>
						<p className="text-sm leading-relaxed text-[#2f4c40]">
							Chúng tôi đã cập nhật Điều khoản và Điều kiện sử dụng (phiên bản{" "}
							<strong className="font-bold text-[#10221b]">
								{formatTermsVersionLabel(status.currentVersion)}
							</strong>
							) với một số nội dung quan trọng. Vui lòng xem và xác nhận để tiếp tục đồng bộ trạng
							thái chấp thuận trên Web và ứng dụng di động.
						</p>
						{status.currentSummary && (
							<div className="rounded-xl border border-[#dfe8df] bg-[#f4f7f2] p-3.5 text-xs leading-relaxed text-[#425048]">
								{status.currentSummary}
							</div>
						)}
						{status.latestAcceptance && (
							<p className="text-xs text-[#667a6d]">
								Lần chấp thuận gần nhất của bạn: phiên bản{" "}
								{formatTermsVersionLabel(status.latestAcceptance.version)} vào{" "}
								{formatTermsDate(status.latestAcceptance.acceptedAt)}.
							</p>
						)}
					</div>

					<div className="flex flex-col-reverse gap-3 border-t border-[#eef2ee] pt-4 sm:flex-row sm:justify-end">
						<Button variant="outline" onClick={onDefer} className="w-full sm:w-auto">
							Để sau
						</Button>
						<Button
							variant="primary"
							onClick={() => {
								setSubmitError(null);
								setStep("review");
							}}
							className="w-full bg-[#164027] hover:bg-[#0f2e1c] sm:w-auto"
						>
							Xem và đồng ý
						</Button>
					</div>
				</div>
			)}

			{step === "review" && (
				<div className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f4f7f2] px-4 py-2.5 text-xs text-[#425048]">
						<span>
							Phiên bản:{" "}
							<strong className="font-bold text-[#164027]">
								{formatTermsVersionLabel(activeVersion)}
							</strong>
						</span>
						<span>Hiệu lực: {formatTermsDate(activeEffectiveDate)}</span>
					</div>

					{isLoadingTerms && (
						<div className="space-y-3 py-6">
							<div className="h-5 w-1/3 animate-pulse rounded bg-[#eef2ee]" />
							<div className="h-20 animate-pulse rounded-xl bg-[#f4f7f2]" />
							<div className="h-20 animate-pulse rounded-xl bg-[#f4f7f2]" />
						</div>
					)}

					{isTermsError && !isLoadingTerms && (
						<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
							<p className="text-sm font-medium text-red-700">
								Không thể tải nội dung điều khoản mới. Vui lòng thử lại.
							</p>
							<Button variant="outline" size="sm" className="mt-3" onClick={onRetryLoadTerms}>
								Thử lại
							</Button>
						</div>
					)}

					{!isLoadingTerms && !isTermsError && termsDetail && (
						<div className="max-h-[45vh] space-y-5 overflow-y-auto rounded-xl border border-[#dfe8df] bg-white p-4 pr-3">
							{termsDetail.sections.map((section) => (
								<section
									key={section.number}
									className="space-y-2 border-b border-[#eef2ee] pb-4 last:border-b-0 last:pb-0"
								>
									<h3 className="text-sm font-bold text-[#164027]">
										{section.number}. {section.title}
									</h3>
									{section.subsections.map((sub) => (
										<div key={sub.code} className="space-y-1">
											<h4 className="text-xs font-bold text-[#10221b]">
												{sub.code}. {sub.title}
											</h4>
											<p className="text-xs leading-relaxed text-[#425048]">{sub.body}</p>
										</div>
									))}
									{section.callout && (
										<div className="rounded-lg bg-[#f4f7f2] px-3 py-2 text-xs text-[#2f4c40]">
											{section.callout}
										</div>
									)}
								</section>
							))}
						</div>
					)}

					<label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#dfe8df] bg-[#f9fbf8] p-3.5 text-sm text-[#10221b]">
						<input
							type="checkbox"
							checked={hasCheckedAgree}
							onChange={(event) => setHasCheckedAgree(event.target.checked)}
							disabled={isLoadingTerms || isTermsError || isAccepting}
							className="mt-0.5 size-4 rounded border-[#b8c7bc] accent-[#164027]"
						/>
						<span className="leading-snug">
							Tôi đã đọc và đồng ý với toàn bộ nội dung Điều khoản và Điều kiện sử dụng DiTrek phiên
							bản {formatTermsVersionLabel(activeVersion)}.
						</span>
					</label>

					{submitError && (
						<p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
							{submitError}
						</p>
					)}

					<div className="flex flex-col-reverse gap-3 border-t border-[#eef2ee] pt-4 sm:flex-row sm:justify-end">
						<Button
							variant="outline"
							onClick={onDefer}
							disabled={isAccepting}
							className="w-full sm:w-auto"
						>
							Để sau
						</Button>
						<Button
							variant="primary"
							disabled={!hasCheckedAgree || isLoadingTerms || isTermsError || isAccepting}
							onClick={() => {
								void handleConfirmAccept();
							}}
							className="w-full bg-[#164027] hover:bg-[#0f2e1c] sm:w-auto"
						>
							{isAccepting ? "Đang lưu xác nhận..." : "Xác nhận đồng ý"}
						</Button>
					</div>
				</div>
			)}

			{step === "confirmed" && acceptedReceipt && (
				<div className="space-y-5 py-2 text-center">
					<div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
						<CheckCircle2 className="size-8" />
					</div>
					<div className="space-y-1.5">
						<p className="text-sm leading-relaxed text-[#2f4c40]">
							Bạn đã chấp thuận Điều khoản và Điều kiện sử dụng DiTrek (phiên bản{" "}
							<strong className="font-bold text-[#10221b]">
								{formatTermsVersionLabel(acceptedReceipt.version)}
							</strong>
							) vào{" "}
							<strong className="font-bold text-[#10221b]">
								{formatTermsDate(acceptedReceipt.acceptedAt)}
							</strong>
							.
						</p>
						<p className="text-xs text-[#667a6d]">
							Trạng thái chấp thuận này đã được đồng bộ cho tài khoản của bạn trên cả Web và ứng
							dụng di động.
						</p>
					</div>
					<Button
						variant="primary"
						onClick={onDone}
						className="w-full bg-[#164027] hover:bg-[#0f2e1c]"
					>
						Tiếp tục sử dụng
					</Button>
				</div>
			)}
		</Modal>
	);
};

const SUPPRESSED_PATHS = new Set([
	"/terms",
	"/terms-and-policy",
	"/login",
	"/register",
	"/verify-otp",
	"/forgot-password",
]);

function readNonAdminUserId(): string | null {
	const user = getStoredAuthUser();
	if (!user) return null;
	const roles = user.roles?.length ? user.roles : [user.role];
	if (roles.includes("admin")) return null;
	return user.id;
}

export const TermsReconsentGate: React.FC = () => {
	const [userId, setUserId] = useState<string | null>(() => readNonAdminUserId());
	const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
	const [status, setStatus] = useState<MyTermsStatus | null>(null);
	const [termsDetail, setTermsDetail] = useState<TermsVersionDetail | undefined>(undefined);
	const [isLoadingTerms, setIsLoadingTerms] = useState(false);
	const [isTermsError, setIsTermsError] = useState(false);
	const [isAccepting, setIsAccepting] = useState(false);
	const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
	const [keepingConfirmedOpen, setKeepingConfirmedOpen] = useState(false);

	useEffect(() => {
		const syncAuthAndPath = () => {
			setUserId(readNonAdminUserId());
			setCurrentPath(window.location.pathname);
		};
		window.addEventListener("popstate", syncAuthAndPath);
		window.addEventListener("storage", syncAuthAndPath);
		window.addEventListener("ctms-navigation", syncAuthAndPath);
		return () => {
			window.removeEventListener("popstate", syncAuthAndPath);
			window.removeEventListener("storage", syncAuthAndPath);
			window.removeEventListener("ctms-navigation", syncAuthAndPath);
		};
	}, []);

	const isSuppressed = !userId || SUPPRESSED_PATHS.has(currentPath);

	const loadStatus = useCallback(async () => {
		if (!userId || SUPPRESSED_PATHS.has(currentPath)) {
			setStatus(null);
			return;
		}
		try {
			const nextStatus = await termsService.getMyStatus();
			setStatus(nextStatus);
		} catch {
			// Non-blocking: do not disrupt app navigation if status check fails.
		}
	}, [userId, currentPath]);

	const loadTermsDetail = useCallback(async () => {
		setIsLoadingTerms(true);
		setIsTermsError(false);
		try {
			const detail = await termsService.getCurrent();
			setTermsDetail(detail);
		} catch {
			setIsTermsError(true);
		} finally {
			setIsLoadingTerms(false);
		}
	}, []);

	useEffect(() => {
		void loadStatus();
	}, [loadStatus]);

	const shouldPrompt =
		Boolean(userId && status?.needsReconsent) &&
		!isSuppressed &&
		dismissedVersion !== status?.currentVersion &&
		!isDeferredInSession(userId ?? "", status?.currentVersion ?? "");

	const isOpen = shouldPrompt || keepingConfirmedOpen;

	useEffect(() => {
		if (isOpen && !termsDetail && !isLoadingTerms) {
			void loadTermsDetail();
		}
	}, [isOpen, termsDetail, isLoadingTerms, loadTermsDetail]);

	if (!status || !isOpen) {
		return null;
	}

	return (
		<TermsReconsentModal
			isOpen={isOpen}
			status={status}
			termsDetail={termsDetail}
			isLoadingTerms={isLoadingTerms}
			isTermsError={isTermsError}
			onRetryLoadTerms={() => {
				void loadTermsDetail();
				void loadStatus();
			}}
			onDefer={() => {
				if (userId) {
					markDeferredInSession(userId, status.currentVersion);
				}
				setDismissedVersion(status.currentVersion);
				setKeepingConfirmedOpen(false);
			}}
			onAccept={async (version) => {
				setIsAccepting(true);
				setKeepingConfirmedOpen(true);
				try {
					const response = await termsService.acceptTerms({ version, platform: "web" });
					setStatus((prev) =>
						prev
							? {
									...prev,
									acceptedCurrentVersion: true,
									needsReconsent: false,
								}
							: prev
					);
					return response;
				} finally {
					setIsAccepting(false);
				}
			}}
			isAccepting={isAccepting}
			onDone={() => {
				setKeepingConfirmedOpen(false);
				setDismissedVersion(status.currentVersion);
			}}
		/>
	);
};
