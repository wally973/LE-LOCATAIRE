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

    final code = response.statusCode;
    final success = code >= 200 && code < 300;

    if (success) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final token = data['access_token'] as String? ?? data['token'] as String?;

      if (token != null && token.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, token);
        return token;
      }
      throw Exception('Token manquant dans la réponse du serveur');
    }

    if (code == 401) {
      throw Exception('Email ou mot de passe incorrect');
    }
    if (code == 400) {
      throw Exception('Données invalides');
    }
    throw Exception('Erreur serveur ($code)');
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