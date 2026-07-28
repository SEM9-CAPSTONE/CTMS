import { Brain, CloudRain, MapPin, ShieldCheck, WifiOff } from "lucide-react";
import type React from "react";

export const LoginHeroBanner: React.FC = () => {
	return (
		<div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#164027] p-12 lg:flex">
			<div
				className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
				style={{ backgroundImage: `url('/figma_assets/login_bg_mountain.png')` }}
			/>
			<div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />

			<div className="relative z-10 flex items-center gap-3.5">
				<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-lg backdrop-blur-md">
					<img src="/ctms_logo.png" alt="CTMS Logo" className="h-10 w-auto object-contain" />
				</div>
				<span className="text-3xl font-extrabold tracking-tight text-white drop-shadow">CTMS</span>
			</div>

			<div className="relative z-10 max-w-[500px]">
				<h1 className="mb-8 text-4xl font-extrabold leading-tight tracking-tight text-white drop-shadow-md lg:text-5xl">
					Sẵn sàng cho hành trình tiếp theo
				</h1>

				<div className="grid grid-cols-2 gap-4">
					<div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/15 px-5 py-4 text-sm font-bold text-white shadow-lg backdrop-blur-md">
						<WifiOff size={20} />
						<span>Offline Maps</span>
					</div>
					<div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/15 px-5 py-4 text-sm font-bold text-white shadow-lg backdrop-blur-md">
						<CloudRain size={20} />
						<span>Weather Risk</span>
					</div>
					<div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/15 px-5 py-4 text-sm font-bold text-white shadow-lg backdrop-blur-md">
						<Brain size={20} />
						<span>AI Analytics</span>
					</div>
					<div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/15 px-5 py-4 text-sm font-bold text-white shadow-lg backdrop-blur-md">
						<MapPin size={20} />
						<span>GPS Tracking</span>
					</div>
				</div>
			</div>

			<div className="relative z-10 flex items-center gap-2 text-xs font-semibold text-white/80">
				<ShieldCheck size={16} />
				<span>Hệ thống quản lý leo núi đạt chuẩn quốc tế</span>
			</div>
		</div>
	);
};
