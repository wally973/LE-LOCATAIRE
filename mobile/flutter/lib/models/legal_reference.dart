/// Référence juridique locatif (catalogue offline / sync API).
class LegalReferenceSource {
  const LegalReferenceSource({
    required this.label,
    required this.url,
    this.article,
  });

  final String label;
  final String url;
  final String? article;

  factory LegalReferenceSource.fromJson(Map<String, dynamic> json) {
    return LegalReferenceSource(
      label: json['label'] as String? ?? '',
      url: json['url'] as String? ?? '',
      article: json['article'] as String?,
    );
  }
}

class LegalReferenceEntry {
  const LegalReferenceEntry({
    required this.slug,
    required this.kind,
    required this.category,
    required this.title,
    required this.summary,
    required this.content,
    this.responsibilityHint,
    this.keywords = const [],
    this.sources = const [],
    this.exceptions = const [],
    this.sortOrder = 0,
    this.score = 0,
  });

  final String slug;
  final String kind;
  final String category;
  final String title;
  final String summary;
  final String content;
  final String? responsibilityHint;
  final List<String> keywords;
  final List<LegalReferenceSource> sources;
  final List<String> exceptions;
  final int sortOrder;
  final double score;

  factory LegalReferenceEntry.fromJson(Map<String, dynamic> json) {
    final rawSources = json['sources'];
    final sources = rawSources is List
        ? rawSources
            .whereType<Map>()
            .map((e) => LegalReferenceSource.fromJson(
                  Map<String, dynamic>.from(e),
                ))
            .toList()
        : <LegalReferenceSource>[];

    return LegalReferenceEntry(
      slug: json['slug'] as String? ?? '',
      kind: json['kind'] as String? ?? 'FAQ',
      category: json['category'] as String? ?? 'GENERIC',
      title: json['title'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      content: json['content'] as String? ?? '',
      responsibilityHint: json['responsibilityHint'] as String?,
      keywords: (json['keywords'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      sources: sources,
      exceptions: (json['exceptions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      sortOrder: json['sortOrder'] as int? ?? 0,
      score: (json['score'] as num?)?.toDouble() ?? 0,
    );
  }
}

class LegalReferencesCatalog {
  const LegalReferencesCatalog({
    required this.version,
    required this.updatedAt,
    required this.entries,
    this.description,
  });

  final int version;
  final String updatedAt;
  final String? description;
  final List<LegalReferenceEntry> entries;

  factory LegalReferencesCatalog.fromJson(Map<String, dynamic> json) {
    final raw = json['entries'] as List<dynamic>? ?? [];
    return LegalReferencesCatalog(
      version: json['version'] as int? ?? 1,
      updatedAt: json['updatedAt'] as String? ?? '',
      description: json['description'] as String?,
      entries: raw
          .whereType<Map>()
          .map((e) => LegalReferenceEntry.fromJson(
                Map<String, dynamic>.from(e),
              ))
          .toList(),
    );
  }
}
