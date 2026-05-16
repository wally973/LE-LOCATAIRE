import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
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
}
