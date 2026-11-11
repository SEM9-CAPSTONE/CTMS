import { AlertTriangle, BriefcaseBusiness, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { PorterRequestCard } from "../components/PorterRequestCard";
import {
	responseErrorMessage,
	useMyPorterRequests,
	useRespondToPorterRequest,
} from "../hooks/usePorterRequests";
import type { PorterRequest } from "../types";

export interface PorterRequestsPageProps {
	onBackHome?: () => void;
}

export function PorterRequestsPage({ onBackHome }: PorterRequestsPageProps) {
	const query = useMyPorterRequests();
	const mutation = useRespondToPorterRequest();
	const submitting = useRef(false);
	const [pendingAction, setPendingAction] = useState<{
		request: PorterRequest;
		action: "accept" | "decline";
	} | null>(null);

	const requests = query.data ?? [];
	const showInitialLoading = query.isLoading && requests.length === 0;
	const error = query.error ? responseErrorMessage(query.error) : null;
	const mutationError = mutation.error ? responseErrorMessage(mutation.error) : null;
	useEffect(() => {
		if (!pendingAction || mutation.isPending) return;
		const current = query.data?.find((item) => item.id === pendingAction.request.id);
		if (current && current.status !== "pending") setPendingAction(null);
	}, [pendingAction, mutation.isPending, query.data]);

	const confirmAction = async () => {
		if (!pendingAction || submitting.current) return;
		submitting.current = true;
		try {
			await mutation.mutateAsync({
				requestId: pendingAction.request.id,
				action: pendingAction.action,
			});
			setPendingAction(null);
		} catch {
			// The mutation exposes the mapped error inside the confirmation dialog.
		} finally {
			submitting.current = false;
		}
	};

	return (
		<div className="min-h-screen bg-[#f4f7f2] px-4 py-8 sm:px-6">
			<div className="mx-auto max-w-5xl space-y-6">
				<header className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
					<p className="text-xs font-extrabold uppercase tracking-wide text-[#667a6d]">
						Porter Request
					</p>
					<h1 className="mt-1 text-2xl font-extrabold text-[#10221b]">Yêu cầu tham gia Trip</h1>
					<p className="mt-2 max-w-3xl text-sm leading-6 text-[#667a6d]">
						Chấp nhận yêu cầu sẽ tự động phân công bạn vào Trip sau khi hệ thống kiểm tra lại lịch,
						điều kiện và trạng thái Trip.
					</p>
					<div className="mt-4 flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => void query.refetch()}
							className="gap-2"
						>
							<RefreshCw className="size-4" />
							Tải lại
						</Button>
						{onBackHome && (
							<Button variant="ghost" size="sm" onClick={onBackHome}>
								Về dashboard
							</Button>
						)}
					</div>
				</header>

				{showInitialLoading && (
					<section className="flex items-center justify-center gap-3 rounded-3xl border border-[#dfe8df] bg-white p-10 text-sm font-bold text-[#667a6d]">
						<Loader2 className="size-5 animate-spin text-[#164027]" />
						Đang tải yêu cầu Porter...
					</section>
				)}

				{!showInitialLoading && error && (
					<section
						role="alert"
						className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-900"
					>
						<div className="flex items-start gap-2">
							<AlertTriangle className="size-5 shrink-0" />
							<span>{error}</span>
						</div>
					</section>
				)}

				{mutationError && !pendingAction && (
					<section
						role="alert"
						className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900"
					>
						{mutationError}
					</section>
				)}

				{!showInitialLoading && !error && requests.length === 0 && (
					<section className="rounded-3xl border border-dashed border-[#cbd9cd] bg-white p-10 text-center shadow-sm">
						<BriefcaseBusiness className="mx-auto size-8 text-[#164027]" />
						<p className="mt-3 text-sm font-extrabold text-[#10221b]">
							Chưa có yêu cầu tham gia Trip.
						</p>
					</section>
				)}

				{requests.length > 0 && (
					<ul className="space-y-3">
						{requests.map((request) => (
							<PorterRequestCard
								key={request.id}
								request={request}
								mode="porter"
								onAccept={(nextRequest) => {
									mutation.reset();
									setPendingAction({ request: nextRequest, action: "accept" });
								}}
								onDecline={(nextRequest) => {
									mutation.reset();
									setPendingAction({ request: nextRequest, action: "decline" });
								}}
								isSubmitting={mutation.isPending && mutation.variables?.requestId === request.id}
							/>
						))}
					</ul>
				)}

				<ConfirmModal
					isOpen={pendingAction !== null}
					onClose={() => {
						if (!mutation.isPending) setPendingAction(null);
					}}
					onConfirm={confirmAction}
					title={pendingAction?.action === "accept" ? "Chấp nhận yêu cầu?" : "Từ chối yêu cầu?"}
					description={
						<div className="space-y-3">
							<p>
								{pendingAction?.action === "accept"
									? "Hệ thống sẽ kiểm tra lại điều kiện hiện tại và tự động phân công bạn vào Trip nếu hợp lệ."
									: "Yêu cầu sẽ chuyển sang trạng thái đã từ chối và không tạo phân công."}
							</p>
							{mutationError && (
								<p role="alert" className="text-rose-800">
									{mutationError}
								</p>
							)}
						</div>
					}
					confirmText={pendingAction?.action === "accept" ? "Chấp nhận" : "Từ chối"}
					variant={pendingAction?.action === "accept" ? "success" : "warning"}
					isLoading={mutation.isPending}
				/>
			</div>
		</div>
	);
}
