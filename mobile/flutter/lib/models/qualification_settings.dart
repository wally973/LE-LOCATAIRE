/// Actions de qualification activées par le bailleur (GET /tenant/me/qualification-settings).
class QualificationSettings {
  final bool liaConversationEnabled;
  final bool requirePhotoEvidence;
  final bool liaAutoResearchEnabled;

  const QualificationSettings({
    this.liaConversationEnabled = true,
    this.requirePhotoEvidence = true,
    this.liaAutoResearchEnabled = true,
  });

  factory QualificationSettings.fromJson(Map<String, dynamic> json) {
    return QualificationSettings(
      liaConversationEnabled: json['liaConversationEnabled'] as bool? ?? true,
      requirePhotoEvidence: json['requirePhotoEvidence'] as bool? ?? true,
      liaAutoResearchEnabled: json['liaAutoResearchEnabled'] as bool? ?? true,
    );
  }

  static const defaults = QualificationSettings();
}
