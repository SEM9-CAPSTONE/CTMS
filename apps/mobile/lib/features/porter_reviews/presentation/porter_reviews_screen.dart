import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../application/porter_reviews_controller.dart';
import '../porter_review_strings.dart';
import 'porter_review_form.dart';

class PorterReviewsScreen extends ConsumerStatefulWidget {
  const PorterReviewsScreen({super.key, this.bookingId, this.tripTitle});
  final String? bookingId, tripTitle;
  @override
  ConsumerState<PorterReviewsScreen> createState() =>
      _PorterReviewsScreenState();
}

class _PorterReviewsScreenState extends ConsumerState<PorterReviewsScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || widget.bookingId == null) return;
      unawaited(
        ref
            .read(porterReviewsProvider)
            ?.selectTrip(
              widget.bookingId!,
              widget.tripTitle ?? PorterReviewStrings.chooseTrip,
            ),
      );
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final controller = ref.read(porterReviewsProvider);
      if (controller != null && !controller.saving) {
        unawaited(
          controller.bookingId == null
              ? controller.loadParticipations()
              : controller.refreshContext(),
        );
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _submit(PorterReviewsController controller) async {
    final result = await controller.submit();
    if (!mounted ||
        result == PorterSubmission.ignored ||
        result == PorterSubmission.conflict ||
        !identical(ref.read(porterReviewsProvider), controller)) {
      return;
    }
    final message = controller.actionMessage;
    if (message != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: result == PorterSubmission.saved
              ? AppColors.brandPrimary
              : AppColors.statusDanger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(porterReviewsProvider);
    return CtmsScaffold(
      title: PorterReviewStrings.title,
      subtitle: PorterReviewStrings.subtitle,
      actions: [
        IconButton(
          tooltip: PorterReviewStrings.refresh,
          icon: const Icon(Icons.refresh),
          onPressed:
              controller == null || controller.busy || controller.loadingList
              ? null
              : () {
                  if (controller.bookingId == null) {
                    controller.loadParticipations(
                      controller.participations?.page ?? 1,
                    );
                  } else {
                    controller.refreshContext();
                  }
                },
        ),
      ],
      body: controller == null
          ? const CtmsEmptyState(title: PorterReviewStrings.sessionExpired)
          : KeyedSubtree(
              key: ObjectKey(controller),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: RefreshIndicator(
                    onRefresh: () async {
                      if (controller.saving) return;
                      if (controller.bookingId == null) {
                        await controller.loadParticipations(
                          controller.participations?.page ?? 1,
                        );
                      } else {
                        await controller.refreshContext();
                      }
                    },
                    child: ListView(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: controller.bookingId == null
                          ? _trips(controller)
                          : _editor(controller),
                    ),
                  ),
                ),
              ),
            ),
    );
  }

  List<Widget> _trips(PorterReviewsController controller) => [
    if (controller.loadingList)
      const LinearProgressIndicator(
        semanticsLabel: PorterReviewStrings.loading,
      ),
    if (controller.listError != null)
      _error(
        controller.listError!,
        () =>
            controller.loadParticipations(controller.participations?.page ?? 1),
      ),
    if (controller.participations?.items.isEmpty == true &&
        !controller.loadingList)
      const CtmsEmptyState(title: PorterReviewStrings.noTrips),
    if (controller.participations?.items.isNotEmpty == true)
      CtmsSectionCard(
        title: PorterReviewStrings.chooseTrip,
        child: Column(
          children: [
            for (final trip in controller.participations!.items) ...[
              Material(
                type: MaterialType.transparency,
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(trip.tripTitle, style: AppTypography.bodyStrong),
                  subtitle: Text(
                    '${PorterReviewStrings.completed(_date(trip.completedAt))}\n${_reason(trip.reason)}',
                  ),
                  isThreeLine: true,
                  trailing: const Icon(Icons.chevron_right),
                  onTap: controller.loadingList
                      ? null
                      : () => controller.selectTrip(
                          trip.bookingId,
                          trip.tripTitle,
                        ),
                ),
              ),
              const Divider(height: 1),
            ],
          ],
        ),
      ),
    if (controller.participations != null) ...[
      const SizedBox(height: AppSpacing.md),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            tooltip: PorterReviewStrings.previous,
            icon: const Icon(Icons.chevron_left),
            onPressed:
                controller.loadingList || controller.participations!.page == 1
                ? null
                : () => controller.loadParticipations(
                    controller.participations!.page - 1,
                  ),
          ),
          Text(PorterReviewStrings.page(controller.participations!.page)),
          IconButton(
            tooltip: PorterReviewStrings.next,
            icon: const Icon(Icons.chevron_right),
            onPressed:
                controller.loadingList || !controller.participations!.hasMore
                ? null
                : () => controller.loadParticipations(
                    controller.participations!.page + 1,
                  ),
          ),
        ],
      ),
    ],
  ];
  List<Widget> _editor(PorterReviewsController controller) {
    final snapshot = controller.context;
    final person = controller.selected;
    final end = controller.deadline;
    final canEditExisting =
        snapshot?.reason == 'NO_ELIGIBLE_ASSIGNMENT' &&
        !controller.serverClosed &&
        !controller.stale &&
        person?.saved?.canEdit == true &&
        end != null;
    return [
      Text(
        controller.tripTitle ?? PorterReviewStrings.chooseTrip,
        style: AppTypography.h2,
      ),
      const SizedBox(height: AppSpacing.sm),
      Align(
        alignment: Alignment.centerLeft,
        child: CtmsButton(
          label: PorterReviewStrings.changeTrip,
          icon: Icons.swap_horiz,
          variant: CtmsButtonVariant.secondary,
          onPressed: controller.saving ? null : controller.changeTrip,
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      if (controller.loadingContext)
        const LinearProgressIndicator(
          semanticsLabel: PorterReviewStrings.loading,
        ),
      if (controller.error != null)
        _error(
          controller.error!,
          controller.inaccessible
              ? controller.changeTrip
              : () => controller.refreshContext(),
        ),
      if (snapshot != null) ...[
        if (controller.stale)
          const Text(
            PorterReviewStrings.stale,
            style: TextStyle(color: AppColors.statusWarning),
          ),
        Text(
          canEditExisting
              ? PorterReviewStrings.noNewReviews
              : _reason(
                  controller.serverClosed ? 'WINDOW_EXPIRED' : snapshot.reason,
                ),
          style: AppTypography.bodyStrong,
        ),
        if (canEditExisting)
          Text(
            PorterReviewStrings.editExistingUntil(_date(end)),
            style: AppTypography.caption,
          )
        else if (end != null)
          Text(
            PorterReviewStrings.deadline(_date(end)),
            style: AppTypography.caption,
          ),
        if (controller.remaining != null &&
            controller.remaining! > Duration.zero)
          Text(
            PorterReviewStrings.remaining(_duration(controller.remaining!)),
            style: AppTypography.caption,
          ),
        const SizedBox(height: AppSpacing.md),
        if (snapshot.porters.isEmpty)
          CtmsEmptyState(title: _reason(snapshot.reason))
        else
          CtmsSectionCard(
            title: snapshot.porters.length == 1
                ? PorterReviewStrings.porter
                : PorterReviewStrings.choosePorter,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (snapshot.porters.length == 1)
                  Text(
                    snapshot.porters.single.name ??
                        PorterReviewStrings.missingName,
                    style: AppTypography.bodyStrong,
                  )
                else
                  DropdownButtonFormField<String>(
                    key: ValueKey(
                      'choice:${controller.bookingId}:${controller.porterId}',
                    ),
                    initialValue: controller.porterId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      labelText: PorterReviewStrings.choosePorter,
                    ),
                    items: [
                      for (final item in snapshot.porters)
                        DropdownMenuItem(
                          value: item.id,
                          child: Text(
                            item.name ?? PorterReviewStrings.missingName,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: controller.busy
                        ? null
                        : (id) {
                            if (id != null) controller.selectPorter(id);
                          },
                  ),
                const SizedBox(height: AppSpacing.md),
                if (person != null && controller.draft != null)
                  PorterReviewForm(
                    key: ValueKey('form:${controller.bookingId}:${person.id}'),
                    controller: controller,
                    onSubmit: () => _submit(controller),
                  ),
              ],
            ),
          ),
      ],
    ];
  }

  Widget _error(String message, VoidCallback retry) => Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(message, style: const TextStyle(color: AppColors.statusDanger)),
        const SizedBox(height: AppSpacing.sm),
        CtmsButton(
          label: PorterReviewStrings.retry,
          variant: CtmsButtonVariant.secondary,
          onPressed: retry,
        ),
      ],
    ),
  );
  String _date(DateTime value) =>
      DateFormat('HH:mm dd/MM/yyyy').format(value.toLocal());
  String _duration(Duration value) =>
      '${value.inHours.toString().padLeft(2, '0')}:${(value.inMinutes % 60).toString().padLeft(2, '0')}:${(value.inSeconds % 60).toString().padLeft(2, '0')}';
  String _reason(String? reason) => switch (reason) {
    'WINDOW_EXPIRED' => PorterReviewStrings.expired,
    'NO_ELIGIBLE_ASSIGNMENT' => PorterReviewStrings.noPorters,
    'PARTICIPATION_NOT_COMPLETED' => PorterReviewStrings.incomplete,
    _ => PorterReviewStrings.available,
  };
}
