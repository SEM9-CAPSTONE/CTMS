export function LocationTypeOptions() {
	return (
		<>
			<option value="" disabled hidden>
				Chọn loại vị trí
			</option>
			<option value="start">Điểm bắt đầu</option>
			<option value="finish">Điểm kết thúc</option>
			<option value="rest">Điểm nghỉ chân</option>
			<option value="water">Nguồn nước</option>
			<option value="dangerous">Nguy hiểm</option>
			<option value="emergency_shelter">Nơi trú ẩn khẩn cấp</option>
		</>
	);
}
