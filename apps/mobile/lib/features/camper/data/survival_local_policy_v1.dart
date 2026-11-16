// Keep this versioned artifact for traces recorded by this Local safety policy.
const localSafetyPolicyV1 = 'ctms-069-local-safety-v1';

final _unsafeLocal = RegExp(
  r'http[s]?://|www\.|<[^>]+>|chẩn đoán|kê đơn|liều (?:dùng|thuốc)|'
  r'\d+\s*(?:mg|mcg|µg|ml|viên)\b|tiêm|khâu|nắn khớp|gây nôn|'
  r'đã (?:gửi|gọi|điều động)|đã được (?:kiểm chứng|kiểm duyệt)|'
  r'hiện tại|hôm nay|lúc này|đang có cảnh báo|từ chối|'
  r'cấp cứu|tai nạn|chấn thương|bị thương|nhiễm độc|ngộ độc|'
  r'rắn cắn|xuất huyết|sơ cứu|điều trị|'
  r'nước (?:uống|suối)|lọc nước|thực phẩm rừng|nấm|cây ăn được|'
  r'prescri(?:be|ption)|medication|inject|treatment|diagnos(?:e|is)|'
  r'ignore.{0,50}instructions|(?:bỏ qua|phớt lờ).{0,50}(?:chỉ dẫn|hướng dẫn)|'
  r'\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b',
  caseSensitive: false,
);
final _generalLocal = RegExp(
  r'ba lô|đóng gói|hành lý|trang bị|chuẩn bị|'
  r'giày|tất|áo khoác|áo mưa|túi ngủ|lều|đọc bản đồ|la bàn|'
  r'checklist|backpack|packing|camping gear',
  caseSensitive: false,
);
final _tripOrLive = RegExp(
  r'chuyến (?:đi|này)|cung |trạm |điểm hẹn|checkpoints?|tọa độ|'
  r'vị trí|thời tiết|dự báo|sạt lở|lũ quét|đường (?:mở|đóng)|'
  r'cảnh báo|hôm (?:nay|qua)|bây giờ|ngày mai|đã gửi|trạng thái|\bsos\b',
  caseSensitive: false,
);
final savedCheckpointQuestionV1 = RegExp(
  r'^(?:gói (?:đã lưu|ngoại tuyến) |chuyến này )?có '
  r'(?:bao nhiêu|mấy) (?:điểm dừng|checkpoint)(?: trong gói (?:đã lưu|ngoại tuyến))?[.?!]*$',
  caseSensitive: false,
);

bool allowsLocalModelTextV1(String text) =>
    _generalLocal.hasMatch(text) &&
    !_unsafeLocal.hasMatch(text) &&
    !_tripOrLive.hasMatch(text);

bool allowsLocalModelAnswerV1(String text) =>
    text.length <= 2600 && allowsLocalModelTextV1(text);
