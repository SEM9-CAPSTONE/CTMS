export const DEFAULT_AUDIT_LOGS_PAGE = 1;
export const DEFAULT_AUDIT_LOGS_LIMIT = 20;

export const OUTCOME_OPTIONS = [
	{ value: "success", label: "Thành công (Success)" },
	{ value: "failure", label: "Thất bại (Failure)" },
] as const;

/** Maps raw action strings to human-readable Vietnamese labels */
export const ACTION_LABELS: Record<string, string> = {
	"booking.refund_processed": "Tiếp nhận yêu cầu hoàn tiền",
	"booking.refund_approved": "Duyệt yêu cầu hoàn tiền",
	"booking.refund_confirmed": "Xác nhận chuyển tiền hoàn cho khách",
	"booking.refund_rejected": "Từ chối yêu cầu hoàn tiền",
	"financial.reconciliation_created": "Ghi nhận khoản hoàn hoặc thu hồi sau quyết toán",
	"financial.reconciliation_resolved": "Ghi nhận kết quả thu hồi",
	"financial.host_account_consolidated": "Gom dữ liệu người tổ chức về tài khoản chính",
	"auth.register": "Đăng ký tài khoản",
	"auth.verify_otp": "Xác thực OTP",
	"auth.login": "Đăng nhập",
	"auth.logout": "Đăng xuất",
	"auth.logout_all_devices": "Đăng xuất tất cả thiết bị",
	"auth.token_refreshed": "Làm mới phiên đăng nhập",
	"auth.password_reset": "Đặt lại mật khẩu",
	"user.account_locked": "Khóa tài khoản",
	"user.account_unlocked": "Mở khóa tài khoản",
	"profile.updated": "Cập nhật hồ sơ",
	"health_profile.updated": "Cập nhật hồ sơ sức khoẻ",
	"health_profile.consent_granted": "Đồng ý chia sẻ dữ liệu sức khoẻ",
	"health_profile.consent_revoked": "Thu hồi đồng ý chia sẻ dữ liệu",
};

/** Maps target type strings to human-readable Vietnamese labels */
export const TARGET_TYPE_LABELS: Record<string, string> = {
	payment: "Giao dịch thanh toán",
	financial_adjustment: "Khoản hoàn sau quyết toán",
	host_wallet: "Ví người tổ chức",
	user: "Người dùng",
	health_profile: "Hồ sơ sức khoẻ",
	session: "Phiên đăng nhập",
};
