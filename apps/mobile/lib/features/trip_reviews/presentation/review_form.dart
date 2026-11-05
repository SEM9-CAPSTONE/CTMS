import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/ctms_button.dart';
import '../domain/review_models.dart';

class ReviewForm extends StatefulWidget {
  const ReviewForm({
    super.key,
    required this.target,
    required this.saved,
    required this.enabled,
    required this.saving,
    required this.onSave,
    required this.onUpload,
  });
  final ReviewTarget target;
  final SavedReview? saved;
  final bool enabled;
  final bool saving;
  final Future<bool> Function(int, String, List<String>) onSave;
  final Future<String> Function(XFile) onUpload;
  @override
  State<ReviewForm> createState() => _ReviewFormState();
}

class _ReviewFormState extends State<ReviewForm> {
  final comment = TextEditingController();
  int rating = 0;
  bool editing = false;
  bool uploading = false;
  List<String> images = [];
  String? validation;
  @override
  void initState() {
    super.initState();
    _restore();
  }

  void _restore() {
    rating = widget.saved?.rating ?? 0;
    comment.text = widget.saved?.comment ?? '';
    images = [...?widget.saved?.images];
    editing = widget.saved == null;
  }

  @override
  void dispose() {
    comment.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    final files = await ImagePicker().pickMultiImage();
    if (!mounted || files.isEmpty) return;
    if (images.length + files.length > 5) {
      setState(() => validation = 'Mỗi đánh giá tối đa 5 ảnh.');
      return;
    }
    setState(() {
      uploading = true;
      validation = null;
    });
    try {
      for (final file in files) {
        final name = file.name.toLowerCase();
        if (!RegExp(r'\.(jpg|jpeg|png|webp)$').hasMatch(name) ||
            await file.length() > 5 * 1024 * 1024) {
          throw const FormatException(
            'Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB.',
          );
        }
      }
      for (final file in files) {
        final url = await widget.onUpload(file);
        if (!mounted) return;
        setState(() => images.add(url));
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => validation = e is FormatException
              ? e.message
              : 'Tải ảnh thất bại. Vui lòng thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final canEdit = widget.enabled && !widget.saving && !uploading && editing;
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.target == ReviewTarget.trip
                        ? 'Đánh giá chuyến đi'
                        : 'Đánh giá Host',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (widget.saved != null) const Chip(label: Text('Đã gửi')),
              ],
            ),
            if (widget.saved?.editExpiresAt != null)
              Text(
                'Hạn chỉnh sửa: ${DateFormat('HH:mm dd/MM/yyyy').format(widget.saved!.editExpiresAt!.toUtc().add(const Duration(hours: 7)))}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 2,
              children: List.generate(
                5,
                (index) => Semantics(
                  label: '${index + 1} sao',
                  selected: rating == index + 1,
                  child: IconButton(
                    tooltip: '${index + 1} sao',
                    onPressed: canEdit
                        ? () => setState(() {
                            rating = index + 1;
                            validation = null;
                          })
                        : null,
                    icon: Icon(
                      index < rating
                          ? Icons.star_rounded
                          : Icons.star_outline_rounded,
                      size: 32,
                      color: index < rating
                          ? AppColors.statusWarning
                          : colors.outline,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (!editing) ...[
              Text(comment.text.isEmpty ? 'Không có nhận xét.' : comment.text),
            ] else
              TextField(
                controller: comment,
                enabled: canEdit,
                minLines: 3,
                maxLines: 6,
                maxLength: 2000,
                maxLengthEnforcement: MaxLengthEnforcement.none,
                decoration: InputDecoration(
                  labelText: 'Nhận xét (không bắt buộc)',
                  hintText: 'Chia sẻ trải nghiệm của bạn',
                  alignLabelWithHint: true,
                  border: const OutlineInputBorder(),
                  errorText: validation,
                ),
              ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final url in images)
                  SizedBox(
                    width: 88,
                    height: 88,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: InkWell(
                            onTap: () => showDialog<void>(
                              context: context,
                              builder: (context) => Dialog(
                                child: InteractiveViewer(
                                  child: Image.network(
                                    url,
                                    errorBuilder: (_, _, _) =>
                                        const Text('Không tải được ảnh.'),
                                  ),
                                ),
                              ),
                            ),
                            child: Image.network(
                              url,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) =>
                                  const Icon(Icons.broken_image_outlined),
                            ),
                          ),
                        ),
                        if (canEdit)
                          Positioned(
                            right: 0,
                            top: 0,
                            child: IconButton.filled(
                              tooltip: 'Xóa ảnh',
                              visualDensity: VisualDensity.compact,
                              icon: const Icon(Icons.close, size: 16),
                              onPressed: () =>
                                  setState(() => images.remove(url)),
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
            if (editing && widget.enabled)
              TextButton.icon(
                onPressed: canEdit && images.length < 5 ? _pickImages : null,
                icon: uploading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(),
                      )
                    : const Icon(Icons.add_photo_alternate_outlined),
                label: Text('Thêm ảnh (${images.length}/5)'),
              ),
            if (validation != null)
              Text(validation!, style: TextStyle(color: colors.error)),
            if (!editing && widget.enabled)
              OutlinedButton.icon(
                onPressed: widget.saving
                    ? null
                    : () => setState(() => editing = true),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Chỉnh sửa'),
              ),
            if (widget.saved != null && !widget.enabled && !widget.saving)
              const Text('Đã hết thời hạn chỉnh sửa.'),
            if (editing && widget.enabled) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: CtmsButton(
                  label: widget.saved == null ? 'Gửi đánh giá' : 'Lưu thay đổi',
                  isLoading: widget.saving,
                  onPressed: !canEdit
                      ? null
                      : () async {
                          if (rating < 1 ||
                              comment.text.trim().runes.length > 2000) {
                            setState(
                              () => validation = rating < 1
                                  ? 'Vui lòng chọn từ 1 đến 5 sao.'
                                  : 'Nhận xét tối đa 2.000 ký tự.',
                            );
                            return;
                          }
                          final success = await widget.onSave(
                            rating,
                            comment.text,
                            List.unmodifiable(images),
                          );
                          if (success && mounted) setState(_restore);
                        },
                ),
              ),
              if (widget.saved != null)
                TextButton(
                  onPressed: canEdit ? () => setState(_restore) : null,
                  child: const Text('Hủy'),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
