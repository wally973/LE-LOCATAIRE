import 'package:flutter/material.dart';
import '../services/tenant_service.dart';
import '../services/ticket_service.dart';
import 'ticket_conversation_screen.dart';

class SummaryScreen extends StatefulWidget {
  final String description;
  final Map<String, dynamic>? diagnostic;

  const SummaryScreen({
    super.key,
    required this.description,
    this.diagnostic,
  });

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  bool _loading = false;
  String? _error;

  String get _title {
    final d = widget.description.trim();
    if (d.length <= 80) return d;
    return '${d.substring(0, 77)}…';
  }

  Future<void> _createTicket() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final housingId = await TenantService.instance.getCurrentHousingId();
      if (housingId == null) {
        throw Exception(
          'Aucun logement actif sur votre compte. Contactez votre bailleur.',
        );
      }

      final payload = await TicketService.instance.createTicket(
        title: _title,
        description: widget.description,
        housingId: housingId,
      );

      final ticketId = payload['id'] as int;
      final messages = TicketService.messagesFromTicketPayload(payload);

      if (!mounted) return;

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (_) => TicketConversationScreen(
            ticketId: ticketId,
            initialMessages: messages,
          ),
        ),
        (route) => route.isFirst,
      );
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
        title: const Text('Résumé du problème'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Description du problème :',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(widget.description, style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 20),
            if (widget.diagnostic != null) ...[
              const Text(
                'Pré-analyse :',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              Text(
                widget.diagnostic.toString(),
                style: const TextStyle(fontSize: 14, color: Colors.black54),
              ),
              const SizedBox(height: 20),
            ],
            const Text(
              'En validant, Lia vous accueillera tout de suite dans une conversation. '
              'Vous pourrez fermer l’application pendant l’analyse.',
              style: TextStyle(fontSize: 15, height: 1.4),
            ),
            const SizedBox(height: 20),
            if (_error != null)
              Text(
                _error!,
                style: const TextStyle(color: Colors.red),
              ),
            const Spacer(),
            _loading
                ? const Center(child: CircularProgressIndicator())
                : ElevatedButton(
                    onPressed: _createTicket,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 50),
                      textStyle: const TextStyle(fontSize: 18),
                    ),
                    child: const Text('Envoyer à Lia'),
                  ),
          ],
        ),
      ),
    );
  }
}
