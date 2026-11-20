class ActivityProfile {
  const ActivityProfile({
    this.comfortableDistanceKm,
    this.comfortableWalkingMinutes,
    this.activityNotes,
    this.confirmedAt,
  });
  final double? comfortableDistanceKm;
  final int? comfortableWalkingMinutes;
  final String? activityNotes;
  final String? confirmedAt;

  factory ActivityProfile.fromJson(
    Map<String, Object?> json,
  ) => ActivityProfile(
    comfortableDistanceKm: (json['comfortableDistanceKm'] as num?)?.toDouble(),
    comfortableWalkingMinutes: (json['comfortableWalkingMinutes'] as num?)
        ?.toInt(),
    activityNotes: json.containsKey('activityNotes')
        ? json['activityNotes'] as String?
        : <String>{
            for (final key in ['mobilityLimitations', 'professionalAdvice'])
              if (json[key] case final String note when note.trim().isNotEmpty)
                note.trim(),
          }.join('\n\n'),
    confirmedAt: json['confirmedAt'] as String?,
  );
  Map<String, Object?> toInputJson() => {
    'comfortableDistanceKm': comfortableDistanceKm,
    'comfortableWalkingMinutes': comfortableWalkingMinutes,
    'activityNotes': activityNotes,
  };
}
