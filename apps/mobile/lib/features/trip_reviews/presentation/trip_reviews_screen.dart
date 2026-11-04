import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/api/api_exception.dart';
import '../data/reviews_api.dart';
import '../domain/review_models.dart';
import 'review_form.dart';

class TripReviewsScreen extends ConsumerStatefulWidget {
  const TripReviewsScreen({super.key, required this.booking});
  final ReviewBooking booking;
  @override
  ConsumerState<TripReviewsScreen> createState() => _TripReviewsScreenState();
}

class _TripReviewsScreenState extends ConsumerState<TripReviewsScreen>
    with WidgetsBindingObserver {
  ReviewContext? data;
  String? error;
  bool loading = true;
  bool saving = false;
  bool stale = false;
  final elapsed = Stopwatch();
  Timer? timer;
  final generations = <ReviewTarget, int>{};
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load();
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && data != null) setState(() {});
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !saving) load();
  }

  bool get editable =>
      !loading &&
      !stale &&
      data?.eligible == true &&
      (data!.expiresAt == null ||
          data!.serverTime.add(elapsed.elapsed).isBefore(data!.expiresAt!));
  Future<bool> load() async {
    if (mounted) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final next = await ref
          .read(reviewsApiProvider)
          .context(widget.booking.id);
      if (!mounted) return false;
      setState(() {
        data = next;
        stale = false;
        loading = false;
        elapsed.reset();
        elapsed.start();
      });
      return true;
    } catch (e) {
      if (mounted) {
        setState(() {
          loading = false;
          stale = true;
          error = message(e);
        });
      }
      return false;
    }
  }

  String message(Object e) {
    if (e is ApiException) {
      return switch (e.statusCode) {
        401 => 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        403 => 'Bạn không có quyền đánh giá đơn đặt chỗ này.',
        409 =>
          'Đánh giá đã thay đổi hoặc đã hết hạn. Kiểm tra dữ liệu mới trước khi gửi lại.',
        422 => 'Dữ liệu đánh giá không hợp lệ. Kiểm tra số sao và nhận xét.',
        _ =>
          'Không kết nối được máy chủ. Nội dung đang nhập được giữ lại; vui lòng thử lại.',
      };
    }
    return 'Không tải được đánh giá. Vui lòng thử lại.';
  }

  bool editableTarget(ReviewTarget target) {
    if (loading || stale || data == null) return false;
    final saved = data!.review(target);
    if (saved == null) return editable;
    return saved.canEdit &&
        saved.editExpiresAt != null &&
        data!.serverTime.add(elapsed.elapsed).isBefore(saved.editExpiresAt!);
  }

  Future<bool> save(
    ReviewTarget target,
    int rating,
    String comment,
    List<String> images,
  ) async {
    if (!editableTarget(target) || saving) return false;
    final existing = data!.review(target);
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await ref
          .read(reviewsApiProvider)
          .save(widget.booking.id, target, rating, comment, existing, images);
      final refreshed = await load();
      if (!mounted) return false;
      if (refreshed) {
        setState(() => generations[target] = (generations[target] ?? 0) + 1);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đánh giá đã được máy chủ xác nhận.')),
        );
      } else {
        setState(
          () => error =
              'Máy chủ đã nhận đánh giá nhưng chưa tải lại được. Hãy tải lại trước khi gửi tiếp.',
        );
      }
      return refreshed;
    } catch (e) {
      final notice = message(e);
      await load();
      if (mounted) setState(() => error = notice);
      return false;
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Đánh giá trải nghiệm')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: RefreshIndicator(
            onRefresh: () async {
              if (!saving) await load();
            },
            child: ListView(
              padding: const EdgeInsets.all(20),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                Text(
                  widget.booking.title,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                if (widget.booking.hostName != null)
                  Text('Host: ${widget.booking.hostName}'),
                const SizedBox(height: 16),
                if (loading) const LinearProgressIndicator(),
                if (error != null)
                  Card(
                    color: colors.errorContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            error!,
                            style: TextStyle(color: colors.onErrorContainer),
                          ),
                          TextButton(
                            onPressed: saving || loading ? null : load,
                            child: const Text('Tải lại'),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (data != null) ...[
                  Card(
                    color: colors.surfaceContainerHighest,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        stale
                            ? 'Chưa xác minh được trạng thái mới nhất. Tạm khóa gửi đánh giá.'
                            : editable
                            ? 'Bạn có thể gửi đánh giá mới đến ${DateFormat('HH:mm dd/MM/yyyy').format(data!.expiresAt!.toUtc().add(const Duration(hours: 7)))}. Đánh giá đã gửi được chỉnh sửa trong 24 giờ kể từ lần gửi đầu tiên.'
                            : data!.reason == 'PARTICIPATION_NOT_COMPLETED'
                            ? 'Đánh giá chỉ dành cho thành viên đã thực sự tham gia và hoàn thành chuyến đi.'
                            : 'Đã hết hạn gửi đánh giá mới. Đánh giá đã gửi được chỉnh sửa trong 24 giờ kể từ lần gửi đầu tiên.',
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  for (final target in ReviewTarget.values)
                    if (data!.eligible || data!.review(target) != null)
                      ReviewForm(
                        key: ValueKey(
                          '${generations[target] ?? 0}-${target.name}',
                        ),
                        target: target,
                        saved: data!.review(target),
                        enabled: editableTarget(target),
                        saving: saving || loading,
                        onUpload: ref.read(reviewsApiProvider).upload,
                        onSave: (rating, comment, images) =>
                            save(target, rating, comment, images),
                      ),
                  if (!editable && data!.reviews.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('Chưa có đánh giá nào được gửi.'),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
