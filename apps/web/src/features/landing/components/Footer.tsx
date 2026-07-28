import type React from "react";

export const Footer: React.FC = () => {
	return (
		<footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#dfe8df] pt-8 pb-3 text-sm text-[#425048]">
			<div className="flex items-center gap-3">
				<img src="/ctms_logo.png" alt="CTMS Logo" className="h-9.5 w-auto object-contain" />
				<span>
					© 2026 CTMS - Hệ thống Quản lý Điểm cắm trại & Trekking. Tất cả quyền được bảo lưu.
				</span>
			</div>
			<div className="flex gap-6">
				<a href="/privacy" className="font-semibold text-[#425048] hover:text-[#1c442f]">
					Chính sách
				</a>
				<a href="/terms" className="font-semibold text-[#425048] hover:text-[#1c442f]">
					Điều khoản
				</a>
				<a href="/contact" className="font-semibold text-[#425048] hover:text-[#1c442f]">
					Liên hệ
				</a>
				<a href="/support" className="font-semibold text-[#425048] hover:text-[#1c442f]">
					Hỗ trợ
				</a>
			</div>
		</footer>
	);
};
