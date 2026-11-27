import type React from "react";
import { handlePublicLinkClick } from "../../public-pages/utils/spaNavigate";

export const Footer: React.FC = () => {
	return (
		<footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#dfe8df] pt-8 pb-3 text-sm text-[#425048]">
			<a
				href="/"
				onClick={(event) => handlePublicLinkClick(event, "/")}
				className="flex items-center gap-3 text-[#425048] transition hover:text-[#1c442f]"
			>
				<img src="/ctms_logo.png" alt="CTMS Logo" className="h-9.5 w-auto object-contain" />
				<span>
					© 2026 CTMS - Hệ thống Quản lý Điểm cắm trại &amp; Trekking. Tất cả quyền được bảo lưu.
				</span>
			</a>
			<div className="flex flex-wrap gap-6">
				<a
					href="/privacy"
					onClick={(event) => handlePublicLinkClick(event, "/privacy")}
					className="font-semibold text-[#425048] hover:text-[#1c442f]"
				>
					Chính sách
				</a>
				<a
					href="/terms-and-policy"
					onClick={(event) => handlePublicLinkClick(event, "/terms-and-policy")}
					className="font-semibold text-[#425048] hover:text-[#1c442f]"
				>
					Điều khoản và Chính sách
				</a>
				<a
					href="/contact"
					onClick={(event) => handlePublicLinkClick(event, "/contact")}
					className="font-semibold text-[#425048] hover:text-[#1c442f]"
				>
					Liên hệ
				</a>
				<a
					href="/support"
					onClick={(event) => handlePublicLinkClick(event, "/support")}
					className="font-semibold text-[#425048] hover:text-[#1c442f]"
				>
					Hỗ trợ
				</a>
			</div>
		</footer>
	);
};
