import 'package:flutter/foundation.dart';
import 'notification_navigation.dart';

/// Traite le payload `data` d’une notification push (FCM).
class PushHandlerService {
  PushHandlerService._();
  static final PushHandlerService instance = PushHandlerService._();

  /// Extrait `ticketId` et réserve l’ouverture de la conversation.
  Future<void> handleRemoteData(Map<String, dynamic> data) async {
    final raw = data['ticketId'];
    if (raw == null) return;

    final ticketId = int.tryParse(raw.toString());
    if (ticketId == null || ticketId <= 0) {
      debugPrint('Push ignorée : ticketId invalide ($raw)');
      return;
    }

    await NotificationNavigation.openTicket(ticketId);
    debugPrint('Push → ticket #$ticketId réservé');
  }
}
