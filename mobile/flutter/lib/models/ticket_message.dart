/// Message du fil Lia (aligné sur l’API backend).
class TicketMessage {
  final int id;
  final int ticketId;
  final String role;
  final String content;
  final DateTime createdAt;

  const TicketMessage({
    required this.id,
    required this.ticketId,
    required this.role,
    required this.content,
    required this.createdAt,
  });

  factory TicketMessage.fromJson(Map<String, dynamic> json) {
    return TicketMessage(
      id: json['id'] as int,
      ticketId: json['ticketId'] as int,
      role: json['role'] as String,
      content: json['content'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  bool get isTenant => role == 'TENANT';
  bool get isLiaHost => role == 'LIA_HOST';
  bool get isSystem => role == 'LIA_SYSTEM';
}
