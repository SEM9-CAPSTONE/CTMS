import type React from "react";
import { cn } from "../utils/cn";

export const TYPOGRAPHY = {
	h1: "text-2xl sm:text-3xl font-bold tracking-tight text-[#10221b]",
	h2: "text-xl sm:text-2xl font-bold tracking-tight text-[#10221b]",
	h3: "text-lg sm:text-xl font-semibold text-[#10221b]",
	h4: "text-base font-semibold text-[#10221b]",
	subheading: "text-xs font-semibold uppercase tracking-wider text-[#7b8c82]",
	body: "text-sm text-[#54655a] leading-relaxed",
	bodySm: "text-xs text-[#667a6d]",
	label: "text-xs font-semibold text-[#425048]",
	caption: "text-xs text-[#7b8c82]",
} as const;

export type HeadingLevel = 1 | 2 | 3 | 4;
export type HeadingVariant = "h1" | "h2" | "h3" | "h4" | "subheading";

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
	level?: HeadingLevel;
	variant?: HeadingVariant;
	as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
	children: React.ReactNode;
}

export const Heading: React.FC<HeadingProps> = ({
	level = 2,
	variant,
	as,
	className,
	children,
	...props
}) => {
	const Tag = as ?? (`h${level}` as const);
	const resolvedVariant = variant ?? (`h${level}` as HeadingVariant);
	const variantClass = TYPOGRAPHY[resolvedVariant] ?? TYPOGRAPHY.h2;

	return (
		<Tag className={cn(variantClass, className)} {...props}>
			{children}
		</Tag>
	);
};

export type TextVariant = "body" | "bodySm" | "label" | "caption";

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
	variant?: TextVariant;
	as?: "p" | "span" | "div" | "label";
	children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
	variant = "body",
	as = "p",
	className,
	children,
	...props
}) => {
	const Tag = as;
	const variantClass = TYPOGRAPHY[variant] ?? TYPOGRAPHY.body;

	return (
		<Tag className={cn(variantClass, className)} {...props}>
			{children}
		</Tag>
	);
};
