/** Select value that switches the "Vị trí" picker from a route location to drawing a danger area. */
export const DANGER_AREA_VALUE = "danger_area";

export function LocationTypeOptions({ includeDangerArea }: { includeDangerArea: boolean }) {
	return (
		<>
			<option value="" disabled hidden>
				Chọn loại vị trí
			</option>
			<option value="water">Nguồn nước</option>
			<option value="dangerous">Nguy hiểm</option>
			<option value="emergency_shelter">Nơi trú ẩn khẩn cấp</option>
			{includeDangerArea && <option value={DANGER_AREA_VALUE}>Khu vực nguy hiểm</option>}
		</>
	);
}
