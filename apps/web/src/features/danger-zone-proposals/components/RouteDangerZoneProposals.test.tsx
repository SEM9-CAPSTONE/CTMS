import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import { dangerZoneProposalsService } from "../services/danger-zone-proposals.service";
import { RouteDangerZoneProposals } from "./RouteDangerZoneProposals";

afterEach(() => vi.restoreAllMocks());
it("keeps Host proposal history read-only", async () => {
	vi.spyOn(dangerZoneProposalsService, "listForRoute").mockResolvedValue([]);
	render(
		<RouteDangerZoneProposals route={{ id: "route", name: "Sơn Trà" } as CreatedTrekkingRoute} />
	);
	expect(await screen.findByText("Đề xuất điểm nguy hiểm")).toBeInTheDocument();
	expect(screen.queryByRole("button", { name: "Thêm đề xuất" })).not.toBeInTheDocument();
	expect(dangerZoneProposalsService).not.toHaveProperty("create");
});
