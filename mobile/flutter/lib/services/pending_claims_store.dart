import '../models/detected_claim.dart';

/// Réclamations restantes après traitement du 1er sujet (mémoire session).
class PendingClaimsStore {
  PendingClaimsStore._();
  static final PendingClaimsStore instance = PendingClaimsStore._();

  List<DetectedClaim> _remaining = [];

  List<DetectedClaim> get remaining => List.unmodifiable(_remaining);

  bool get hasPending => _remaining.isNotEmpty;

  void setRemaining(List<DetectedClaim> claims) {
    _remaining = List.from(claims);
  }

  void remove(DetectedClaim claim) {
    _remaining.removeWhere((c) => c.id == claim.id);
  }

  void clear() => _remaining = [];
}
