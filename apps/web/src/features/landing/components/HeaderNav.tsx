import type React from "react";
import { NAV_ITEMS } from "../constants";

interface HeaderNavProps {
	onNavigateToLogin: () => void;
	onNavigateToRegister: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
	onNavigateToLogin,
	onNavigateToRegister,
}) => {
	return (
		<header className="mb-10 flex flex-wrap items-center justify-between gap-5">
			<div className="flex items-center gap-9">
				<div className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-[#1c442f]">
					<img src="/ctms_logo.png" alt="CTMS Logo" className="h-13 w-auto object-contain" />
					<span>CTMS</span>
				</div>
				<nav className="hidden flex-wrap items-center gap-7 md:flex" aria-label="Điều hướng chính">
					{NAV_ITEMS.map((item) => (
						<a
							key={item.label}
							href={item.href}
							className="text-sm font-semibold text-[#2f4c40] transition hover:text-[#1c442f]"
						>
							{item.label}
						</a>
					))}
				</nav>
			</div>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onNavigateToLogin}
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#1c442f]/20 bg-transparent px-6 py-3 text-sm font-semibold text-[#1c442f] transition hover:-translate-y-0.5 hover:bg-[#1c442f]/5"
				>
					Đăng nhập
				</button>
				<button
					type="button"
					onClick={onNavigateToRegister}
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1c442f] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#143323] hover:shadow-md"
				>
					Đăng ký
				</button>
			</div>
		</header>
	);
};
