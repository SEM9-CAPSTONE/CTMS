import type React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "outline" | "ghost";
	size?: "sm" | "md" | "lg";
	children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
	variant = "primary",
	size = "md",
	children,
	className = "",
	...props
}) => {
	const baseStyle =
		"inline-flex items-center justify-center font-medium transition-colors rounded-xl focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

	const variantStyles = {
		primary: "bg-[#2d5a27] text-white hover:bg-[#23471e] active:bg-[#1a3516]",
		secondary: "bg-[#e8f0e6] text-[#2d5a27] hover:bg-[#d8e6d5]",
		outline: "border border-[#2d5a27] text-[#2d5a27] hover:bg-[#e8f0e6]",
		ghost: "text-[#2d5a27] hover:bg-[#e8f0e6]",
	};

	const sizeStyles = {
		sm: "px-3 py-1.5 text-xs",
		md: "px-4 py-2 text-sm",
		lg: "px-6 py-3 text-base",
	};

	return (
		<button
			type="button"
			className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
			{...props}
		>
			{children}
		</button>
	);
};
