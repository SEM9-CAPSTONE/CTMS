import { type Page, expect, test } from "@playwright/test";
import type { LoginApiResponse } from "../../src/features/auth/types";

const API = "http://127.0.0.1:3050/api";
function pdf(fixture: string) {
	const page = (contents: number) =>
		`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 7 0 R >> >> /Contents ${contents} 0 R >>`;
	const stream = (color: string) => {
		const command = `${color} rg 50 50 300 400 re f\n0 0 0 rg BT /F1 16 Tf 60 470 Td (PDF preview test) Tj ET\n`;
		return `<< /Length ${command.length} >>\nstream\n${command}endstream`;
	};
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 2 /Kids [3 0 R 5 0 R] >>",
		page(4),
		stream("0.1 0.4 0.3"),
		page(6),
		stream("0.2 0.3 0.6"),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	];
	let content = `%PDF-1.4\n% ${fixture}\n`;
	const offsets = objects.map((object, index) => {
		const offset = Buffer.byteLength(content);
		content += `${index + 1} 0 obj\n${object}\nendobj\n`;
		return offset;
	});
	const xref = Buffer.byteLength(content);
	content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) content += `${String(offset).padStart(10, "0")} 00000 n \n`;
	return Buffer.from(
		`${content}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
	);
}
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
async function fillSource(
	page: Page,
	title: string,
	buffer: Buffer,
	filename: string,
	action = "Lưu bản nháp"
) {
	const form = page.getByRole("dialog");
	await form
		.getByLabel("Tệp PDF")
		.setInputFiles({ name: filename, mimeType: "application/pdf", buffer });
	await form.getByLabel(/Tên tài liệu/).fill(title);
	await form.getByLabel("URL nguồn tham khảo").fill("https://example.org/manual");
	await form.getByRole("button", { name: action, exact: true }).click();
}
async function openDuplicate(
	page: Page,
	save: () => Promise<void>,
	code: string,
	existingTitle: string
) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(result) =>
				result.request().method() === "POST" &&
				result.url().startsWith(`${API}/admin/survival-documents`) &&
				result.status() === 409
		),
		save(),
	]);
	expect(await response.json()).toMatchObject({ code });
	const panel = page.getByRole("dialog");
	await expect(panel.getByRole("alert")).toContainText(`${existingTitle} · Phiên bản 1`);
	await panel.getByRole("button", { name: "Mở phiên bản đã có" }).click();
	await panel.getByRole("tab", { name: "Phiên bản" }).click();
	await expect(panel.getByLabel("Lịch sử phiên bản").locator("option")).toHaveCount(1);
}
async function openPublished(page: Page, title: string) {
	await expect(page.getByTestId("toast-success").last()).toContainText("Đã xuất bản tài liệu.");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.getByRole("button", { name: `Xem ${title}`, exact: true }).click();
	await expect(page.getByRole("dialog").getByText("Đã xuất bản", { exact: true })).toBeVisible();
}
test("Admin uploads, publishes, replaces and archives versions with real API and private storage", async ({
	page,
}) => {
	await login(page);
	await page.goto("/admin/survival-documents");
	await expect(page.getByRole("heading", { name: "Kho tài liệu sinh tồn" })).toBeVisible();
	const stamp = Date.now();
	const title = `Tài liệu giả định ${stamp}`;
	const firstName = `fictional-${stamp}.pdf`;
	const firstPdf = pdf(`${title} v1`);
	const changedPdf = pdf(`${title} v2`);
	await page.getByRole("button", { name: "Thêm tài liệu", exact: true }).click();
	await fillSource(page, title, firstPdf, firstName, "Xuất bản");
	await openPublished(page, title);
	const panel = page.getByRole("dialog");
	const firstPage = panel.getByRole("img", { name: "Trang PDF 1" });
	await expect(firstPage).toBeVisible();
	expect(
		await firstPage.evaluate(
			(element: HTMLCanvasElement) =>
				element.getContext("2d")?.getImageData(element.width / 2, element.height / 2, 1, 1).data[1]
		)
	).toBe(102);
	const idle = await firstPage.evaluate(async (element: HTMLCanvasElement) => {
		const scrollport = element.closest('[aria-label="Các trang PDF"]') as HTMLElement;
		scrollport.scrollTop = 50;
		const start = scrollport.scrollTop;
		let mutations = 0;
		const observer = new MutationObserver((records) => {
			mutations += records.length;
		});
		observer.observe(element, {
			attributes: true,
			attributeFilter: ["width", "height", "hidden", "style"],
		});
		await new Promise<void>((resolve) => {
			const until = performance.now() + 400;
			const frame = () => (performance.now() < until ? requestAnimationFrame(frame) : resolve());
			requestAnimationFrame(frame);
		});
		observer.disconnect();
		return { mutations, start, finish: scrollport.scrollTop };
	});
	expect(idle.mutations).toBe(0);
	expect(idle.start).toBeGreaterThan(0);
	expect(idle.finish).toBe(idle.start);
	const pages = panel.getByLabel("Các trang PDF");
	await pages.locator(":scope > div").nth(1).scrollIntoViewIfNeeded();
	await expect(panel.getByRole("img", { name: "Trang PDF 2" })).toBeVisible();
	await expect(panel.getByText("2 trang", { exact: true })).toBeVisible();
	await expect(panel.getByRole("button", { name: "Trang sau" })).toHaveCount(0);
	await expect.poll(() => pages.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	const secondPage = panel.getByRole("img", { name: "Trang PDF 2" });
	const unzoomed = await secondPage.evaluate((element: HTMLCanvasElement) => element.width);
	await panel.getByRole("button", { name: "Phóng to PDF (100%)", exact: true }).click();
	await expect
		.poll(() => secondPage.evaluate((element: HTMLCanvasElement) => element.width))
		.toBeGreaterThan(unzoomed);
	await expect(secondPage).toBeVisible();
	await panel.getByRole("button", { name: "Toàn màn hình PDF" }).click();
	await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
	await page.keyboard.press("Escape");
	await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
	await pages.locator(":scope > div").nth(1).scrollIntoViewIfNeeded();
	await expect(secondPage).toBeVisible();
	await expect(panel.getByRole("link", { name: "Tải PDF về máy" })).toBeVisible();
	await panel.getByRole("tab", { name: "Nhật ký" }).click();
	await expect(panel.getByRole("heading", { name: "Ngày xuất bản" })).toBeVisible();
	await expect(panel.getByText(/Người thực hiện/)).toHaveCount(0);
	await expect(panel.getByText("Tải tệp lên", { exact: true })).toHaveCount(0);
	await panel.getByRole("tab", { name: "Tổng quan" }).click();
	await panel.screenshot({ path: "test-results/ctms50-details-viewer.png" });
	await expect(panel.getByText("Thông tin tài liệu và quyền sử dụng", { exact: true })).toHaveCount(
		0
	);
	await panel.getByRole("button", { name: "Tạo phiên bản mới" }).click();
	await openDuplicate(
		page,
		() => fillSource(page, title, firstPdf, `renamed-${stamp}.pdf`),
		"SOURCE_DUPLICATE_PDF",
		title
	);
	await panel.getByRole("button", { name: "Đóng", exact: true }).click();
	await page.getByRole("button", { name: "Thêm tài liệu", exact: true }).click();
	await openDuplicate(
		page,
		() => fillSource(page, `${title} trùng`, firstPdf, firstName),
		"SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT",
		title
	);
	await panel.getByRole("button", { name: "Tạo phiên bản mới" }).click();
	await openDuplicate(
		page,
		() => fillSource(page, title, changedPdf, firstName),
		"SOURCE_DUPLICATE_PDF_NAME",
		title
	);
	await panel.getByRole("button", { name: "Tạo phiên bản mới" }).click();
	await fillSource(page, title, changedPdf, `fictional-${stamp}-v2.pdf`);
	await expect(panel.getByText("Bản nháp", { exact: true })).toBeVisible();
	await expect(panel.getByText(/Phiên bản đang xuất bản:/)).toHaveCount(0);
	await panel.getByRole("button", { name: "Xuất bản", exact: true }).click();
	await openPublished(page, title);
	await panel.getByRole("tab", { name: "Phiên bản" }).click();
	await panel.getByLabel("Lịch sử phiên bản").selectOption({ label: "Phiên bản 1" });
	await expect(panel.getByText("Đã thay thế", { exact: true })).toBeVisible();
	await expect(panel.getByRole("button", { name: "Xuất bản" })).toHaveCount(0);
	await expect(panel.getByRole("img", { name: "Trang PDF 1" })).toBeVisible();
	await expect(panel.getByRole("link", { name: "Tải PDF về máy" })).toBeVisible();
	await panel.getByLabel("Lịch sử phiên bản").selectOption({ label: "Phiên bản 2" });
	await expect(panel.getByRole("button", { name: "Ngừng sử dụng", exact: true })).toBeEnabled();
	await panel.getByRole("button", { name: "Ngừng sử dụng", exact: true }).click();
	const archiveDialog = page.getByRole("dialog", { name: "Ngừng sử dụng tài liệu", exact: true });
	await expect(archiveDialog).toBeVisible();
	await expect(
		archiveDialog.getByRole("button", { name: "Xác nhận ngừng sử dụng" })
	).toBeDisabled();
	await archiveDialog.getByLabel("Lý do ngừng sử dụng").fill("Ngừng sử dụng tài liệu giả định");
	await archiveDialog.getByRole("button", { name: "Xác nhận ngừng sử dụng" }).click();
	await expect(archiveDialog).toHaveCount(0);
	await expect(panel.getByText("Ngừng sử dụng", { exact: true })).toBeVisible();
	await expect(panel.getByRole("img", { name: "Trang PDF 1" })).toBeVisible();
	await page.screenshot({ path: "test-results/ctms50-source-history.png", fullPage: true });
	await panel.getByRole("button", { name: "Xóa tài liệu", exact: true }).click();
	await expect(page.getByText("Xóa vĩnh viễn tài liệu?")).toBeVisible();
	await page.getByRole("button", { name: "Hủy bỏ" }).click();
	await expect(panel).toBeVisible();
	await panel.getByRole("button", { name: "Xóa tài liệu", exact: true }).click();
	await page.getByRole("button", { name: "Xóa vĩnh viễn", exact: true }).click();
	await expect(page.getByText("Đã xóa tài liệu.")).toBeVisible();
	await expect(page.getByRole("button", { name: `Xem ${title}`, exact: true })).toHaveCount(0);
});
test("shows upload and URL modes without catalog requests or browser PDF downloads", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page);
	const external: string[] = [];
	const catalog: string[] = [];
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (url.hostname === "example.org") external.push(request.url());
		if (url.pathname.endsWith("/survival-documents/references")) catalog.push(request.url());
	});
	await page.goto("/admin/survival-documents");
	await expect(page.getByText("Gợi ý nguồn chính thống", { exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "Thêm tài liệu", exact: true }).click();
	const form = page.getByRole("dialog");
	const pickFile = form.getByRole("button", { name: "Chọn tệp", exact: true });
	const title = form.getByLabel(/Tên tài liệu/);
	await expect(pickFile).toBeVisible();
	await title.fill("Tài liệu kiểm thử từ URL");
	const desktopFile = await pickFile.boundingBox();
	const desktopTitle = await title.boundingBox();
	expect(desktopFile && desktopTitle && desktopFile.x < desktopTitle.x).toBe(true);
	await form.screenshot({ path: testInfo.outputPath("editor-upload-desktop.png") });

	await form.getByRole("button", { name: "Nhập URL PDF" }).click();
	const sourceUrl = form.getByLabel(/URL (tệp )?PDF/);
	await sourceUrl.fill("https://example.org/manual.pdf");
	await expect(form.getByLabel("Tệp PDF")).toHaveCount(0);
	await expect(title).toHaveValue("Tài liệu kiểm thử từ URL");
	const compactDialog = await form.boundingBox();
	const compactUrl = await sourceUrl.boundingBox();
	const compactTitle = await title.boundingBox();
	expect(compactDialog?.width).toBeLessThanOrEqual(512);
	expect(compactUrl && compactTitle && compactUrl.y < compactTitle.y).toBe(true);
	expect(await form.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
	await form.screenshot({ path: testInfo.outputPath("editor-url-compact.png") });
	await form.getByRole("button", { name: "Tải PDF từ máy" }).click();
	await expect(form.getByLabel(/URL (tệp )?PDF/)).toHaveCount(0);
	expect(external).toEqual([]);
	expect(catalog).toEqual([]);
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
