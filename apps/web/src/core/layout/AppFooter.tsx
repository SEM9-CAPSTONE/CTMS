import type React from "react";

export const AppFooter: React.FC = () => {
	return (
		<footer className="mt-auto border-t border-emerald-950/10 bg-white py-6 text-center text-xs text-gray-500">
			<div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
				<p>
					© {new Date().getFullYear()} CTMS - Camping Site & Trekking Management System. All rights
					reserved.
				</p>
				<div className="flex gap-4">
					<a href="#privacy" className="hover:text-emerald-700">
						Privacy Policy
					</a>
					<a href="#terms" className="hover:text-emerald-700">
						Terms of Service
					</a>
					<a href="#support" className="hover:text-emerald-700">
						Support
					</a>
				</div>
			</div>
		</footer>
	);
};
