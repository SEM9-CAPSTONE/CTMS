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
            text.trim().isEmpty ||
            sources is! List ||
            sources.isEmpty) {
          throw const FormatException('Invalid answer');
        }
        return SurvivalChatAnswer(
          id: id,
          text: text,
          sources: List.unmodifiable(sources.map(SurvivalChatSource.fromJson)),
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
  });

  final String id;
  final String text;
  final List<SurvivalChatSource> sources;
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

  factory SurvivalChatSource.fromJson(Object? json) {
    if (json is! Map<String, dynamic>) {
      throw const FormatException('Invalid source');
    }
    final locations = json['locations'];
    if (locations is! List || locations.isEmpty) {
      throw const FormatException('Missing source locations');
    }
    return SurvivalChatSource(
      documentId: json['documentId'] as String,
      documentVersionId: json['documentVersionId'] as String,
      sourceVersion: json['sourceVersion'] as int,
      chunkSetId: json['chunkSetId'] as String,
      chunkId: json['chunkId'] as String,
      chunkIndex: json['chunkIndex'] as int,
      title: json['title'] as String,
      classification: json['classification'] as String,
      locale: json['locale'] as String,
      locations: List.unmodifiable(
        locations.map((location) {
          if (location is! Map<String, dynamic>) {
            throw const FormatException('Invalid source location');
          }
          return (
            page: location['page'] as int,
            itemRef: location['itemRef'] as String,
          );
        }),
      ),
    );
  }

  final String documentId;
  final String documentVersionId;
  final int sourceVersion;
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
