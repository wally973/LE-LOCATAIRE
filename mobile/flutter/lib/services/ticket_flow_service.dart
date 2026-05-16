import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'auth_service.dart';

class TicketFlowService {
  // Singleton (une seule instance dans toute l'app)
  TicketFlowService._privateConstructor();
  static final TicketFlowService instance = TicketFlowService._privateConstructor();

  String get baseUrl => getApiEndpoint();
  // Le token est maintenant récupéré dynamiquement depuis AuthService

  // -----------------------------
  // 0. Initialiser le flux
  // -----------------------------
  Future<Map<String, dynamic>> initializeTicketFlow() async {
    final response = await http.post(
      Uri.parse("$baseUrl/ai/ticket-flow"),
      headers: await _headers(),
    );

    if (response.statusCode >= 400) {
      throw Exception("Erreur lors de l'initialisation du flux");
    }

    return jsonDecode(response.body);
  }

  // -----------------------------
  // 1. Envoyer la description
  // -----------------------------
  Future<Map<String, dynamic>> sendDescription(String description) async {
    final response = await http.post(
      Uri.parse("$baseUrl/ai/ticket-flow"),
      headers: await _headers(),
      body: jsonEncode({"description": description}),
    );

    return jsonDecode(response.body);
  }

  // -----------------------------
  // 2. Envoyer la photo (URL)
  // -----------------------------
  Future<Map<String, dynamic>> sendPhoto(String photoUrl) async {
    final response = await http.post(
      Uri.parse("$baseUrl/ai/ticket-flow"),
      headers: await _headers(),
      body: jsonEncode({"photoUrl": photoUrl}),
    );

    return jsonDecode(response.body);
  }

  // -----------------------------
  // 3. Upload de la photo
  // (version simple pour toi)
  // -----------------------------
  Future<String> uploadPhoto({
    required String filename,
    required List<int> bytes,
  }) async {
    // ⚠️ Version simple : en vrai tu dois mettre ton endpoint d’upload
    final uri = Uri.parse("$baseUrl/upload");

    final request = http.MultipartRequest("POST", uri)
      ..headers.addAll(await _headers())
      ..files.add(http.MultipartFile.fromBytes("file", bytes, filename: filename));

    final response = await request.send();
    final body = await response.stream.bytesToString();

    final data = jsonDecode(body);

    // On suppose que ton backend renvoie { "url": "https://..." }
    return data["url"];
  }

  // -----------------------------
  // 4. Créer le ticket final
  // -----------------------------
  @Deprecated('Utiliser TicketService.createTicket')
  Future<Map<String, dynamic>> createTicket({
    required String description,
    required int housingId,
    String title = 'Problème signalé',
  }) async {
    final headers = await _headers();

    final response = await http.post(
      Uri.parse("$baseUrl/tickets"),
      headers: headers,
      body: jsonEncode({
        "title": title,
        "description": description,
        "housingId": housingId,
      }),
    );

    if (response.statusCode >= 300) {
      if (response.statusCode == 401 || response.statusCode == 403) {
        throw Exception("Authentification requise pour créer un ticket (${response.statusCode}).");
      }
      throw Exception("Erreur lors de la création du ticket (${response.statusCode}) : ${response.body}");
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  // -----------------------------
  // Headers communs (avec JWT dynamique)
  // -----------------------------
  Future<Map<String, String>> _headers() async {
    final token = await AuthService.instance.getToken();

    return {
      "Content-Type": "application/json",
      if (token != null) "Authorization": "Bearer $token",
    };
  }
}
