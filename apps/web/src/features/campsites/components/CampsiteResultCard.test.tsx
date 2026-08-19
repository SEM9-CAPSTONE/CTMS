import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CampsiteSearchItem } from "../types";
import { CampsiteResultCard } from "./CampsiteResultCard";

describe("CampsiteResultCard", () => {
	const campsite: CampsiteSearchItem = {
		id: "1",
		name: "Đà Lạt Pine Camp",
		location: { province: "Lam Dong", city: "Da Lat", latitude: 11.9, longitude: 108.4 },
		coverImage: "https://example.com/cover.jpg",
		activeRoutes: [],
	};

	it("renders name, city+province, and the cover image -- no price field anywhere (BR-048/AC3)", () => {
		render(<CampsiteResultCard campsite={campsite} />);
		expect(screen.getByText("Đà Lạt Pine Camp")).toBeInTheDocument();
		expect(screen.getByText("Da Lat, Lam Dong")).toBeInTheDocument();
		const img = screen.getByAltText("Đà Lạt Pine Camp") as HTMLImageElement;
		expect(img.src).toBe("https://example.com/cover.jpg");
		expect(screen.queryByText(/₫|VND|price|giá/i)).not.toBeInTheDocument();
	});

	it("falls back to a placeholder icon (no broken <img>) when coverImage is null", () => {
		render(<CampsiteResultCard campsite={{ ...campsite, coverImage: null }} />);
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
	});

	it("renders nothing for activeRoutes -- no fabricated 'routes' section for an empty array", () => {
		render(<CampsiteResultCard campsite={campsite} />);
		expect(screen.queryByText(/route|tuyến/i)).not.toBeInTheDocument();
	});
});
