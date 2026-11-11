import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScheduleProgressService } from "../services/schedule-progress.service";
import type { CamperScheduleProgress, ScheduleProgressResponse } from "../types";
import { TeamScheduleProgressCard } from "./TeamScheduleProgressCard";

const TRIP_ID = "44444444-4444-4444-8444-444444444444";

function member(overrides: Partial<CamperScheduleProgress>): CamperScheduleProgress {
	return {
		userId: "u",
		fullName: "Camper",
		status: "ON_TRACK",
		reference: null,
		lagMinutes: null,
		safeCheckpoint: null,
		guidance: null,
		lastValidSampleAt: "2026-11-07T03:10:00.000Z",
		levelsReached: [],
		...overrides,
	};
}

function response(overrides: Partial<ScheduleProgressResponse> = {}): ScheduleProgressResponse {
	return {
		tripId: TRIP_ID,
		tripStatus: "ongoing",
		evaluatedAt: "2026-11-07T03:12:00.000Z",
		viewer: "team",
		configVersion: "v3",
		thresholds: {
			behindLagMinutes: 30,
			severelyBehindLagMinutes: 60,
			locationUnknownAfterMinutes: 5,
		},
		members: [],
		...overrides,
	};
}

const reference = {
	checkpointId: "cp",
	checkpointName: "Đèo Gió",
	porterArrivedAt: "2026-11-07T02:00:00.000Z",
};

function renderCard(get: ScheduleProgressService["get"]) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return render(<TeamScheduleProgressCard tripId={TRIP_ID} service={{ get }} />, { wrapper });
}

afterEach(cleanup);

describe("TeamScheduleProgressCard (CTMS-063-T02)", () => {
	it("shows a loading state first", () => {
		renderCard(() => new Promise(() => undefined));
		expect(screen.getByText("Đang tải tiến độ thành viên…")).toBeInTheDocument();
	});

	it("lists members most urgent first with the server's checkpoint, lag and guidance", async () => {
		renderCard(async () =>
			response({
				members: [
					member({ userId: "a", fullName: "An", status: "ON_TRACK" }),
					member({
						userId: "b",
						fullName: "Bình",
						status: "SEVERELY_BEHIND",
						reference,
						lagMinutes: 72,
						safeCheckpoint: { id: "s", name: "Trạm nghỉ suối", type: "rest" },
						guidance: "Dừng tại Trạm nghỉ suối và chờ Porter hướng dẫn.",
					}),
					member({ userId: "c", fullName: "Chi", status: "LOCATION_UNKNOWN", reference }),
					member({
						userId: "d",
						fullName: "Dũng",
						status: "BEHIND",
						reference,
						lagMinutes: 35,
						safeCheckpoint: { id: "s", name: "Trạm nghỉ suối", type: "rest" },
						guidance: "Hãy tiếp tục theo tuyến.",
					}),
				],
			})
		);

		const rows = await screen.findAllByTestId("schedule-progress-member");
		expect(rows.map((row) => row.dataset.status)).toEqual([
			"SEVERELY_BEHIND",
			"BEHIND",
			"LOCATION_UNKNOWN",
			"ON_TRACK",
		]);
		const severe = within(rows[0]);
		expect(severe.getByText("Chậm nghiêm trọng")).toBeInTheDocument();
		expect(severe.getByText(/chậm 72 phút/)).toBeInTheDocument();
		expect(severe.getByText("Trạm nghỉ suối")).toBeInTheDocument();
		expect(
			severe.getByText("Dừng tại Trạm nghỉ suối và chờ Porter hướng dẫn.")
		).toBeInTheDocument();
		expect(within(rows[2]).getByText("Chưa rõ vị trí")).toBeInTheDocument();
		expect(within(rows[2]).queryByText(/chậm \d+ phút/)).not.toBeInTheDocument();
	});

	it("never shows lag or a safe checkpoint for a Camper who is on track", async () => {
		renderCard(async () =>
			response({ members: [member({ status: "ON_TRACK", reference, lagMinutes: 12 })] })
		);

		const row = await screen.findByTestId("schedule-progress-member");
		expect(within(row).getByText("Theo kịp đoàn")).toBeInTheDocument();
		expect(within(row).queryByText(/chậm 12 phút/)).not.toBeInTheDocument();
		expect(within(row).queryByText(/Điểm an toàn/)).not.toBeInTheDocument();
	});

	it("shows the no-safe-checkpoint wording instead of inventing a checkpoint", async () => {
		renderCard(async () =>
			response({
				members: [
					member({
						status: "BEHIND",
						reference,
						lagMinutes: 31,
						safeCheckpoint: null,
						guidance:
							"Không có checkpoint an toàn gần đây. Dừng ở nơi an toàn, giữ liên lạc với Porter.",
					}),
				],
			})
		);

		const row = await screen.findByTestId("schedule-progress-member");
		expect(within(row).getByText("Không có checkpoint an toàn gần đây")).toBeInTheDocument();
	});

	it("explains when the Trip is not running or nobody has checked in", async () => {
		renderCard(async () => response({ tripStatus: "completed" }));
		expect(
			await screen.findByText("Chỉ theo dõi tiến độ khi chuyến đi đang diễn ra.")
		).toBeInTheDocument();
		cleanup();

		renderCard(async () => response());
		expect(
			await screen.findByText("Chưa có Camper nào đã check-in tham gia chuyến đi.")
		).toBeInTheDocument();
	});

	it("shows an error when the first load fails and recovers on refresh", async () => {
		const get = vi
			.fn<ScheduleProgressService["get"]>()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue(response({ members: [member({ fullName: "An" })] }));
		renderCard(get);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Không tải được tiến độ thành viên."
		);
		await userEvent.click(screen.getByRole("button", { name: "Làm mới" }));

		expect(await screen.findByText("An")).toBeInTheDocument();
	});

	it("keeps the last evaluation, labelled with its time, when a refresh fails", async () => {
		const get = vi
			.fn<ScheduleProgressService["get"]>()
			.mockResolvedValueOnce(
				response({
					members: [member({ fullName: "An", status: "BEHIND", reference, lagMinutes: 33 })],
				})
			)
			.mockRejectedValue(new Error("offline"));
		renderCard(get);
		await screen.findByText("An");

		await userEvent.click(screen.getByRole("button", { name: "Làm mới" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			/Không cập nhật được tiến độ\. Đang hiển thị dữ liệu lúc/
		);
		expect(screen.getByText("An")).toBeInTheDocument();
	});
});
