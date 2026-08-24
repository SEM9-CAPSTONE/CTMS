import { Loader2, LocateFixed } from "lucide-react";
import { useState } from "react";

interface CurrentLocationButtonProps {
	disabled?: boolean;
	onLocation: (latitude: number, longitude: number) => void;
	onError: (message: string) => void;
}

function mapGeolocationError(error: GeolocationPositionError): string {
	if (error.code === error.PERMISSION_DENIED) {
		return "Bạn chưa cấp quyền vị trí. Có thể tìm địa điểm hoặc chọn trực tiếp trên bản đồ.";
	}

	if (error.code === error.TIMEOUT) {
		return "Lấy vị trí hiện tại quá lâu. Vui lòng thử lại hoặc chọn trực tiếp trên bản đồ.";
	}

	return "Không thể lấy vị trí hiện tại. Vui lòng tìm địa điểm hoặc chọn trực tiếp trên bản đồ.";
}

export function CurrentLocationButton({
	disabled = false,
	onLocation,
	onError,
}: CurrentLocationButtonProps) {
	const [isLoading, setIsLoading] = useState(false);

	const requestLocation = () => {
		if (!navigator.geolocation) {
			onError("Trình duyệt không hỗ trợ lấy vị trí hiện tại.");
			return;
		}

		setIsLoading(true);
		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				setIsLoading(false);
				onLocation(coords.latitude, coords.longitude);
			},
			(error) => {
				setIsLoading(false);
				onError(mapGeolocationError(error));
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	};

	return (
		<button
			type="button"
			disabled={disabled || isLoading}
			onClick={requestLocation}
			className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cbd9ce] bg-white px-4 py-2.5 text-sm font-extrabold text-[#164027] hover:bg-[#eef6ef] disabled:cursor-not-allowed disabled:opacity-60"
		>
			{isLoading ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
			Dùng vị trí hiện tại
		</button>
	);
}
