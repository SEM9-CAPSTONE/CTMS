import type React from "react";

export interface CardProps {
	children: React.ReactNode;
	className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "" }) => {
	return (
		<div
			className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${className}`}
		>
			{children}
		</div>
	);
};
