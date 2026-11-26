import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SafetySymbol } from "./components/SafetySymbol";
import type { SafetySymbolKind } from "./map-symbols";

export function createSafetySymbol(kind: SafetySymbolKind, color: string, outlined: boolean) {
	const template = document.createElement("template");
	template.innerHTML = renderToStaticMarkup(
		createElement(SafetySymbol, { kind, color, outlined, size: 28 })
	);
	return template.content;
}
