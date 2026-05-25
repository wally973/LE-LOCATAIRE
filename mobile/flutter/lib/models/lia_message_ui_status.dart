/// Statut affiché sous un message Lia (synchronisé avec l’action annoncée).
class LiaMessageUiStatus {
  final String kind;
  final String label;
  final String? detail;
  final String tone;

  const LiaMessageUiStatus({
    required this.kind,
    required this.label,
    this.detail,
    required this.tone,
  });

  factory LiaMessageUiStatus.fromJson(Map<String, dynamic> json) {
    return LiaMessageUiStatus(
      kind: json['kind'] as String? ?? 'INFO',
      label: json['label'] as String? ?? '',
      detail: json['detail'] as String?,
      tone: json['tone'] as String? ?? 'info',
    );
  }

  static LiaMessageUiStatus? fromMessageMetadata(dynamic metadata) {
    if (metadata is! Map<String, dynamic>) return null;
    final raw = metadata['uiStatus'];
    if (raw is! Map<String, dynamic>) return null;
    return LiaMessageUiStatus.fromJson(raw);
  }
}
