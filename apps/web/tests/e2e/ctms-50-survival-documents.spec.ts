import { type Page, expect, test } from "@playwright/test";
import type { LoginApiResponse } from "../../src/features/auth/types";

const API = "http://127.0.0.1:3050/api";
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
async function login(page: Page, role = "admin") {
	const response = await page.request.post(`${API}/auth/login`, {
		data: { identifier: `${role}-ctms50-e2e@example.test`, password: "Ctms50!FictionalTest" },
	});
	expect(response.ok()).toBe(true);
	const session = (await response.json()) as LoginApiResponse;
	await page.addInitScript((value) => {
		localStorage.setItem("accessToken", value.accessToken);
		localStorage.setItem("refreshToken", value.refreshToken);
		localStorage.setItem("authUser", JSON.stringify(value.user));
	}, session);
	return session;
}
async function fillSource(page: Page, title: string) {
	const form = page.getByRole("dialog");
	await form
		.getByLabel("Tệp PDF")
		.setInputFiles({ name: "fictional.pdf", mimeType: "application/pdf", buffer: pdf });
	await form.getByLabel("Tên tài liệu", { exact: true }).fill(title);
	await form.getByLabel("Tổ chức xuất bản").fill("Tổ chức giả định");
	await form.getByLabel("Ngày truy cập").fill("2026-01-01");
	await form.getByLabel("Loại giấy phép").fill("Giấy phép giả định");
	await form
		.getByLabel("Minh chứng quyền sử dụng")
		.fill("Tác giả giả định cho phép lưu trữ và xử lý tài liệu");
	await form.getByLabel("Ghi công nguồn").fill("Tác giả giả định");
	await form.getByLabel("Nội dung thay đổi").fill("Phiên bản giả định cho thử nghiệm");
	await form.getByRole("button", { name: "Lưu bản nháp" }).click();
}
async function publish(page: Page) {
	const panel = page.getByRole("dialog");
	await panel.getByRole("button", { name: "Gửi duyệt", exact: true }).click();
	await expect(panel.getByText("Chờ duyệt", { exact: true })).toBeVisible();
	await panel.getByLabel("Kết quả xác minh quyền").selectOption("PERMITTED");
	await panel.getByLabel("Đã kiểm tra nguồn và đúng phiên bản tài liệu").check();
	await panel.getByLabel("Có quyền lưu trữ và xử lý bằng AI").check();
	await panel
		.getByLabel("Minh chứng xét duyệt")
		.fill("Đã kiểm tra quyền cho đúng phiên bản giả định");
	await panel.getByRole("button", { name: "Phê duyệt", exact: true }).click();
	await expect(panel.getByText("Đã duyệt", { exact: true })).toBeVisible();
	await panel.getByRole("button", { name: "Xuất bản", exact: true }).click();
	await expect(panel.getByText("Đã xuất bản", { exact: true })).toBeVisible();
}
test("Admin completes upload-review-publish-v2-history-stop-use with real API and private storage", async ({
	page,
}) => {
	await login(page);
	await page.goto("/admin/survival-documents");
	await expect(page.getByRole("heading", { name: "Kho tài liệu sinh tồn" })).toBeVisible();
	const title = `Tài liệu giả định ${Date.now()}`;
	await page.getByRole("button", { name: "Thêm nguồn tài liệu" }).click();
	await fillSource(page, title);
	const panel = page.getByRole("dialog");
	await expect(panel.getByText("Bản nháp", { exact: true })).toBeVisible();
	await panel.getByRole("button", { name: "Mở tệp gốc riêng tư" }).click();
	await expect(panel.getByRole("link", { name: "Tải PDF về máy" })).toBeVisible();
	await publish(page);
	await expect(panel.getByText("Chưa được phép", { exact: true }).first()).toBeVisible();
	await panel.getByRole("button", { name: "Tạo phiên bản mới" }).click();
	await fillSource(page, title);
	await expect(panel.getByText("Bản nháp", { exact: true })).toBeVisible();
	await expect(panel.getByText(/Phiên bản đang xuất bản: 1/)).toBeVisible();
	await publish(page);
	await panel.getByLabel("Lịch sử phiên bản").selectOption({ label: "Phiên bản 1 · Đã thay thế" });
	await expect(panel.getByText("Đã thay thế", { exact: true })).toBeVisible();
	await expect(panel.getByRole("button", { name: "Gửi duyệt" })).toHaveCount(0);
	await panel.getByRole("button", { name: "Mở tệp gốc riêng tư" }).click();
	await expect(panel.getByRole("link", { name: "Tải PDF về máy" })).toBeVisible();
	await panel.getByLabel("Lịch sử phiên bản").selectOption({ label: "Phiên bản 2 · Đã xuất bản" });
	await panel.getByLabel("Lý do ngừng sử dụng").fill("Ngừng sử dụng tài liệu giả định");
	await panel.getByRole("button", { name: "Ngừng sử dụng", exact: true }).click();
	await expect(panel.getByText("Ngừng sử dụng", { exact: true })).toBeVisible();
	await page.screenshot({ path: "test-results/ctms50-source-history.png", fullPage: true });
});
test("catalog selection only prefills; no external request or permission approval", async ({
	page,
}) => {
	await login(page);
	const external: string[] = [];
	page.on("request", (request) => {
		if (
			/usgs.gov|nps.gov|weather.gov|cdc.gov|who.int|ifrc.org|dmptc.gov.vn|redcross.org.vn/.test(
				request.url()
			)
		)
			external.push(request.url());
	});
	await page.goto("/admin/survival-documents");
	await page.getByText("Gợi ý nguồn chính thống", { exact: true }).click();
	await page.getByRole("button", { name: "Điền thông tin nguồn" }).first().click();
	await expect(page.getByLabel("Tên tài liệu", { exact: true })).toHaveValue("Landslide Basics");
	await expect(page.getByLabel("Minh chứng quyền sử dụng")).toHaveValue("");
	await expect(page.getByLabel("Loại giấy phép")).toHaveValue("");
	expect(external).toEqual([]);
});
for (const role of ["camper", "host", "porter"])
	test(`${role} cannot access Admin source management`, async ({ page }) => {
		const session = await login(page, role);
		await page.goto("/admin/survival-documents");
		await expect(page.getByRole("heading", { name: "Kho tài liệu sinh tồn" })).toHaveCount(0);
		const response = await page.request.get(`${API}/admin/survival-documents`, {
			headers: { Authorization: `Bearer ${session.accessToken}` },
		});
		expect(response.status()).toBe(403);
	});
