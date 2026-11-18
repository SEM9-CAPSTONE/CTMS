/// Feature copy follows the existing *_strings.dart localization convention.
class PorterReviewStrings {
  PorterReviewStrings._();
  static const title = 'Đánh giá người hỗ trợ';
  static const subtitle = 'Gửi nhận xét sau chuyến đi';
  static const chooseTrip = 'Chọn chuyến đi';
  static const choosePorter = 'Chọn người hỗ trợ';
  static const porter = 'Người hỗ trợ';
  static const changeTrip = 'Đổi chuyến';
  static const noTrips = 'Chưa có chuyến đi đã hoàn thành để đánh giá.';
  static const missingName = 'Chưa có tên người hỗ trợ';
  static const noPorters =
      'Chuyến đi này chưa có người hỗ trợ đủ điều kiện để nhận đánh giá mới.';
  static const noNewReviews = 'Không có người hỗ trợ để đánh giá mới.';
  static const incomplete =
      'Bạn chỉ có thể đánh giá sau khi đã tham gia và hoàn thành chuyến đi.';
  static const expired =
      'Đã hết hạn đánh giá. Bạn vẫn có thể xem nội dung đã gửi.';
  static const available = 'Còn trong thời gian đánh giá';
  static const unavailable =
      'Nội dung không còn khả dụng hoặc bạn không có quyền truy cập.';
  static const readOnly = 'Chỉ xem';
  static const loading = 'Đang tải thông tin đánh giá…';
  static const refresh = 'Làm mới';
  static const retry = 'Thử lại';
  static const loadFailed =
      'Chưa tải được thông tin đánh giá. Kiểm tra kết nối rồi thử lại.';
  static const stale =
      'Chưa xác minh được dữ liệu mới nhất. Hãy tải lại trước khi gửi.';
  static const ratingLabel = 'Điểm đánh giá';
  static const commentLabel = 'Nhận xét (không bắt buộc)';
  static const commentHint = 'Người hỗ trợ đã giúp bạn như thế nào?';
  static const commentTooLong = 'Nhận xét tối đa 2.000 ký tự.';
  static const save = 'Gửi đánh giá';
  static const saveEdit = 'Lưu chỉnh sửa';
  static const saving = 'Đang gửi…';
  static const edit = 'Chỉnh sửa';
  static const saved = 'Đã lưu đánh giá người hỗ trợ.';
  static const confirmedLater = 'Đã kiểm tra: máy chủ đã lưu đánh giá của bạn.';
  static const savedRefreshFailed =
      'Máy chủ đã lưu nhưng chưa tải được trạng thái mới. Hãy tải lại trước khi gửi tiếp.';
  static const notSaved =
      'Chưa xác nhận được kết quả gửi. Nội dung của bạn được giữ lại; hãy kiểm tra lại trước khi gửi tiếp.';
  static const retryAfterCheck =
      'Đã kiểm tra trạng thái mới. Bạn có thể chủ động gửi lại bản nháp.';
  static const duplicate =
      'Bạn đã có đánh giá cho người này. Đang hiển thị bản đã lưu; bản nháp vẫn được giữ trong màn hình.';
  static const conflict =
      'Đánh giá đã đổi ở phiên khác. Hãy chọn bản muốn giữ.';
  static const currentSaved = 'Bản đã lưu';
  static const yourDraft = 'Bản nháp';
  static const keepDraft = 'Giữ bản nháp của tôi';
  static const useSaved = 'Dùng bản đã lưu';
  static const retainedDraft =
      'Bản nháp chưa gửi vẫn được giữ. Bạn có thể chỉnh sửa sau khi đối chiếu nội dung đã lưu.';
  static const noComment = 'Không có nhận xét.';
  static const noSavedReview = 'Chưa có đánh giá nào được gửi cho người này.';
  static const sessionExpired =
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  static const forbidden =
      'Tài khoản này không có quyền đánh giá người hỗ trợ.';
  static const invalid =
      'Thông tin đánh giá chưa hợp lệ. Kiểm tra số sao và nhận xét.';
  static const memoryOnly =
      'Bản nháp sẽ mất khi rời màn hình hoặc đổi tài khoản.';
  static const assignmentRemoved = 'Người hỗ trợ này đã được gỡ phân công.';
  static const hidden =
      'Đánh giá đang bị ẩn và không được tính vào điểm tổng hợp.';
  static const next = 'Trang sau';
  static const previous = 'Trang trước';
  static const reviewingDeadline = 'Đang xác minh lại thời hạn với máy chủ…';
  static const countdownEnded =
      'Đã đến hạn hiển thị; đang kiểm tra lại trạng thái máy chủ.';
  static String page(int page) => 'Trang $page';
  static String stars(int value) => '$value sao';
  static String starAction(int value) => 'Chấm $value sao';
  static String completed(String date) => 'Hoàn thành: $date';
  static String deadline(String date) => 'Hạn gửi và sửa: $date';
  static String editExistingUntil(String date) =>
      'Bạn vẫn có thể sửa đánh giá đến $date.';
  static String remaining(String value) => 'Thời gian còn lại: $value';
}
