import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/companion_state.dart';
import '../models/detected_claim.dart';
import '../models/ticket_message.dart';
import 'auth_service.dart';

/// Plusieurs réclamations dans une même description.
class MultipleClaimsException implements Exception {
  MultipleClaimsException(this.claims);
  final List<DetectedClaim> claims;

  @override
  String toString() =>
      'Ce texte mélange encore plusieurs sujets. Reformulez un seul problème par dossier.';
}

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

  static const _apiTimeout = Duration(seconds: 20);
  static const _createTimeout = Duration(seconds: 45);

  Future<http.Response> _get(Uri uri) async {
    return http.get(uri, headers: await _headers()).timeout(_apiTimeout);
  }

  Future<http.Response> _post(Uri uri, {Object? body}) async {
    return http
        .post(
          uri,
          headers: await _headers(),
          body: body == null ? null : jsonEncode(body),
        )
        .timeout(_apiTimeout);
  }

  Future<List<dynamic>> getMyTickets() async {
    final response = await _get(Uri.parse('$_baseUrl/tickets/me'));

    if (response.statusCode != 200) {
      throw Exception(
        'Impossible de récupérer vos demandes (${response.statusCode})',
      );
    }

    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<Map<String, dynamic>> getTicket(int id) async {
    final response = await _get(Uri.parse('$_baseUrl/tickets/$id'));

    if (response.statusCode != 200) {
      throw Exception('Ticket introuvable (${response.statusCode})');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<List<TicketMessage>> getMessages(int ticketId) async {
    final response = await _get(Uri.parse('$_baseUrl/tickets/$ticketId/messages'));

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
    final response = await _post(
      Uri.parse('$_baseUrl/tickets/$ticketId/artisan-request'),
      body: {
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
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
    final response = await _post(
      Uri.parse('$_baseUrl/tickets/$ticketId/messages'),
      body: {'content': content},
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
    String? claimCategory,
  }) async {
    final response = await http
        .post(
          Uri.parse('$_baseUrl/tickets'),
          headers: await _headers(),
          body: jsonEncode({
            'title': title,
            'description': description,
            'housingId': housingId,
            if (claimCategory != null && claimCategory.isNotEmpty)
              'claimCategory': claimCategory,
          }),
        )
        .timeout(_createTimeout);

    if (response.statusCode == 400) {
      try {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (body['code'] == 'MULTIPLE_CLAIMS') {
          final raw = body['claims'] as List<dynamic>? ?? [];
          final claims = raw
              .map((e) => DetectedClaim.fromJson(e as Map<String, dynamic>))
              .toList();
          throw MultipleClaimsException(claims);
        }
      } catch (e) {
        if (e is MultipleClaimsException) rethrow;
      }
    }

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
    return status == 'LIA_ANALYZING';
  }

  /// Lia attend une photo (intake ou reprise après photo floue).
  static bool isAwaitingTenantPhoto(Map<String, dynamic>? ticket) {
    if (ticket == null) return false;
    final status = ticket['status'] as String?;
    if (status == 'AWAITING_TENANT_PHOTO') return true;
    final phase = intakePhase(ticket);
    return phase == 'AWAITING_PHOTO';
  }

  /// Actions photo (bouton caméra) : phase intake ou flag Expert-Compagnon.
  static bool shouldOfferPhoto(Map<String, dynamic>? ticket) {
    if (isAwaitingTenantPhoto(ticket)) return true;
    if (ticket == null) return false;
    // Dossier conclu (intake terminé ou fil clos) : plus d'invite photo.
    // La relance explicite passe par le statut AWAITING_TENANT_PHOTO ci-dessus.
    if (intakePhase(ticket) == 'DONE') return false;
    if (isFollowUpClosed(ticket)) return false;
    if (intakePhase(ticket) == 'INTAKE') return false;
    final companion = CompanionState.fromTicketJson(ticket);
    return companion?.photoRequested == true;
  }

  static String? intakePhase(Map<String, dynamic>? ticket) {
    if (ticket == null) return null;
    final ai = ticket['aiLastDecision'];
    if (ai is! Map) return null;
    final aiMap = Map<String, dynamic>.from(ai);
    final intake = aiMap['intake'];
    if (intake is! Map) return null;
    final intakeMap = Map<String, dynamic>.from(intake);
    return intakeMap['phase'] as String?;
  }

  /// Relance l’analyse IA après envoi d’une nouvelle photo.
  Future<Map<String, dynamic>> redoPhoto(
    int ticketId, {
    String? feedback,
    String? photoUrl,
  }) async {
    final response = await _post(
      Uri.parse('$_baseUrl/tickets/$ticketId/redo-photo'),
      body: {
        if (feedback != null && feedback.isNotEmpty) 'feedback': feedback,
        if (photoUrl != null && photoUrl.isNotEmpty) 'photoUrl': photoUrl,
      },
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(
        'Relance analyse impossible (${response.statusCode})',
      );
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Message Lia pour le locataire après diagnostic.
  static String? tenantMessageFromTicket(Map<String, dynamic>? ticket) {
    if (ticket == null) return null;
    final ai = ticket['aiLastDecision'];
    if (ai is Map<String, dynamic>) {
      var msg = ai['messageForTenant'] as String?;
      if (msg != null && msg.trim().isNotEmpty) {
        msg = msg.trim();
        msg = msg.replaceFirst(
          RegExp(r'^VERDICT_BAILLEUR\s*[—\-]\s*', caseSensitive: false),
          '',
        );
        if (msg.contains('Synthèse de l’analyse')) {
          final parts = msg.split('\n');
          final simple = parts
              .where((l) =>
                  !l.startsWith('•') &&
                  !l.startsWith('Capteurs') &&
                  !l.contains('Hypothèse retenue') &&
                  !l.contains('Éliminations'))
              .join('\n')
              .trim();
          if (simple.length > 40) return simple;
        }
        return msg;
      }
    }
    return null;
  }

  static String responsibilityLabel(String? code) {
    switch (code) {
      case 'LOCATAIRE':
        return 'À votre charge';
      case 'BAILLEUR':
      case 'ESCALADE_BAILLEUR':
        return 'Charge bailleur';
      case 'NON_RECEVABLE':
        return 'Non recevable';
      case 'SOCIAL':
        return 'Accompagnement social';
      case 'PENDING':
        return 'Analyse en cours';
      default:
        return code ?? '—';
    }
  }

  /// Le locataire a déjà accepté ou refusé un artisan (boutons ou message).
  static bool hasArtisanChoiceInMessages(List<TicketMessage> messages) {
    const declineHints = [
      'pas de plombier',
      'sans plombier',
      'pas d’électricien',
      "pas d'electricien",
      'sans électricien',
      'pas de serrurier',
      'pas d’artisan',
      "pas d'artisan",
      'ne souhaite pas',
      'ne veux pas',
      'pas besoin de plombier',
      'pas besoin d’électricien',
    ];
    const acceptHints = [
      'souhaite un plombier',
      'souhaite un électricien',
      'souhaite un serrurier',
      'souhaite un chauffagiste',
      'souhaite un artisan',
      'veux un plombier',
      'veux un électricien',
    ];

    for (final m in messages) {
      if (m.isLiaHost) {
        final c = m.content.toLowerCase();
        if (c.contains('transmis votre demande')) return true;
        if (c.contains('n’ouvrons pas de demande d’artisan') ||
            c.contains("n'ouvrons pas de demande d'artisan")) {
          return true;
        }
      }
      if (!m.isTenant) continue;
      final t = m.content.toLowerCase().trim();
      if (declineHints.any((k) => t.contains(k))) return true;
      if (acceptHints.any((k) => t.contains(k))) return true;
      if (t.startsWith('oui') &&
          RegExp(r'plombier|électricien|electricien|serrurier|artisan')
              .hasMatch(t)) {
        return true;
      }
    }
    return false;
  }

  /// Fil clos après refus d’artisan — nouvelle réclamation via l’accueil.
  static bool isFollowUpClosed(Map<String, dynamic>? ticket) {
    if (ticket == null) return false;
    final ai = ticket['aiLastDecision'];
    if (ai is! Map) return false;
    final aiMap = Map<String, dynamic>.from(ai);
    return aiMap['followUpClosed'] == true;
  }

  static bool hasFinalDiagnostic(Map<String, dynamic>? ticket) {
    if (ticket == null) return false;
    final r = ticket['responsibility'] as String?;
    return r != null && r != 'PENDING';
  }

  /// Diagnostic confirmé par un référent / technicien (rectification expert).
  static bool isExpertValidated(Map<String, dynamic>? ticket) {
    final ai = _aiDecisionMap(ticket);
    if (ai == null) return false;
    if (ai['diagnosticAuthority'] == 'EXPERT_VALIDATED') return true;
    final er = ai['expertRectification'];
    if (er is Map && er['authority'] == 'EXPERT_VALIDATED') return true;
    return false;
  }

  static String? expertReferentName(Map<String, dynamic>? ticket) {
    final ai = _aiDecisionMap(ticket);
    if (ai == null) return null;
    final er = ai['expertRectification'];
    if (er is Map) {
      final name = er['expertDisplayName'] as String?;
      if (name != null && name.trim().isNotEmpty) return name.trim();
    }
    final tc = ai['expertTakeCharge'];
    if (tc is Map) {
      final name = tc['expertDisplayName'] as String?;
      if (name != null && name.trim().isNotEmpty) return name.trim();
    }
    return null;
  }

  static bool isExpertTakeCharge(Map<String, dynamic>? ticket) {
    final ai = _aiDecisionMap(ticket);
    if (ai == null) return false;
    if (ai['expertTakeCharge'] != null) return true;
    final er = ai['expertRectification'];
    if (er is Map && er['takeCharge'] == true) return true;
    return false;
  }

  static Map<String, dynamic>? _aiDecisionMap(Map<String, dynamic>? ticket) {
    if (ticket == null) return null;
    final ai = ticket['aiLastDecision'];
    if (ai is Map<String, dynamic>) return ai;
    if (ai is Map) return Map<String, dynamic>.from(ai);
    return null;
  }
}
