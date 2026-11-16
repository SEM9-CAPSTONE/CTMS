// Keep this versioned artifact for traces recorded by this runtime configuration.
const localRuntimeConfigV1 = 'ctms-069-local-fllama-v1';
const localContextTokensV1 = 2048;
const localBatchTokensV1 = 128;
const localThreadsV1 = 2;
const localUseMlockV1 = false;
const localOutputTokensV1 = 220;
const localTemperatureV1 = 0.2;
const localStopV1 = ['<|im_end|>', '<|endoftext|>'];
const localTimeoutV1 = Duration(seconds: 45);

String renderLocalPromptV1(String question) {
  final input = question.replaceAll('<|', '‹|').replaceAll('|>', '|›');
  return '<|im_start|>system\n'
      'Trả lời ngắn gọn bằng tiếng Việt. Chỉ đưa lời khuyên chuẩn bị '
      'trekking và sinh tồn phổ thông. Không chẩn đoán, kê thuốc, '
      'hướng dẫn thủ thuật hay khẳng định tình trạng thực tế. '
      'Không nhận là CTMS đã kiểm chứng. Nếu không an toàn, chỉ trả '
      'lời TỪ CHỐI.<|im_end|>\n'
      '<|im_start|>user\n$input<|im_end|>\n<|im_start|>assistant\n';
}
