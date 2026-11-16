import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HostMonitoringParticipants } from "./HostMonitoringParticipants";

const names = [
	"Nguyễn Ngọc Lan",
	"Trần Quốc Huy",
	"Lê Thanh Mai",
	"Phạm Thanh Bình",
	"Nguyễn Minh Anh",
];
const participants = Array.from({ length: 25 }, (_, index) => ({
	id: `participant-${index}`,
	role: "camper" as const,
	name: names[index % names.length],
	location: null,
	lastSeenAt: null,
	freshness: "unavailable" as const,
	outsideRouteArea: false,
	safety: { route: null, gps: null },
}));

describe("HostMonitoringParticipants", () => {
	it("pages a large Trip without losing the global marker code", () => {
		const onSelect = vi.fn();
		render(
			<HostMonitoringParticipants
				participants={participants}
				tripId="trip"
				now={0}
				onSelect={onSelect}
			/>
		);
		expect(screen.getAllByRole("listitem")).toHaveLength(6);
		fireEvent.click(screen.getByRole("button", { name: "Tiếp theo" }));
		const button = screen.getByRole("list").querySelector("button");
		if (!button) throw new Error("Expected a roster row");
		const code = button.textContent?.match(/^C([0-9]+)/);
		fireEvent.click(button);
		expect(onSelect).toHaveBeenCalledWith({
			tripId: "trip",
			role: "camper",
			participantId: `participant-${Number(code?.[1]) - 1}`,
		});
	});
	it("opens the page containing a participant selected on the map", () => {
		const { rerender } = render(
			<HostMonitoringParticipants
				participants={participants}
				tripId="trip"
				now={0}
				onSelect={vi.fn()}
			/>
		);
		rerender(
			<HostMonitoringParticipants
				participants={participants}
				member={participants[24]}
				tripId="trip"
				now={0}
				onSelect={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: /^C25 ·/ })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getAllByRole("listitem")).toHaveLength(6);
	});
	it("preserves the page during a refresh with the same selected identity", () => {
		const { rerender } = render(
			<HostMonitoringParticipants
				participants={participants}
				member={participants[0]}
				tripId="trip"
				now={0}
				onSelect={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Tiếp theo" }));
		rerender(
			<HostMonitoringParticipants
				participants={[...participants]}
				member={{ ...participants[0] }}
				tripId="trip"
				now={15000}
				onSelect={vi.fn()}
			/>
		);
		expect(screen.getByText("Trang 2 / 5")).toBeVisible();
	});
	it("searches Vietnamese names without accents and keeps summary counts independent of filtering", () => {
		render(
			<HostMonitoringParticipants
				participants={participants}
				tripId="trip"
				now={0}
				onSelect={vi.fn()}
			/>
		);
		fireEvent.change(screen.getByRole("textbox", { name: "Tìm thành viên theo tên" }), {
			target: { value: "le thanh mai" },
		});
		expect(screen.getAllByRole("listitem")).toHaveLength(5);
		expect(screen.getByText("25 thành viên: 0 mới, 0 cũ, 25 chưa có vị trí")).toBeVisible();
		fireEvent.change(screen.getByRole("combobox", { name: "Lọc vai trò" }), {
			target: { value: "porter" },
		});
		expect(screen.getByText("Không có thành viên phù hợp.")).toBeVisible();
	});
	it("prioritizes missing and stale locations ahead of fresh locations", () => {
		const mixed = [
			{ ...participants[0], freshness: "fresh" as const },
			{ ...participants[1], freshness: "stale" as const },
			{ ...participants[2] },
		];
		render(
			<HostMonitoringParticipants participants={mixed} tripId="trip" now={0} onSelect={vi.fn()} />
		);
		const rows = screen.getAllByRole("listitem");
		expect(rows[0]).toHaveTextContent("C3");
		expect(rows[1]).toHaveTextContent("C2");
		expect(rows[2]).toHaveTextContent("C1");
		fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái vị trí" }), {
			target: { value: "stale" },
		});
		expect(screen.getAllByRole("listitem")).toHaveLength(1);
	});
	it("pins an off-page selection and reveals it on request", () => {
		render(
			<HostMonitoringParticipants
				participants={participants}
				member={participants[0]}
				tripId="trip"
				now={0}
				onSelect={vi.fn()}
			/>
		);
		fireEvent.change(screen.getByRole("textbox", { name: "Tìm thành viên theo tên" }), {
			target: { value: "Lê Thanh Mai" },
		});
		expect(screen.getByText(/Đang chọn:/)).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: "Hiện trong danh sách" }));
		expect(screen.getByRole("button", { name: /^C1 ·/ })).toHaveAttribute("aria-pressed", "true");
	});
});
