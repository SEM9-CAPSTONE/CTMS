import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import '../data/porter_reviews_api.dart';
import '../domain/porter_review_models.dart';
import '../porter_review_strings.dart';

enum PorterSubmission { saved, conflict, duplicate, failed, ignored }

class PorterReviewsController extends ChangeNotifier {
  PorterReviewsController(this.api, {Duration Function()? elapsedForDisplay})
    : _displayElapsed = elapsedForDisplay {
    unawaited(loadParticipations());
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }
  final PorterReviewsApi api;
  final Duration Function()? _displayElapsed;
  PorterParticipationPage? participations;
  PorterReviewContext? context;
  String? bookingId, tripTitle, porterId, error, listError, actionMessage;
  bool loadingList = false,
      loadingContext = false,
      saving = false,
      stale = false;
  bool inaccessible = false, serverClosed = false, _disposed = false;
  int _listRequest = 0, _contextRequest = 0;
  final _drafts = <String, PorterReviewDraft>{};
  final _elapsed = Stopwatch();
  final _checkedDeadlines = <String>{};
  late final Timer _ticker;
  _PendingWrite? _pendingWrite;

  ReviewPorter? get selected => context?.porter(porterId ?? '');
  String _key(String porter) => '$bookingId:$porter';
  PorterReviewDraft? get draft =>
      porterId == null ? null : _drafts[_key(porterId!)];
  bool get busy => saving || loadingContext;
  bool get canEditSelected {
    final person = selected;
    return person != null &&
        !busy &&
        !stale &&
        !inaccessible &&
        !serverClosed &&
        (person.saved?.canEdit ?? person.canCreate);
  }

  bool get canSubmit {
    final value = draft;
    return canEditSelected &&
        value != null &&
        value.editing &&
        value.rating >= 1 &&
        value.rating <= 5 &&
        !value.conflict &&
        (selected!.saved == null || !value.matches(selected!.saved!));
  }

  DateTime? get deadline =>
      selected?.saved?.editExpiresAt ?? context?.expiresAt;
  Duration? get remaining {
    final snapshot = context;
    final end = deadline;
    if (snapshot == null || end == null) return null;
    final difference = end.difference(
      snapshot.serverTime.add(_displayElapsed?.call() ?? _elapsed.elapsed),
    );
    return difference.isNegative ? Duration.zero : difference;
  }

  Future<void> loadParticipations([int page = 1]) async {
    if (_disposed || loadingList) return;
    final request = ++_listRequest;
    loadingList = true;
    listError = null;
    notifyListeners();
    try {
      final result = await api.participations(page);
      if (!_disposed && request == _listRequest) participations = result;
    } catch (_) {
      if (!_disposed && request == _listRequest) {
        listError = PorterReviewStrings.loadFailed;
      }
    } finally {
      if (!_disposed && request == _listRequest) {
        loadingList = false;
        notifyListeners();
      }
    }
  }

  Future<void> selectTrip(String id, String title) async {
    if (_disposed || saving) return;
    _contextRequest++;
    bookingId = id;
    tripTitle = title;
    porterId = null;
    context = null;
    error = null;
    inaccessible = false;
    stale = false;
    serverClosed = false;
    _pendingWrite = null;
    loadingContext = false;
    await refreshContext();
  }

  void changeTrip() {
    if (_disposed || saving) return;
    _contextRequest++;
    bookingId = null;
    tripTitle = null;
    porterId = null;
    context = null;
    loadingContext = false;
    error = null;
    _pendingWrite = null;
    notifyListeners();
  }

