import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AvailablePorter } from "../types";
import { AvailablePorterCard } from "./AvailablePorterCard";

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false } },
});

function renderCard(porter: AvailablePorter) {
	return render(
		<QueryClientProvider client={queryClient}>
			{/* biome-ignore lint/a11y/useValidAriaRole: component prop, not an ARIA role */}
			<AvailablePorterCard tripId="trip-123" porter={porter} role="support" />
		</QueryClientProvider>
	);
}

describe("AvailablePorterCard", () => {
	const basePorter: AvailablePorter = {
		porterId: "porter-1",
		displayName: "Nguyễn Minh Sơn",
		avatarUrl: null,
		experienceYears: 5,
		availabilityStatus: "available",
		ratingAvg: 4.9,
		completedTrips: 42,
	};

	it("renders porter basic info cleanly", () => {
		renderCard(basePorter);
		expect(screen.getByText("Nguyễn Minh Sơn")).toBeInTheDocument();
		expect(screen.getByText("5 năm kinh nghiệm")).toBeInTheDocument();
		expect(screen.getByText("42 chuyến")).toBeInTheDocument();
		expect(screen.getByText("4.9")).toBeInTheDocument();
	});

	it("renders no certificate pills when certificates list is empty", () => {
		renderCard({ ...basePorter, certificates: [] });
		expect(screen.queryByLabelText("Danh sách chứng chỉ đã xác minh")).not.toBeInTheDocument();
	});

	it("renders up to 2 certificates without extra badge", () => {
		renderCard({
			...basePorter,
			certificates: [
				{ type: "wfa", name: "Sơ cấp cứu WFA" },
				{ type: "rescue", name: "Cứu hộ địa hình" },
			],
		});

		expect(screen.getByText("Sơ cấp cứu WFA")).toBeInTheDocument();
		expect(screen.getByText("Cứu hộ địa hình")).toBeInTheDocument();
		expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
		expect(screen.queryByText(/còn hạn/i)).not.toBeInTheDocument();
	});

	it("renders first 2 certificates and '+n' badge when having 3 or more certificates", () => {
		renderCard({
			...basePorter,
			certificates: [
				{ type: "wfa", name: "Sơ cấp cứu WFA" },
				{ type: "rescue", name: "Cứu hộ địa hình" },
				{ type: "guide_card", name: "Thẻ HDV Quốc tế" },
				{ type: "other", name: "Kỹ năng sinh tồn" },
			],
		});

		expect(screen.getByText("Sơ cấp cứu WFA")).toBeInTheDocument();
		expect(screen.getByText("Cứu hộ địa hình")).toBeInTheDocument();
		expect(screen.queryByText("Thẻ HDV Quốc tế")).not.toBeInTheDocument();
		expect(screen.getByText("+2")).toBeInTheDocument();
		expect(screen.getByTitle("Còn 2 chứng chỉ khác")).toBeInTheDocument();
	});
});
