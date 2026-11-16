import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../gps_tracking/application/gps_location_source.dart';
import '../../offline_packages/application/offline_trip_providers.dart';
import '../../sync/application/connectivity_source.dart';
import '../application/survival_chat_controller.dart';
import '../data/survival_chat_api.dart';
import '../data/survival_local_model.dart';
import 'widgets/ai_answer_feedback_actions.dart';

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

class CamperAiAssistantScreen extends ConsumerStatefulWidget {
  const CamperAiAssistantScreen({super.key, this.trip});

  final OfflineTripSelection? trip;

  @override
  ConsumerState<CamperAiAssistantScreen> createState() =>
      _CamperAiAssistantScreenState();
}

class _CamperAiAssistantScreenState
    extends ConsumerState<CamperAiAssistantScreen> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();

  String? _inputError;
  String? _modelError;
  int? _downloadBytes;

  Future<void> _showCurrentLocation() async {
    const gps = GeolocatorLocationSource();
    var message = 'Không lấy được vị trí hiện tại. Hãy kiểm tra quyền vị trí.';
    try {
      var permission = await gps.checkPermission();
      if (permission == GpsPermissionState.denied) {
        permission = await gps.requestPermission();
      }
      if (permission == GpsPermissionState.granted) {
        final fix = await gps.currentSample(
          timeLimit: const Duration(seconds: 8),
        );
        if (DateTime.now().difference(fix.capturedAt).abs() <=
            const Duration(seconds: 30)) {
          message =
              'Vĩ độ ${fix.latitude.toStringAsFixed(5)}\n'
              'Kinh độ ${fix.longitude.toStringAsFixed(5)}';
        }
      }
    } catch (_) {
      // Missing GPS and permission failures do not block the SOS workflow.
    }
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Vị trí hiện tại'),
        content: SelectableText(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  Future<void> _downloadModel(SurvivalLocalModel model) async {
    if (_downloadBytes != null) return;
    setState(() {
      _downloadBytes = 0;
      _modelError = null;
    });
    try {
      if (!await ref.read(connectivitySourceProvider).isConnected()) {
        if (mounted) {
          setState(() => _modelError = 'Hãy kết nối mạng để tải trợ lý.');
        }
        return;
      }
      await model.download((bytes) {
        final previous = _downloadBytes;
        if (mounted && previous != null && bytes - previous >= 1024 * 1024) {
          setState(() => _downloadBytes = bytes);
        }
      });
      if (mounted) ref.invalidate(survivalLocalModelReadyProvider);
    } on LocalModelFailure catch (error) {
      if (mounted) {
        setState(() {
          _modelError = error == LocalModelFailure.storage
              ? 'Thiết bị không đủ dung lượng để tải trợ lý.'
              : 'Chưa tải được trợ lý. Bạn có thể thử lại.';
        });
      }
    } finally {
      if (mounted) setState(() => _downloadBytes = null);
    }
  }

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
    final question = query.trim();
    if (question.isEmpty ||
        question.length > survivalQuestionLimit ||
        question.contains('\u0000')) {
      setState(() {
        _inputError = question.isEmpty
            ? 'Hãy nhập câu hỏi.'
            : 'Nhập câu hỏi hợp lệ, tối đa 2.000 ký tự.';
      });
      return;
    }
    final account = ref.read(survivalChatAccountProvider);
    final trip = widget.trip;
    if (ref
        .read(survivalChatControllerProvider.notifier)
        .send(question, trip: trip?.accountId == account ? trip : null)) {
      _inputController.clear();
      setState(() => _inputError = null);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scrollController.hasClients) {
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
    final turns = ref.watch(survivalChatControllerProvider);
    final account = ref.watch(survivalChatAccountProvider);
    final model = ref.watch(survivalLocalModelProvider);
    final modelReady =
        model.supported &&
        (ref.watch(survivalLocalModelReadyProvider).valueOrNull ?? false);
    final pending = turns.any((turn) => turn.pending);
    ref.listen(survivalChatControllerProvider, (_, _) => _scrollToBottom());
    ref.listen(survivalChatAccountProvider, (previous, next) {
      if (previous != next) {
        _inputController.clear();
        setState(() {
          _inputError = null;
          _modelError = null;
        });
      }
    });
    return CtmsScaffold(
      title: 'Trợ lý AI',
      subtitle: 'Sơ cứu và sinh tồn khi đi trekking',
      isConnected: null,
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
                            child: const Icon(
                              Icons.smart_toy_rounded,
                              color: AppColors.brandPrimary,
                              size: 20,
                            ),
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
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (account != null && model.supported && !modelReady)
                        TextButton(
                          onPressed: pending || _downloadBytes != null
                              ? null
                              : () => _downloadModel(model),
                          child: const Text(
                            'Tải trợ lý để dùng khi mất mạng · 491 MB',
                          ),
                        ),
                      if (_downloadBytes case final bytes?)
                        LinearProgressIndicator(
                          value: bytes / survivalModelRelease.byteLength,
                          semanticsLabel: 'Đang tải trợ lý',
                        ),
                      if (_modelError case final message?)
                        Text(message, style: AppTypography.caption),
                      const SizedBox(height: AppSpacing.md),
                      const Text(
                        'Chọn câu hỏi gợi ý hoặc nhập câu hỏi của bạn.',
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children:
                            [
                              if (widget.trip?.accountId == account &&
                                  widget.trip != null)
                                'Gói đã lưu có bao nhiêu điểm dừng?',
                              ..._quickPrompts,
                            ].map((prompt) {
                              return GestureDetector(
                                onTap: pending
                                    ? null
                                    : () => _sendMessage(prompt),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 7,
                                  ),
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
                for (final turn in turns)
                  Column(
                    key: PageStorageKey(turn.id),
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _ChatBubble(
                        message: _ChatMessage(
                          text: turn.question,
                          isUser: true,
                          timestamp: 'Bạn',
                        ),
                      ),
                      if (turn.answer case final answer?)
                        _ChatBubble(
                          feedback: AiAnswerFeedbackActions(turn: turn),
                          sources: answer.isLocal ? null : answer.sources,
                          message: _ChatMessage(
                            text: answer.text,
                            isUser: false,
                            timestamp: switch (answer.snapshotVersion) {
                              final version? => 'Gói đã lưu · Bản $version',
                              _ => answer.isLocal ? 'Gợi ý từ AI' : 'Trợ lý AI',
                            },
                          ),
                        ),
                      if (turn.pending)
                        Semantics(
                          liveRegion: true,
                          child: const Padding(
                            padding: EdgeInsets.only(bottom: AppSpacing.md),
                            child: Text(
                              'Đang tìm hướng dẫn…',
                              style: AppTypography.caption,
                            ),
                          ),
                        ),
                      if (turn.failure case final failure?)
                        Semantics(
                          liveRegion: true,
                          child: Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  failure.message,
                                  style: AppTypography.body,
                                ),
                                if (failure.emergency &&
                                    GoRouter.maybeOf(context) != null)
                                  TextButton(
                                    onPressed: () =>
                                        context.go('/camper/trips'),
                                    child: const Text(
                                      'Mở chuyến đi để gửi SOS',
                                    ),
                                  ),
                                if (failure.emergency)
                                  TextButton(
                                    onPressed: _showCurrentLocation,
                                    child: const Text('Xem vị trí hiện tại'),
                                  ),
                                if (failure.retryable)
                                  TextButton(
                                    onPressed: pending
                                        ? null
                                        : () => ref
                                              .read(
                                                survivalChatControllerProvider
                                                    .notifier,
                                              )
                                              .retry(turn),
                                    child: const Text('Thử lại'),
                                  ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
              ],
            ),
          ),

          // Bottom Input Bar
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(
                top: BorderSide(color: AppColors.border, width: 1.0),
              ),
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
                        textInputAction: TextInputAction.send,
                        onChanged: (_) {
                          if (_inputError != null) {
                            setState(() => _inputError = null);
                          }
                        },
                        onSubmitted: _sendMessage,
                        style: AppTypography.body.copyWith(
                          color: AppColors.textPrimary,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Hỏi trợ lý sinh tồn...',
                          errorText: _inputError,
                          hintStyle: AppTypography.body.copyWith(
                            color: AppColors.textSecondary,
                          ),
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
                      icon: const Icon(
                        Icons.send_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                      onPressed: pending
                          ? null
                          : () => _sendMessage(_inputController.text),
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
  const _ChatBubble({required this.message, this.sources, this.feedback});

  final _ChatMessage message;
  final List<SurvivalChatSource>? sources;
  final Widget? feedback;

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        mainAxisAlignment: isUser
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
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
              child: const Icon(
                Icons.smart_toy_rounded,
                size: 16,
                color: AppColors.brandPrimary,
              ),
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
                border: isUser
                    ? null
                    : Border.all(color: AppColors.border, width: 1.0),
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
                  if (sources case final sources?)
                    _AnswerSources(sources: sources),
                  ?feedback,
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.bottomRight,
                    child: Text(
                      message.timestamp,
                      style: TextStyle(
                        fontSize: 10,
                        color: isUser
                            ? Colors.white.withValues(alpha: 0.7)
                            : AppColors.textSecondary,
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

class _AnswerSources extends StatelessWidget {
  const _AnswerSources({required this.sources});

  final List<SurvivalChatSource> sources;

  @override
  Widget build(BuildContext context) {
    final detailStyle = AppTypography.caption.copyWith(
      color: AppColors.textSecondary,
    );
    if (sources.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: AppSpacing.sm),
        child: Text('Không có thông tin nguồn', style: detailStyle),
      );
    }

    final groups = <(String, String), List<SurvivalChatSource>>{};
    for (final source in sources) {
      groups
          .putIfAbsent((source.documentId, source.documentVersionId), () => [])
          .add(source);
    }
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      minTileHeight: 48,
      childrenPadding: const EdgeInsets.only(bottom: AppSpacing.xs),
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      shape: const Border(),
      collapsedShape: const Border(),
      textColor: AppColors.brandPrimary,
      iconColor: AppColors.brandPrimary,
      collapsedTextColor: AppColors.brandPrimary,
      collapsedIconColor: AppColors.brandPrimary,
      title: Text(
        'Nguồn tham khảo (${groups.length})',
        style: AppTypography.caption,
      ),
      children: [
        for (final group in groups.values)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: _sourceDetails(group, detailStyle),
          ),
      ],
    );
  }

  Widget _sourceDetails(List<SurvivalChatSource> group, TextStyle detailStyle) {
    final versions = group
        .map((source) => source.sourceVersion)
        .nonNulls
        .toSet();
    final pages = {
      for (final source in group)
        for (final location in source.locations) location.page,
    }.toList()..sort();
    final details = [
      if (versions.length == 1) 'Phiên bản ${versions.single}',
      if (pages.isNotEmpty) 'Trang ${pages.join(', ')}',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(group.first.title, style: AppTypography.body),
        if (details.isNotEmpty) Text(details.join(' · '), style: detailStyle),
      ],
    );
  }
}
