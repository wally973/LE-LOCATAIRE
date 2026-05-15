import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import 'auth_service.dart';

/// Préférences et jeton push (FCM) côté API backend.
class NotificationService {
  NotificationService._privateConstructor();
  static final NotificationService instance =
      NotificationService._privateConstructor();

  static const _deviceTokenKey = 'fcm_device_token';

  String get _baseUrl => getApiEndpoint();

  Future<Map<String, String>> _authHeaders() async {
    final token = await AuthService.instance.getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// À appeler après connexion : enregistre le jeton côté serveur.
  /// Sans package firebase_messaging, utilise un jeton dev stocké localement.
  Future<void> syncDeviceTokenAfterLogin() async {
    final prefs = await SharedPreferences.getInstance();
    var deviceToken = prefs.getString(_deviceTokenKey);
    if (deviceToken == null || deviceToken.isEmpty) {
      deviceToken =
          'dev-${DateTime.now().millisecondsSinceEpoch}-${defaultTargetPlatform.name}';
      await prefs.setString(_deviceTokenKey, deviceToken);
    }

    final platform = defaultTargetPlatform == TargetPlatform.iOS
        ? 'ios'
        : defaultTargetPlatform == TargetPlatform.android
            ? 'android'
            : 'web';

    final response = await http.post(
      Uri.parse('$_baseUrl/notifications/me/device-tokens'),
      headers: await _authHeaders(),
      body: jsonEncode({'token': deviceToken, 'platform': platform}),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      debugPrint(
        'Enregistrement jeton push échoué: ${response.statusCode} ${response.body}',
      );
    }
  }

  Future<Map<String, dynamic>> getSettings() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/notifications/me/settings'),
      headers: await _authHeaders(),
    );
    if (response.statusCode != 200) {
      throw Exception('Impossible de charger les préférences');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateSettings({
    bool? emailEnabled,
    bool? pushEnabled,
  }) async {
    final body = <String, dynamic>{};
    if (emailEnabled != null) body['emailEnabled'] = emailEnabled;
    if (pushEnabled != null) body['pushEnabled'] = pushEnabled;

    final response = await http.patch(
      Uri.parse('$_baseUrl/notifications/me/settings'),
      headers: await _authHeaders(),
      body: jsonEncode(body),
    );
    if (response.statusCode != 200) {
      throw Exception('Mise à jour des préférences échouée');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }
}
