import 'published_trip.dart';

/// Labels for the reason codes the backend has validated; AI text is never shown.
const recommendationReasonLabels = <String, String>{
  'preferred_trip_type': 'Đúng loại chuyến bạn chọn',
  'preferred_difficulty': 'Đúng độ khó bạn chọn',
  'preferred_region': 'Ở khu vực bạn quan tâm',
  'preferred_price': 'Phù hợp mức giá bạn chọn',
  'booked_trip_type': 'Giống loại chuyến bạn từng đi',
  'booked_difficulty': 'Độ khó tương tự chuyến bạn từng đi',
  'booked_region': 'Cùng khu vực với chuyến bạn từng đi',
  'booked_price': 'Mức giá tương tự chuyến bạn từng đặt',
  'departing_soon': 'Sắp khởi hành',
  'fitness_match': 'Phù hợp thể lực của bạn',
};

class TripRecommendationItem {
  const TripRecommendationItem({required this.trip, required this.reasons});

  factory TripRecommendationItem.fromJson(Map<String, Object?> json) =>
      TripRecommendationItem(
        trip: PublishedTrip.fromJson(json['trip'] as Map<String, Object?>),
        reasons: [
          for (final reason in json['reasons'] as List<Object?>)
            ?recommendationReasonLabels[reason],
        ],
      );

  final PublishedTrip trip;

  /// Already translated labels; unknown codes are dropped.
  final List<String> reasons;
}

class TripRecommendations {
  const TripRecommendations({
    required this.items,
    required this.needsPreferences,
  });

  factory TripRecommendations.fromJson(Map<String, Object?> json) =>
      TripRecommendations(
        items: [
          for (final item in json['items'] as List<Object?>)
            TripRecommendationItem.fromJson(item as Map<String, Object?>),
        ],
        needsPreferences: json['status'] == 'needs_preferences',
      );

  final List<TripRecommendationItem> items;

  /// No preferences and no booking history yet: nothing was generated, the Camper must choose
  /// preferences first.
  final bool needsPreferences;
}

/// match: why it fits; info: facts; caution: what to weigh before booking.
enum ExplanationTone { match, info, caution }

/// Where a quoted entry lives, so the Camper can find and change it.
const explanationSourceLabels = <String, String>{
  'health_profile': 'Hồ sơ sức khỏe',
  'personal_profile': 'Hồ sơ cá nhân',
  'trip_preferences': 'Sở thích chuyến đi',
  'booking_history': 'Lịch sử chuyến đi',
};

/// What the Camper entered, quoted back in an explanation.
class ExplanationQuote {
  const ExplanationQuote({
    required this.source,
    required this.field,
    required this.text,
    this.fromHistory = false,
  });

  factory ExplanationQuote.fromJson(Map<String, Object?> json) =>
      ExplanationQuote(
        fromHistory: json['source'] == 'booking_history',
        source: explanationSourceLabels[json['source']] ?? 'Thông tin của bạn',
        field: json['field'] as String,
        text: json['text'] as String,
      );

  /// Already translated.
  final String source;
  final String field;
  final String text;

  /// Derived from bookings rather than entered by the Camper.
  final bool fromHistory;

  String get caption => fromHistory
      ? 'Từ lịch sử chuyến đi của bạn · $field'
      : 'Bạn đã cung cấp · $source · $field';
}

class TripRecommendationExplanationSection {
  const TripRecommendationExplanationSection({
    required this.kind,
    required this.tone,
    required this.title,
    required this.detail,
    this.quote,
    this.conclusion,
  });

  factory TripRecommendationExplanationSection.fromJson(
    Map<String, Object?> json,
  ) => TripRecommendationExplanationSection(
    kind: json['kind'] as String,
    tone: switch (json['tone']) {
      'match' => ExplanationTone.match,
      'caution' => ExplanationTone.caution,
      _ => ExplanationTone.info,
    },
    title: json['title'] as String,
    detail: json['detail'] as String,
    quote: json['quote'] == null
        ? null
        : ExplanationQuote.fromJson(json['quote'] as Map<String, Object?>),
    conclusion: json['conclusion'] as String?,
  );

  final String kind;
  final ExplanationTone tone;

  /// Vietnamese text written by the server from the Trip's stored facts.
  final String title;
  final String detail;

  /// Null for facts that come only from the Trip.
  final ExplanationQuote? quote;

  /// "Vì vậy …"
  final String? conclusion;
}

/// "Vì sao gợi ý chuyến này" for a Trip from the Camper's latest suggestions.
class TripRecommendationExplanation {
  const TripRecommendationExplanation({
    required this.sections,
    required this.summary,
    required this.healthConsidered,
  });

  factory TripRecommendationExplanation.fromJson(Map<String, Object?> json) =>
      TripRecommendationExplanation(
        sections: [
          for (final section in json['sections'] as List<Object?>)
            TripRecommendationExplanationSection.fromJson(
              section as Map<String, Object?>,
            ),
        ],
        summary: json['summary'] as String? ?? '',
        healthConsidered: json['healthConsidered'] == true,
      );

  final List<TripRecommendationExplanationSection> sections;

  /// Overall "Vì vậy chuyến này phù hợp với bạn…".
  final String summary;
  final bool healthConsidered;
}

class TripRegionOption {
  const TripRegionOption(this.code, this.label);

  final String code;
  final String label;
}

class TripPreferences {
  const TripPreferences({
    this.tripTypes = const {},
    this.difficulties = const {},
    this.regions = const {},
    this.minPrice,
    this.maxPrice,
    this.regionOptions = const [],
  });

  factory TripPreferences.fromJson(Map<String, Object?> json) {
    Set<String> strings(String key) => {
      for (final value in json[key] as List<Object?>) value as String,
    };
    return TripPreferences(
      tripTypes: strings('tripTypes'),
      difficulties: strings('difficulties'),
      regions: strings('regions'),
      minPrice: (json['minPrice'] as num?)?.toInt(),
      maxPrice: (json['maxPrice'] as num?)?.toInt(),
      regionOptions: [
        for (final option in json['regionOptions'] as List<Object?>)
          TripRegionOption(
            (option as Map<String, Object?>)['code'] as String,
            option['label'] as String,
          ),
      ],
    );
  }

  final Set<String> tripTypes;
  final Set<String> difficulties;
  final Set<String> regions;
  final int? minPrice;
  final int? maxPrice;
  final List<TripRegionOption> regionOptions;

  Map<String, Object?> toJson() => {
    'tripTypes': tripTypes.toList(),
    'difficulties': difficulties.toList(),
    'regions': regions.toList(),
    'minPrice': minPrice,
    'maxPrice': maxPrice,
  };
}
