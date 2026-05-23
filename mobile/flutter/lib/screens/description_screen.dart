import 'package:flutter/material.dart';
import '../models/detected_claim.dart';
import '../models/qualification_settings.dart';
import '../services/tenant_service.dart';
import '../services/ticket_service.dart';
import 'multi_claim_screen.dart';
import 'ticket_conversation_screen.dart';

/// Première saisie du problème → conversation Lia (questions) avant photo / diagnostic.
class DescriptionScreen extends StatefulWidget {
  final QualificationSettings settings;

  const DescriptionScreen({super.key, required this.settings});

  @override
  State<DescriptionScreen> createState() => _DescriptionScreenState();
}

class _DescriptionScreenState extends State<DescriptionScreen> {
  final TextEditingController _controller = TextEditingController();
  bool _loading = false;
  String _loadingLabel = 'Ouverture du dossier…';
  String? _error;

  static const _examples = [
    'Fuite sous l’évier depuis ce matin',
    'Fuite au WC et plus d’électricité dans la cuisine',
    'Infiltration au plafond quand il pleut',
  ];

  String _titleFrom(String description) {
    final d = description.trim();
    if (d.length <= 80) return d;
    return '${d.substring(0, 77)}…';
  }

  void _applyExample(String text) {
    _controller.text = text;
    setState(() => _error = null);
  }

  Future<void> _openMultiClaim(List<DetectedClaim> claims) async {
    if (!mounted) return;
    await Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => MultiClaimScreen(
          claims: claims,
          settings: widget.settings,
        ),
      ),
    );
  }

  Future<void> _startConversation() async {
    final description = _controller.text.trim();
    if (description.isEmpty) {
      setState(() => _error = 'Décrivez votre problème en une phrase.');
      return;
    }

    setState(() {
      _loading = true;
      _loadingLabel = 'Analyse de votre description…';
      _error = null;
    });

    try {
      final housingId = await TenantService.instance.getCurrentHousingId();
      if (housingId == null) {
        throw Exception(
          'Aucun logement actif sur votre compte. Contactez votre bailleur.',
        );
      }

      final detected =
          await TenantService.instance.detectClaims(description);
      if (detected.length > 1) {
        await _openMultiClaim(detected);
        return;
      }

      if (!mounted) return;
      setState(() => _loadingLabel = 'Ouverture du dossier…');

      final excerpt = detected.length == 1 ? detected.first.excerpt : description;
      final title = detected.length == 1
          ? detected.first.label
          : _titleFrom(excerpt);

      final payload = await TicketService.instance.createTicket(
        title: title,
        description: excerpt,
        housingId: housingId,
        claimCategory: detected.length == 1 ? detected.first.category : null,
      );

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
      await _openMultiClaim(e.claims);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final conv = widget.settings.liaConversationEnabled;
    final subtitle = conv
        ? 'Lia vous posera quelques questions, puis pourra demander une photo '
            'avant le diagnostic.'
        : 'Lia pourra vous demander une photo puis lancer le diagnostic.';

    return Scaffold(
      appBar: AppBar(title: const Text('Décrire le problème')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'En une phrase, quel est le problème ?',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'Un seul sujet par demande (ex. WC, ou électricité, pas les deux en même temps). '
              'Vous pourrez ouvrir d’autres dossiers ensuite.',
              style: TextStyle(
                fontSize: 14,
                color: Colors.deepOrange,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 15,
                color: Colors.black54,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Exemples pour tester :',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _examples.map((ex) {
                return ActionChip(
                  label: Text(
                    ex,
                    style: const TextStyle(fontSize: 12),
                  ),
                  onPressed: _loading ? null : () => _applyExample(ex),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _controller,
              maxLines: 4,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _startConversation(),
              decoration: InputDecoration(
                hintText:
                    'Ex. : fuite sous l’évier, plus d’électricité dans la cuisine…',
                border: const OutlineInputBorder(),
                errorText: _error,
              ),
            ),
            const SizedBox(height: 24),
            _loading
                ? Column(
                    children: [
                      const CircularProgressIndicator(),
                      const SizedBox(height: 16),
                      Text(
                        _loadingLabel,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  )
                : ElevatedButton(
                    onPressed: _startConversation,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      textStyle: const TextStyle(fontSize: 18),
                    ),
                    child: const Text('Continuer avec Lia'),
                  ),
          ],
        ),
      ),
    );
  }
}
