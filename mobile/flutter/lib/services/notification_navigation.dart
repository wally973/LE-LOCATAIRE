import 'package:shared_preferences/shared_preferences.dart';

const _pendingTicketKey = 'pending_notification_ticket_id';

/// Réservation d’un ticket à ouvrir après tap sur une notification push.
class NotificationNavigation {
  static int? pendingTicketId;

  static Future<void> openTicket(int ticketId) async {
    pendingTicketId = ticketId;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_pendingTicketKey, ticketId);
  }

  /// Charge un ticket en attente (mémoire ou stockage persistant).
  static Future<int?> loadPendingTicketId() async {
    if (pendingTicketId != null) return pendingTicketId;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_pendingTicketKey);
  }

  static Future<int?> takePendingTicketId() async {
    final fromMemory = pendingTicketId;
    pendingTicketId = null;

    final prefs = await SharedPreferences.getInstance();
    final fromDisk = prefs.getInt(_pendingTicketKey);
    if (fromDisk != null) {
      await prefs.remove(_pendingTicketKey);
    }

    return fromMemory ?? fromDisk;
  }
}
