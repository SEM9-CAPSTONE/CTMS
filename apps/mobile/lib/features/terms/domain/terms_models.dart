import '../../../core/api/api_exception.dart';

const String termsVersionOutdatedCode = 'TERMS_VERSION_OUTDATED';

String formatTermsVersionLabel(String raw) {
  final cleaned = raw.trim().replaceFirst(RegExp(r'^[vV]'), '');
  return 'v$cleaned';
}

String formatTermsDate(String raw) {
  if (raw.trim().isEmpty) return '—';
  final isoMatch = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(raw.trim());
  if (isoMatch != null) {
    return '${isoMatch.group(3)}/${isoMatch.group(2)}/${isoMatch.group(1)}';
  }
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw;
  final day = parsed.day.toString().padLeft(2, '0');
  final month = parsed.month.toString().padLeft(2, '0');
  return '$day/$month/${parsed.year}';
}

bool isTermsVersionOutdatedError(Object error) {
  if (error is ApiException && error.statusCode == 409) {
    final data = error.errorData;
    if (data is Map && data['code'] == termsVersionOutdatedCode) {
      return true;
    }
  }
  return false;
}

class TermsSubsection {
  const TermsSubsection({
    required this.code,
    required this.title,
    required this.body,
  });

  factory TermsSubsection.fromJson(Map<String, dynamic> json) {
    return TermsSubsection(
      code: (json['code'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
    );
  }

  final String code;
  final String title;
  final String body;
}

class TermsSection {
  const TermsSection({
    required this.number,
    required this.slug,
    required this.title,
    required this.subsections,
    this.callout,
  });

  factory TermsSection.fromJson(Map<String, dynamic> json) {
    final rawSubsections = json['subsections'] as List<dynamic>? ?? const [];
    return TermsSection(
      number: (json['number'] as num?)?.toInt() ?? 0,
      slug: (json['slug'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      subsections: rawSubsections
          .whereType<Map<String, dynamic>>()
          .map(TermsSubsection.fromJson)
          .toList(),
      callout: json['callout'] as String?,
    );
  }

  final int number;
  final String slug;
  final String title;
  final List<TermsSubsection> subsections;
  final String? callout;
}

class TermsVersionSummary {
  const TermsVersionSummary({
    required this.id,
    required this.version,
    required this.title,
    this.summary,
    required this.effectiveDate,
    required this.isActive,
    required this.requiresReconsent,
    required this.publishedAt,
  });

  factory TermsVersionSummary.fromJson(Map<String, dynamic> json) {
    return TermsVersionSummary(
      id: (json['id'] ?? '').toString(),
      version: (json['version'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      summary: json['summary'] as String?,
      effectiveDate: (json['effectiveDate'] ?? '').toString(),
      isActive: json['isActive'] == true,
      requiresReconsent: json['requiresReconsent'] != false,
      publishedAt: (json['publishedAt'] ?? '').toString(),
    );
  }

  final String id;
  final String version;
  final String title;
  final String? summary;
  final String effectiveDate;
  final bool isActive;
  final bool requiresReconsent;
  final String publishedAt;
}

class TermsVersionDetail extends TermsVersionSummary {
  const TermsVersionDetail({
    required super.id,
    required super.version,
    required super.title,
    super.summary,
    required super.effectiveDate,
    required super.isActive,
    required super.requiresReconsent,
    required super.publishedAt,
    required this.sections,
  });

  factory TermsVersionDetail.fromJson(Map<String, dynamic> json) {
    final summary = TermsVersionSummary.fromJson(json);
    final rawSections = json['sections'] as List<dynamic>? ?? const [];
    return TermsVersionDetail(
      id: summary.id,
      version: summary.version,
      title: summary.title,
      summary: summary.summary,
      effectiveDate: summary.effectiveDate,
      isActive: summary.isActive,
      requiresReconsent: summary.requiresReconsent,
      publishedAt: summary.publishedAt,
      sections: rawSections
          .whereType<Map<String, dynamic>>()
          .map(TermsSection.fromJson)
          .toList(),
    );
  }

  final List<TermsSection> sections;
}

class TermsAcceptanceRecord {
  const TermsAcceptanceRecord({
    required this.id,
    required this.version,
    required this.acceptedAt,
    required this.source,
    required this.platform,
  });

  factory TermsAcceptanceRecord.fromJson(Map<String, dynamic> json) {
    return TermsAcceptanceRecord(
      id: (json['id'] ?? '').toString(),
      version: (json['version'] ?? '').toString(),
      acceptedAt: (json['acceptedAt'] ?? '').toString(),
      source: (json['source'] ?? '').toString(),
      platform: (json['platform'] ?? '').toString(),
    );
  }

  final String id;
  final String version;
  final String acceptedAt;
  final String source;
  final String platform;
}

class MyTermsStatus {
  const MyTermsStatus({
    required this.currentVersion,
    required this.currentTitle,
    required this.currentEffectiveDate,
    this.currentSummary,
    required this.requiresReconsent,
    required this.acceptedCurrentVersion,
    required this.needsReconsent,
    this.latestAcceptance,
    required this.acceptanceHistory,
  });

  factory MyTermsStatus.fromJson(Map<String, dynamic> json) {
    final rawHistory = json['acceptanceHistory'] as List<dynamic>? ?? const [];
    final rawLatest = json['latestAcceptance'];
    return MyTermsStatus(
      currentVersion: (json['currentVersion'] ?? '').toString(),
      currentTitle: (json['currentTitle'] ?? '').toString(),
      currentEffectiveDate: (json['currentEffectiveDate'] ?? '').toString(),
      currentSummary: json['currentSummary'] as String?,
      requiresReconsent: json['requiresReconsent'] != false,
      acceptedCurrentVersion: json['acceptedCurrentVersion'] == true,
      needsReconsent: json['needsReconsent'] == true,
      latestAcceptance: rawLatest is Map<String, dynamic>
          ? TermsAcceptanceRecord.fromJson(rawLatest)
          : null,
      acceptanceHistory: rawHistory
          .whereType<Map<String, dynamic>>()
          .map(TermsAcceptanceRecord.fromJson)
          .toList(),
    );
  }

  final String currentVersion;
  final String currentTitle;
  final String currentEffectiveDate;
  final String? currentSummary;
  final bool requiresReconsent;
  final bool acceptedCurrentVersion;
  final bool needsReconsent;
  final TermsAcceptanceRecord? latestAcceptance;
  final List<TermsAcceptanceRecord> acceptanceHistory;
}

class AcceptTermsResult {
  const AcceptTermsResult({
    required this.accepted,
    required this.version,
    required this.effectiveDate,
    required this.acceptedAt,
    required this.alreadyAccepted,
  });

  factory AcceptTermsResult.fromJson(Map<String, dynamic> json) {
    return AcceptTermsResult(
      accepted: json['accepted'] == true,
      version: (json['version'] ?? '').toString(),
      effectiveDate: (json['effectiveDate'] ?? '').toString(),
      acceptedAt: (json['acceptedAt'] ?? '').toString(),
      alreadyAccepted: json['alreadyAccepted'] == true,
    );
  }

  final bool accepted;
  final String version;
  final String effectiveDate;
  final String acceptedAt;
  final bool alreadyAccepted;
}
