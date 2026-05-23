import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/detected_claim.dart';
import '../models/qualification_settings.dart';
import 'auth_service.dart';

/// Profil locataire et logement courant (`GET /tenant/me`).
class TenantService {
  TenantService._privateConstructor();
  static final TenantService instance = TenantService._privateConstructor();

  String get _baseUrl => getApiEndpoint();

  Future<Map<String, String>> _headers() async {
    final token = await AuthService.instance.getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> getMe() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/tenant/me'),
      headers: await _headers(),
    );
    if (response.statusCode != 200) {
      throw Exception('Profil locataire indisponible (${response.statusCode})');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Identifiant du logement actif, ou null si non attribué.
  Future<int?> getCurrentHousingId() async {
    final me = await getMe();
    final tenant = me['tenant'] as Map<String, dynamic>?;
    if (tenant == null) return null;
    return tenant['housingId'] as int?;
  }

  /// Réglages Lia / photo définis par le bailleur.
  Future<QualificationSettings> getQualificationSettings() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/tenant/me/qualification-settings'),
      headers: await _headers(),
    );
    if (response.statusCode != 200) {
      return QualificationSettings.defaults;
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return QualificationSettings.fromJson(json);
  }

  /// Détecte plusieurs sujets dans une description (avant création de ticket).
  Future<List<DetectedClaim>> detectClaims(String description) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/tenant/me/detect-claims'),
      headers: await _headers(),
      body: jsonEncode({'description': description}),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(
        'Analyse de la description impossible (${response.statusCode})',
      );
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final raw = json['claims'] as List<dynamic>? ?? [];
    return raw
        .map((e) => DetectedClaim.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
