import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_scaffold.dart';

class _ChatMessage {
  const _ChatMessage({
    required this.text,
    required this.isUser,
    required this.timestamp,
  });

  final String text;
  final bool isUser;
  final String timestamp;
}

class CamperAiAssistantScreen extends StatefulWidget {
  const CamperAiAssistantScreen({super.key});

  @override
  State<CamperAiAssistantScreen> createState() => _CamperAiAssistantScreenState();
}

class _CamperAiAssistantScreenState extends State<CamperAiAssistantScreen> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();

  final List<_ChatMessage> _messages = [
    const _ChatMessage(
      text: 'Xin chào bạn! Tôi là Trợ lý sinh tồn CTMS. Tôi luôn sẵn sàng tư vấn trang bị cần thiết, kỹ năng an toàn dã ngoại, nhận diện địa hình hoặc sơ cứu chấn thương khi trekking.',
      isUser: false,
      timestamp: 'Vừa xong',
    ),
  ];

  static const _quickPrompts = [
    'Cần chuẩn bị gì cho cung Tà Năng 3 ngày?',
    'Cách xử lý khi bị trật khớp cổ chân?',
    'Cách dựng lều an toàn khi có mưa dông?',
    'Làm sao lọc nước uống an toàn trong rừng?',
  ];

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _sendMessage(String query) {
    final text = query.trim();
    if (text.isEmpty) return;

    _inputController.clear();
    setState(() {
      _messages.add(
        _ChatMessage(
          text: text,
          isUser: true,
          timestamp: 'Bây giờ',
        ),
      );
    });

    _scrollToBottom();

    // Simulated responsive AI reply
    Future.delayed(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      String reply = 'Tôi đã nhận được câu hỏi: "$text".\n\n'
          'Đối với địa hình rừng núi, bạn hãy luôn ưu tiên:\n'
          '1. Giữ liên lạc với Porter hoặc Đội cứu hộ CTMS.\n'
          '2. Không rời khỏi lối mòn (trail) đã được đánh dấu GPS.\n'
          '3. Luôn bảo toàn năng lượng và nguồn nước sinh hoạt.';

      if (text.contains('Tà Năng')) {
        reply = 'Chuẩn bị cho cung Tà Năng – Phan Dũng (3 ngày 2 đêm):\n'
            '• Nước uống: Tối thiểu 3-4 lít (có trạm tiếp nước ở đồi thông).\n'
            '• Giày trekking bám tốt chống trượt trên dốc đất đỏ.\n'
            '• Áo mưa bộ, túi chống nước cho thiết bị điện tử.\n'
            '• Lương khô, điện giải và bộ sơ cứu cá nhân cơ bản.';
      } else if (text.contains('trật khớp') || text.contains('cổ chân')) {
        reply = 'Sơ cứu chấn thương cổ chân theo nguyên tắc R.I.C.E:\n'
            '• Rest (Nghỉ ngơi): Dừng di chuyển ngay lập tức.\n'
            '• Ice (Chườm lạnh): Dùng khăn ướt suối lạnh chườm giảm sưng.\n'
            '• Compression (Băng ép): Dùng băng thun cố định cổ chân vừa phải.\n'
            '• Elevation (Kê cao): Kê chân cao hơn tim khi ngồi nghỉ.\n'
            'Hãy thông báo ngay cho Porter phụ trách để hỗ trợ di chuyển!';
      } else if (text.contains('mưa dông') || text.contains('dựng lều')) {
        reply = 'Nguyên tắc dựng lều khi có mưa dông:\n'
            '• Tránh lòng suối cạn hoặc khe vực (nguy cơ lũ quét).\n'
            '• Tránh cây cao đơn độc giữa đồi (nguy cơ sét đánh).\n'
            '• Chọn bãi đất hơi thoai thoải, đóng cọc lều nghiêng 45 độ ngược hướng gió.\n'
            '• Trải tấm bạt chống thấm đáy lều và cố định dây chằng chắc chắn.';
      }

      setState(() {
        _messages.add(
          _ChatMessage(
            text: reply,
            isUser: false,
            timestamp: 'Vừa xong',
          ),
        );
      });
      _scrollToBottom();
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return CtmsScaffold(
      title: 'Trợ lý AI',
      subtitle: 'Hỗ trợ an toàn & sinh tồn dã ngoại 24/7',
      body: Column(
        children: [
          // Chat Stream Area
          Expanded(
            child: ListView(
              controller: _scrollController,
              padding: const EdgeInsets.all(AppSpacing.xxl),
              children: [
                // Welcome Info Card
                Container(
                  padding: const EdgeInsets.all(AppSpacing.cardPadding),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppRadius.cardBorderRadius,
                    border: Border.all(color: AppColors.border, width: 1.0),
                    boxShadow: AppColors.cardShadowSm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.brandBg,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: const Icon(Icons.smart_toy_rounded, color: AppColors.brandPrimary, size: 20),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Trợ lý sinh tồn CTMS AI',
                                  style: AppTypography.h3.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const Text('Sẵn sàng hỗ trợ trực tuyến & ngoại tuyến', style: AppTypography.caption),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const Text(
                        'Bạn có thể bấm vào gợi ý nhanh bên dưới hoặc tự nhập câu hỏi về chuyến đi của mình:',
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _quickPrompts.map((prompt) {
                          return GestureDetector(
                            onTap: () => _sendMessage(prompt),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                              decoration: BoxDecoration(
                                color: AppColors.brandBg,
                                borderRadius: AppRadius.pillBorderRadius,
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Text(
                                prompt,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: AppSpacing.lg),

                // Message bubbles
                ..._messages.map((msg) => _ChatBubble(message: msg)),
              ],
            ),
          ),

          // Bottom Input Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.border, width: 1.0)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x06164027),
                  blurRadius: 10,
                  offset: Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.brandBg,
                        borderRadius: AppRadius.pillBorderRadius,
                        border: Border.all(color: AppColors.border),
                      ),
                      child: TextField(
                        controller: _inputController,
                        onSubmitted: _sendMessage,
                        style: AppTypography.body.copyWith(color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          hintText: 'Hỏi trợ lý sinh tồn...',
                          hintStyle: AppTypography.body.copyWith(color: AppColors.textSecondary),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          filled: false,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg,
                            vertical: AppSpacing.sm,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Container(
                    decoration: const BoxDecoration(
                      color: AppColors.brandPrimary,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                      onPressed: () => _sendMessage(_inputController.text),
                      tooltip: 'Gửi câu hỏi',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.message});

  final _ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              padding: const EdgeInsets.all(6),
              margin: const EdgeInsets.only(right: 8, top: 2),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.border),
              ),
              child: const Icon(Icons.smart_toy_rounded, size: 16, color: AppColors.brandPrimary),
            ),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.cardPadding),
              decoration: BoxDecoration(
                color: isUser ? AppColors.brandPrimary : Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isUser ? 16 : 4),
                  bottomRight: Radius.circular(isUser ? 4 : 16),
                ),
                border: isUser ? null : Border.all(color: AppColors.border, width: 1.0),
                boxShadow: AppColors.cardShadowSm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.text,
                    style: TextStyle(
                      color: isUser ? Colors.white : AppColors.textPrimary,
                      fontSize: 14,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.bottomRight,
                    child: Text(
                      message.timestamp,
                      style: TextStyle(
                        fontSize: 10,
                        color: isUser ? Colors.white.withValues(alpha: 0.7) : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
