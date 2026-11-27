export type TermsPlatform = "web" | "mobile" | "api";
export type TermsAcceptanceSource = "registration" | "reconsent";

export interface TermsSubsection {
	code: string;
	title: string;
	body: string;
}

export interface TermsSection {
	number: number;
	slug: string;
	title: string;
	subsections: TermsSubsection[];
	callout?: string;
}

export const DEFAULT_TERMS_VERSION = "1.0";
export const DEFAULT_TERMS_EFFECTIVE_DATE = "2026-11-27";
export const DEFAULT_TERMS_TITLE = "Điều khoản và Chính sách sử dụng CTMS";
export const DEFAULT_TERMS_SUMMARY =
	"Phiên bản khởi tạo gồm đầy đủ 12 mục về tài khoản, đặt chỗ, hủy chuyến, an toàn dã ngoại và leo núi, bản đồ và thời tiết, trợ lý sinh tồn trí tuệ nhân tạo, tín hiệu cầu cứu khẩn cấp và dữ liệu người dùng.";

export function normalizeTermsVersion(raw: string): string {
	return raw.trim().replace(/^[vV]/, "");
}

export const DEFAULT_TERMS_V1_SECTIONS: TermsSection[] = [
	{
		number: 1,
		slug: "quy-dinh-chung",
		title: "Quy định chung",
		subsections: [
			{
				code: "1.1",
				title: "Phạm vi áp dụng",
				body: "Điều khoản và Chính sách sử dụng này áp dụng cho tất cả cá nhân, tổ chức khi truy cập, đăng ký tài khoản hoặc sử dụng trang web, ứng dụng di động và các dịch vụ thuộc hệ thống quản lý điểm cắm trại và chuyến đi dã ngoại, leo núi CTMS.",
			},
			{
				code: "1.2",
				title: "Chấp thuận điều khoản",
				body: "Khi tạo tài khoản hoặc xác nhận đồng ý phiên bản điều khoản đang hiệu lực trên CTMS, bạn xác nhận đã đọc, hiểu và đồng ý tuân thủ toàn bộ nội dung của Điều khoản này.",
			},
		],
		callout:
			"Điều khoản này có thể được cập nhật theo từng phiên bản. Khi có thay đổi quan trọng, CTMS sẽ thông báo và có thể yêu cầu bạn xem lại và chấp thuận lại.",
	},
	{
		number: 2,
		slug: "tai-khoan-va-vai-tro",
		title: "Tài khoản và vai trò",
		subsections: [
			{
				code: "2.1",
				title: "Đăng ký và xác thực tài khoản",
				body: "Để tạo tài khoản trên CTMS, bạn cần cung cấp thông tin chính xác gồm địa chỉ thư điện tử và số điện thoại hợp lệ, sau đó hoàn tất bước xác thực mã một lần hoặc đăng nhập bằng phương thức được hệ thống hỗ trợ. Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động phát sinh từ tài khoản của mình.",
			},
			{
				code: "2.2",
				title: "Các vai trò trên hệ thống",
				body: "CTMS hỗ trợ các vai trò gồm Người tham gia chuyến đi, Đơn vị tổ chức chuyến đi, Người dẫn đường hỗ trợ đoàn và Quản trị viên hệ thống. Mỗi vai trò chỉ được sử dụng các chức năng phù hợp với quyền hạn được cấp và trạng thái xác minh tương ứng.",
			},
		],
	},
	{
		number: 3,
		slug: "dat-cho-va-thanh-toan",
		title: "Đặt chỗ và thanh toán",
		subsections: [
			{
				code: "3.1",
				title: "Đặt chỗ chuyến đi",
				body: "Khi đặt chỗ cho một chuyến đi đang mở trên CTMS, hệ thống ghi nhận số lượng khách, thông tin thành viên và lưu lại bản sao lịch trình, mức giá cơ bản cùng chính sách hủy áp dụng tại thời điểm đặt chỗ. Các thay đổi sau đó đối với mô tả chuyến đi không tự động làm thay đổi thông tin đã ghi nhận của đơn đặt chỗ hợp lệ.",
			},
			{
				code: "3.2",
				title: "Thanh toán và phí dịch vụ",
				body: "Đối với chuyến đi miễn phí, đơn đặt chỗ có thể được xác nhận ngay theo trạng thái hệ thống. Đối với chuyến đi có phí, đơn đặt chỗ có thời hạn giữ chỗ chờ thanh toán; nếu quá hạn chưa thanh toán, hệ thống có thể tự động hủy giữ chỗ. Phí dịch vụ nền tảng và quy trình thanh toán cho đơn vị tổ chức áp dụng theo chính sách và tỷ lệ hiển thị tại thời điểm giao dịch.",
			},
		],
	},
	{
		number: 4,
		slug: "huy-chuyen",
		title: "Hủy chuyến",
		subsections: [
			{
				code: "4.1",
				title: "Hủy đặt chỗ trước chuyến đi",
				body: "Khi chuyến đi chưa bắt đầu, người tham gia có thể gửi yêu cầu hủy đặt chỗ trực tiếp trên đơn đặt chỗ. Mức hoàn tiền (nếu có) được tính căn cứ theo chính sách hủy gắn với chuyến đi tại thời điểm đặt chỗ, hiển thị rõ theo các mốc thời gian trước giờ khởi hành trên chi tiết chuyến đi và đơn đặt chỗ. Khi chuyến đi đã bắt đầu, thao tác tự hủy đặt chỗ trước chuyến đi không còn khả dụng.",
			},
			{
				code: "4.2",
				title: "Yêu cầu hoàn tiền sau chuyến đi",
				body: "Sau khi chuyến đi kết thúc, nếu phát sinh sự cố hoặc khiếu nại liên quan đến dịch vụ, người tham gia có thể gửi yêu cầu hoàn tiền sau chuyến đi kèm lý do và bằng chứng. Khiếu nại thông thường cần được gửi trong vòng 24 giờ sau khi chuyến đi hoàn tất.",
			},
			{
				code: "4.3",
				title: "Xét duyệt và xác nhận chuyển tiền",
				body: "Mọi yêu cầu hoàn tiền đều trải qua bước tiếp nhận và xét duyệt (chấp thuận hoặc từ chối) tách biệt với bước chuyển tiền. Thông báo chấp thuận yêu cầu chỉ xác nhận kết quả xét duyệt, không đồng nghĩa tiền đã được chuyển ngay vào tài khoản ngân hàng của bạn; việc chuyển tiền được theo dõi và xác nhận ở bước xử lý riêng trên hệ thống.",
			},
		],
		callout:
			"Hủy đặt chỗ trước chuyến đi và yêu cầu hoàn tiền sau chuyến đi là hai quy trình riêng biệt; bước duyệt yêu cầu và bước xác nhận chuyển tiền được xử lý tách bạch.",
	},
	{
		number: 5,
		slug: "hoat-dong-da-ngoai-va-leo-nui",
		title: "Hoạt động dã ngoại và leo núi",
		subsections: [
			{
				code: "5.1",
				title: "Rủi ro đặc thù ngoài trời",
				body: "Hoạt động cắm trại, dã ngoại và leo núi diễn ra tại khu vực địa hình tự nhiên, luôn tiềm ẩn rủi ro về thời tiết, địa hình, động thực vật và thể lực cá nhân. Khi đăng ký tham gia, bạn cần tự đánh giá tình trạng sức khỏe phù hợp với mức độ tuyến đường và chuẩn bị trang bị cần thiết.",
			},
			{
				code: "5.2",
				title: "Trách nhiệm an toàn khi tham gia",
				body: "Người tham gia có trách nhiệm tuân thủ lịch trình, hướng dẫn an toàn của đơn vị tổ chức và người dẫn đường, không tự ý tách đoàn và tuân thủ quy định bảo vệ môi trường, phòng cháy chữa cháy tại khu vực cắm trại và tuyến hành trình.",
			},
		],
	},
	{
		number: 6,
		slug: "don-vi-to-chuc-va-nguoi-dan-duong",
		title: "Đơn vị tổ chức và Người dẫn đường",
		subsections: [
			{
				code: "6.1",
				title: "Trách nhiệm của Đơn vị tổ chức",
				body: "Đơn vị tổ chức chịu trách nhiệm về tính chính xác của thông tin chuyến đi, tuyến đường, điểm dừng, mức giá, chính sách hủy và việc tổ chức vận hành chuyến đi an toàn, đúng nội dung đã công bố cũng như tuân thủ quy định pháp luật liên quan tại địa phương.",
			},
			{
				code: "6.2",
				title: "Xác minh và vai trò của Người dẫn đường",
				body: "Người dẫn đường hỗ trợ dẫn tuyến, điểm danh, theo dõi an toàn và ghi nhận sự cố trên hành trình theo phân công. Hồ sơ năng lực, chứng chỉ và cấp độ của người dẫn đường trên CTMS phải trải qua bước kiểm tra và xét duyệt của quản trị viên; người dẫn đường chịu trách nhiệm hoàn toàn về tính trung thực của mọi giấy tờ đã nộp.",
			},
		],
	},
	{
		number: 7,
		slug: "ban-do-va-du-lieu-thoi-tiet",
		title: "Bản đồ và dữ liệu thời tiết",
		subsections: [
			{
				code: "7.1",
				title: "Dữ liệu tuyến đường và bản đồ ngoại tuyến",
				body: "Bản đồ tuyến đường, điểm dừng, vùng cảnh báo nguy hiểm và gói dữ liệu ngoại tuyến trên CTMS được cung cấp nhằm hỗ trợ định hướng và chuẩn bị hành trình. Tín hiệu định vị vệ tinh và bản đồ có thể chịu ảnh hưởng bởi địa hình, thiết bị hoặc thay đổi thực địa chưa kịp cập nhật.",
			},
			{
				code: "7.2",
				title: "Cảnh báo rủi ro thời tiết",
				body: "Thông tin dự báo và đánh giá mức độ rủi ro thời tiết trên CTMS dựa trên nguồn dữ liệu khí tượng tích hợp và cập nhật vận hành nhằm hỗ trợ ra quyết định. Khi rủi ro thời tiết ở mức nguy hiểm hoặc thiếu dữ liệu đánh giá hợp lệ, hệ thống có thể tạm khóa đặt chỗ hoặc phát thông báo điều chỉnh, hủy chuyến vì lý do an toàn.",
			},
		],
	},
	{
		number: 8,
		slug: "tro-ly-sinh-ton-tri-tue-nhan-tao",
		title: "Trợ lý sinh tồn trí tuệ nhân tạo",
		subsections: [
			{
				code: "8.1",
				title: "Tính chất tham khảo",
				body: "Trợ lý sinh tồn trí tuệ nhân tạo trên CTMS cung cấp gợi ý và tra cứu kiến thức sinh tồn dựa trên tài liệu được nạp trong hệ thống và ngữ cảnh chuyến đi. Nội dung phản hồi chỉ mang tính tham khảo hỗ trợ chuẩn bị và xử lý tình huống cơ bản.",
			},
			{
				code: "8.2",
				title: "Giới hạn chuyên môn",
				body: "Trợ lý sinh tồn trí tuệ nhân tạo không phải bác sĩ, nhân viên y tế hay đơn vị cứu hộ chuyên nghiệp và không thay thế chẩn đoán y khoa, chỉ dẫn của người dẫn đường có kinh nghiệm hoặc cơ quan chức năng trong tình huống nguy hiểm.",
			},
		],
		callout:
			"Trong mọi tình huống khẩn cấp về sức khỏe hoặc an toàn, không chỉ dựa vào phản hồi của Trợ lý sinh tồn trí tuệ nhân tạo mà cần ưu tiên liên hệ người dẫn đoàn và lực lượng hỗ trợ chuyên môn.",
	},
	{
		number: 9,
		slug: "tin-hieu-cau-cuu-va-tinh-huong-khan-cap",
		title: "Tín hiệu cầu cứu và tình huống khẩn cấp",
		subsections: [
			{
				code: "9.1",
				title: "Cơ chế gửi tín hiệu cầu cứu khẩn cấp",
				body: "Tính năng cầu cứu khẩn cấp cho phép người dùng phát tín hiệu cảnh báo kèm tọa độ gần nhất ghi nhận từ thiết bị tới người phụ trách chuyến đi và bộ phận theo dõi vận hành trên CTMS. Người dùng chỉ sử dụng tính năng này cho tình huống khẩn cấp thực sự và thực hiện xác nhận đúng hướng dẫn trên màn hình.",
			},
			{
				code: "9.2",
				title: "Giới hạn kết nối và không bảo đảm cứu hộ",
				body: "Việc truyền tín hiệu cầu cứu phụ thuộc vào vùng phủ sóng di động, kết nối mạng, độ chính xác định vị vệ tinh, pin thiết bị và điều kiện hiện trường. CTMS là công cụ hỗ trợ cảnh báo và điều phối thông tin, không thay thế dịch vụ cứu hộ hoặc cấp cứu công lập và không cam kết thời gian hay kết quả cứu hộ thực tế. Khi có nguy hiểm đe dọa tính mạng, hãy ưu tiên liên hệ trực tiếp cơ quan cứu hộ, công an hoặc y tế địa phương ngay khi có thể.",
			},
		],
	},
	{
		number: 10,
		slug: "du-lieu-nguoi-dung",
		title: "Dữ liệu người dùng",
		subsections: [
			{
				code: "10.1",
				title: "Phạm vi dữ liệu xử lý",
				body: "CTMS xử lý các dữ liệu cần thiết để cung cấp dịch vụ gồm thông tin tài khoản, hồ sơ vai trò, lịch sử đặt chỗ và giao dịch, dữ liệu vị trí và đồng bộ ngoại tuyến trong thời gian tham gia chuyến đi, đánh giá và nhật ký kiểm toán các thao tác quan trọng.",
			},
			{
				code: "10.2",
				title: "Hồ sơ sức khỏe và quyền chia sẻ riêng",
				body: "Hồ sơ sức khỏe là thông tin nhạy cảm, hoàn toàn tự nguyện và tách biệt với việc chấp thuận Điều khoản này. Khi xác nhận đặt chỗ cho một chuyến đi cụ thể, người tham gia có thể chủ động lựa chọn chia sẻ Hồ sơ sức khỏe để đơn vị tổ chức và người dẫn đường nắm thông tin hỗ trợ an toàn phù hợp. Bạn không bắt buộc phải chia sẻ và có thể bật hoặc thu hồi quyền chia sẻ bất kỳ lúc nào trong phần Hồ sơ cá nhân.",
			},
		],
	},
	{
		number: 11,
		slug: "vi-pham-va-xu-ly-tai-khoan",
		title: "Vi phạm và xử lý tài khoản",
		subsections: [
			{
				code: "11.1",
				title: "Hành vi không được phép",
				body: "Người dùng không được cung cấp thông tin hoặc chứng chỉ giả mạo, thực hiện gian lận đặt chỗ, thanh toán hoặc khiếu nại, gây rối hoặc đe dọa an toàn của người khác, phát tín hiệu cầu cứu giả, hoặc can thiệp trái phép vào hệ thống.",
			},
			{
				code: "11.2",
				title: "Biện pháp xử lý",
				body: "Khi phát hiện dấu hiệu vi phạm hoặc nhận báo cáo hợp lệ, quản trị viên CTMS có thể xem xét, nhắc nhở, gỡ bỏ nội dung vi phạm hoặc tạm khóa tài khoản (đồng thời chấm dứt các phiên đăng nhập hiện hành và ghi nhận nhật ký kiểm toán). Tài khoản chỉ được mở lại sau khi hoàn tất quá trình xem xét theo quy định vận hành.",
			},
		],
	},
	{
		number: 12,
		slug: "thay-doi-dieu-khoan",
		title: "Thay đổi điều khoản",
		subsections: [
			{
				code: "12.1",
				title: "Cập nhật phiên bản điều khoản",
				body: "CTMS có thể điều chỉnh, bổ sung Điều khoản và Chính sách này khi có thay đổi về tính năng, quy trình vận hành hoặc yêu cầu pháp lý. Mỗi bản cập nhật được gắn số phiên bản, ngày hiệu lực rõ ràng và lưu giữ trong Lịch sử phiên bản để người dùng tra cứu bất cứ lúc nào.",
			},
			{
				code: "12.2",
				title: "Thông báo và chấp thuận lại",
				body: "Với các thay đổi quan trọng yêu cầu xác nhận lại, hệ thống sẽ hiển thị thông báo trên trang web và ứng dụng di động để bạn đọc nội dung phiên bản mới trước khi xác nhận đồng ý. Bạn có thể chọn Để sau nếu cần thêm thời gian xem xét (bản ghi chấp thuận trước đó vẫn được giữ nguyên), và khi bạn xác nhận đồng ý trên một nền tảng, trạng thái chấp thuận sẽ tự động đồng bộ sang nền tảng còn lại cho cùng tài khoản.",
			},
		],
	},
];
