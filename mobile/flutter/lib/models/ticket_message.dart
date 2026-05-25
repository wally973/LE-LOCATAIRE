import 'lia_message_ui_status.dart';

/// Message du fil Lia (aligné sur l’API backend).
class TicketMessage {
  final int id;
  final int ticketId;
  final String role;
  final String content;
  final DateTime createdAt;
  final LiaMessageUiStatus? uiStatus;

  const TicketMessage({
    required this.id,
    required this.ticketId,
    required this.role,
    required this.content,
    required this.createdAt,
    this.uiStatus,
  });

  factory TicketMessage.fromJson(Map<String, dynamic> json) {
    return TicketMessage(
      id: (json['id'] as num).toInt(),
      ticketId: (json['ticketId'] as num).toInt(),
      role: json['role'] as String,
      content: json['content'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      uiStatus: LiaMessageUiStatus.fromMessageMetadata(json['metadata']),
    );
  }

  bool get isTenant => role == 'TENANT';
  bool get isLiaHost => role == 'LIA_HOST';
  bool get isSystem => role == 'LIA_SYSTEM';
}
