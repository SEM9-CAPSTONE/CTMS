/**
 * CTMS Mobile UI Generator — Figma plugin
 * ---------------------------------------------------------------------------
 * SINH 13 FRAME MOBILE (390x844) TRÊN MỘT PAGE MỚI.
 *
 * AN TOÀN: plugin này KHÔNG đọc, KHÔNG sửa, KHÔNG xoá bất kỳ page/frame nào
 * đang có (bao gồm toàn bộ preview web). Nó chỉ gọi figma.createPage() rồi vẽ
 * vào page mới đó. Chạy lại nhiều lần sẽ tạo page mới (v2, v3...), không ghi đè.
 *
 * Nguồn thiết kế: docs/design/CTMS-DESIGN-SYSTEM.md + FIGMA-SCREEN-INVENTORY.md
 */

/* ========================================================================== */
/* 1. TOKENS                                                                  */
/* ========================================================================== */

const T = {
	primary: "#164027",
	secondary: "#2D5A27",
	accent: "#276143",
	light: "#EEF7F0",
	bg: "#F4F7F2",
	dark: "#10221B",
	success: "#16A34A",
	warning: "#D97706",
	danger: "#DC2626",
	info: "#0284C7",
	neutral: "#64748B",
	surface: "#FFFFFF",
	surfaceMuted: "#F8FAF8",
	border: "#E5EAE6",
	borderStrong: "#CBD5E1",
	textPrimary: "#10221B",
	textSecondary: "#4B5563",
	textMuted: "#9CA3AF",
	porter: "#A85F28",
	camper: "#2C6E8E",
};

const TONE = {
	success: T.success,
	warning: T.warning,
	danger: T.danger,
	info: T.info,
	neutral: T.neutral,
	brand: T.primary,
};

const R = { card: 12, control: 10, pill: 999, icon: 10 };
const SCREEN_W = 390;

