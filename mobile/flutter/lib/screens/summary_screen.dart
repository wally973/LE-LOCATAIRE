import 'package:flutter/material.dart';
import '../services/ticket_flow_service.dart';

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
  String? _success;

  Future<void> _createTicket() async {
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });

    try {
      // Appel final pour créer le ticket
      await TicketFlowService.instance.createTicket(
        description: widget.description,
        housingId: 1, // TODO : remplacer par le vrai logement de l’utilisateur
      );

      setState(() {
        _success = "Votre ticket a été créé avec succès !";
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }

    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Résumé du problème"),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Description du problème :",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(widget.description, style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 20),

            const Text(
              "Diagnostic IA :",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),

            widget.diagnostic != null
                ? Text(
                    widget.diagnostic.toString(),
                    style: const TextStyle(fontSize: 16),
                  )
                : const Text(
                    "Aucun diagnostic disponible.",
                    style: TextStyle(fontSize: 16),
                  ),

            const SizedBox(height: 30),

            if (_error != null)
              Text(
                _error!,
                style: const TextStyle(color: Colors.red),
              ),

            if (_success != null)
              Text(
                _success!,
                style: const TextStyle(color: Colors.green),
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
                    child: const Text("Créer le ticket"),
                  ),
          ],
        ),
      ),
    );
  }
}
