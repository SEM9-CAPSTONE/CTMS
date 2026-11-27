import { ArrowLeft, Calendar, History, Info } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, PageSkeleton, StatusBadge } from "../../../shared/components";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { Footer } from "../../landing/components/Footer";
import { HeaderNav } from "../../landing/components/HeaderNav";
import { TermsToc } from "../components/TermsToc";
import { TermsVersionHistoryModal } from "../components/TermsVersionHistoryModal";
import { formatTermsDate, formatTermsVersionLabel } from "../constants";
import { useCurrentTerms, useTermsVersionDetail } from "../hooks/useTerms";

export interface TermsPageProps {
	onBackToHome: () => void;
	onNavigateToLogin: () => void;
	onNavigateToRegister: () => void;
	onBackToRegister?: () => void;
	onNavigateToDashboard?: () => void;
	fromRegister?: boolean;
}

export const TermsPage: React.FC<TermsPageProps> = ({
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
	onBackToRegister,
	onNavigateToDashboard,
	fromRegister = false,
}) => {
	const storedUser = getStoredAuthUser();
	const isAdmin = Boolean(
		storedUser && (storedUser.role === "admin" || storedUser.roles?.includes("admin"))
	);
	const [selectedVersionCode, setSelectedVersionCode] = useState<string | null>(null);
	const [activeSectionNumber, setActiveSectionNumber] = useState<number>(1);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const programmaticScrollUntilRef = useRef<number>(0);

	const currentQuery = useCurrentTerms();
	const historicalQuery = useTermsVersionDetail(
		isAdmin && selectedVersionCode && selectedVersionCode !== currentQuery.data?.version
			? selectedVersionCode
			: null
	);

	const isViewingHistory = Boolean(
		isAdmin &&
			selectedVersionCode &&
			currentQuery.data &&
			selectedVersionCode !== currentQuery.data.version
	);
	const activeTerms = isViewingHistory ? historicalQuery.data : currentQuery.data;
	const isLoading = isViewingHistory ? historicalQuery.isLoading : currentQuery.isLoading;
	const isError = isViewingHistory ? historicalQuery.isError : currentQuery.isError;

	const sections = useMemo(() => activeTerms?.sections ?? [], [activeTerms]);

	useEffect(() => {
		if (sections.length === 0) return;
		const hashMatch = /^#terms-section-(\d+)$/.exec(window.location.hash);
		if (hashMatch) {
			const target = Number(hashMatch[1]);
			if (sections.some((item) => item.number === target)) {
				setActiveSectionNumber(target);
			}
		}
	}, [sections]);

	useEffect(() => {
		if (sections.length === 0) return;

		const updateActiveFromScroll = () => {
			if (Date.now() < programmaticScrollUntilRef.current) return;

			const docHeight = document.documentElement.scrollHeight;
			const viewportBottom = window.scrollY + window.innerHeight;
			if (docHeight > window.innerHeight && viewportBottom >= docHeight - 24) {
				const lastSection = sections[sections.length - 1];
				if (lastSection) setActiveSectionNumber(lastSection.number);
				return;
			}

			// Pick the last section whose top edge has crossed the reading threshold (140px from top).
			const thresholdPx = 140;
			let current = sections[0]?.number ?? 1;
			for (const section of sections) {
				const el = document.getElementById(`terms-section-${section.number}`);
				if (!el) continue;
				const rect = el.getBoundingClientRect();
				if (rect.top <= thresholdPx) {
					current = section.number;
				} else {
					break;
				}
			}
			setActiveSectionNumber(current);
		};

		window.addEventListener("scroll", updateActiveFromScroll, { passive: true });
		window.addEventListener("resize", updateActiveFromScroll, { passive: true });
		updateActiveFromScroll();
		return () => {
			window.removeEventListener("scroll", updateActiveFromScroll);
			window.removeEventListener("resize", updateActiveFromScroll);
		};
	}, [sections]);

	const handleSelectSection = (sectionNumber: number) => {
		setActiveSectionNumber(sectionNumber);
		programmaticScrollUntilRef.current = Date.now() + 650;
		const element = document.getElementById(`terms-section-${sectionNumber}`);
		if (element && typeof element.scrollIntoView === "function") {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	const handleRetry = () => {
		if (isViewingHistory) {
			void historicalQuery.refetch();
		} else {
			void currentQuery.refetch();
		}
	};

	return (
		<div className="min-h-screen bg-[#f4f7f2] px-5 py-6 font-sans text-[#10221b] antialiased">
			<div className="mx-auto max-w-[1240px]">
				{storedUser ? (
					<header className="mb-10 flex flex-wrap items-center justify-between gap-4">
						<button
							type="button"
							onClick={onNavigateToDashboard ?? onBackToHome}
							className="flex cursor-pointer items-center gap-3 text-2xl font-extrabold tracking-tight text-[#164027]"
						>
							<img src="/ctms_logo.png" alt="DiTrek Logo" className="h-13 w-auto object-contain" />
							<span>DiTrek</span>
						</button>
						<div className="flex items-center gap-3">
							<Button variant="outline" size="sm" onClick={onNavigateToDashboard ?? onBackToHome}>
								<ArrowLeft className="mr-1.5 size-4" />
								Quay lại bảng điều khiển
							</Button>
						</div>
					</header>
				) : (
					<HeaderNav
						onNavigateToLogin={onNavigateToLogin}
						onNavigateToRegister={onNavigateToRegister}
					/>
				)}

				{fromRegister && onBackToRegister && (
					<div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#cde0d1] bg-[#eef7f0] px-4 py-3">
						<p className="text-xs font-medium text-[#164027] sm:text-sm">
							Thông tin bạn đã nhập ở màn hình đăng ký vẫn được giữ nguyên.
						</p>
						<Button
							variant="primary"
							size="sm"
							onClick={onBackToRegister}
							className="shrink-0 bg-[#164027] hover:bg-[#0f2e1c]"
						>
							<ArrowLeft className="mr-1.5 size-4" />
							Quay lại đăng ký
						</Button>
					</div>
				)}

				{/* Header Banner */}
				<section className="rounded-3xl border border-[#dfe8df] bg-white px-6 py-7 shadow-xs sm:px-8 sm:py-8">
					<div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
						<div className="space-y-2">
							<p className="text-xs font-semibold tracking-wide text-[#2d5a27]">
								Tài liệu pháp lý và vận hành
							</p>
							<h1 className="text-2xl font-extrabold tracking-tight text-[#10221b] sm:text-3xl">
								{activeTerms?.title ?? "Điều khoản và Điều kiện sử dụng DiTrek"}
							</h1>
							{activeTerms && (
								<div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-medium text-[#425048]">
									<span className="inline-flex items-center gap-1.5">
										<Calendar className="size-3.5 text-[#164027]" />
										<span>Hiệu lực: {formatTermsDate(activeTerms.effectiveDate)}</span>
									</span>
									<StatusBadge tone={activeTerms.isActive ? "success" : "neutral"}>
										{activeTerms.isActive
											? formatTermsVersionLabel(activeTerms.version)
											: `${formatTermsVersionLabel(activeTerms.version)} (cũ)`}
									</StatusBadge>
								</div>
							)}
						</div>

						{isAdmin && (
							<div className="flex flex-wrap items-center gap-2.5">
								{isViewingHistory && currentQuery.data && (
									<Button
										variant="secondary"
										size="sm"
										onClick={() => setSelectedVersionCode(currentQuery.data?.version ?? null)}
									>
										Về phiên bản mới nhất
									</Button>
								)}
								<Button
									variant="outline"
									size="sm"
									onClick={() => setIsHistoryOpen(true)}
									className="gap-1.5"
								>
									<History className="size-4" />
									<span>Lịch sử phiên bản</span>
								</Button>
							</div>
						)}
					</div>
				</section>

				{isViewingHistory && activeTerms && (
					<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
						<span>
							Bạn đang xem phiên bản lịch sử {formatTermsVersionLabel(activeTerms.version)} (hiệu
							lực từ {formatTermsDate(activeTerms.effectiveDate)}).
						</span>
						{currentQuery.data && (
							<button
								type="button"
								onClick={() => setSelectedVersionCode(currentQuery.data?.version ?? null)}
								className="cursor-pointer font-bold text-[#164027] underline hover:no-underline"
							>
								Xem phiên bản hiện tại ({formatTermsVersionLabel(currentQuery.data.version)})
							</button>
						)}
					</div>
				)}

				{/* Main Body */}
				<div className="mt-6 pb-14">
					{isLoading && <PageSkeleton />}

					{isError && !isLoading && (
						<div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
							<p className="text-base font-bold text-[#10221b]">
								Không thể tải nội dung Điều khoản và Điều kiện sử dụng
							</p>
							<p className="mt-1.5 text-sm text-[#54655a]">
								Vui lòng kiểm tra kết nối mạng và thử tải lại.
							</p>
							<Button variant="primary" className="mt-4 bg-[#164027]" onClick={handleRetry}>
								Thử lại
							</Button>
						</div>
					)}

					{!isLoading && !isError && activeTerms && (
						<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
							<TermsToc
								sections={sections}
								activeNumber={activeSectionNumber}
								onSelectSection={handleSelectSection}
							/>

							<article className="min-w-0 flex-1 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs sm:p-8">
								<div className="space-y-8">
									{sections.map((section) => (
										<section
											key={section.number}
											id={`terms-section-${section.number}`}
											className="scroll-mt-6 border-b border-[#eef2ee] pb-8 last:border-b-0 last:pb-0"
										>
											<h2 className="text-xl font-bold tracking-tight text-[#10221b]">
												{section.number}. {section.title}
											</h2>

											<div className="mt-4 space-y-4">
												{section.subsections.map((sub) => (
													<div key={sub.code} className="space-y-1.5">
														<h3 className="text-sm font-bold text-[#164027]">
															{sub.code}. {sub.title}
														</h3>
														<p className="text-sm leading-relaxed text-[#35463c]">{sub.body}</p>
													</div>
												))}
											</div>

											{section.callout && (
												<div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#d6e7da] bg-[#f4f7f2] px-4 py-3 text-xs leading-relaxed text-[#254431]">
													<Info className="mt-0.5 size-4 shrink-0 text-[#164027]" />
													<p>{section.callout}</p>
												</div>
											)}
										</section>
									))}
								</div>
							</article>
						</div>
					)}
				</div>

				<Footer />
			</div>

			{isAdmin && (
				<TermsVersionHistoryModal
					isOpen={isHistoryOpen}
					onClose={() => setIsHistoryOpen(false)}
					selectedVersion={activeTerms?.version ?? ""}
					onSelectVersion={(version) => setSelectedVersionCode(version)}
				/>
			)}
		</div>
	);
};
