import '../profile/domain/activity_profile.dart';

class HealthComparison {
  const HealthComparison({
    required this.label,
    required this.profileValue,
    required this.tripValue,
    required this.detail,
    this.result = 'unknown',
  });
  final String label;
  final String profileValue;
  final String tripValue;
  final String detail;
  final String result;
  factory HealthComparison.fromJson(Map<String, Object?> json) =>
      HealthComparison(
        label: json['label'] as String,
        profileValue: json['profileValue'] as String,
        tripValue: json['tripValue'] as String,
        detail: json['detail'] as String,
        result: json['result'] as String? ?? 'unknown',
      );
}

class TripHealthAssessment {
  const TripHealthAssessment({
    required this.status,
    required this.summary,
    required this.comparisons,
    required this.missingInformation,
  });
  final String status;
  final String summary;
  final List<HealthComparison> comparisons;
  final List<String> missingInformation;
  String get label => switch (status) {
    'suitable' => 'Phù hợp với thông tin đã khai báo',
    'needs_review' => 'Cần xác nhận thêm',
    _ => 'Chưa đủ thông tin để đánh giá',
  };
  factory TripHealthAssessment.fromJson(Map<String, Object?> json) =>
      TripHealthAssessment(
        status: json['status'] as String,
        summary: json['summary'] as String,
        comparisons: [
          for (final item in json['comparisons'] as List<Object?>)
            HealthComparison.fromJson(item as Map<String, Object?>),
        ],
        missingInformation: [
          for (final item in json['missingInformation'] as List<Object?>)
            item as String,
        ],
      );
}

class RecommendationHealthBasis {
  const RecommendationHealthBasis({
    required this.fitnessLevel,
    this.activityProfile,
  });
  final String fitnessLevel;
  final ActivityProfile? activityProfile;
  factory RecommendationHealthBasis.fromJson(Map<String, Object?> json) =>
      RecommendationHealthBasis(
        fitnessLevel: json['fitnessLevel'] as String,
        activityProfile: json['activityProfile'] is Map<String, Object?>
            ? ActivityProfile.fromJson(
                json['activityProfile'] as Map<String, Object?>,
              )
            : null,
      );
}
