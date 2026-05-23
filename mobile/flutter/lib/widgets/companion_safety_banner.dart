import 'package:flutter/material.dart';
import '../models/companion_state.dart';

/// Bandeau sécurité Expert-Compagnon (vert / orange / rouge).
class CompanionSafetyBanner extends StatelessWidget {
  const CompanionSafetyBanner({super.key, required this.companion});

  final CompanionState companion;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    IconData icon;
    String label;
    switch (companion.safetyLevel) {
      case 'red':
        bg = Colors.red.shade100;
        fg = Colors.red.shade900;
        icon = Icons.warning_amber_rounded;
        label = 'Sécurité : danger — coupez l’eau ou l’électricité si besoin, appelez les secours.';
        break;
      case 'yellow':
        bg = Colors.orange.shade100;
        fg = Colors.orange.shade900;
        icon = Icons.info_outline;
        label = 'Prudence : limitez les dégâts et protégez vos affaires.';
        break;
      default:
        bg = Colors.green.shade50;
        fg = Colors.green.shade900;
        icon = Icons.check_circle_outline;
        label = 'Situation suivie — suivez les consignes de Lia.';
    }
    return Material(
      color: bg,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            Icon(icon, color: fg),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label, style: TextStyle(color: fg, fontSize: 13)),
            ),
          ],
        ),
      ),
    );
  }
}
