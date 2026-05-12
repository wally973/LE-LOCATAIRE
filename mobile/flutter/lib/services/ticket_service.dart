import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'auth_service.dart';

class TicketService {
  // Singleton
  TicketService._privateConstructor();
  static final TicketService instance = TicketService._privateConstructor();

  Future<Map<String, dynamic>> _headers() async {
    final token = await AuthService.instance.getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  String get _baseUrl => getApiEndpoint();

  Future<List<dynamic>> getTickets() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/tickets'),
      headers: await _headers(),
    );

    if (response.statusCode != 200) {
      throw Exception('Impossible de récupérer les tickets (${response.statusCode})');
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
      throw Exception('Erreur lors de la création du ticket (${response.statusCode})');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateTicket({
    required int id,
    String? title,
    String? description,
    String? status,
  }) async {
    final response = await http.patch(
      Uri.parse('$_baseUrl/tickets/$id'),
      headers: await _headers(),
      body: jsonEncode({
        if (title != null) 'title': title,
        if (description != null) 'description': description,
        if (status != null) 'status': status,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Impossible de mettre à jour le ticket (${response.statusCode})');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<void> deleteTicket(int id) async {
    final response = await http.delete(
      Uri.parse('$_baseUrl/tickets/$id'),
      headers: await _headers(),
    );

    if (response.statusCode != 200 && response.statusCode != 204) {
      throw Exception('Impossible de supprimer le ticket (${response.statusCode})');
    }
  }
}
