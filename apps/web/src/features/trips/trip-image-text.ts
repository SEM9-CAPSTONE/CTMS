// This app currently has no i18n runtime. Keep new image strings paired for both locales.
const messages = {
	vi: {
		pickerTitle: "Hình ảnh chuyến đi",
		dropPrompt: "Kéo thả hình ảnh vào đây",
		or: "hoặc",
		choose: "Chọn ảnh",
		coverBadge: "Ảnh bìa",
		constraints: "Tối đa 5 ảnh • JPG, PNG, WebP • Tối đa 5MB/ảnh",
		title: "Ảnh chuyến đi",
		add: "Thêm ảnh",
		remove: "Xóa ảnh",
		cover: "Ảnh đại diện",
		hint: "Tối đa 5 ảnh, mỗi ảnh 5 MB (JPG, PNG, WebP). Ảnh tải lên đầu tiên là ảnh đại diện.",
		invalid: "Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.",
		limit: "Mỗi chuyến đi chỉ được có tối đa 5 ảnh.",
		failed: "Không thể cập nhật ảnh. Vui lòng thử lại.",
		loading: "Đang tải ảnh…",
		retry: "Thử lại",
		queued: "Đã xóa bản ghi ảnh. File đang được xóa khỏi storage.",
		createHint:
			"Chọn tối đa 5 ảnh cho chuyến đi. Ảnh đầu tiên là ảnh đại diện; ảnh sẽ được tải lên khi lưu.",
		createUploadFailed:
			"Trip đã được lưu nhưng chưa tải đủ ảnh. Bấm Thử lại để tiếp tục tải ảnh, không tạo trip mới.",
	},
	en: {
		pickerTitle: "Trip images",
		dropPrompt: "Drag and drop images here",
		or: "or",
		choose: "Choose images",
		coverBadge: "Cover image",
		constraints: "Up to 5 images • JPG, PNG, WebP • Up to 5MB each",
		title: "Trip images",
		add: "Add image",
		remove: "Remove image",
		cover: "Thumbnail",
		hint: "Up to 5 images, 5 MB each (JPG, PNG, WebP). The first upload is the thumbnail.",
		invalid: "Choose a JPG, PNG or WebP image up to 5 MB.",
		limit: "A trip can contain at most 5 images.",
		failed: "Could not update images. Please retry.",
		loading: "Loading images…",
		retry: "Retry",
		queued: "Image record removed. Storage deletion is queued.",
		createHint:
			"Choose up to 5 trip images. The first image is the thumbnail; images upload when you save.",
		createUploadFailed:
			"The trip was saved, but some images could not be uploaded. Retry to continue uploading without creating another trip.",
	},
};
export function tripImageText(
	locale = typeof document === "undefined" ? "vi" : document.documentElement.lang
) {
	return locale.startsWith("en") ? messages.en : messages.vi;
}
