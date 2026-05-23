import 'package:flutter/material.dart';
import '../models/detected_claim.dart';
import '../models/qualification_settings.dart';
import '../services/pending_claims_store.dart';
import '../services/tenant_service.dart';
import '../services/ticket_service.dart';
import 'ticket_conversation_screen.dart';

/// Choix du 1er sujet quand plusieurs réclamations sont détectées.
class MultiClaimScreen extends StatefulWidget {
  final List<DetectedClaim> claims;
  final QualificationSettings settings;

  const MultiClaimScreen({
    super.key,
    required this.claims,
    required this.settings,
  });

  @override
  State<MultiClaimScreen> createState() => _MultiClaimScreenState();
}

class _MultiClaimScreenState extends State<MultiClaimScreen> {
  bool _loading = false;
  String? _error;

  String _titleFrom(String text) {
    final d = text.trim();
    if (d.length <= 80) return d;
    return '${d.substring(0, 77)}…';
  }

  Future<void> _openClaim(DetectedClaim claim) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final housingId = await TenantService.instance.getCurrentHousingId();
      if (housingId == null) {
        throw Exception(
          'Aucun logement actif. Contactez votre bailleur.',
        );
      }

      final payload = await TicketService.instance.createTicket(
        title: _titleFrom(claim.excerpt),
        description: claim.excerpt,
        housingId: housingId,
        claimCategory: claim.category,
      );

      final others = widget.claims.where((c) => c.id != claim.id).toList();
      PendingClaimsStore.instance.setRemaining(others);

      final ticketId = (payload['id'] as num).toInt();
      final messages = TicketService.messagesFromTicketPayload(payload);

      if (!mounted) return;

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (_) => TicketConversationScreen(
            ticketId: ticketId,
            initialMessages: messages.isEmpty ? null : messages,
            settings: widget.settings,
          ),
        ),
        (route) => route.isFirst,
      );
    } on MultipleClaimsException catch (e) {
      setState(() {
        _error = e.toString();
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Plusieurs problèmes'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Nous avons repéré plusieurs sujets distincts. '
              'Chaque réclamation doit avoir son propre dossier (numéro d’affaire).',
              style: TextStyle(fontSize: 16, height: 1.4),
            ),
            const SizedBox(height: 8),
            Text(
              '${widget.claims.length} sujets — commencez par celui que vous voulez traiter en premier.',
              style: TextStyle(fontSize: 14, color: Colors.black54),
            ),
            const SizedBox(height: 20),
            if (_error != null)
              Text(
                _error!,
                style: const TextStyle(color: Colors.red),
              ),
            ...widget.claims.map(
              (c) => Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.label,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        c.excerpt,
                        style: const TextStyle(fontSize: 14, height: 1.35),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _loading ? null : () => _openClaim(c),
                        child: const Text('Ouvrir ce dossier'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (_loading) const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
    );
  }
}
