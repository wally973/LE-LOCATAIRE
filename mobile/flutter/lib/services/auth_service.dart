import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

/// Service d'authentification pour gérer la connexion utilisateur
class AuthService {
  // Singleton
  AuthService._privateConstructor();
  static final AuthService instance = AuthService._privateConstructor();

  // Clé pour stocker le JWT dans SharedPreferences
  static const String _tokenKey = 'auth_token';

  String get baseUrl => getApiEndpoint();

  /// Connexion utilisateur
  /// Envoie email et password au backend et récupère le JWT
  Future<String> login(String email, String password) async {
    final headers = await _headers();
    final response = await http.post(
      Uri.parse("$baseUrl/auth/login"),
      headers: headers,
      body: jsonEncode({
        "email": email,
        "password": password,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final token = data['access_token']; // Supposons que le backend renvoie { access_token: "..." }

      if (token != null) {
        // Stocker le token dans SharedPreferences
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, token);
        return token;
      } else {
        throw Exception("Token manquant dans la réponse du serveur");
      }
    } else {
      // Gérer les erreurs spécifiques
      if (response.statusCode == 401) {
        throw Exception("Email ou mot de passe incorrect");
      } else if (response.statusCode == 400) {
        throw Exception("Données invalides");
      } else {
        throw Exception("Erreur serveur (${response.statusCode})");
      }
    }
  }

  /// Inscription utilisateur
  Future<bool> register(String email, String password) async {
    final headers = await _headers();

    final response = await http.post(
      Uri.parse("$baseUrl/auth/register"),
      headers: headers,
      body: jsonEncode({
        "email": email,
        "password": password,
      }),
    );

    return response.statusCode == 201;
  }

  /// Récupérer le token JWT stocké
  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  /// Vérifier si l'utilisateur est connecté
  Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  /// Déconnexion : supprimer le token
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  /// Headers communs pour les appels réseau
  Future<Map<String, String>> _headers() async {
    return {
      "Content-Type": "application/json",
    };
  }
}