let FONT = "Inter";
let WEIGHT_STYLE = { 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold" };

/* --- Log: in ra CẢ console lẫn bảng UI của plugin (khỏi cần DevTools) --- */
const LOG_BUFFER = [];
function log(msg, level) {
	console.log("[CTMS] " + msg);
	LOG_BUFFER.push(msg);
	try {
		figma.ui.postMessage({ type: "log", msg, level });
	} catch (e) {
		/* UI chưa mở */
	}
}
const logOk = (m) => log(m, "ok");
const logWarn = (m) => log(m, "warn");
const logErr = (m) => log(m, "err");
const logDim = (m) => log(m, "dim");

log("code.js đã nạp thành công.");

/* ========================================================================== */
/* 2. LOW-LEVEL HELPERS                                                       */
/* ========================================================================== */

function hexToRgb(h) {
	const s = h.replace("#", "");
	return {
		r: parseInt(s.substring(0, 2), 16) / 255,
		g: parseInt(s.substring(2, 4), 16) / 255,
		b: parseInt(s.substring(4, 6), 16) / 255,
	};
}

function solid(h, opacity) {
	return [{ type: "SOLID", color: hexToRgb(h), opacity: opacity === undefined ? 1 : opacity }];
}

function normPad(p) {
	if (p === undefined) return [0, 0, 0, 0];
	if (typeof p === "number") return [p, p, p, p];
	if (p.length === 2) return [p[0], p[1], p[0], p[1]];
	return p;
}

const SHADOW_SM = [
	{
		type: "DROP_SHADOW",
		color: { r: 0.06, g: 0.13, b: 0.11, a: 0.06 },
		offset: { x: 0, y: 1 },
		radius: 3,
		spread: 0,
		visible: true,
		blendMode: "NORMAL",
	},
];
const SHADOW_MD = [
	{
		type: "DROP_SHADOW",
		color: { r: 0.06, g: 0.13, b: 0.11, a: 0.12 },
		offset: { x: 0, y: 8 },
		radius: 20,
		spread: -6,
		visible: true,
		blendMode: "NORMAL",
	},
];

/* ---- Lucide icon paths (subset) ---- */
const ICONS = {
	circle: '<circle cx="12" cy="12" r="9"/>',
	dashboard:
		'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
	map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
	calendar:
		'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
	users:
		'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
	warning:
		'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
	bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
	compass:
		'<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>',
	sparkles:
		'<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
	user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
	search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
	chevronRight: '<path d="m9 18 6-6-6-6"/>',
	chevronLeft: '<path d="m15 18-6-6 6-6"/>',
	chevronDown: '<path d="m6 9 6 6 6-6"/>',
	arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
	plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
	filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
	settings:
		'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
	logout:
		'<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
	wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>',
	phone:
		'<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
	shield:
		'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
	rain: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
	sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
	check: '<path d="M20 6 9 17l-5-5"/>',
	x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	more: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
	pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
	clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
	star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
	heart:
		'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
	send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
	mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
	clip: '<path d="M13.234 20.252 21 12.3"/><path d="m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486"/>',
	camera:
		'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
	download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
	refresh:
		'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
	lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
	mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
	eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
	navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
	flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
	list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
	chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
	checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
	alertCircle:
		'<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
	battery: '<path d="M22 14v-4"/><rect x="2" y="6" width="16" height="12" rx="2"/>',
	signal: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/>',
	backpack:
		'<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 10h8"/><path d="M8 18v-4a4 4 0 0 1 8 0v4"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
	tent: '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>',
	route:
		'<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
	clipboard:
		'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
	siren:
		'<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1 1 1 0 0 0-1-1H6a1 1 0 0 0-1 1"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>',
	layers:
		'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
	grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
};

function makeIcon(name, size, color) {
	const body = ICONS[name] || ICONS.circle;
	const svg =
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
		'stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
		body +
		"</svg>";
	const node = figma.createNodeFromSvg(svg);
	node.name = "icon/" + name;

	// Frame bọc do createNodeFromSvg tạo ra CÓ SẴN fill — nếu tô màu nó thì
	// cả ô 24×24 thành hình vuông đặc. Phải xoá fill của frame bọc.
	node.fills = [];
	node.clipsContent = false;

	// Lucide là icon dạng nét (stroke), không phải khối tô.
	const SHAPES = ["VECTOR", "RECTANGLE", "ELLIPSE", "LINE", "POLYGON", "STAR", "BOOLEAN_OPERATION"];
	const stack = [node];
	while (stack.length) {
		const n = stack.pop();
		if (SHAPES.indexOf(n.type) !== -1) {
			n.fills = [];
			n.strokes = solid(color);
			if (!n.strokeWeight) n.strokeWeight = 2;
			try {
				n.strokeCap = "ROUND";
				n.strokeJoin = "ROUND";
			} catch (e) {
				/* vài loại node không nhận */
			}
		} else if (n !== node && "fills" in n) {
			n.fills = [];
		}
		if ("children" in n) for (const c of n.children) stack.push(c);
	}

	node.rescale((size || 20) / 24);
	return node;
}

/* ========================================================================== */
/* 3. DECLARATIVE BUILDER                                                     */
/* ========================================================================== */

/**
 * QUAN TRỌNG — thứ tự bắt buộc:
 *   1. tạo node rỗng (chưa có con)
 *   2. append vào cha
 *   3. áp layoutSizing (FILL/GROW)  ← cha phải xong FIXED trước
 *   4. mới dựng con
 * Nếu dựng con trước bước 3, con đặt FILL khi cha còn HUG → Figma ném lỗi.
 */
function createBare(spec) {
	if (spec.t === "t") {
		const n = figma.createText();
		// LƯU Ý: với text node, `w` là ĐỘ ĐẬM font (400/500/600/700), không phải bề rộng.
		// Muốn cố định bề rộng thì dùng `tw`.
		const style = WEIGHT_STYLE[spec.w] || WEIGHT_STYLE[400] || "Regular";
		n.fontName = { family: FONT, style };
		n.characters = spec.s === undefined ? "" : String(spec.s);
		n.fontSize = spec.size || 14;
		n.fills = solid(spec.color || T.textPrimary);
		if (spec.lh) n.lineHeight = { value: spec.lh, unit: "PIXELS" };
		if (spec.ls) n.letterSpacing = { value: spec.ls, unit: "PERCENT" };
		if (spec.align) n.textAlignHorizontal = spec.align;
		n.textAutoResize = "HEIGHT";
		if (spec.tw) n.resize(spec.tw, n.height);
		return n;
	}
	if (spec.t === "i") return makeIcon(spec.name, spec.size, spec.color || T.textSecondary);
	if (spec.t === "r") {
		const n = figma.createRectangle();
		n.resize(spec.w || 8, spec.h || 8);
		n.fills = spec.fill ? solid(spec.fill, spec.op) : [];
		if (spec.radius) n.cornerRadius = spec.radius;
		if (spec.stroke) {
			n.strokes = solid(spec.stroke);
			n.strokeWeight = spec.sw || 1;
		}
		return n;
	}
	if (spec.t === "e") {
		const n = figma.createEllipse();
		n.resize(spec.w || 8, spec.h || spec.w || 8);
		n.fills = spec.fill ? solid(spec.fill, spec.op) : [];
		if (spec.stroke) {
			n.strokes = solid(spec.stroke);
			n.strokeWeight = spec.sw || 1;
		}
		return n;
	}

	const n = figma.createFrame();
	n.name = spec.name || "Frame";
	n.clipsContent = spec.clip === undefined ? true : spec.clip;
	n.fills = spec.fill ? solid(spec.fill, spec.op) : [];
	if (spec.radius !== undefined) n.cornerRadius = spec.radius;
	if (spec.stroke) {
		n.strokes = solid(spec.stroke, spec.strokeOp);
		n.strokeWeight = spec.sw || 1;
		n.strokeAlign = "INSIDE";
	}
	if (spec.shadow === "md") n.effects = SHADOW_MD;
	else if (spec.shadow) n.effects = SHADOW_SM;

	if (spec.dir) {
		n.layoutMode = spec.dir === "h" ? "HORIZONTAL" : "VERTICAL";
		n.itemSpacing = spec.gap || 0;
		const p = normPad(spec.pad);
		n.paddingTop = p[0];
		n.paddingRight = p[1];
		n.paddingBottom = p[2];
		n.paddingLeft = p[3];
		const vertical = spec.dir === "v";
		n.primaryAxisSizingMode = (vertical ? spec.h : spec.w) ? "FIXED" : "AUTO";
		n.counterAxisSizingMode = (vertical ? spec.w : spec.h) ? "FIXED" : "AUTO";
		if (spec.align) n.counterAxisAlignItems = spec.align;
		if (spec.justify) n.primaryAxisAlignItems = spec.justify;
	}
	if (spec.w || spec.h) n.resize(spec.w || n.width || 1, spec.h || n.height || 1);
	return n;
}

function applySizing(n, spec, parent) {
	if (!parent || !parent.layoutMode || parent.layoutMode === "NONE") return;
	try {
		if (spec.fw) n.layoutSizingHorizontal = "FILL";
		if (spec.fh) n.layoutSizingVertical = "FILL";
		if (spec.grow) n.layoutGrow = 1;
		if (spec.selfAlign) n.layoutAlign = spec.selfAlign;
	} catch (e) {
		console.warn("applySizing bỏ qua trên", n.name, "→", e.message);
	}
}

function build(spec, parent) {
	const n = createBare(spec);
	if (parent) parent.appendChild(n);
	applySizing(n, spec, parent);

	// layoutWrap chỉ hợp lệ khi trục chính đã FIXED → phải đặt sau applySizing
	if (spec.wrap && n.layoutMode === "HORIZONTAL") {
		try {
			n.layoutWrap = "WRAP";
			if (spec.crossGap !== undefined) n.counterAxisSpacing = spec.crossGap;
		} catch (e) {
			console.warn("layoutWrap bỏ qua trên", n.name, "→", e.message);
		}
	}

	const kids = spec.children || [];
	for (const c of kids) if (c) build(c, n);
	return n;
}

/* shorthands */
const V = (o) => Object.assign({ t: "f", dir: "v" }, o);
const H = (o) => Object.assign({ t: "f", dir: "h" }, o);
const BOX = (o) => Object.assign({ t: "f" }, o);
const TX = (s, o) => Object.assign({ t: "t", s }, o || {});
const IC = (name, size, color) => ({ t: "i", name, size, color });
const DOT = (color, size) => ({ t: "e", w: size || 6, fill: color });
const LINE = (color) => ({ t: "r", h: 1, fw: true, fill: color || T.border });

/* ========================================================================== */
/* 4. COMPONENTS                                                              */
/* ========================================================================== */

function statusBar() {
	return H({
		name: "StatusBar",
		fw: true,
		h: 44,
		pad: [0, 18],
		align: "CENTER",
		justify: "SPACE_BETWEEN",
		fill: T.surface,
		children: [
			TX("9:41", { size: 14, w: 600 }),
			H({
				gap: 6,
				align: "CENTER",
				children: [IC("signal", 14, T.textPrimary), IC("wifi", 14, T.textPrimary), IC("battery", 16, T.textPrimary)],
			}),
		],
	});
}

function appBar(o) {
	const actions = (o.actions || []).map((a) =>
		BOX({
			w: 34,
			h: 34,
			radius: R.pill,
			fill: T.surfaceMuted,
			dir: "v",
			justify: "CENTER",
			align: "CENTER",
			children: [IC(a.icon, 18, a.color || T.textSecondary)],
		}),
	);
	return V({
		name: "AppBar",
		fw: true,
		fill: T.surface,
		pad: [4, 16, 14, 16],
		gap: 2,
		children: [
			H({
				fw: true,
				align: "CENTER",
				justify: "SPACE_BETWEEN",
				gap: 10,
				children: [
					H({
						gap: 10,
						align: "CENTER",
						grow: 1,
						children: [
							o.back
								? BOX({
										w: 34,
										h: 34,
										radius: R.pill,
										fill: T.surfaceMuted,
										dir: "v",
										justify: "CENTER",
										align: "CENTER",
										children: [IC("chevronLeft", 18, T.textPrimary)],
									})
								: null,
							TX(o.title, { size: 22, w: 700, lh: 28, grow: 1 }),
						].filter(Boolean),
					}),
					H({ gap: 8, align: "CENTER", children: actions }),
				],
			}),
			o.subtitle ? TX(o.subtitle, { size: 12, color: T.textSecondary, lh: 17, fw: true }) : null,
		].filter(Boolean),
	});
}

function bottomNav(items, active, accent) {
	const acc = accent || T.primary;
	return V({
		name: "BottomNav",
		fw: true,
		fill: T.surface,
		children: [
			LINE(T.border),
			H({
				fw: true,
				h: 68,
				pad: [10, 4, 0, 4],
				justify: "SPACE_BETWEEN",
				children: items.map((it, i) =>
					V({
						grow: 1,
						gap: 5,
						align: "CENTER",
						children: [
							BOX({
								w: 44,
								h: 26,
								radius: R.pill,
								fill: i === active ? T.light : null,
								dir: "v",
								justify: "CENTER",
								align: "CENTER",
								children: [IC(it.icon, 19, i === active ? acc : T.textMuted)],
							}),
							TX(it.label, {
								size: 10,
								w: i === active ? 600 : 400,
								color: i === active ? acc : T.textMuted,
								align: "CENTER",
							}),
						],
					}),
				),
			}),
			BOX({ fw: true, h: 20, fill: T.surface, dir: "v", justify: "CENTER", align: "CENTER", children: [
				{ t: "r", w: 120, h: 4, radius: R.pill, fill: T.borderStrong },
			] }),
		],
	});
}

function badge(text, tone, variant) {
	const c = TONE[tone] || T.neutral;
	const isSolid = variant === "solid";
	return H({
		name: "Badge",
		radius: R.pill,
		fill: c,
		op: isSolid ? 1 : 0.12,
		pad: [4, 9],
		gap: 5,
		align: "CENTER",
		children: [TX(text, { size: 11, w: 600, color: isSolid ? "#FFFFFF" : c })],
	});
}

function statCard(o) {
	return V({
		name: "StatCard",
		grow: 1,
		fill: T.surface,
		radius: R.card,
		stroke: T.border,
		pad: 12,
		gap: 6,
		shadow: true,
		children: [
			TX(o.label, { size: 10, w: 600, color: T.textMuted, ls: 4 }),
			H({
				fw: true,
				align: "CENTER",
				justify: "SPACE_BETWEEN",
				children: [
					TX(o.value, { size: 26, w: 700, color: o.color || T.textPrimary, lh: 30 }),
					o.icon ? IC(o.icon, 16, o.color || T.textMuted) : null,
				].filter(Boolean),
			}),
			o.sub ? TX(o.sub, { size: 10, color: T.textMuted }) : null,
		].filter(Boolean),
	});
}

function statGrid(items) {
	const rows = [];
	for (let i = 0; i < items.length; i += 2) {
		rows.push(H({ fw: true, gap: 10, children: items.slice(i, i + 2).map(statCard) }));
	}
	return V({ name: "StatGrid", fw: true, gap: 10, children: rows });
}

function card(o) {
	return V({
		name: o.name || "Card",
		fw: true,
		fill: o.fill || T.surface,
		radius: R.card,
		stroke: o.stroke === null ? null : o.stroke || T.border,
		pad: o.pad === undefined ? 14 : o.pad,
		gap: o.gap === undefined ? 12 : o.gap,
		shadow: o.shadow === undefined ? true : o.shadow,
		children: [
			o.title
				? H({
						fw: true,
						align: "CENTER",
						justify: "SPACE_BETWEEN",
						children: [
							H({
								gap: 8,
								align: "CENTER",
								children: [o.icon ? IC(o.icon, 16, T.primary) : null, TX(o.title, { size: 15, w: 600 })].filter(
									Boolean,
								),
							}),
							o.action ? TX(o.action, { size: 12, w: 600, color: T.accent }) : null,
						].filter(Boolean),
					})
				: null,
		]
			.filter(Boolean)
			.concat(o.children || []),
	});
}

function btn(text, o) {
	o = o || {};
	const variant = o.variant || "primary";
	const map = {
		primary: { bg: T.primary, fg: "#FFFFFF", stroke: null },
		secondary: { bg: T.surface, fg: T.textPrimary, stroke: T.borderStrong },
		ghost: { bg: null, fg: T.accent, stroke: null },
		danger: { bg: T.danger, fg: "#FFFFFF", stroke: null },
		dangerSoft: { bg: T.danger, fg: T.danger, stroke: null, op: 0.1 },
		light: { bg: "#FFFFFF", fg: T.primary, stroke: null },
	};
	const s = map[variant];
	return H({
		name: "Button/" + variant,
		fw: o.fw,
		grow: o.grow,
		w: o.w,
		h: o.h || 44,
		radius: o.radius || R.control,
		fill: s.bg,
		op: s.op,
		stroke: s.stroke,
		pad: [0, 16],
		gap: 8,
		align: "CENTER",
		justify: "CENTER",
		children: [
			o.icon ? IC(o.icon, 16, s.fg) : null,
			TX(text, { size: 14, w: 600, color: s.fg }),
			o.trailIcon ? IC(o.trailIcon, 16, s.fg) : null,
		].filter(Boolean),
	});
}

function field(o) {
	return V({
		fw: true,
		gap: 6,
		children: [
			o.label ? TX(o.label, { size: 12, w: 500, color: T.textSecondary }) : null,
			H({
				fw: true,
				h: 46,
				radius: R.control,
				fill: T.surface,
				stroke: T.border,
				pad: [0, 12],
				gap: 9,
				align: "CENTER",
				children: [
					o.icon ? IC(o.icon, 17, T.textMuted) : null,
					TX(o.value || o.placeholder, {
						size: 14,
						color: o.value ? T.textPrimary : T.textMuted,
						grow: 1,
					}),
					o.trailIcon ? IC(o.trailIcon, 17, T.textMuted) : null,
				].filter(Boolean),
			}),
		].filter(Boolean),
	});
}

function chipRow(items, active, accent) {
	const acc = accent || T.primary;
	return H({
		name: "ChipRow",
		fw: true,
		gap: 8,
		clip: true,
		children: items.map((label, i) =>
			H({
				radius: R.pill,
				fill: i === active ? acc : T.surface,
				stroke: i === active ? null : T.border,
				pad: [7, 12],
				align: "CENTER",
				children: [TX(label, { size: 12, w: i === active ? 600 : 400, color: i === active ? "#FFFFFF" : T.textSecondary })],
			}),
		),
	});
}

function alertBanner(o) {
	const c = TONE[o.sev] || T.warning;
	const emergency = o.variant === "emergency";
	return H({
		name: "AlertBanner",
		fw: true,
		radius: R.card,
		fill: emergency ? c : c,
		op: emergency ? 1 : 0.09,
		gap: 0,
		children: [
			{ t: "r", w: 4, fh: true, fill: emergency ? "#FFFFFF" : c },
			V({
				grow: 1,
				pad: 12,
				gap: 8,
				children: [
					H({
						fw: true,
						gap: 9,
						align: "MIN",
						children: [
							IC(o.icon || "warning", 18, emergency ? "#FFFFFF" : c),
							V({
								grow: 1,
								gap: 3,
								children: [
									H({
										fw: true,
										gap: 6,
										align: "CENTER",
										justify: "SPACE_BETWEEN",
										children: [
											TX(o.title, { size: 13, w: 700, color: emergency ? "#FFFFFF" : c, grow: 1 }),
											o.time ? TX(o.time, { size: 10, color: emergency ? "#FFFFFF" : T.textMuted }) : null,
										].filter(Boolean),
									}),
									TX(o.msg, { size: 12, lh: 17, color: emergency ? "#FFFFFF" : T.textSecondary, fw: true }),
								],
							}),
						],
					}),
					o.actions
						? H({
								fw: true,
								gap: 8,
								children: o.actions.map((a) =>
									btn(a.text, { variant: a.variant || (emergency ? "light" : "primary"), h: 34, grow: 1 }),
								),
							})
						: null,
				].filter(Boolean),
			}),
		],
	});
}

function progress(pct, color) {
	return BOX({
		fw: true,
		h: 6,
		radius: R.pill,
		fill: T.border,
		dir: "h",
		children: [{ t: "r", w: Math.max(4, Math.round((SCREEN_W - 60) * pct)), h: 6, radius: R.pill, fill: color || T.primary }],
	});
}

function avatar(size, color, initials) {
	return BOX({
		w: size,
		h: size,
		radius: R.pill,
		fill: color,
		op: 0.16,
		dir: "v",
		justify: "CENTER",
		align: "CENTER",
		children: [TX(initials, { size: Math.round(size * 0.36), w: 700, color })],
	});
}

function kv(label, value, valueColor) {
	return V({
		grow: 1,
		gap: 3,
		children: [
			TX(label, { size: 10, w: 600, color: T.textMuted, ls: 4 }),
			TX(value, { size: 13, w: 600, color: valueColor || T.textPrimary, lh: 18, fw: true }),
		],
	});
}

function checkItem(label, done) {
	return H({
		fw: true,
		gap: 9,
		align: "CENTER",
		children: [
			done
				? BOX({
						w: 17,
						h: 17,
						radius: 5,
						fill: T.success,
						dir: "v",
						justify: "CENTER",
						align: "CENTER",
						children: [IC("check", 11, "#FFFFFF")],
					})
				: BOX({ w: 17, h: 17, radius: 5, fill: null, stroke: T.borderStrong }),
			TX(label, { size: 12.5, color: done ? T.textPrimary : T.textSecondary, grow: 1 }),
		],
	});
}

function mapPlaceholder(h, label) {
	return BOX({
		name: "MapPanel",
		fw: true,
		h: h || 200,
		radius: R.card,
		fill: "#DCE9DE",
		dir: "v",
		justify: "CENTER",
		align: "CENTER",
		gap: 8,
		children: [
			IC("map", 30, T.primary),
			TX(label || "Bản đồ Leaflet", { size: 12, w: 600, color: T.primary }),
		],
	});
}

function imagePlaceholder(h, label, tint) {
	return BOX({
		fw: true,
		h: h,
		radius: R.card,
		fill: tint || "#CBD9CE",
		dir: "v",
		justify: "CENTER",
		align: "CENTER",
		children: [TX(label, { size: 11, w: 600, color: T.primary })],
	});
}

function listRowCard(o) {
	return V({
		fw: true,
		fill: T.surface,
		radius: R.card,
		stroke: T.border,
		pad: 12,
		gap: 8,
		shadow: true,
		children: [
			H({
				fw: true,
				align: "CENTER",
				justify: "SPACE_BETWEEN",
				gap: 8,
				children: [TX(o.code, { size: 12, w: 700, color: T.primary }), badge(o.status, o.tone, o.solid ? "solid" : null)],
			}),
			TX(o.title, { size: 14.5, w: 600, lh: 20, fw: true }),
			o.meta ? H({ fw: true, gap: 14, children: o.meta.map((m) => kv(m[0], m[1], m[2])) }) : null,
			o.note
				? H({
						fw: true,
						gap: 6,
						align: "CENTER",
						children: [IC(o.noteIcon || "alertCircle", 13, o.noteColor || T.warning), TX(o.note, { size: 11.5, color: o.noteColor || T.warning, grow: 1 })],
					})
				: null,
		].filter(Boolean),
	});
}

function body(children, pad) {
	return V({
		name: "Body",
		fw: true,
		grow: 1,
		fill: T.bg,
		pad: pad === undefined ? [14, 16, 20, 16] : pad,
		gap: 14,
		children,
	});
}

function screen(name, children, h) {
	return V({
		name,
		w: SCREEN_W,
		h: h || 844,
		fill: T.bg,
		gap: 0,
		clip: true,
		children,
	});
}

/* ========================================================================== */
/* 4b. COMPONENTS RIÊNG CHO AUTH                                              */
/* ========================================================================== */

/** Text field kiểu M3 outlined: nhãn nằm trên, ô cao 52, không icon trang trí. */
function authField(o) {
	return V({
		name: "Field/" + (o.label || o.placeholder || ""),
		fw: true,
		gap: 7,
		children: [
			o.label
				? H({
						fw: true,
						gap: 5,
						align: "CENTER",
						children: [
							TX(o.label, { size: 13, w: 500, color: T.textSecondary }),
							o.optional ? TX("(không bắt buộc)", { size: 11.5, color: T.textMuted }) : null,
						].filter(Boolean),
					})
				: null,
			H({
				fw: true,
				h: o.h || 52,
				radius: o.radius || R.control,
				fill: T.surface,
				stroke: o.focus ? T.primary : T.border,
				sw: o.focus ? 1.5 : 1,
				pad: [0, 14],
				gap: 11,
				align: "CENTER",
				children: [
					o.icon ? IC(o.icon, 19, T.textMuted) : null,
					TX(o.value || o.placeholder, {
						size: 14.5,
						color: o.value ? T.textPrimary : T.textMuted,
						grow: 1,
					}),
					o.trail ? TX(o.trail, { size: 13, w: 600, color: T.accent }) : null,
					o.trailIcon ? IC(o.trailIcon, 19, T.textMuted) : null,
					o.select ? IC("chevronDown", 18, T.textSecondary) : null,
				].filter(Boolean),
			}),
			o.helper ? TX(o.helper, { size: 11.5, color: o.helperColor || T.textMuted, lh: 16, fw: true }) : null,
		].filter(Boolean),
	});
}

/** Thanh tiến trình 5 bước, kiểu chấm nối — gọn cho mobile. */
function stepper(current, total) {
	const items = [];
	for (let i = 1; i <= total; i++) {
		const done = i < current;
		const active = i === current;
		items.push(
			BOX({
				w: 26,
				h: 26,
				radius: R.pill,
				fill: active ? T.primary : done ? T.primary : T.border,
				op: done ? 0.16 : 1,
				dir: "v",
				justify: "CENTER",
				align: "CENTER",
				children: [
					done
						? IC("check", 13, T.primary)
						: TX(String(i), { size: 12, w: 700, color: active ? "#FFFFFF" : T.textMuted }),
				],
			}),
		);
		if (i < total) items.push({ t: "r", h: 2, grow: 1, radius: R.pill, fill: i < current ? T.primary : T.border });
	}
	return H({ name: "Stepper", fw: true, gap: 6, align: "CENTER", children: items });
}

/** Khung màn đăng ký: header trắng (back + stepper) → body → thanh nút dính đáy. */
function stepScreen(o) {
	return screen(
		o.name,
		[
			statusBar(),
			V({
				name: "Header",
				fw: true,
				fill: T.surface,
				pad: [4, 20, 18, 20],
				gap: 18,
				children: [
					H({
						fw: true,
						gap: 12,
						align: "CENTER",
						children: [
							BOX({
								w: 36,
								h: 36,
								radius: R.pill,
								fill: T.surfaceMuted,
								dir: "v",
								justify: "CENTER",
								align: "CENTER",
								children: [IC("chevronLeft", 18, T.textPrimary)],
							}),
							TX("Đăng ký tài khoản", { size: 15, w: 600, grow: 1 }),
							TX("Bước " + o.step + "/5", { size: 12.5, w: 600, color: T.textMuted }),
						],
					}),
					stepper(o.step, 5),
				],
			}),
			V({
				name: "Body",
				fw: true,
				grow: 1,
				fill: T.bg,
				pad: [22, 20, 24, 20],
				gap: 22,
				children: [
					V({
						fw: true,
						gap: 7,
						children: [
							TX(o.title, { size: 22, w: 700, lh: 29, fw: true }),
							o.subtitle ? TX(o.subtitle, { size: 13.5, color: T.textSecondary, lh: 20, fw: true }) : null,
						].filter(Boolean),
					}),
				].concat(o.children),
			}),
			V({
				name: "ActionBar",
				fw: true,
				fill: T.surface,
				gap: 0,
				children: [
					LINE(T.border),
					H({
						fw: true,
						pad: [14, 20, 22, 20],
						gap: 12,
						children: [
							o.back === false ? null : btn("Quay lại", { variant: "secondary", w: 112, h: 52 }),
							btn(o.primary, { grow: 1, fw: o.back === false, h: 52 }),
						].filter(Boolean),
					}),
				],
			}),
		],
		o.h,
	);
}

/** Dòng "nhãn — giá trị" cho màn xác nhận. */
function summaryRow(label, value, verified) {
	return H({
		fw: true,
		gap: 14,
		align: "MIN",
		children: [
			TX(label, { size: 13, color: T.textSecondary, tw: 128 }),
			V({
				grow: 1,
				gap: 6,
				children: [
					TX(value, { size: 13.5, w: 600, lh: 19, fw: true }),
					verified ? badge("Đã xác thực", "success") : null,
				].filter(Boolean),
			}),
		],
	});
}

function summarySection(title, rows) {
	return V({
		name: "Summary/" + title,
		fw: true,
		fill: T.surface,
		radius: R.card,
		stroke: T.border,
		pad: 16,
		gap: 14,
		shadow: true,
		children: [
			H({
				fw: true,
				align: "CENTER",
				justify: "SPACE_BETWEEN",
				children: [
					TX(title, { size: 11.5, w: 700, color: T.primary, ls: 5 }),
					TX("Sửa", { size: 12.5, w: 600, color: T.accent }),
				],
			}),
			LINE(T.border),
		].concat(rows),
	});
}

/** Chip chọn nhiều — dùng cho "Địa điểm có thể dẫn đoàn". */
function pickChip(label, selected) {
	return H({
		radius: R.pill,
		fill: selected ? T.light : T.surface,
		stroke: selected ? T.primary : T.border,
		pad: [9, 13],
		gap: 7,
		align: "CENTER",
		children: [
			selected ? IC("check", 13, T.primary) : null,
			TX(label, { size: 12.5, w: selected ? 600 : 400, color: selected ? T.primary : T.textSecondary }),
		].filter(Boolean),
	});
}

function confirmCheck(text, checked) {
	return H({
		fw: true,
		radius: R.card,
		fill: T.light,
		pad: 15,
		gap: 12,
		align: "MIN",
		children: [
			BOX({
				w: 20,
				h: 20,
				radius: 5,
				fill: checked ? T.primary : null,
				stroke: checked ? null : T.borderStrong,
				dir: "v",
				justify: "CENTER",
				align: "CENTER",
				children: checked ? [IC("check", 13, "#FFFFFF")] : [],
			}),
			TX(text, { size: 13, lh: 19, grow: 1, fw: true }),
		],
	});
}

function emptyBox(text) {
	return V({
		fw: true,
		radius: R.card,
		fill: T.surfaceMuted,
		stroke: T.border,
		pad: [22, 18],
		align: "CENTER",
		children: [TX(text, { size: 12.5, color: T.textSecondary, align: "CENTER", lh: 19, fw: true })],
	});
}

function fieldLabel(text, hint) {
	return V({
		fw: true,
		gap: 4,
		children: [
			TX(text, { size: 13, w: 500, color: T.textSecondary }),
			hint ? TX(hint, { size: 11.5, color: T.textMuted, lh: 16, fw: true }) : null,
		].filter(Boolean),
	});
}

/* ========================================================================== */
/* 5. NAV DEFINITIONS                                                         */
/* ========================================================================== */

const CAMPER_NAV = [
	{ icon: "dashboard", label: "Tổng quan" },
	{ icon: "compass", label: "Khám phá" },
	{ icon: "backpack", label: "Chuyến đi" },
	{ icon: "sparkles", label: "Trợ lý AI" },
	{ icon: "user", label: "Hồ sơ" },
];

const PORTER_NAV = [
	{ icon: "dashboard", label: "Tổng quan" },
	{ icon: "calendar", label: "Lịch" },
	{ icon: "map", label: "Bản đồ" },
	{ icon: "bell", label: "Cảnh báo" },
	{ icon: "grid", label: "Thêm" },
];

/* ========================================================================== */
/* 6. SCREENS                                                                 */
/* ========================================================================== */

/* --- 01. Đăng nhập --- */
/* Hero branding 258px ≈ 29% chiều cao khung. Spacing dùng spacer rời thay vì gap
   đồng đều, để tạo phân cấp: Hero ↓ Form ↓ Input ↓ Button ↓ Social ↓ Footer. */
function scLogin() {
	const chip = (label) =>
		H({
			name: "Chip/" + label,
			radius: R.pill,
			fill: "#FFFFFF",
			op: 0.13,
			stroke: "#FFFFFF",
			strokeOp: 0.3,
			pad: [9, 14],
			align: "CENTER",
			children: [TX(label, { size: 12.5, w: 600, color: "#FFFFFF" })],
		});

	const socialBtn = (leading, label) =>
		H({
			name: "Social/" + label,
			grow: 1,
			h: 52,
			radius: 14,
			fill: T.surface,
			stroke: T.borderStrong,
			gap: 10,
			align: "CENTER",
			justify: "CENTER",
			children: [leading, TX(label, { size: 14, w: 600 })],
		});

	return screen(
		"01 · Đăng nhập",
		[
			statusBar(),
			V({
				name: "Hero",
				fw: true,
				h: 258,
				fill: T.primary,
				justify: "MAX",
				pad: [0, 24, 26, 24],
				gap: 14,
				children: [
					H({
						gap: 11,
						align: "CENTER",
						children: [
							BOX({
								w: 40,
								h: 40,
								radius: 12,
								fill: "#FFFFFF",
								dir: "v",
								justify: "CENTER",
								align: "CENTER",
								children: [IC("tent", 22, T.primary)],
							}),
							TX("CTMS", { size: 24, w: 700, color: "#FFFFFF", ls: 4 }),
						],
					}),
					TX("Sẵn sàng cho chuyến đi tiếp theo", { size: 25, w: 700, color: "#FFFFFF", lh: 33, fw: true }),
					H({
						fw: true,
						gap: 9,
						wrap: true,
						crossGap: 9,
						children: [
							chip("Bản đồ ngoại tuyến"),
							chip("Cảnh báo thời tiết"),
							chip("Trợ lý AI"),
							chip("Theo dõi GPS"),
						],
					}),
					H({
						gap: 8,
						align: "CENTER",
						children: [
							IC("shield", 15, "#A8C8B4"),
							TX("Quản lý hành trình an toàn & thông minh", { size: 12.5, color: "#A8C8B4" }),
						],
					}),
				],
			}),
			V({
				name: "Form",
				fw: true,
				grow: 1,
				fill: T.surface,
				pad: [30, 24, 26, 24],
				gap: 0,
				children: [
					V({
						fw: true,
						gap: 7,
						children: [
							TX("Chào mừng trở lại!", { size: 27, w: 700, lh: 35, fw: true }),
							TX("Đăng nhập để tiếp tục khám phá.", { size: 14, color: T.textSecondary, fw: true }),
						],
					}),
					BOX({ fw: true, h: 26 }),
					V({
						fw: true,
						gap: 14,
						children: [
							authField({ placeholder: "Email hoặc Số điện thoại", icon: "user", h: 56, radius: 14 }),
							authField({ placeholder: "Mật khẩu", icon: "lock", trailIcon: "eye", h: 56, radius: 14 }),
						],
					}),
					BOX({ fw: true, h: 18 }),
					H({
						fw: true,
						align: "CENTER",
						justify: "SPACE_BETWEEN",
						children: [
							H({
								gap: 10,
								align: "CENTER",
								children: [
									BOX({ w: 20, h: 20, radius: 6, fill: null, stroke: T.borderStrong, sw: 1.5 }),
									TX("Ghi nhớ", { size: 13.5, color: T.textSecondary }),
								],
							}),
							TX("Quên mật khẩu?", { size: 13.5, w: 600, color: T.accent }),
						],
					}),
					BOX({ fw: true, h: 24 }),
					btn("Đăng nhập", { fw: true, h: 54, radius: 14, trailIcon: "arrowRight" }),
					BOX({ fw: true, h: 12 }),
					btn("Đăng ký tài khoản mới", { fw: true, h: 52, radius: 14, variant: "secondary" }),
					BOX({ fw: true, h: 24 }),
					H({
						fw: true,
						gap: 12,
						align: "CENTER",
						children: [LINE(T.border), TX("Hoặc đăng nhập bằng", { size: 12, color: T.textMuted }), LINE(T.border)],
					}),
					BOX({ fw: true, h: 18 }),
					H({
						fw: true,
						gap: 12,
						children: [
							socialBtn(TX("G", { size: 15, w: 700, color: T.textPrimary }), "Google"),
							socialBtn(IC("chat", 17, T.textSecondary), "Lark"),
						],
					}),
					BOX({ fw: true, grow: 1 }),
					H({
						fw: true,
						gap: 6,
						justify: "CENTER",
						align: "CENTER",
						children: [
							TX("Bạn chưa có tài khoản?", { size: 13.5, color: T.textSecondary }),
							TX("Đăng ký ngay", { size: 13.5, w: 700, color: T.primary }),
						],
					}),
				],
			}),
		],
		900,
	);
}

/* --- 02. Bước 1 · Chọn vai trò --- */
function scRegStep1() {
	const roleCard = (o) =>
		V({
			name: "RoleCard/" + o.name,
			fw: true,
			fill: T.surface,
			radius: R.card,
			stroke: o.selected ? T.primary : T.border,
			sw: o.selected ? 1.5 : 1,
			pad: 16,
			gap: 8,
			shadow: o.selected,
			children: [
				H({
					fw: true,
					gap: 12,
					align: "CENTER",
					children: [
						V({
							grow: 1,
							gap: 3,
							children: [TX(o.name, { size: 16, w: 700, color: o.selected ? T.primary : T.textPrimary })],
						}),
						BOX({
							w: 22,
							h: 22,
							radius: R.pill,
							fill: o.selected ? T.primary : null,
							stroke: o.selected ? null : T.borderStrong,
							dir: "v",
							justify: "CENTER",
							align: "CENTER",
							children: o.selected ? [IC("check", 13, "#FFFFFF")] : [],
						}),
					],
				}),
				TX(o.desc, { size: 13, color: T.textSecondary, lh: 19, fw: true }),
				o.tag ? badge(o.tag, o.tagTone) : null,
			].filter(Boolean),
		});

	return stepScreen({
		name: "02 · Bước 1 · Chọn vai trò",
		step: 1,
		back: false,
		primary: "Tiếp tục",
		title: "Bạn tham gia CTMS với vai trò nào?",
		subtitle: "Vai trò quyết định các chức năng bạn sử dụng trong ứng dụng.",
		children: [
			V({
				fw: true,
				gap: 12,
				children: [
					roleCard({
						name: "Trekker",
						desc: "Tham gia các chuyến cắm trại và trekking do Host tổ chức.",
					}),
					roleCard({
						name: "Porter",
						selected: true,
						desc: "Người dẫn đường chuyên nghiệp, đồng hành cùng đoàn trên các cung trekking.",
						tag: "Cần Host xét duyệt hồ sơ",
						tagTone: "warning",
					}),
				],
			}),
			TX("Bạn có thể chuyển đổi giữa Trekker và Porter bất cứ lúc nào trong Hồ sơ cá nhân.", {
				size: 12.5,
				color: T.textSecondary,
				lh: 18,
				fw: true,
			}),
			// Host quản lý trên bản web (xem apps/mobile/lib/core/router/app_router.dart)
			H({
				fw: true,
				radius: R.control,
				fill: T.surfaceMuted,
				stroke: T.border,
				pad: [13, 14],
				gap: 10,
				align: "MIN",
				children: [
					IC("alertCircle", 16, T.textSecondary),
					TX("Bạn muốn trở thành Host? Tài khoản Host được đăng ký và quản lý trên phiên bản web của CTMS.", {
						size: 12.5,
						color: T.textSecondary,
						lh: 18,
						grow: 1,
					}),
				],
			}),
		],
	});
}

/* --- 03. Bước 2 · Thông tin tài khoản --- */
function scRegStep2() {
	return stepScreen({
		name: "03 · Bước 2 · Thông tin tài khoản",
		step: 2,
		primary: "Tiếp tục",
		title: "Thông tin tài khoản",
		subtitle: "Email này sẽ dùng để đăng nhập và nhận thông báo xét duyệt.",
		children: [
			V({
				fw: true,
				gap: 20,
				children: [
					authField({ label: "Email", value: "hoangnghia.porter@email.com" }),
					authField({
						label: "Mật khẩu",
						value: "••••••••••",
						trailIcon: "eye",
						helper: "Tối thiểu 8 ký tự, gồm cả chữ và số.",
					}),
					authField({ label: "Xác nhận mật khẩu", value: "••••••••••", trailIcon: "eye" }),
				],
			}),
		],
	});
}

/* --- 04. Bước 3 · Thông tin cá nhân & xác thực --- */
function scRegStep3() {
	return stepScreen({
		name: "04 · Bước 3 · Thông tin cá nhân & xác thực",
		step: 3,
		primary: "Tiếp tục",
		title: "Thông tin cá nhân & xác thực",
		subtitle: "Hoàn thiện thông tin để Host có thể xét duyệt hồ sơ của bạn.",
		children: [
			V({
				fw: true,
				gap: 20,
				children: [
					authField({ label: "Họ và tên", value: "Trần Hữu Nghĩa" }),
					H({
						fw: true,
						gap: 12,
						children: [
							V({ grow: 1, children: [authField({ label: "Ngày sinh", value: "12/03/1994", select: true })] }),
							V({ grow: 1, children: [authField({ label: "Giới tính", value: "Nam", select: true })] }),
						],
					}),
					authField({ label: "Số điện thoại", value: "0905 123 456", trail: "Gửi mã OTP" }),
					H({
						fw: true,
						radius: R.control,
						fill: T.success,
						op: 0.1,
						pad: [11, 14],
						gap: 9,
						align: "CENTER",
						children: [
							IC("checkCircle", 17, T.success),
							TX("Đã xác thực số điện thoại", { size: 13, w: 600, color: T.success, grow: 1 }),
						],
					}),
				],
			}),
		],
	});
}

/* --- 05. Bước 4 · Kinh nghiệm & phạm vi hỗ trợ --- */
function scRegStep4() {
	return stepScreen({
		name: "05 · Bước 4 · Kinh nghiệm & phạm vi hỗ trợ",
		step: 4,
		h: 940,
		primary: "Tiếp tục",
		title: "Kinh nghiệm & phạm vi hỗ trợ",
		subtitle: "Giúp Host hiểu rõ khu vực bạn có thể dẫn đoàn.",
		children: [
			V({
				fw: true,
				gap: 20,
				children: [
					authField({ label: "Số năm kinh nghiệm", value: "4 năm", select: true }),
					authField({ label: "Quận/Huyện mong muốn công tác", value: "Huyện Hòa Vang, Đà Nẵng", select: true }),
					V({
						fw: true,
						gap: 10,
						children: [
							fieldLabel("Địa điểm có thể dẫn đoàn", "Chọn một hoặc nhiều địa điểm do Host quản lý trong khu vực."),
							H({
								fw: true,
								gap: 8,
								wrap: true,
								crossGap: 8,
								children: [
									pickChip("Bán đảo Sơn Trà", true),
									pickChip("Hồ Hòa Trung", true),
									pickChip("Núi Bà Nà", false),
									pickChip("Suối Lương", false),
									pickChip("Đỉnh Bàn Cờ", true),
									pickChip("Khe Răm", false),
								],
							}),
							TX("Đã chọn 3 địa điểm", { size: 11.5, w: 600, color: T.accent }),
						],
					}),
					authField({
						label: "Chứng chỉ chuyên môn",
						optional: true,
						placeholder: "Ví dụ: Chứng chỉ hướng dẫn viên, sơ cứu...",
					}),
				],
			}),
		],
	});
}

/* --- 05b. Bước 4 · Trạng thái rỗng (biến thể, không phải bước mới) --- */
function scRegStep4Empty() {
	return stepScreen({
		name: "05b · Bước 4 · Trạng thái rỗng",
		step: 4,
		primary: "Tiếp tục",
		title: "Kinh nghiệm & phạm vi hỗ trợ",
		subtitle: "Giúp Host hiểu rõ khu vực bạn có thể dẫn đoàn.",
		children: [
			V({
				fw: true,
				gap: 20,
				children: [
					authField({ label: "Số năm kinh nghiệm", value: "4 năm", select: true }),
					authField({ label: "Quận/Huyện mong muốn công tác", value: "Huyện Nam Trà My, Quảng Nam", select: true }),
					V({
						fw: true,
						gap: 10,
						children: [
							fieldLabel("Địa điểm có thể dẫn đoàn"),
							emptyBox("Hiện chưa có địa điểm do Host quản lý tại khu vực này."),
						],
					}),
					authField({
						label: "Chứng chỉ chuyên môn",
						optional: true,
						placeholder: "Ví dụ: Chứng chỉ hướng dẫn viên, sơ cứu...",
					}),
				],
			}),
		],
	});
}

/* --- 06. Bước 5 · Xác nhận đăng ký --- */
function scRegStep5() {
	return stepScreen({
		name: "06 · Bước 5 · Xác nhận đăng ký",
		step: 5,
		h: 1080,
		primary: "Gửi hồ sơ",
		title: "Xác nhận đăng ký",
		subtitle: "Kiểm tra lại thông tin trước khi gửi hồ sơ cho Host.",
		children: [
			summarySection("THÔNG TIN TÀI KHOẢN", [
				summaryRow("Email", "hoangnghia.porter@email.com"),
				summaryRow("Số điện thoại", "0905 123 456", true),
			]),
			summarySection("THÔNG TIN CÁ NHÂN", [
				summaryRow("Họ và tên", "Trần Hữu Nghĩa"),
				summaryRow("Ngày sinh", "12/03/1994"),
				summaryRow("Giới tính", "Nam"),
			]),
			summarySection("THÔNG TIN NGHIỆP VỤ", [
				summaryRow("Kinh nghiệm", "4 năm"),
				summaryRow("Quận/Huyện công tác", "Huyện Hòa Vang, Đà Nẵng"),
				summaryRow("Địa điểm dẫn đoàn", "Bán đảo Sơn Trà, Hồ Hòa Trung, Đỉnh Bàn Cờ"),
				summaryRow("Chứng chỉ", "Chứng chỉ sơ cứu cơ bản"),
			]),
			confirmCheck("Tôi xác nhận các thông tin trên là chính xác.", true),
		],
	});
}

/* --- 07. Hồ sơ đã được gửi --- */
function scRegSuccess() {
	return screen("07 · Hồ sơ đã được gửi", [
		statusBar(),
		V({
			name: "Body",
			fw: true,
			grow: 1,
			fill: T.surface,
			pad: [0, 28, 28, 28],
			gap: 0,
			justify: "CENTER",
			align: "CENTER",
			children: [
				BOX({
					w: 76,
					h: 76,
					radius: R.pill,
					fill: T.success,
					op: 0.12,
					dir: "v",
					justify: "CENTER",
					align: "CENTER",
					children: [IC("check", 34, T.success)],
				}),
				BOX({ fw: true, h: 26 }),
				TX("Hồ sơ đã được gửi", { size: 25, w: 700, align: "CENTER", lh: 33, fw: true }),
				BOX({ fw: true, h: 12 }),
				TX(
					"Hồ sơ Porter của bạn đã được gửi đến Host để xét duyệt. Bạn sẽ nhận được thông báo sau khi Host xem xét hồ sơ.",
					{ size: 14, color: T.textSecondary, align: "CENTER", lh: 21, fw: true },
				),
				BOX({ fw: true, h: 24 }),
				H({
					fw: true,
					radius: R.control,
					fill: T.surfaceMuted,
					pad: [12, 16],
					gap: 9,
					align: "CENTER",
					justify: "CENTER",
					children: [
						IC("clock", 16, T.textSecondary),
						TX("Thời gian xét duyệt thường trong 1–3 ngày làm việc.", {
							size: 12.5,
							color: T.textSecondary,
							lh: 18,
							fw: true,
						}),
					],
				}),
			],
		}),
		V({
			fw: true,
			fill: T.surface,
			gap: 0,
			children: [LINE(T.border), H({ fw: true, pad: [14, 24, 24, 24], children: [btn("Về Trang chủ", { fw: true, h: 52 })] })],
		}),
	]);
}

/* --- 03. Camper · Tổng quan --- */
function scCamperHome() {
	return screen("03 · Camper · Tổng quan", [
		statusBar(),
		appBar({
			title: "Chào buổi sáng, Minh!",
			subtitle: "Thứ Sáu, 24/07/2026",
			actions: [{ icon: "bell" }, { icon: "settings" }],
		}),
		body([
			BOX({
				fw: true,
				h: 150,
				radius: R.card,
				fill: "#3F6B52",
				dir: "v",
				justify: "MAX",
				pad: 14,
				gap: 10,
				children: [
					TX("Khám phá những cung đường mới cùng CTMS", { size: 16, w: 700, color: "#FFFFFF", lh: 22, fw: true }),
					H({
						fw: true,
						gap: 8,
						children: [btn("Khám phá địa điểm", { variant: "light", h: 36, grow: 1 }), btn("Xem chuyến đi", { variant: "secondary", h: 36, grow: 1 })],
					}),
				],
			}),
			card({
				title: "Chuyến đi sắp tới",
				action: "Đã xác nhận",
				children: [
					TX("Trekking Sơn Trà – Bãi Bắc", { size: 16, w: 700, fw: true }),
					TX("27/09/2026 · 03 ngày 02 đêm", { size: 12, color: T.textSecondary, fw: true }),
					H({ fw: true, gap: 10, children: [kv("THÀNH VIÊN", "06 người"), kv("ĐỘ KHÓ", "Trung bình", T.warning)] }),
					H({ fw: true, gap: 10, children: [kv("PORTER PHỤ TRÁCH", "Hữu Nghĩa"), kv("RỦI RO THỜI TIẾT", "An toàn", T.success)] }),
					btn("Xem chi tiết chuyến đi", { fw: true, h: 40 }),
				],
			}),
			card({
				title: "Chuẩn bị trước chuyến đi",
				action: "68%",
				children: [
					progress(0.68),
					checkItem("Thông tin thành viên", true),
					checkItem("Danh sách vật dụng", true),
					checkItem("Thiết bị thuê", true),
					checkItem("Dữ liệu bản đồ ngoại tuyến", false),
					checkItem("Xác nhận điều khoản an toàn", false),
				],
			}),
			H({
				fw: true,
				gap: 10,
				children: [
					{ icon: "shield", label: "Trung tâm\ncẩm nang" },
					{ icon: "backpack", label: "Xem\nchuyến đi" },
					{ icon: "sparkles", label: "Hỗ trợ\nAI" },
					{ icon: "user", label: "Cập nhật\nhồ sơ" },
				].map((q) =>
					V({
						grow: 1,
						fill: T.surface,
						radius: R.card,
						stroke: T.border,
						pad: 10,
						gap: 7,
						align: "CENTER",
						children: [IC(q.icon, 20, T.primary), TX(q.label, { size: 10, w: 500, align: "CENTER", color: T.textSecondary, lh: 14 })],
					}),
				),
			}),
			card({
				title: "Rủi ro thời tiết",
				action: "Cần chú ý",
				icon: "rain",
				children: [
					H({ fw: true, gap: 10, children: [kv("KHẢ NĂNG MƯA", "45%"), kv("SỨC GIÓ", "12 km/h")] }),
					H({ fw: true, gap: 10, children: [kv("NHIỆT ĐỘ", "24–26°C"), kv("TẦM NHÌN", "10 km")] }),
					BOX({
						fw: true,
						radius: 8,
						fill: T.warning,
						op: 0.1,
						pad: 10,
						dir: "v",
						children: [
							TX('"Có mưa phùn lúc bộ văn chiều tối lộ trình có ẩm ướt cấp độ nhẹ."', {
								size: 11.5,
								color: T.warning,
								lh: 16,
								fw: true,
							}),
						],
					}),
					btn("Xem chi tiết", { fw: true, variant: "secondary", h: 38 }),
				],
			}),
			card({
				title: "Gợi ý dành cho bạn",
				action: "Xem thêm",
				children: [
					H({
						fw: true,
						gap: 10,
						children: [
							V({ grow: 1, gap: 6, children: [imagePlaceholder(78, "Hồ Hòa Trung"), TX("Hồ Hòa Trung Camp", { size: 12.5, w: 600 }), TX("450.000đ / người", { size: 11, w: 600, color: T.primary })] }),
							V({ grow: 1, gap: 6, children: [imagePlaceholder(78, "Sơn Trà", "#C4D6C9"), TX("Khu cắm trại Sơn Trà", { size: 12.5, w: 600 }), TX("600.000đ / người", { size: 11, w: 600, color: T.primary })] }),
						],
					}),
				],
			}),
		]),
		bottomNav(CAMPER_NAV, 0, T.camper),
	]);
}

/* --- 04. Camper · Khám phá --- */
function scCamperExplore() {
	const spot = (o) =>
		V({
			fw: true,
			fill: T.surface,
			radius: R.card,
			stroke: T.border,
			pad: 0,
			gap: 0,
			shadow: true,
			children: [
				BOX({
					fw: true,
					h: 118,
					fill: o.tint,
					dir: "v",
					justify: "SPACE_BETWEEN",
					pad: 10,
					children: [
						H({
							fw: true,
							justify: "SPACE_BETWEEN",
							align: "MIN",
							children: [
								badge(o.safety, o.safetyTone, "solid"),
								BOX({ w: 28, h: 28, radius: R.pill, fill: "#FFFFFF", dir: "v", justify: "CENTER", align: "CENTER", children: [IC("heart", 15, T.textSecondary)] }),
							],
						}),
					],
				}),
				V({
					fw: true,
					pad: 12,
					gap: 7,
					children: [
						H({
							fw: true,
							align: "CENTER",
							justify: "SPACE_BETWEEN",
							gap: 8,
							children: [
								TX(o.name, { size: 14.5, w: 700, grow: 1 }),
								H({ gap: 4, align: "CENTER", children: [IC("star", 13, T.warning), TX(o.rating, { size: 12, w: 600 })] }),
							],
						}),
						H({ gap: 5, align: "CENTER", children: [IC("pin", 12, T.textMuted), TX(o.place, { size: 11.5, color: T.textSecondary })] }),
						H({ gap: 12, align: "CENTER", children: [TX(o.diff, { size: 11, color: T.textMuted }), TX(o.slots, { size: 11, color: T.textMuted })] }),
						H({
							fw: true,
							align: "CENTER",
							justify: "SPACE_BETWEEN",
							children: [TX(o.price, { size: 13.5, w: 700, color: T.primary }), btn("Xem chi tiết", { variant: "secondary", h: 32 })],
						}),
					],
				}),
			],
		});

	return screen("04 · Camper · Khám phá địa điểm", [
		statusBar(),
		appBar({
			title: "Tìm địa điểm cho chuyến đi tiếp theo",
			subtitle: "124 địa điểm · khu vực miền Trung",
			actions: [{ icon: "map" }],
		}),
		body([
			card({
				pad: 12,
				gap: 10,
				children: [
					field({ value: "Đà Nẵng, Việt Nam", icon: "pin" }),
					H({ fw: true, gap: 8, children: [field({ placeholder: "Ngày nhận", icon: "calendar" }), field({ placeholder: "Ngày trả", icon: "calendar" })] }),
					H({ fw: true, gap: 8, children: [field({ value: "1-2 Người", icon: "users" }), btn("Tìm kiếm", { icon: "search", grow: 1 })] }),
				],
			}),
			H({
				fw: true,
				align: "CENTER",
				justify: "SPACE_BETWEEN",
				children: [
					TX("124 địa điểm", { size: 15, w: 700 }),
					H({ gap: 8, align: "CENTER", children: [IC("filter", 15, T.textSecondary), TX("Phổ biến nhất", { size: 12, w: 500, color: T.textSecondary }), IC("chevronDown", 13, T.textSecondary)] }),
				],
			}),
			spot({ name: "Bán đảo Sơn Trà", place: "Đà Nẵng, Việt Nam", rating: "4.6 (124)", diff: "Dễ", slots: "12 vị trí cắm lều", price: "Từ 350.000đ / đêm", safety: "An toàn", safetyTone: "success", tint: "#C7D8CB" }),
			spot({ name: "Hồ Hòa Trung", place: "Hòa Vang · Cách trung tâm 25km", rating: "4.5 (88)", diff: "Trung bình", slots: "8 vị trí cắm lều", price: "Từ 200.000đ / đêm", safety: "Cần chú ý", safetyTone: "warning", tint: "#D6D2BE" }),
			spot({ name: "Bidoup Núi Bà", place: "Lạc Dương · Cách trung tâm 39km", rating: "4.3 (210)", diff: "Khó", slots: "2 vị trí cắm lều", price: "Từ 500.000đ / đêm", safety: "Nguy hiểm", safetyTone: "danger", tint: "#BFCBC2" }),
		]),
		bottomNav(CAMPER_NAV, 1, T.camper),
	]);
}

/* --- 05. Camper · Chuyến đi của tôi --- */
function scCamperTrips() {
	return screen("05 · Camper · Chuyến đi của tôi", [
		statusBar(),
		appBar({
			title: "Chuyến đi của tôi",
			subtitle: "Quản lý các chuyến cắm trại và trekking của bạn",
			actions: [{ icon: "plus", color: T.primary }],
		}),
		body([
			statGrid([
				{ label: "CHUYẾN SẮP TỚI", value: "02", icon: "calendar" },
				{ label: "ĐANG HOẠT ĐỘNG", value: "01", color: T.success, icon: "navigation" },
				{ label: "ĐÃ HOÀN THÀNH", value: "14", icon: "checkCircle" },
				{ label: "TỔNG QUÃNG ĐƯỜNG", value: "248", sub: "km", icon: "route" },
			]),
			chipRow(["Tất cả (17)", "Sắp diễn ra (2)", "Đang hoạt động (1)", "Hoàn thành (14)"], 0, T.camper),
			V({
				fw: true,
				fill: T.surface,
				radius: R.card,
				stroke: T.border,
				shadow: true,
				gap: 0,
				children: [
					BOX({
						fw: true,
						h: 130,
						fill: "#B9CCC0",
						dir: "v",
						justify: "SPACE_BETWEEN",
						pad: 12,
						children: [
							H({ fw: true, justify: "SPACE_BETWEEN", align: "MIN", children: [badge("SẮP DIỄN RA", "brand", "solid"), BOX({ radius: 8, fill: "#FFFFFF", pad: [6, 10], dir: "v", align: "CENTER", children: [TX("03", { size: 16, w: 700, color: T.primary }), TX("Ngày", { size: 9, color: T.textMuted })] })] }),
							V({ gap: 2, children: [TX("Trekking Bán Đảo Sơn Trà", { size: 17, w: 700, color: "#FFFFFF" }), TX("Đà Nẵng, Việt Nam", { size: 11.5, color: "#FFFFFF" })] }),
						],
					}),
					V({
						fw: true,
						pad: 13,
						gap: 11,
						children: [
							H({ fw: true, gap: 10, children: [kv("THỜI GIAN", "15 – 17 TN09"), kv("THÀNH VIÊN", "04 Người")] }),
							H({ fw: true, gap: 10, children: [kv("ĐỘ KHÓ", "Trung bình", T.warning), kv("TRẠNG THÁI", "An toàn", T.success)] }),
							LINE(T.border),
							TX("Tiến độ chuẩn bị (75%)", { size: 12, w: 600 }),
							progress(0.75),
							checkItem("Danh sách thành viên — Xong", true),
							checkItem("Dụng cụ cá nhân — Xong", true),
							checkItem("Thiết bị cắm trại — Đang soạn", false),
							checkItem("Dữ liệu ngoại tuyến — Chưa tải", false),
							H({ fw: true, gap: 8, children: [btn("Chi tiết tuyến", { variant: "secondary", grow: 1, h: 40 }), btn("Tiếp tục chuẩn bị", { grow: 1, h: 40 })] }),
						],
					}),
				],
			}),
			listRowCard({
				code: "ĐANG HOẠT ĐỘNG · 85%",
				status: "Đang đi",
				tone: "success",
				title: "Khám phá Thác K50",
				meta: [
					["VỪA ĐI QUA", "Checkpoint #04"],
					["SẮP TỚI", "Hạ trại Chân thác"],
				],
				note: "Mưa dông nhẹ lúc 16:00 — chuẩn bị áo mưa",
			}),
			card({
				fill: T.danger,
				stroke: null,
				children: [
					V({ fw: true, gap: 6, align: "CENTER", children: [IC("siren", 24, "#FFFFFF"), TX("Hỗ trợ Khẩn cấp", { size: 15, w: 700, color: "#FFFFFF" }), TX("Nhấn giữ để gửi tín hiệu SOS kèm vị trí GPS của bạn.", { size: 11.5, color: "#FFFFFF", align: "CENTER", lh: 16, fw: true })] }),
					btn("NHẤN GIỮ (SOS)", { fw: true, variant: "light" }),
				],
			}),
		]),
		bottomNav(CAMPER_NAV, 2, T.camper),
	]);
}

/* --- 06. Camper · Trợ lý sinh tồn AI --- */
function scCamperAi() {
	return screen("06 · Camper · Trợ lý sinh tồn AI", [
		statusBar(),
		appBar({
			title: "Trợ lý sinh tồn AI",
			subtitle: "● Đang trực tuyến",
			back: true,
			actions: [{ icon: "plus", color: T.primary }, { icon: "list" }],
		}),
		V({
			name: "Chat",
			fw: true,
			grow: 1,
			fill: T.bg,
			pad: [14, 16, 12, 16],
			gap: 12,
			children: [
				H({
					fw: true,
					justify: "MAX",
					children: [
						BOX({
							w: 250,
							radius: R.card,
							fill: T.primary,
							pad: 11,
							dir: "v",
							children: [TX("Tôi nên làm gì nếu bị lạc và trời sắp tối?", { size: 13, color: "#FFFFFF", lh: 19, fw: true })],
						}),
					],
				}),
				H({
					fw: true,
					gap: 8,
					align: "MIN",
					children: [
						BOX({ w: 28, h: 28, radius: R.pill, fill: T.primary, dir: "v", justify: "CENTER", align: "CENTER", children: [IC("sparkles", 15, "#FFFFFF")] }),
						V({
							grow: 1,
							fill: T.surface,
							radius: R.card,
							stroke: T.border,
							pad: 12,
							gap: 9,
							children: [
								TX("Chào bạn, việc bị lạc khi trời sắp tối là tình huống nghiêm trọng nhưng có thể kiểm soát được. Hãy tuân thủ các bước sau ngay lập tức:", { size: 12.5, lh: 18, color: T.textSecondary, fw: true }),
								...[
									["1", "Giữ bình tĩnh (STOP):", "Dừng lại, Suy nghĩ, Quan sát và Lên kế hoạch. Đừng tiếp tục di chuyển vì bóng tối sẽ làm bạn dễ mất phương hướng hơn."],
									["2", "Tìm nơi trú ẩn:", "Tìm khu vực khô ráo, tránh gió trước khi trời tối hẳn. Sử dụng bạt, lá khô hoặc hốc cây để giữ nhiệt cơ thể."],
									["3", "Nhóm lửa giữ ấm:", "Lửa không chỉ giữ ấm mà còn là tín hiệu cứu hộ hiệu quả nhất."],
								].map((r) =>
									H({
										fw: true,
										gap: 8,
										align: "MIN",
										children: [
											BOX({ w: 18, h: 18, radius: R.pill, fill: T.light, dir: "v", justify: "CENTER", align: "CENTER", children: [TX(r[0], { size: 10, w: 700, color: T.primary })] }),
											V({ grow: 1, gap: 1, children: [TX(r[1], { size: 12.5, w: 700, fw: true }), TX(r[2], { size: 12, color: T.textSecondary, lh: 17, fw: true })] }),
										],
									}),
								),
								LINE(T.border),
								H({ fw: true, gap: 7, children: [btn("Mở bản đồ", { variant: "secondary", h: 34, grow: 1 }), btn("Liên hệ", { variant: "secondary", h: 34, grow: 1 })] }),
								btn("SOS · Gửi tín hiệu khẩn cấp", { fw: true, variant: "danger", h: 38 }),
							],
						}),
					],
				}),
			],
		}),
		V({
			fw: true,
			fill: T.surface,
			pad: [10, 16, 10, 16],
			gap: 7,
			children: [
				H({
					fw: true,
					h: 46,
					radius: R.pill,
					fill: T.bg,
					stroke: T.border,
					pad: [0, 8, 0, 14],
					gap: 8,
					align: "CENTER",
					children: [
						IC("clip", 17, T.textMuted),
						TX("Nhập câu hỏi về sinh tồn hoặc sơ cứu...", { size: 12.5, color: T.textMuted, grow: 1 }),
						IC("mic", 17, T.textMuted),
						BOX({ w: 32, h: 32, radius: R.pill, fill: T.primary, dir: "v", justify: "CENTER", align: "CENTER", children: [IC("send", 15, "#FFFFFF")] }),
					],
				}),
				TX("AI có thể mắc sai lầm. Luôn ưu tiên thiết bị cứu hộ chuyên dụng.", { size: 10, color: T.textMuted, align: "CENTER", fw: true }),
			],
		}),
		bottomNav(CAMPER_NAV, 3, T.camper),
	]);
}

/* --- 07. Camper · Hồ sơ & Cài đặt --- */
function scCamperProfile() {
	const navItem = (icon, label, active) =>
		H({
			fw: true,
			radius: 8,
			fill: active ? T.light : null,
			pad: [10, 11],
			gap: 10,
			align: "CENTER",
			children: [
				IC(icon, 16, active ? T.primary : T.textSecondary),
				TX(label, { size: 12.5, w: active ? 600 : 400, color: active ? T.primary : T.textSecondary, grow: 1 }),
				IC("chevronRight", 14, T.textMuted),
			],
		});

	return screen("07 · Camper · Hồ sơ & Cài đặt", [
		statusBar(),
		appBar({ title: "Hồ sơ & Cài đặt", subtitle: "Quản lý thông tin cá nhân, an toàn và tài khoản", actions: [{ icon: "settings" }] }),
		body([
			card({
				children: [
					H({
						fw: true,
						gap: 12,
						align: "CENTER",
						children: [
							avatar(56, T.camper, "MQ"),
							V({ grow: 1, gap: 5, children: [TX("Minh Quân", { size: 16, w: 700 }), H({ gap: 6, align: "CENTER", children: [badge("Thành viên Pro", "success"), TX("Tham gia từ 2021", { size: 11, color: T.textMuted })] })] }),
						],
					}),
					btn("Thay đổi ảnh", { fw: true, variant: "secondary", h: 38, icon: "camera" }),
				],
			}),
			card({
				title: "Hoàn thiện hồ sơ",
				action: "80%",
				children: [
					progress(0.8),
					BOX({
						fw: true,
						radius: 8,
						fill: T.warning,
						op: 0.1,
						pad: 11,
						dir: "v",
						gap: 5,
						children: [
							H({ gap: 7, align: "CENTER", children: [IC("warning", 14, T.warning), TX("Cần hành động:", { size: 12, w: 700, color: T.warning })] }),
							TX("Thêm người liên hệ khẩn cấp", { size: 11.5, color: T.warning, fw: true }),
							TX("Xác minh số điện thoại", { size: 11.5, color: T.warning, fw: true }),
						],
					}),
				],
			}),
			card({
				title: "Thông tin cá nhân",
				action: "Sửa",
				children: [
					H({ fw: true, gap: 10, children: [kv("HỌ VÀ TÊN", "Minh Quân"), kv("NGÀY SINH", "15/09/1995")] }),
					H({ fw: true, gap: 10, children: [kv("GIỚI TÍNH", "Nam"), kv("ĐỊA CHỈ", "123 Lê Lợi, Đà Nẵng")] }),
					LINE(T.border),
					TX("Yêu thích trekking và khám phá thiên nhiên.", { size: 12, color: T.textSecondary, lh: 17, fw: true }),
				],
			}),
			card({
				title: "Kinh nghiệm & Kỹ năng",
				children: [
					H({ fw: true, gap: 10, children: [kv("CẮM TRẠI", "5 năm"), kv("TREKKING", "3 năm")] }),
					TX("NGÔN NGỮ", { size: 10, w: 600, color: T.textMuted, ls: 4 }),
					H({ fw: true, gap: 7, children: [badge("Tiếng Việt ×", "brand"), badge("Tiếng Anh ×", "brand"), badge("+ Thêm", "neutral")] }),
				],
			}),
			card({
				pad: 6,
				gap: 2,
				children: [
					navItem("mail", "Thông tin liên hệ"),
					navItem("siren", "Thông tin khẩn cấp"),
					navItem("shield", "Sức khỏe & thể lực"),
					navItem("backpack", "Thiết bị cá nhân"),
					navItem("bell", "Thông báo"),
					navItem("lock", "Bảo mật tài khoản"),
				],
			}),
			btn("Đăng xuất", { fw: true, variant: "secondary", icon: "logout" }),
		]),
		bottomNav(CAMPER_NAV, 4, T.camper),
	]);
}

/* --- 08. Porter · Tổng quan --- */
function scPorterHome() {
	return screen("08 · Porter · Tổng quan", [
		statusBar(),
		appBar({
			title: "Tổng quan công việc",
			subtitle: "Chào buổi sáng, Anh Minh · Hôm nay 24/07/2026",
			actions: [{ icon: "bell" }, { icon: "settings" }],
		}),
		body([
			H({
				fw: true,
				radius: R.pill,
				fill: T.success,
				op: 0.12,
				pad: [7, 12],
				gap: 7,
				align: "CENTER",
				children: [DOT(T.success), TX("Đã kết nối trực tiếp", { size: 11.5, w: 600, color: T.success })],
			}),
			statGrid([
				{ label: "CHUYẾN HÔM NAY", value: "01", icon: "route" },
				{ label: "CHUYẾN SẮP TỚI", value: "04", icon: "calendar" },
				{ label: "CHỜ XÁC NHẬN", value: "02", color: T.warning, icon: "clock" },
				{ label: "ĐANG HOẠT ĐỘNG", value: "01", color: T.info, icon: "navigation" },
				{ label: "CẢNH BÁO XỬ LÝ", value: "03", color: T.danger, icon: "warning" },
				{ label: "SỰ CỐ ĐANG MỞ", value: "00", icon: "shield" },
			]),
			card({
				gap: 12,
				children: [
					H({
						fw: true,
						gap: 10,
						align: "CENTER",
						children: [
							BOX({ w: 36, h: 36, radius: R.icon, fill: T.primary, dir: "v", justify: "CENTER", align: "CENTER", children: [IC("route", 19, "#FFFFFF")] }),
							V({ grow: 1, gap: 2, children: [TX("Trekking Sơn Trà – Bãi Bắc", { size: 15.5, w: 700 }), TX("Mã chuyến: TRK-DA-2026-001", { size: 11, color: T.textMuted })] }),
						],
					}),
					H({ fw: true, gap: 8, children: [badge("Weather Risk · An toàn", "success"), badge("Offline · 128MB", "info")] }),
					LINE(T.border),
					H({ fw: true, gap: 10, children: [kv("ĐỊA ĐIỂM & TUYẾN", "Campsite Bãi Đá Đen"), kv("VAI TRÒ", "Porter trưởng (Leader)")] }),
					H({ fw: true, gap: 10, children: [kv("THỜI GIAN DỰ KIẾN", "Tập trung 05:30"), kv("QUY MÔ ĐOÀN", "06 thành viên")] }),
					V({ fw: true, gap: 6, children: [H({ fw: true, justify: "SPACE_BETWEEN", children: [TX("Tiến độ chuẩn bị", { size: 12, w: 600 }), TX("5/7", { size: 12, w: 600, color: T.primary })] }), progress(5 / 7)] }),
					BOX({
						fw: true,
						radius: 8,
						fill: T.surfaceMuted,
						pad: 11,
						dir: "v",
						gap: 7,
						children: [
							TX("CHECKLIST CHUẨN BỊ", { size: 10, w: 600, color: T.textMuted, ls: 4 }),
							checkItem("Đã xác nhận phân công", true),
							checkItem("Đã xem danh sách thành viên", true),
							checkItem("Đã tải bản đồ offline", true),
							checkItem("Đã kiểm tra thiết bị & dụng cụ", true),
							checkItem("Đã đọc cảnh báo thời tiết", false),
							checkItem("Đã xác nhận thời gian tập trung", false),
						],
					}),
					btn("Mở workspace", { fw: true }),
					H({ fw: true, gap: 8, children: [btn("Xem tuyến", { variant: "secondary", grow: 1, h: 40 }), btn("Xem thành viên", { variant: "secondary", grow: 1, h: 40 })] }),
				],
			}),
			mapPlaceholder(170, "Toạ độ: 16.1215° N, 108.2882° E"),
			card({
				title: "Thành viên cần chú ý",
				action: "Tất cả",
				children: [
					H({ fw: true, gap: 10, align: "CENTER", children: [avatar(34, T.warning, "VA"), V({ grow: 1, gap: 2, children: [TX("Nguyễn Văn An", { size: 13, w: 600 }), TX("Chưa xác nhận tham gia", { size: 11, color: T.danger })] })] }),
					H({ fw: true, gap: 10, align: "CENTER", children: [avatar(34, T.info, "TB"), V({ grow: 1, gap: 2, children: [TX("Lê Thị Bình", { size: 13, w: 600 }), TX("Tiền sử họ cảm — Cần lưu ý", { size: 11, color: T.warning })] })] }),
				],
			}),
		]),
		bottomNav(PORTER_NAV, 0, T.porter),
	]);
}

/* --- 09. Porter · Lịch phân công --- */
function scPorterSchedule() {
	const dayCol = (d, date, today, events) =>
		V({
			grow: 1,
			gap: 6,
			children: [
				V({
					fw: true,
					radius: 8,
					fill: today ? T.light : null,
					pad: [6, 4],
					gap: 1,
					align: "CENTER",
					children: [
						TX(d, { size: 10, w: 600, color: today ? T.primary : T.textMuted, align: "CENTER" }),
						TX(date, { size: 12, w: 700, color: today ? T.primary : T.textPrimary, align: "CENTER" }),
					],
				}),
			].concat(events || []),
		});

	const evt = (color) => BOX({ fw: true, h: 28, radius: 6, fill: color, op: 0.18 });

	return screen("09 · Porter · Lịch phân công", [
		statusBar(),
		appBar({
			title: "Lịch phân công",
			subtitle: "Theo dõi và xác nhận các ca trekking được giao",
			actions: [{ icon: "filter" }, { icon: "calendar" }],
		}),
		body([
			statGrid([
				{ label: "CHUYẾN HÔM NAY", value: "01", sub: "đang chuẩn bị" },
				{ label: "CHUYẾN SẮP TỚI", value: "04", sub: "tuần này" },
				{ label: "CHỜ XÁC NHẬN", value: "02", color: T.warning, sub: "cần gấp" },
				{ label: "ĐÃ XÁC NHẬN", value: "12", color: T.success, sub: "tất cả" },
			]),
			card({
				pad: 12,
				children: [
					H({
						fw: true,
						align: "CENTER",
						justify: "SPACE_BETWEEN",
						children: [
							IC("chevronLeft", 17, T.textSecondary),
							TX("15 – 21 Tháng 5, 2024", { size: 13, w: 600 }),
							IC("chevronRight", 17, T.textSecondary),
						],
					}),
					H({
						fw: true,
						gap: 4,
						align: "MIN",
						children: [
							dayCol("T3", "15", false, [evt(T.success)]),
							dayCol("T4", "16", false, []),
							dayCol("T5", "17", true, [evt(T.primary), evt(T.warning)]),
							dayCol("T6", "18", false, [evt(T.danger)]),
							dayCol("T7", "19", false, []),
							dayCol("CN", "20", false, [evt(T.info)]),
						],
					}),
				],
			}),
			chipRow(["Tất cả", "Đã xác nhận", "Chờ xác nhận", "Đang diễn ra"], 0, T.porter),
			V({
				fw: true,
				fill: T.surface,
				radius: R.card,
				stroke: T.border,
				shadow: true,
				pad: 13,
				gap: 11,
				children: [
					H({ fw: true, justify: "SPACE_BETWEEN", align: "CENTER", children: [badge("ĐANG DIỄN RA", "success", "solid"), TX("#TRK-2024-0517", { size: 11, color: T.textMuted })] }),
					TX("Trekking Sơn Trà – Bãi Bắc", { size: 17, w: 700, fw: true }),
					H({ fw: true, gap: 10, children: [kv("CAMPSITE", "Bãi Đá Đen"), kv("ĐỘ KHÓ", "Trung bình", T.warning)] }),
					H({ fw: true, gap: 10, children: [kv("TẬP TRUNG", "05:30 tại Basecamp"), kv("PORTER TRƯỞNG", "Trần Hữu Nghĩa")] }),
					BOX({
						fw: true,
						radius: 8,
						fill: T.surfaceMuted,
						pad: 11,
						dir: "h",
						gap: 10,
						align: "CENTER",
						children: [
							IC("sun", 24, T.warning),
							V({ grow: 1, gap: 2, children: [TX("An toàn", { size: 13, w: 700, color: T.success }), TX("Xác suất mưa 10% · Gió 12km/h", { size: 11, color: T.textSecondary }), TX('"Thời tiết lý tưởng cho trekking"', { size: 10.5, color: T.textMuted, fw: true })] }),
							TX("28°C", { size: 16, w: 700 }),
						],
					}),
					V({ fw: true, gap: 6, children: [H({ fw: true, justify: "SPACE_BETWEEN", children: [TX("Trạng thái chuẩn bị", { size: 12, w: 600 }), TX("Hoàn thành 6/8", { size: 11.5, color: T.textSecondary })] }), progress(0.75)] }),
					checkItem("Đã xác nhận tham gia", true),
					checkItem("Đã tải bản đồ offline", true),
					checkItem("Đã kiểm tra thiết bị liên lạc", true),
					checkItem("Kiểm tra danh sách y tế (Cần thiết)", false),
					BOX({
						fw: true,
						radius: 8,
						fill: T.light,
						pad: 11,
						dir: "h",
						gap: 9,
						align: "CENTER",
						children: [IC("download", 18, T.primary), V({ grow: 1, gap: 1, children: [TX("Gói ngoại tuyến", { size: 12.5, w: 600 }), TX("Sẵn sàng · 128MB", { size: 11, color: T.textSecondary })] })],
					}),
					btn("Mở Workspace", { fw: true }),
				],
			}),
		]),
		bottomNav(PORTER_NAV, 1, T.porter),
	]);
}

/* --- 10. Porter · Bản đồ chuyến đi --- */
function scPorterMap() {
	return screen("10 · Porter · Bản đồ chuyến đi", [
		statusBar(),
		V({
			fw: true,
			fill: T.surface,
			pad: [4, 16, 12, 16],
			gap: 9,
			children: [
				H({
					fw: true,
					align: "CENTER",
					justify: "SPACE_BETWEEN",
					children: [
						V({ grow: 1, gap: 2, children: [TX("Bản đồ chuyến đi", { size: 20, w: 700 }), H({ gap: 6, align: "CENTER", children: [DOT(T.success), TX("Trực tuyến · Đồng bộ 2 phút trước", { size: 11, color: T.textSecondary })] })] }),
						BOX({ w: 34, h: 34, radius: R.pill, fill: T.surfaceMuted, dir: "v", justify: "CENTER", align: "CENTER", children: [IC("layers", 18, T.textSecondary)] }),
					],
				}),
				H({
					fw: true,
					h: 40,
					radius: R.control,
					fill: T.surfaceMuted,
					pad: [0, 12],
					gap: 8,
					align: "CENTER",
					children: [IC("route", 16, T.primary), TX("Trekking Sơn Trà – Bãi Bắc", { size: 12.5, w: 600, grow: 1 }), IC("chevronDown", 15, T.textSecondary)],
				}),
			],
		}),
		V({
			fw: true,
			grow: 1,
			fill: T.bg,
			pad: [12, 16, 14, 16],
			gap: 12,
			children: [
				alertBanner({
					sev: "warning",
					icon: "warning",
					title: "Cảnh báo lệch tuyến",
					msg: "Trần Cường lệch tuyến 15m · 5 phút trước",
					time: "5p",
					actions: [{ text: "Xem trên bản đồ" }, { text: "Liên hệ", variant: "secondary" }],
				}),
				mapPlaceholder(250, "CP2: Bãi Đá Đen · Porter Anh Minh"),
				H({
					fw: true,
					gap: 10,
					children: [
						V({ grow: 1, fill: T.surface, radius: R.card, stroke: T.border, pad: 11, gap: 4, children: [H({ gap: 6, align: "CENTER", children: [IC("refresh", 13, T.success), TX("Đồng bộ", { size: 11, w: 600, color: T.success })] }), TX("1 phút trước", { size: 12, w: 600 }), TX("0 GPS logs chờ tải lên", { size: 10, color: T.textMuted })] }),
						V({ grow: 1, fill: T.surface, radius: R.card, stroke: T.border, pad: 11, gap: 4, children: [H({ gap: 6, align: "CENTER", children: [IC("warning", 13, T.danger), TX("Ngoại tuyến", { size: 11, w: 600, color: T.danger })] }), TX("1 Thành viên", { size: 12, w: 600 }), TX("Mất kết nối > 10p", { size: 10, color: T.textMuted })] }),
					],
				}),
				card({
					title: "Checkpoint: Bãi Bắc",
					icon: "flag",
					children: [
						H({ fw: true, gap: 10, children: [kv("DỰ KIẾN TỚI", "10:30 AM"), kv("THỰC TẾ TỚI", "10:15 AM (-15p)", T.success)] }),
						V({ fw: true, gap: 6, children: [H({ fw: true, justify: "SPACE_BETWEEN", children: [TX("Thành viên tới", { size: 12, w: 600 }), TX("5 / 6 người", { size: 12, w: 600, color: T.primary })] }), progress(5 / 6)] }),
						btn("Xác nhận Checkpoint", { fw: true }),
					],
				}),
			],
		}),
		bottomNav(PORTER_NAV, 2, T.porter),
	]);
}

/* --- 11. Porter · Thành viên đoàn --- */
function scPorterMembers() {
	const member = (o) =>
		V({
			fw: true,
			fill: T.surface,
			radius: R.card,
			stroke: o.selected ? T.primary : T.border,
			sw: o.selected ? 1.5 : 1,
			pad: 12,
			gap: 9,
			shadow: true,
			children: [
				H({
					fw: true,
					gap: 10,
					align: "CENTER",
					children: [
						BOX({ w: 18, h: 18, radius: 5, fill: o.selected ? T.primary : null, stroke: o.selected ? null : T.borderStrong, dir: "v", justify: "CENTER", align: "CENTER", children: o.selected ? [IC("check", 12, "#FFFFFF")] : [] }),
						avatar(36, o.color || T.primary, o.initials),
						V({ grow: 1, gap: 2, children: [TX(o.name, { size: 14, w: 600 }), TX(o.phone, { size: 11, color: T.textMuted })] }),
						badge(o.status, o.tone),
					],
				}),
				H({ fw: true, gap: 10, children: [kv("CHECKPOINT CUỐI", o.cp), kv("LAST SEEN", o.seen)] }),
				H({ fw: true, gap: 10, children: [kv("PIN", o.battery, o.batteryColor), kv("KẾT NỐI", o.conn, o.connColor)] }),
				o.note ? H({ fw: true, gap: 6, align: "CENTER", children: [IC("alertCircle", 13, o.noteColor), TX(o.note, { size: 11.5, color: o.noteColor, grow: 1 })] }) : null,
			].filter(Boolean),
		});

	return screen("11 · Porter · Thành viên đoàn", [
		statusBar(),
		appBar({
			title: "Thành viên đoàn",
			subtitle: "Trekking Sơn Trà – Bãi Bắc (TRK-DA-2026-001)",
			actions: [{ icon: "download" }, { icon: "map" }],
		}),
		body([
			statGrid([
				{ label: "TỔNG THÀNH VIÊN", value: "12" },
				{ label: "BÌNH THƯỜNG", value: "08", color: T.success },
				{ label: "CẦN CHÚ Ý", value: "02", color: T.warning },
				{ label: "NGOẠI TUYẾN", value: "01", color: T.neutral },
				{ label: "CHẬM TIẾN ĐỘ", value: "01", color: T.warning },
				{ label: "SOS", value: "0", color: T.danger },
			]),
			field({ placeholder: "Tìm theo tên hoặc số điện thoại...", icon: "search" }),
			chipRow(["Tất cả", "Bình thường", "Cần chú ý", "Ngoại tuyến"], 0, T.porter),
			member({
				selected: true,
				initials: "TB",
				color: T.warning,
				name: "Lê Thị Bình",
				phone: "0905 123 456",
				status: "Chậm tiến độ",
				tone: "warning",
				cp: "Checkpoint 2",
				seen: "10p trước",
				battery: "42%",
				batteryColor: T.warning,
				conn: "Trực tuyến",
				connColor: T.success,
				note: "Cơ địa dị ứng hải sản",
				noteColor: T.warning,
			}),
			member({
				selected: true,
				initials: "TC",
				color: T.danger,
				name: "Trần Cường",
				phone: "0905 999 888",
				status: "Mất kết nối",
				tone: "danger",
				cp: "Checkpoint 2",
				seen: "15p trước",
				battery: "12%",
				batteryColor: T.danger,
				conn: "Ngoại tuyến",
				connColor: T.danger,
				note: "Cần dùng thuốc huyết áp",
				noteColor: T.danger,
			}),
			member({
				initials: "VA",
				color: T.success,
				name: "Nguyễn Văn An",
				phone: "0905 777 666",
				status: "Bình thường",
				tone: "success",
				cp: "Checkpoint 3",
				seen: "2p trước",
				battery: "85%",
				conn: "Trực tuyến",
				connColor: T.success,
			}),
		]),
		V({
			name: "BulkActionBar",
			fw: true,
			fill: T.primary,
			pad: [11, 14],
			gap: 9,
			children: [
				H({
					fw: true,
					align: "CENTER",
					justify: "SPACE_BETWEEN",
					children: [TX("Đã chọn 2 thành viên", { size: 12.5, w: 600, color: "#FFFFFF" }), IC("x", 16, "#FFFFFF")],
				}),
				H({ fw: true, gap: 8, children: [btn("Gửi thông báo", { variant: "light", h: 34, grow: 1 }), btn("Xác nhận checkpoint", { variant: "light", h: 34, grow: 1 })] }),
			],
		}),
		bottomNav(PORTER_NAV, 4, T.porter),
	]);
}

/* --- 12. Porter · Sự cố --- */
function scPorterIncidents() {
	return screen("12 · Porter · Quản lý sự cố", [
		statusBar(),
		appBar({
			title: "Quản lý sự cố",
			subtitle: "Báo cáo và theo dõi sự cố trong chuyến trekking",
			actions: [{ icon: "shield" }, { icon: "filter" }],
		}),
		body([
			statGrid([
				{ label: "SỰ CỐ ĐANG MỞ", value: "12", icon: "alertCircle" },
				{ label: "CHỜ HOST XÁC NHẬN", value: "04", color: T.warning, icon: "clock" },
				{ label: "ĐANG XỬ LÝ", value: "05", color: T.info, icon: "users" },
				{ label: "ĐÃ ĐIỀU HỖ TRỢ", value: "02", icon: "navigation" },
				{ label: "ĐÃ GIẢI QUYẾT", value: "28", color: T.success, icon: "checkCircle" },
				{ label: "NGHIÊM TRỌNG", value: "01", color: T.danger, icon: "siren" },
			]),
			chipRow(["Tất cả", "Đang mở", "Đang xử lý", "Đã giải quyết", "Đã đóng"], 0, T.porter),
			field({ placeholder: "Tìm theo mã hoặc tên sự cố...", icon: "search" }),
			listRowCard({
				code: "INC-2024-001",
				status: "Đang điều hỗ trợ",
				tone: "info",
				title: "Chấn thương cổ chân",
				meta: [
					["CHUYẾN", "Trekking Sơn Trà"],
					["THÀNH VIÊN", "Lê Thị Bình"],
				],
				note: "Checkpoint 2 · Mức độ CAO · 10 phút trước",
				noteIcon: "pin",
				noteColor: T.danger,
			}),
			listRowCard({
				code: "INC-2024-002",
				status: "Đang xử lý",
				tone: "warning",
				title: "Kiệt sức do nhiệt",
				meta: [
					["CHUYẾN", "Hành trình Fansipan"],
					["THÀNH VIÊN", "Nguyễn Văn An"],
				],
				note: "Đỉnh 2800m · Mức độ KHẨN CẤP · 25 phút trước",
				noteIcon: "pin",
				noteColor: T.danger,
			}),
			listRowCard({
				code: "INC-2024-003",
				status: "Đã đóng",
				tone: "neutral",
				title: "Hỏng trang thiết bị",
				meta: [
					["CHUYẾN", "Trekking Sơn Trà"],
					["THÀNH VIÊN", "Trần Minh Quân"],
				],
				note: "Rừng nguyên sinh · Mức độ THẤP · 2 giờ trước",
				noteIcon: "pin",
				noteColor: T.textMuted,
			}),
			btn("Báo cáo sự cố mới", { fw: true, icon: "plus" }),
		]),
		bottomNav(PORTER_NAV, 4, T.porter),
	]);
}

/* --- 13. Porter · Trung tâm cảnh báo --- */
function scPorterAlerts() {
	return screen("13 · Porter · Trung tâm cảnh báo", [
		statusBar(),
		appBar({
			title: "Trung tâm cảnh báo",
			subtitle: "Cảnh báo về chuyến đi, thời tiết, thành viên và hệ thống",
			actions: [{ icon: "check" }, { icon: "settings" }],
		}),
		body([
			statGrid([
				{ label: "CHƯA ĐỌC", value: "12", icon: "mail" },
				{ label: "CẦN XÁC NHẬN", value: "05", color: T.warning, icon: "clipboard" },
				{ label: "NGUY HIỂM", value: "02", color: T.danger, icon: "siren" },
				{ label: "WEATHER RISK", value: "03", color: T.info, icon: "rain" },
				{ label: "C.BÁO THÀNH VIÊN", value: "04", icon: "users" },
				{ label: "C.BÁO HỆ THỐNG", value: "01", icon: "settings" },
			]),
			chipRow(["Tất cả 11", "Chuyến đi 2", "Thời tiết 3", "Thành viên 4", "Khẩn cấp 1"], 0, T.porter),
			alertBanner({
				sev: "info",
				icon: "rain",
				title: "Weather Risk (Nguy hiểm)",
				time: "14:20 · Hôm nay",
				msg: "Trekking Sơn Trà: Cảnh báo mưa lớn từ 16:00. Gió giật mạnh. Khuyến nghị tạm dừng di chuyển và tìm nơi trú ẩn an toàn.",
				actions: [{ text: "Xác nhận" }, { text: "Xem chi tiết", variant: "secondary" }],
			}),
			alertBanner({
				sev: "danger",
				variant: "emergency",
				icon: "siren",
				title: "Emergency Broadcast (Khẩn cấp)",
				time: "12:05",
				msg: "Tuyến 02 bị đóng do sạt lở nghiêm trọng. Yêu cầu tất cả các nhóm trên tuyến 02 dừng di chuyển ngay lập tức và quay lại Basecamp.",
				actions: [{ text: "Xác nhận & Phản hồi" }, { text: "Liên hệ Host", variant: "secondary" }],
			}),
			alertBanner({
				sev: "warning",
				icon: "pin",
				title: "Cảnh báo thành viên (Quan trọng)",
				time: "10:45",
				msg: "Thành viên Nguyễn Văn An (Nhóm 03) lệch tuyến 15m. Vị trí hiện tại: 16.1234, 108.4567.",
				actions: [{ text: "Xem bản đồ" }, { text: "Liên hệ", variant: "secondary" }],
			}),
			alertBanner({
				sev: "neutral",
				icon: "settings",
				title: "Cảnh báo hệ thống (Thông tin)",
				time: "08:30",
				msg: "Dữ liệu bản đồ ngoại tuyến vùng Bidoup đã cũ. Phiên bản v2.4.1 đã có sẵn.",
				actions: [{ text: "Cập nhật ngay", variant: "secondary" }],
			}),
		]),
		bottomNav(PORTER_NAV, 3, T.porter),
	]);
}

/* ========================================================================== */
/* 7. LAYOUT & RUN                                                            */
/* ========================================================================== */

const GROUPS = [
	{
		title: "AUTH  ·  Đăng nhập & Đăng ký Porter (5 bước)",
		screens: [scLogin, scRegStep1, scRegStep2, scRegStep3, scRegStep4, scRegStep4Empty, scRegStep5, scRegSuccess],
	},
	{
		title: "CAMPER HUB  ·  Flutter mobile",
		screens: [scCamperHome, scCamperExplore, scCamperTrips, scCamperAi, scCamperProfile],
	},
	{
		title: "PORTER DASHBOARD  ·  Flutter mobile",
		screens: [scPorterHome, scPorterSchedule, scPorterMap, scPorterMembers, scPorterIncidents, scPorterAlerts],
	},
];

function withTimeout(promise, ms, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error("quá hạn " + ms + "ms: " + label)), ms)),
	]);
}