  Future<bool> refreshContext() async {
    final id = bookingId;
    if (_disposed || id == null || loadingContext) return false;
    final request = ++_contextRequest;
    loadingContext = true;
    error = null;
    notifyListeners();
    try {
      final snapshot = await api.context(id);
      if (_disposed || request != _contextRequest || id != bookingId) {
        return false;
      }
      context = snapshot;
      stale = false;
      inaccessible = false;
      _elapsed
        ..reset()
        ..start();
      for (final person in snapshot.porters) {
        final key = _key(person.id);
        final value = _drafts[key];
        if (value == null || (!value.editing && !value.retained)) {
          _drafts[key] = _fromSaved(person.saved);
        }
      }
      if (porterId == null || snapshot.porter(porterId!) == null) {
        porterId = snapshot.porters.isEmpty ? null : snapshot.porters.first.id;
      }
      _reconcilePending();
      return true;
    } catch (failure) {
      if (!_disposed && request == _contextRequest) {
        stale = true;
        final status = failure is ApiException ? failure.statusCode : null;
        inaccessible = status == 404 || status == 403 || status == 401;
        if (inaccessible) {
          context = null;
          porterId = null;
          _drafts.clear();
          _pendingWrite = null;
        }
        error = _message(failure);
      }
      return false;
    } finally {
      if (!_disposed && request == _contextRequest) {
        loadingContext = false;
        notifyListeners();
      }
    }
  }

  void selectPorter(String id) {
    if (_disposed || busy || context?.porter(id) == null) return;
    porterId = id;
    notifyListeners();
  }

  void edit() {
    if (!canEditSelected || draft == null) return;
    draft!.editing = true;
    draft!.baseRevision = selected?.saved?.revision;
    notifyListeners();
  }

  void setRating(int value) {
    if (!canEditSelected || draft?.editing != true) return;
    draft!.rating = value;
    notifyListeners();
  }

  void setComment(String value) {
    if (!canEditSelected || draft?.editing != true) return;
    draft!.comment = value;
    notifyListeners();
  }

  void keepDraft() {
    if (!canEditSelected || draft == null) return;
    draft!
      ..conflict = false
      ..baseRevision = selected?.saved?.revision
      ..editing = true
      ..retained = true;
    notifyListeners();
  }

  void useSaved() {
    if (selected?.saved == null || busy) return;
    _drafts[_key(porterId!)] = _fromSaved(selected!.saved);
    notifyListeners();
  }

  Future<PorterSubmission> submit() async {
    if (!canSubmit) return PorterSubmission.ignored;
    final value = draft!;
    if (value.commentLength > 2000) {
      actionMessage = PorterReviewStrings.commentTooLong;
      notifyListeners();
      return PorterSubmission.failed;
    }
    final attempt = _PendingWrite(
      bookingId!,
      porterId!,
      value.rating,
      value.normalizedComment,
      selected?.saved?.id,
      value.baseRevision,
    );
    saving = true;
    actionMessage = null;
    notifyListeners();
    try {
      await api.write(
        bookingId: attempt.bookingId,
        porterId: attempt.porterId,
        rating: attempt.rating,
        comment: attempt.comment,
        reviewId: attempt.reviewId,
        expectedRevision: attempt.revision,
      );
      if (_disposed) return PorterSubmission.ignored;
      _pendingWrite = attempt;
      final refreshed = await refreshContext();
      if (_disposed) return PorterSubmission.ignored;
      if (refreshed && draft?.conflict == true) {
        actionMessage = PorterReviewStrings.conflict;
        return PorterSubmission.conflict;
      }
      actionMessage = refreshed
          ? PorterReviewStrings.saved
          : PorterReviewStrings.savedRefreshFailed;
      return refreshed ? PorterSubmission.saved : PorterSubmission.failed;
    } catch (failure) {
      if (_disposed) return PorterSubmission.ignored;
      final code = failure is ApiException && failure.errorData is Map
          ? (failure.errorData as Map)['code']
          : null;
      if (failure is ApiException && failure.statusCode == 409) {
        final refreshed = await refreshContext();
        if (_disposed) return PorterSubmission.ignored;
        if (code == 'STALE_REVISION') {
          draft?.conflict = true;
          actionMessage = PorterReviewStrings.conflict;
          return PorterSubmission.conflict;
        }
        if (code == 'DUPLICATE_REVIEW') {
          if (!refreshed) {
            actionMessage = PorterReviewStrings.savedRefreshFailed;
            return PorterSubmission.failed;
          }
          if (draft != null) {
            draft!
              ..editing = false
              ..retained = true;
          }
          actionMessage = PorterReviewStrings.duplicate;
          return PorterSubmission.duplicate;
        }
        serverClosed = true;
        if (draft != null) draft!.editing = false;
        actionMessage = PorterReviewStrings.expired;
        return PorterSubmission.failed;
      }
      final status = failure is ApiException ? failure.statusCode : null;
      if (status == null || status >= 500) {
        _pendingWrite = attempt;
        final refreshed = await refreshContext();
        if (_disposed) return PorterSubmission.ignored;
        if (refreshed &&
            _pendingWrite == null &&
            draft?.editing == false &&
            draft?.retained == false) {
          actionMessage = PorterReviewStrings.confirmedLater;
          return PorterSubmission.saved;
        }
        actionMessage = refreshed
            ? PorterReviewStrings.retryAfterCheck
            : PorterReviewStrings.notSaved;
      } else {
        actionMessage = _message(failure);
        if (status == 404 || status == 403 || status == 401) {
          stale = true;
          inaccessible = true;
        }
      }
      return PorterSubmission.failed;
    } finally {
      if (!_disposed) {
        saving = false;
        notifyListeners();
      }
    }
  }

