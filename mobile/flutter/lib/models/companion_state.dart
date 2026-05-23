/// État Expert-Compagnon (avatar + guide photo) — ticket.aiLastDecision.companion
class CompanionState {
  const CompanionState({
    required this.lastSpeech,
    required this.safetyLevel,
    this.avatarAction = 'GESTURE:nod',
    this.avatarPosition = 'bottom_right',
    this.photoRequested = false,
    this.photoGuidanceSteps = const [],
    this.landlordHint,
    this.language = 'fr',
  });

  final String lastSpeech;
  final String safetyLevel;
  final String avatarAction;
  final String avatarPosition;
  final bool photoRequested;
  final List<String> photoGuidanceSteps;
  final String? landlordHint;
  final String language;

  static CompanionState? fromTicketJson(Map<String, dynamic>? ticket) {
    try {
      if (ticket == null) return null;
      final decision = ticket['aiLastDecision'];
      if (decision is! Map) return null;
      final decisionMap = Map<String, dynamic>.from(decision);
      final raw = decisionMap['companion'];
      if (raw is! Map) return null;
      final rawMap = Map<String, dynamic>.from(raw);
      final speech = rawMap['lastSpeech']?.toString();
      if (speech == null || speech.isEmpty) return null;

      final stepsRaw = rawMap['photo_guidance_steps'];
      final steps = stepsRaw is List
          ? stepsRaw.map((e) => e.toString()).where((s) => s.isNotEmpty).toList()
          : <String>[];

      final hint = rawMap['landlord_hint'];
      return CompanionState(
        lastSpeech: speech,
        safetyLevel: rawMap['safety_level']?.toString() ?? 'green',
        avatarAction: rawMap['avatar_action']?.toString() ?? 'GESTURE:nod',
        avatarPosition: rawMap['avatar_position']?.toString() ?? 'bottom_right',
        photoRequested: rawMap['photo_requested'] == true,
        photoGuidanceSteps: steps,
        landlordHint: hint?.toString(),
        language: rawMap['language']?.toString() ?? 'fr',
      );
    } catch (_) {
      return null;
    }
  }

  bool get isUrgent => safetyLevel == 'red';
  bool get isCaution => safetyLevel == 'yellow';
}
