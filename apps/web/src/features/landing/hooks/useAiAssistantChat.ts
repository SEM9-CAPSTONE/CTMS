import { useState } from "react";
import { landingService } from "../services/landing.service";
import type { ChatMessage } from "../types";
import { cleanPromptText } from "../utils/landing.utils";

export function useAiAssistantChat() {
	const [chatMessage, setChatMessage] = useState("");
	const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
		{
			sender: "user",
			text: "Tôi bị bong gân mắt cá chân, hãy hướng dẫn sơ cứu nhanh.",
		},
		{
			sender: "ai",
			text: "Hướng dẫn sơ cứu R.I.C.E:\n1. Rest (Nghỉ ngơi): Ngừng vận động ngay lập tức.\n2. Ice (Chườm đá): Chườm lạnh 15-20 phút.\n3. Compression (Băng ép): Băng bó nhẹ nhàng.\n4. Elevation (Kê cao): Kê cao chân hơn tim.",
		},
	]);

	const selectPrompt = (prompt: string) => {
		const cleanPrompt = cleanPromptText(prompt);
		setChatMessage(cleanPrompt);
	};

	const sendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!chatMessage.trim()) return;

		const userMsg: ChatMessage = { sender: "user", text: chatMessage };
		setChatHistory((prev) => [...prev, userMsg]);
		setChatMessage("");

		const aiResponse = await landingService.sendAiQuery(chatMessage);
		setChatHistory((prev) => [...prev, aiResponse]);
	};

	return {
		chatMessage,
		setChatMessage,
		chatHistory,
		selectPrompt,
		sendMessage,
	};
}