  void _reconcilePending() {
    final attempt = _pendingWrite;
    if (attempt == null || attempt.bookingId != bookingId) return;
    final saved = context?.porter(attempt.porterId)?.saved;
    final value = _drafts[_key(attempt.porterId)];
    if (saved != null &&
        saved.rating == attempt.rating &&
        saved.comment == attempt.comment &&
        (attempt.revision == null || saved.revision > attempt.revision!)) {
      _drafts[_key(attempt.porterId)] = _fromSaved(saved);
    } else if (saved != null && value != null) {
      value
        ..retained = true
        ..conflict = true;
    }
    _pendingWrite = null;
  }

  PorterReviewDraft _fromSaved(SavedPorterReview? saved) => PorterReviewDraft(
    rating: saved?.rating ?? 0,
    comment: saved?.comment ?? '',
    baseRevision: saved?.revision,
    editing: saved == null,
  );

  String _message(Object failure) {
    final status = failure is ApiException ? failure.statusCode : null;
    return switch (status) {
      401 => PorterReviewStrings.sessionExpired,
      403 => PorterReviewStrings.forbidden,
      404 => PorterReviewStrings.unavailable,
      422 => PorterReviewStrings.invalid,
      _ => PorterReviewStrings.loadFailed,
    };
  }

  void _tick() {
    if (_disposed || context == null) return;
    final end = deadline;
    if (!busy && !stale && end != null && remaining == Duration.zero) {
      final key = '$bookingId:$porterId:${end.toIso8601String()}';
      // The timer only asks the server again; it never revokes canEdit/canCreate locally.
      if (_checkedDeadlines.add(key)) unawaited(refreshContext());
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _contextRequest++;
    _listRequest++;
    _ticker.cancel();
    _elapsed.stop();
    _drafts.clear();
    _pendingWrite = null;
    context = null;
    participations = null;
    bookingId = null;
    tripTitle = null;
    porterId = null;
    api.dispose();
    super.dispose();
  }
}

class _PendingWrite {
  const _PendingWrite(
    this.bookingId,
    this.porterId,
    this.rating,
    this.comment,
    this.reviewId,
    this.revision,
  );
  final String bookingId, porterId;
  final int rating;
  final String? comment, reviewId;
  final int? revision;
}

final porterReviewsApiProvider = Provider.autoDispose
    .family<PorterReviewsApi, String>(
      (ref, account) =>
          HttpPorterReviewsApi(ref.watch(apiClientProvider), account),
    );

final porterReviewsProvider =
    ChangeNotifierProvider.autoDispose<PorterReviewsController?>((ref) {
      final account = ref.watch(
        authControllerProvider.select((state) => state.valueOrNull?.id),
      );
      if (account == null) return null;
      return PorterReviewsController(
        ref.watch(porterReviewsApiProvider(account)),
      );
    });
