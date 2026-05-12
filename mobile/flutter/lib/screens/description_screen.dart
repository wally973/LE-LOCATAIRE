import 'package:flutter/material.dart';
import '../services/ticket_flow_service.dart';
import 'photo_screen.dart';
import 'summary_screen.dart';

class DescriptionScreen extends StatefulWidget {
  const DescriptionScreen({super.key});

  @override
  State<DescriptionScreen> createState() => _DescriptionScreenState();
}

class _DescriptionScreenState extends State<DescriptionScreen> {
  final TextEditingController _controller = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _sendDescription() async {
    final description = _controller.text.trim();

    if (description.isEmpty) {
      setState(() => _error = "Veuillez décrire votre problème.");
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      // Appel au backend IA
      final state = await TicketFlowService.instance.sendDescription(description);

      if (state["next"] == "ASK_PHOTO") {
        // L’IA demande une photo → on passe à l’écran photo
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => PhotoScreen(
              message: state["message"],
              description: description,
            ),
          ),
        );
      } else if (state["next"] == "READY_TO_CREATE_TICKET") {
        // L’IA dit que tout est prêt → on passe au résumé
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SummaryScreen(
              description: description,
              diagnostic: state["diagnostic"],
            ),
          ),
        );
      } else {
        setState(() => _error = "Réponse inattendue du serveur. Réessayez plus tard.");
      }
    } catch (e) {
      setState(() => _error = "Erreur lors de l’envoi. Vérifiez votre connexion.");
    }

    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Décrire le problème"),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const Text(
              "Décrivez votre problème le plus simplement possible.",
              style: TextStyle(fontSize: 18),
            ),
            const SizedBox(height: 20),

            TextField(
              controller: _controller,
              maxLines: 5,
              decoration: InputDecoration(
                hintText: "Exemple : J’ai une fuite sous l’évier",
                border: OutlineInputBorder(),
                errorText: _error,
              ),
            ),

            const SizedBox(height: 30),

            _loading
                ? const CircularProgressIndicator()
                : ElevatedButton(
                    onPressed: _sendDescription,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 40,
                        vertical: 20,
                      ),
                      textStyle: const TextStyle(fontSize: 18),
                    ),
                    child: const Text("Continuer"),
                  ),
          ],
        ),
      ),
    );
  }
}