async function loadFonts() {
	// Mỗi ứng viên khai báo cách map 4 độ đậm sang style thực tế của font đó.
	const candidates = [
		{ family: "Inter", styles: { 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold" } },
		{ family: "Roboto", styles: { 400: "Regular", 500: "Medium", 600: "Medium", 700: "Bold" } },
		{ family: "Arial", styles: { 400: "Regular", 500: "Regular", 600: "Bold", 700: "Bold" } },
		{ family: "Segoe UI", styles: { 400: "Regular", 500: "Regular", 600: "Bold", 700: "Bold" } },
	];

	for (const c of candidates) {
		try {
			const uniq = [];
			for (const k in c.styles) if (uniq.indexOf(c.styles[k]) === -1) uniq.push(c.styles[k]);
			for (const st of uniq) {
				await withTimeout(figma.loadFontAsync({ family: c.family, style: st }), 8000, c.family + " " + st);
			}
			FONT = c.family;
			WEIGHT_STYLE = c.styles;
			logOk("✔ Font đang dùng: " + c.family);
			return;
		} catch (e) {
			logWarn("font " + c.family + " không dùng được → " + e.message);
		}
	}

	// Fallback cuối: quét font có sẵn trên máy, lấy family đầu tiên có Regular.
	logWarn("Không font nào trong danh sách dùng được — đang quét font hệ thống…");
	const all = await withTimeout(figma.listAvailableFontsAsync(), 20000, "listAvailableFontsAsync");
	for (const f of all) {
		if (f.fontName.style !== "Regular") continue;
		try {
			await withTimeout(figma.loadFontAsync(f.fontName), 8000, f.fontName.family);
			FONT = f.fontName.family;
			WEIGHT_STYLE = { 400: "Regular", 500: "Regular", 600: "Regular", 700: "Regular" };
			logOk("✔ Font dự phòng: " + FONT + " (chỉ có Regular — chữ sẽ không có độ đậm)");
			return;
		} catch (e) {
			/* thử font kế tiếp */
		}
	}
	throw new Error("Không nạp được bất kỳ font nào. Kiểm tra kết nối mạng của Figma.");
}

function uniquePageName(base) {
	const existing = figma.root.children.map((p) => p.name);
	if (existing.indexOf(base) === -1) return base;
	let i = 2;
	while (existing.indexOf(base + " v" + i) !== -1) i++;
	return base + " v" + i;
}

async function main() {
	log("===== BẮT ĐẦU =====");
	logDim("Đang nạp font (tối đa 8s mỗi font)…");
	await loadFonts();

	// ---- TẠO PAGE MỚI. Không đụng vào page nào đang có. ----
	const page = figma.createPage();
	logOk("✔ Đã tạo page mới");
	page.name = uniquePageName("📱 CTMS Mobile — Flutter");
	page.backgrounds = [{ type: "SOLID", color: hexToRgb("#E8EDE9") }];
	await figma.setCurrentPageAsync(page);

	const GAP_X = 60;
	const GAP_Y = 120;
	const COL = SCREEN_W + GAP_X;

	let y = 0;
	const created = [];

	// tiêu đề tổng
	const heading = build(TX("CTMS · Mobile App UI (Flutter) — sinh tự động từ design system", { size: 40, w: 700, color: T.primary }));
	page.appendChild(heading);
	heading.x = 0;
	heading.y = y;
	y += 80;

	const sub = build(
		TX("Nguồn: docs/design/CTMS-DESIGN-SYSTEM.md + FIGMA-SCREEN-INVENTORY.md  ·  Khung 390×844  ·  KHÔNG liên quan tới các frame web", {
			size: 18,
			color: T.textSecondary,
		}),
	);
	page.appendChild(sub);
	sub.x = 0;
	sub.y = y;
	y += 70;

	const failures = [];

	for (const g of GROUPS) {
		log("── Nhóm: " + g.title);
		const label = build(TX(g.title, { size: 26, w: 700, color: T.textPrimary }));
		page.appendChild(label);
		label.x = 0;
		label.y = y;
		y += 50;

		let maxH = 0;
		for (let i = 0; i < g.screens.length; i++) {
			const fn = g.screens[i];
			try {
				const spec = fn();
				logDim("   → dựng: " + spec.name);
				const node = build(spec);
				page.appendChild(node);
				node.x = i * COL;
				node.y = y;
				node.cornerRadius = 24;
				node.effects = SHADOW_MD;
				maxH = Math.max(maxH, node.height);
				created.push(node);
				logOk("   ✔ xong: " + spec.name + " (" + Math.round(node.width) + "×" + Math.round(node.height) + ")");
			} catch (e) {
				const msg = (fn.name || "screen#" + i) + " → " + (e && e.message ? e.message : String(e));
				failures.push(msg);
				logErr("   ✘ LỖI: " + msg);
				if (e && e.stack) console.error(e.stack);
			}
		}
		y += maxH + GAP_Y;
	}

	if (created.length) figma.viewport.scrollAndZoomIntoView(created);

	log("===== KẾT THÚC: " + created.length + " frame, " + failures.length + " lỗi =====");
	if (failures.length) for (const f of failures) logErr("• " + f);
	else logOk('Page mới: "' + page.name + '". Không có page/frame nào khác bị thay đổi.');

	const summary = failures.length
		? "⚠ Tạo được " + created.length + " frame, " + failures.length + " màn lỗi."
		: "✅ Đã tạo " + created.length + " frame trên page mới.";

	if (HAS_UI) {
		figma.ui.postMessage({ type: "done", ok: failures.length === 0 });
		figma.notify(summary, { timeout: 4000 });
		// Giữ bảng log mở để đọc. Bấm "Đóng" trong bảng để thoát.
	} else {
		figma.closePlugin(summary);
	}
}

// Bảng log hiển thị ngay trong Figma (không cần DevTools).
// Bọc try/catch: nếu manifest.json chưa khai báo "ui" thì __html__ không tồn tại —
// khi đó plugin vẫn chạy bình thường, chỉ mất bảng log.
let HAS_UI = false;
try {
	if (typeof __html__ !== "undefined" && __html__) {
		figma.showUI(__html__, { width: 380, height: 460, title: "CTMS Mobile UI Generator" });
		figma.ui.onmessage = (m) => {
			if (m && m.type === "close") figma.closePlugin();
		};
		for (const line of LOG_BUFFER) figma.ui.postMessage({ type: "log", msg: line });
		HAS_UI = true;
	} else {
		console.warn("[CTMS] manifest.json chưa có \"ui\": \"ui.html\" — chạy không có bảng log.");
	}
} catch (e) {
	console.warn("[CTMS] Không mở được bảng log →", e.message);
}

main().catch((err) => {
	const msg = err && err.message ? err.message : String(err);
	logErr("LỖI NGHIÊM TRỌNG: " + msg);
	if (err && err.stack) {
		console.error(err.stack);
		logDim(String(err.stack).split("\n").slice(0, 6).join("\n"));
	}
	if (HAS_UI) figma.ui.postMessage({ type: "done", ok: false });
	else figma.closePlugin("❌ Lỗi: " + msg);
});
