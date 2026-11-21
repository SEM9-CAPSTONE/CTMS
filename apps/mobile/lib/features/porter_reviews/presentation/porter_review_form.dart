import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../application/porter_reviews_controller.dart';
import '../domain/porter_review_models.dart';
import '../porter_review_strings.dart';

class PorterReviewForm extends StatefulWidget {
  const PorterReviewForm({
    super.key,
    required this.controller,
    required this.onSubmit,
  });
  final PorterReviewsController controller;
  final Future<void> Function() onSubmit;
  @override
  State<PorterReviewForm> createState() => _PorterReviewFormState();
}

class _PorterReviewFormState extends State<PorterReviewForm> {
  late TextEditingController comment;
  PorterReviewDraft? bound;
  @override
  void initState() {
    super.initState();
    _bind();
  }

  void _bind() {
    bound = widget.controller.draft;
    comment = TextEditingController(text: bound?.comment ?? '');
  }

  @override
  void didUpdateWidget(covariant PorterReviewForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(bound, widget.controller.draft)) {
      comment.dispose();
      _bind();
    }
  }

  @override
  void dispose() {
    comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final value = controller.draft!;
    final person = controller.selected!;
    final saved = person.saved;
    final editable = controller.canEditSelected && value.editing;
    final editing =
        value.editing && (controller.canEditSelected || value.conflict);
    final hasChanges = saved == null
        ? value.rating != 0 || value.comment.isNotEmpty
        : !value.matches(saved);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!person.assigned && saved != null) ...[
          const Text(
            PorterReviewStrings.assignmentRemoved,
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (saved?.moderationStatus == 'hidden') ...[
          const Text(PorterReviewStrings.hidden, style: AppTypography.caption),
          const SizedBox(height: AppSpacing.md),
        ],
        if (value.conflict && saved != null) ...[
          const Text(
            PorterReviewStrings.conflict,
            style: TextStyle(
              color: AppColors.statusWarning,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            PorterReviewStrings.currentSaved,
            style: AppTypography.bodyStrong,
          ),
          Text(PorterReviewStrings.stars(saved.rating)),
          Text(saved.comment ?? PorterReviewStrings.noComment),
          const Divider(height: 28),
          const Text(
            PorterReviewStrings.yourDraft,
            style: AppTypography.bodyStrong,
          ),
        ],
        if (!value.conflict || saved == null)
          const Text(
            PorterReviewStrings.ratingLabel,
            style: AppTypography.bodyStrong,
          ),
        Semantics(
          container: true,
          child: Wrap(
            children: [
              for (var index = 1; index <= 5; index++)
                Semantics(
                  button: true,
                  selected: (editing ? value.rating : saved?.rating) == index,
                  label: PorterReviewStrings.starAction(index),
                  onTap: editable ? () => controller.setRating(index) : null,
                  child: ExcludeSemantics(
                    child: IconButton(
                      tooltip: PorterReviewStrings.starAction(index),
                      onPressed: editable
                          ? () => controller.setRating(index)
                          : null,
                      icon: Icon(
                        index <= (editing ? value.rating : saved?.rating ?? 0)
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        color: AppColors.statusWarning,
                        size: 32,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (editing)
          TextField(
            key: const ValueKey('porter-review-comment'),
            controller: comment,
            enabled: editable,
            minLines: 3,
            maxLines: 6,
            onChanged: controller.setComment,
            decoration: InputDecoration(
              labelText: PorterReviewStrings.commentLabel,
              hintText: PorterReviewStrings.commentHint,
              alignLabelWithHint: true,
              border: const OutlineInputBorder(),
              counterText: '${value.commentLength}/2000',
              errorText: value.commentLength > 2000
                  ? PorterReviewStrings.commentTooLong
                  : null,
            ),
          )
        else
          Text(
            saved == null
                ? PorterReviewStrings.noSavedReview
                : saved.comment ?? PorterReviewStrings.noComment,
          ),
        const SizedBox(height: AppSpacing.md),
        if (value.conflict && saved != null)
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              CtmsButton(
                label: PorterReviewStrings.keepDraft,
                onPressed: controller.canEditSelected
                    ? controller.keepDraft
                    : null,
              ),
              CtmsButton(
                label: PorterReviewStrings.useSaved,
                variant: CtmsButtonVariant.secondary,
                onPressed: controller.busy ? null : controller.useSaved,
              ),
            ],
          )
        else if (editing)
          SizedBox(
            width: double.infinity,
            child: Opacity(
              opacity: controller.canSubmit || controller.saving ? 1 : 0.42,
              child: CtmsButton(
                label: saved == null
                    ? PorterReviewStrings.save
                    : PorterReviewStrings.saveEdit,
                isLoading: controller.saving,
                onPressed: controller.canSubmit ? widget.onSubmit : null,
              ),
            ),
          )
        else if (saved != null && saved.canEdit)
          CtmsButton(
            label: PorterReviewStrings.edit,
            onPressed: controller.canEditSelected ? controller.edit : null,
          ),
        if (value.retained && !editing) ...[
          const SizedBox(height: AppSpacing.sm),
          const Text(
            PorterReviewStrings.retainedDraft,
            style: AppTypography.caption,
          ),
        ],
        if ((value.editing || value.retained) && hasChanges) ...[
          const SizedBox(height: AppSpacing.sm),
          const Text(
            PorterReviewStrings.memoryOnly,
            style: AppTypography.caption,
          ),
        ],
      ],
    );
  }
}
