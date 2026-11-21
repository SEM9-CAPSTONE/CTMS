import { regionForPoint } from "./trip-regions";

describe("regionForPoint", () => {
	it.each([
		[16.118, 108.276, "son_tra"], // Đỉnh Bàn Cờ
		[16.1, 108.27, "son_tra"], // Khu Linh Ứng
		[16.195, 108.13, "hai_van_lien_chieu"], // Đèo Hải Vân
		[16.11, 108.13, "hai_van_lien_chieu"], // Rạn Nam Ô
		[15.997, 107.99, "ba_na_hoa_vang"], // Bà Nà
		[15.965, 108.035, "ba_na_hoa_vang"], // Thác Hòa Phú Thành
		[16.003, 108.263, "ngu_hanh_son"], // Ngũ Hành Sơn
		[16.061, 108.214, "city_center"], // Hải Châu
	] as const)("places %d,%d in %s", (lat, lng, region) => {
		expect(regionForPoint(lat, lng)).toBe(region);
	});

	it("returns null outside Đà Nẵng or without coordinates", () => {
		expect(regionForPoint(11.94, 108.44)).toBeNull(); // Đà Lạt
		expect(regionForPoint(15.75, 108.3)).toBeNull(); // far south of Non Nước
		expect(regionForPoint(null, 108)).toBeNull();
		expect(regionForPoint(Number.NaN, 108)).toBeNull();
	});
});
