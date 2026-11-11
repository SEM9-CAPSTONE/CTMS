import { Bot, Send, Sparkles } from "lucide-react";
import type React from "react";
import { AI_PROMPTS } from "../constants";
import { useAiAssistantChat } from "../hooks/useAiAssistantChat";

export const AiAssistantSection: React.FC = () => {
	const { chatMessage, setChatMessage, chatHistory, selectPrompt, sendMessage } =
		useAiAssistantChat();

	return (
		<section className="mb-16 grid grid-cols-1 items-center gap-10 rounded-[36px] bg-[#143b25] p-8 text-white md:p-11 lg:grid-cols-[1.1fr_1fr]">
			<div>
				<div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-xs font-bold text-[#a8d5b4]">
					<Sparkles size={15} />
					<span>CÔNG NGHỆ MỚI</span>
				</div>
				<h2 className="mb-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
					Trợ lý sinh tồn AI
				</h2>
				<p className="mb-7 text-base leading-relaxed text-[#c3d9c7]">
					Sẵn sàng phản hồi mọi thắc mắc, nêu ý kiến về nguy cơ và hỗ trợ kỹ năng 24/7 bằng ngôn ngữ
					tự nhiên.
				</p>
				<div className="flex flex-col gap-3">
					{AI_PROMPTS.map((prompt) => (
						<button
							key={prompt}
							type="button"
							className="cursor-pointer rounded-2xl border border-white/15 bg-white/8 px-4.5 py-3.5 text-left text-sm text-[#e2f0e4] transition hover:translate-x-1 hover:bg-white/16"
							onClick={() => selectPrompt(prompt)}
						>
							{prompt}
						</button>
					))}
				</div>
			</div>

			<div>
				<div className="rounded-3xl bg-white p-6 text-[#10221b] shadow-2xl">
					<div className="mb-4 flex items-center justify-between border-b border-[#dfe8df] pb-4">
						<div className="flex items-center gap-3 text-[#1c442f]">
							<Bot size={20} />
							<div>
								<strong className="block text-base font-bold text-[#10221b]">
									Trợ lý Sinh tồn CTMS
								</strong>
								<span className="text-xs text-[#425048]">Trợ lý vận hành 24/7</span>
							</div>
						</div>
						<div className="rounded-full bg-[#e8f5e9] px-2.5 py-1 text-[0.78rem] font-bold text-[#2e7d32]">
							Hoạt động 24/7
						</div>
					</div>

					<div className="mb-4 flex max-h-[260px] flex-col gap-3 overflow-y-auto pr-1.5">
						{chatHistory.map((msg) => (
							<div
								key={msg.id ?? `${msg.sender}-${msg.text.slice(0, 10)}`}
								className={
									msg.sender === "user"
										? "max-w-[85%] self-end rounded-2xl bg-[#eaf3eb] px-4.5 py-3 text-sm font-semibold text-[#1c442f]"
										: "max-w-[90%] self-start rounded-2xl border border-[#dfe8df] bg-[#f5f7f4] px-4.5 py-3 text-sm text-[#10221b]"
								}
							>
								<p className="m-0 whitespace-pre-line">{msg.text}</p>
							</div>
						))}
					</div>

					<form
						onSubmit={sendMessage}
						className="flex items-center rounded-full border border-[#dfe8df] bg-[#f5f7f4] py-1.5 pl-4.5 pr-1.5"
					>
						<input
							type="text"
							placeholder="Nhập câu hỏi của bạn..."
							value={chatMessage}
							onChange={(e) => setChatMessage(e.target.value)}
							className="w-full bg-transparent text-sm outline-none"
						/>
						<button
							type="submit"
							className="flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#1c442f] text-white transition hover:bg-[#143323]"
						>
							<Send size={16} />
						</button>
					</form>
				</div>
			</div>
		</section>
	);
};
