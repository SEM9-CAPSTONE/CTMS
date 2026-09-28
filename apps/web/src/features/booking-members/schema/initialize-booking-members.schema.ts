import { z } from "zod";

export const participantEmailSchema = z.string().trim().email("Email người tham gia không hợp lệ");

const resolvedParticipantSchema = z.object({
	userId: z.string().uuid("Mã người tham gia không hợp lệ"),
	email: z.string().email(),
});

export function validateResolvedParticipants(
	participants: Array<{ userId: string; email: string }>,
	requiredCount: number,
	ownerId: string
): string | null {
	if (participants.length !== requiredCount) {
		return `Cần xác nhận đúng ${requiredCount} người tham gia bổ sung`;
	}
	const parsed = z.array(resolvedParticipantSchema).safeParse(participants);
	if (!parsed.success)
		return parsed.error.issues[0]?.message ?? "Danh sách người tham gia không hợp lệ";
	const ids = participants.map((participant) => participant.userId);
	if (ids.includes(ownerId)) return "Người đặt chỗ được hệ thống tự động thêm";
	if (new Set(ids).size !== ids.length) return "Một người không thể xuất hiện nhiều lần";
	return null;
}
