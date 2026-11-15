import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

const survivalQuestionLimit = 2000;

sealed class SurvivalChatResult {
  const SurvivalChatResult();

  factory SurvivalChatResult.fromJson(Map<String, dynamic>? json) {
    if (json == null) throw const FormatException('Missing answer');
    final sources = json['sources'];
    switch (json['status']) {
      case 'ANSWERED':
        final id = json['answerId'];
        final text = json['answer'];
        if (id is! String ||
            id.isEmpty ||
            text is! String ||
            text.trim().isEmpty) {
          throw const FormatException('Invalid answer');
        }
        return SurvivalChatAnswer(
          id: id,
          text: text,
          sources: sources is List
              ? List.unmodifiable(
                  sources.map(SurvivalChatSource.tryParse).nonNulls,
                )
              : const [],
        );
      case 'INSUFFICIENT_CONTEXT' || 'REFUSED':
        if (json['answer'] != null || sources is! List || sources.isNotEmpty) {
          throw const FormatException('Invalid unavailable response');
        }
        return SurvivalChatUnavailable(refused: json['status'] == 'REFUSED');
      default:
        throw const FormatException('Unknown answer status');
    }
  }
}

class SurvivalChatAnswer extends SurvivalChatResult {
  const SurvivalChatAnswer({
    required this.id,
    required this.text,
    required this.sources,
  }) : snapshotVersion = null;

  const SurvivalChatAnswer.local(this.text, {this.snapshotVersion})
    : id = null,
      sources = const [];

  final String? id;
  final String text;
  final List<SurvivalChatSource> sources;
  final int? snapshotVersion;

  bool get isLocal => id == null;
}

class SurvivalChatUnavailable extends SurvivalChatResult {
  const SurvivalChatUnavailable({required this.refused});

  final bool refused;
}

class SurvivalChatSource {
  const SurvivalChatSource({
    required this.documentId,
    required this.documentVersionId,
    required this.sourceVersion,
    required this.chunkSetId,
    required this.chunkId,
    required this.chunkIndex,
    required this.title,
    required this.classification,
    required this.locale,
    required this.locations,
  });

  static final _uuid = RegExp(
    r'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );

  static SurvivalChatSource? tryParse(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    if (json
        case {
          'documentId': final String documentId,
          'documentVersionId': final String documentVersionId,
          'chunkSetId': final String chunkSetId,
          'chunkId': final String chunkId,
          'chunkIndex': final int chunkIndex,
          'title': final String title,
          'classification': final String classification,
          'locale': final String locale,
        }
        when [
              documentId,
              documentVersionId,
              chunkSetId,
              chunkId,
            ].every(_uuid.hasMatch) &&
            chunkIndex >= 0 &&
            title.trim().isNotEmpty &&
            !_uuid.hasMatch(title.trim()) &&
            classification.trim().isNotEmpty &&
            locale.trim().isNotEmpty) {
      final version = json['sourceVersion'];
      final locations = json['locations'];
      return SurvivalChatSource(
        documentId: documentId,
        documentVersionId: documentVersionId,
        sourceVersion: version is int && version > 0 ? version : null,
        chunkSetId: chunkSetId,
        chunkId: chunkId,
        chunkIndex: chunkIndex,
        title: title.trim(),
        classification: classification,
        locale: locale,
        locations: List.unmodifiable([
          if (locations is List)
            for (final location in locations)
              if (location case {
                'page': final int page,
                'itemRef': final String itemRef,
              } when page > 0 && itemRef.trim().isNotEmpty)
                (page: page, itemRef: itemRef),
        ]),
      );
    }
    return null;
  }

  final String documentId;
  final String documentVersionId;
  final int? sourceVersion;
  final String chunkSetId;
  final String chunkId;
  final int chunkIndex;
  final String title;
  final String classification;
  final String locale;
  final List<({int page, String itemRef})> locations;
}

class SurvivalChatApi {
  const SurvivalChatApi(this._client);

  final ApiClient _client;

  Future<SurvivalChatResult> ask(String question, String requestId) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/ai/answers',
      data: {'question': question, 'locale': 'vi', 'requestId': requestId},
    );
    return SurvivalChatResult.fromJson(response.data);
  }
}

final survivalChatApiProvider = Provider(
  (ref) => SurvivalChatApi(ref.watch(apiClientProvider)),
);
