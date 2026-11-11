typedef OfflinePosition = ({double longitude, double latitude});

class OfflineTrip {
  const OfflineTrip({
    required this.route,
    required this.checkpoints,
    required this.guides,
    required this.hazardSources,
  });

  final List<OfflinePosition> route;
  final List<OfflineCheckpoint> checkpoints;
  final List<OfflineGuide> guides;
  final List<OfflineHazardSource> hazardSources;
}

class OfflineCheckpoint {
  const OfflineCheckpoint({
    required this.name,
    required this.type,
    required this.position,
    required this.instructions,
  });

  final String name;
  final String type;
  final OfflinePosition position;
  final String instructions;
}

class OfflineGuide {
  const OfflineGuide({
    required this.topic,
    required this.content,
    required this.sourceTitle,
    required this.documentVersionId,
    required this.attribution,
    required this.sourceUrl,
    required this.pageRefs,
  });

  final String topic;
  final String content;
  final String sourceTitle;
  final String documentVersionId;
  final String? attribution;
  final String? sourceUrl;
  final List<({int page, String itemRef})> pageRefs;
}

enum OfflineHazardOutcome { activeAlerts, noActiveAlert, unknown }

class OfflineHazardSource {
  const OfflineHazardSource({
    required this.id,
    required this.checkedAt,
    required this.validUntil,
    required this.outcome,
  });

  final String id;
  final DateTime? checkedAt;
  final DateTime? validUntil;
  final OfflineHazardOutcome outcome;
}
