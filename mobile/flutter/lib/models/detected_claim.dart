/// Sujet détecté dans une description (un ticket = une réclamation).
class DetectedClaim {
  final String id;
  final String category;
  final String label;
  final String excerpt;

  const DetectedClaim({
    required this.id,
    required this.category,
    required this.label,
    required this.excerpt,
  });

  factory DetectedClaim.fromJson(Map<String, dynamic> json) {
    return DetectedClaim(
      id: (json['id'] as String?) ?? 'signalement-unique',
      category: (json['category'] as String?) ?? 'GENERIC',
      label: (json['label'] as String?) ?? '',
      excerpt: (json['excerpt'] as String?) ?? '',
    );
  }
}
