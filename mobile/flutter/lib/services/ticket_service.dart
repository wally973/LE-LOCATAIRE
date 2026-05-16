import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/ticket_message.dart';
import 'auth_service.dart';

class TicketService {
  TicketService._privateConstructor();
  static final TicketService instance = TicketService._privateConstructor();

  Future<Map<String, String>> _headers() async {
    final token = await AuthService.instance.getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  String get _baseUrl => getApiEndpoint();

  Future<List<dynamic>> getMyTickets() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/tickets/me'),
      headers: await _headers(),
    );

    if (response.statusCode != 200) {
      throw Exception(
        'Impossible de récupérer vos demandes (${response.statusCode})',
      );
    }

    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<Map<String, dynamic>> getTicket(int id) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/tickets/$id'),
      headers: await _headers(),
    );

    if (response.statusCode != 200) {
      throw Exception('Ticket introuvable (${response.statusCode})');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<List<TicketMessage>> getMessages(int ticketId) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/tickets/$ticketId/messages'),
      headers: await _headers(),
    );

    if (response.statusCode != 200) {
      throw Exception('Fil de conversation indisponible (${response.statusCode})');
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((e) => TicketMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Demande un artisan partenaire (ticket à charge locataire).
  Future<void> requestArtisan(int ticketId, {String? reason}) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/tickets/$ticketId/artisan-request'),
      headers: await _headers(),
      body: jsonEncode({
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      }),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      final body = response.body;
      if (response.statusCode == 409) {
        throw Exception('Une demande d’artisan est déjà en cours pour ce dossier.');
      }
      throw Exception('Demande d’artisan impossible (${response.statusCode}) $body');
    }
  }

  Future<List<TicketMessage>> postMessage(int ticketId, String content) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/tickets/$ticketId/messages'),
      headers: await _headers(),
      body: jsonEncode({'content': content}),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Envoi du message impossible (${response.statusCode})');
    }

    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((e) => TicketMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Crée un ticket et renvoie ticket + messages Lia (accueil immédiat).
  Future<Map<String, dynamic>> createTicket({
    required String title,
    required String description,
    required int housingId,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/tickets'),
      headers: await _headers(),
      body: jsonEncode({
        'title': title,
        'description': description,
        'housingId': housingId,
      }),
    );

    if (response.statusCode != 201 && response.statusCode != 200) {
      throw Exception(
        'Erreur lors de la création du ticket (${response.statusCode})',
      );
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  static List<TicketMessage> messagesFromTicketPayload(
    Map<String, dynamic> payload,
  ) {
    final raw = payload['messages'] as List<dynamic>?;
    if (raw == null) return [];
    return raw
        .map((e) => TicketMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static bool isLiaAnalyzing(Map<String, dynamic>? ticket) {
    if (ticket == null) return false;
    final status = ticket['status'] as String?;
    return status == 'LIA_ANALYZING' || status == 'NEW';
  }

  /// Relance l’analyse IA après envoi d’une nouvelle photo.
  Future<Map<String, dynamic>> redoPhoto(
    int ticketId, {
    String? feedback,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/tickets/$ticketId/redo-photo'),
      headers: await _headers(),
      body: jsonEncode({
        if (feedback != null && feedback.isNotEmpty) 'feedback': feedback,
      }),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(
        'Relance analyse impossible (${response.statusCode})',
      );
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }
}
