// Feature vocabulary is kept separate from rendering, matching the application's Vietnamese UI.
export const safetyText = {
	title: "Nguy hiểm và nguồn nước quanh tuyến",
	loading: "Đang lấy vùng cảnh báo, sự kiện thiên tai và nguồn nước gần tuyến…",
	groups: { area: "Vùng nguy hiểm", point: "Điểm nguy hiểm", water: "Nguồn nước" },
	groupEmpty: "Chưa có dữ liệu phù hợp gần tuyến trong lần kiểm tra này.",
	groupLoading: "Đang kiểm tra lớp dữ liệu này…",
	waterAttribution: "Dữ liệu nguồn nước: © OpenStreetMap contributors (ODbL).",
	waterDisclaimer: "Vị trí trên bản đồ không xác nhận hiện có nước hoặc nước uống được.",
	mapLegend:
		"Màu theo mức nguy hiểm · Màu xanh dương: nguồn nước · Màu nhạt: dữ liệu đã cũ hoặc đã kết thúc.",
	contextSource: {
		VNDMS: {
			LOADING: "Đang lấy các điểm thiên tai VNDMS…",
			LIVE: "Đã lấy sự kiện trực tiếp từ VNDMS. Các sự kiện đã kết thúc được ghi nhãn riêng.",
			EMPTY: "VNDMS chưa trả sự kiện trong năm hiện tại và năm trước.",
			PARTIAL: "Chỉ lấy được một phần sự kiện VNDMS; một số bản ghi thiếu vị trí hoặc thời gian.",
			UNAVAILABLE: "Không lấy được sự kiện VNDMS. Chưa kiểm tra đủ các điểm nguy hiểm bên ngoài.",
			DISABLED: "Chưa bật kết nối sự kiện VNDMS.",
		},
		OSM: {
			LOADING: "Đang lấy nguồn nước gần tuyến…",
			LIVE: "Đã lấy dữ liệu nguồn nước từ OpenStreetMap quanh tuyến.",
			EMPTY:
				"Chưa tìm thấy nguồn nước được lập bản đồ quanh tuyến. Điều này không xác nhận khu vực không có nước.",
			PARTIAL: "Dữ liệu nguồn nước chưa đầy đủ hoặc phạm vi tuyến vượt giới hạn tra cứu.",
			UNAVAILABLE: "Không lấy được dữ liệu nguồn nước. Hãy thử kiểm tra lại.",
			DISABLED: "Chưa bật kết nối dữ liệu nguồn nước.",
		},
	},
	liveSource: {
		LOADING: "Đang lấy vùng cảnh báo NCHMF…",
		LIVE: "Đã lấy cảnh báo trực tiếp từ NCHMF.",
		EMPTY:
			"NCHMF chưa trả dữ liệu cảnh báo cho các giờ gần nhất. Chưa thể xác nhận tình hình hiện tại.",
		PARTIAL: "Đã lấy dữ liệu NCHMF nhưng chưa kiểm tra hết vùng tuyến đi qua.",
		UNAVAILABLE:
			"Không lấy được cảnh báo hiện tại từ NCHMF. Chưa kiểm tra được các vùng cảnh báo hiện hành từ nguồn này.",
		DISABLED: "Chưa bật kết nối cảnh báo trực tiếp. Chưa thể xác nhận tình hình hiện tại.",
	},
	sourceCheckedAt: "Kiểm tra nguồn lúc",
	sourceDataTime: "Mốc dữ liệu cảnh báo",
	sourceValidUntil: "Hiệu lực đến",
	error: "Chưa kiểm tra được thông tin nguy hiểm. Bạn vẫn có thể lưu tuyến.",
	empty: "Chưa tìm thấy dữ liệu nguy hiểm liên quan. Điều này không đồng nghĩa tuyến an toàn.",
	disclaimer:
		"Kết quả chỉ hỗ trợ xem xét tuyến, không bảo đảm an toàn. Vùng theo xã có thể rộng hơn phạm vi nguy hiểm thực tế.",
	truncated: "Có nhiều kết quả hơn giới hạn hiển thị; phân tích hiện tại chưa đầy đủ.",
	wait: "Vẽ ít nhất hai điểm khác nhau để kiểm tra tuyến.",
	retry: "Kiểm tra lại",
	sourceType: {
		OFFICIAL_CURRENT: "Cảnh báo nguồn chính thức",
		BASE_HISTORICAL: "Dữ liệu lịch sử",
		HOST_DEFINED: "Nguy hiểm do Host đánh dấu",
		FIELD_OBSERVATION: "Sự cố Trip CTMS",
		RESOURCE: "Nguồn nước / tài nguyên địa lý",
	},
	severity: {
		LOW: "Thấp",
		MEDIUM: "Trung bình",
		HIGH: "Cao",
		VERY_HIGH: "Rất cao",
		UNKNOWN: "Chưa đủ thông tin",
	},
	lifecycle: {
		ACTIVE: "Còn hiệu lực theo chính sách dữ liệu",
		STALE: "Dữ liệu đã cũ",
		EXPIRED: "Đã hết hiệu lực",
		RESOLVED: "Đã xử lý hoặc đóng",
		HISTORICAL: "Lịch sử",
		SCHEDULED: "Chưa đến thời gian hiệu lực",
		UNKNOWN: "Chưa xác định hiệu lực",
	},
	verification: {
		SOURCE_PROVIDED: "Theo nguồn cung cấp",
		UNVERIFIED: "Chưa xác minh",
		VERIFIED: "Đã xác minh",
	},
} as const;
