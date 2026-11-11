"""CTMS-29-T01. Turns an already-computed weather risk assessment
(CTMS-26's own data, passed in verbatim) into clear, actionable advice via
an LLM.

No retry/backoff loop lives here on purpose -- retries live in exactly one
place per external dependency, matching this codebase's own established
convention (services/api's WeatherService retries its own single external
call -- Open-Meteo -- rather than every hop along the way). The NestJS
`OpenAiWeatherAdviceProvider` that calls this endpoint is the layer that
retries; a failure here propagates as a real HTTP error instead of being
silently absorbed twice.
"""

import json

from openai import OpenAI

from app.models import WeatherAdvisoryRequest, WeatherAdvisoryResponse

MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = """Bạn là trợ lý an toàn thời tiết cho một nền tảng quản lý cắm trại/trekking (CTMS).

Bạn sẽ nhận một đánh giá rủi ro thời tiết ĐÃ ĐƯỢC TÍNH SẴN (risk_level, composite_score, và điểm chi tiết \
từng tiêu chí: lượng mưa, gió, nhiệt độ, tầm nhìn, dông sét). Đây là dữ liệu DUY NHẤT bạn được phép dùng.

QUY TẮC BẮT BUỘC (không được vi phạm dưới bất kỳ hình thức nào):
1. CHỈ được giải thích đúng những dữ liệu được cung cấp trong yêu cầu này. Không được bịa thêm bất kỳ \
yếu tố thời tiết, số liệu, hay điều kiện nào không có trong dữ liệu.
2. risk_level và composite_score đã được một hệ thống khác tính toán xong, KHÔNG THỂ thay đổi. Bạn không \
được đề xuất một mức rủi ro khác, không được tự tính lại điểm, không được nói rằng mức rủi ro thực tế nên \
khác đi.
3. Câu trả lời của bạn PHẢI bằng tiếng Việt.
4. Câu trả lời PHẢI có hành động cụ thể, rõ ràng để Host/Camper có thể làm theo ngay (không nói chung chung).

Trả lời CHỈ bằng JSON hợp lệ theo đúng schema sau, không thêm text nào khác ngoài JSON:
{"advice": "<đoạn giải thích ngắn gọn, rõ ràng>", "actions": ["<hành động cụ thể 1>", "<hành động cụ thể 2>", ...]}
"""


class WeatherAdvisoryService:
	"""The OpenAI client is constructor-injected (not module-level) so a
	test can substitute a fake without needing a real API key -- the same
	"fake the edge, keep the real code" boundary this codebase already
	draws in OpenMeteoWeatherProvider's own tests."""

	def __init__(self, client: OpenAI, model: str = MODEL) -> None:
		self._client = client
		self._model = model

	def generate(self, request: WeatherAdvisoryRequest) -> WeatherAdvisoryResponse:
		user_payload = request.model_dump()
		completion = self._client.chat.completions.create(
			model=self._model,
			response_format={"type": "json_object"},
			temperature=0.3,
			messages=[
				{"role": "system", "content": SYSTEM_PROMPT},
				{"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
			],
		)
		content = completion.choices[0].message.content
		if not content:
			raise ValueError("Empty response from the LLM provider")

		parsed = json.loads(content)
		# Structural enforcement of BR-076: even if the model tried to sneak
		# a risk_level/composite_score field into its JSON, WeatherAdvisoryResponse
		# has no such field to receive it -- pydantic drops unknown keys.
		return WeatherAdvisoryResponse(
			advice=parsed["advice"],
			actions=parsed["actions"],
		)
