import { Loader2 } from "lucide-react";

export function SessionCheckScreen() {
	return (
		<output className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f4f7f2] text-[#164027]">
			<img src="/ctms_logo.png" alt="CTMS Logo" className="h-12 w-auto object-contain" />
			<span className="flex items-center gap-2 text-sm font-semibold text-[#54655a]">
				<Loader2 className="size-4 animate-spin" />
				Đang kiểm tra phiên đăng nhập...
			</span>
		</output>
	);
}
