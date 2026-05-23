import 'package:flutter/material.dart';

/// Proposition d’artisan partenaire après diagnostic LOCATAIRE.
class TenantArtisanOffer {
  const TenantArtisanOffer({
    required this.label,
    required this.panelDescription,
    required this.acceptMessage,
    required this.declineMessage,
    required this.icon,
  });

  final String label;
  final String panelDescription;
  final String acceptMessage;
  final String declineMessage;
  final IconData icon;

  static TenantArtisanOffer? fromTicket(Map<String, dynamic>? ticket) {
    if (ticket == null) return null;
    final type = (ticket['aiSuggestedArtisanType'] as String?)?.toUpperCase();
    final category = (ticket['aiCategory'] as String?)?.toUpperCase();
    final title = (ticket['title'] as String? ?? '').toLowerCase();

    String? resolved;
    if (type == 'ELECTRICIAN' ||
        category == 'ELECTRICITY' ||
        _looksElectric(title)) {
      resolved = 'electrician';
    } else if (type == 'PLUMBER' ||
        category == 'PLUMBING' ||
        _looksPlumbing(title)) {
      resolved = 'plumber';
    } else if (type == 'LOCKSMITH' || category == 'LOCK') {
      resolved = 'locksmith';
    } else if (type == 'HEATING_TECH' || category == 'HEATING') {
      resolved = 'heating';
    }

    switch (resolved) {
      case 'electrician':
        return const TenantArtisanOffer(
          label: 'électricien',
          panelDescription:
              'Si vous le souhaitez, nous pouvons vous proposer un électricien partenaire (devis). '
              'L’intervention reste à votre charge (entretien locatif / point lumineux accessible).',
          acceptMessage: 'Oui, je souhaite un électricien',
          declineMessage: 'Non, je ne souhaite pas d’électricien',
          icon: Icons.electrical_services_outlined,
        );
      case 'locksmith':
        return const TenantArtisanOffer(
          label: 'serrurier',
          panelDescription:
              'Si vous le souhaitez, nous pouvons vous proposer un serrurier partenaire (devis). '
              'L’intervention reste à votre charge sauf défaut imputable au bailleur.',
          acceptMessage: 'Oui, je souhaite un serrurier',
          declineMessage: 'Non, je ne souhaite pas de serrurier',
          icon: Icons.key_outlined,
        );
      case 'heating':
        return const TenantArtisanOffer(
          label: 'chauffagiste',
          panelDescription:
              'Si vous le souhaitez, nous pouvons vous proposer un chauffagiste partenaire (devis). '
              'L’intervention peut rester à votre charge selon la cause retenue.',
          acceptMessage: 'Oui, je souhaite un chauffagiste',
          declineMessage: 'Non, je ne souhaite pas de chauffagiste',
          icon: Icons.thermostat_outlined,
        );
      case 'plumber':
        return const TenantArtisanOffer(
          label: 'plombier',
          panelDescription:
              'Si vous le souhaitez, nous pouvons vous proposer un plombier partenaire (devis). '
              'L’intervention reste à votre charge : le bailleur n’est pas tenu de déboucher l’évier.',
          acceptMessage: 'Oui, je souhaite un plombier',
          declineMessage: 'Non, je ne souhaite pas de plombier',
          icon: Icons.plumbing,
        );
      default:
        return const TenantArtisanOffer(
          label: 'artisan',
          panelDescription:
              'Si vous le souhaitez, nous pouvons vous proposer un artisan partenaire (devis). '
              'L’intervention reste en principe à votre charge.',
          acceptMessage: 'Oui, je souhaite un artisan',
          declineMessage: 'Non, je ne souhaite pas d’artisan',
          icon: Icons.handyman_outlined,
        );
    }
  }

  static bool _looksElectric(String t) {
    return RegExp(
      r'électri|electri|lumi[eè]re|ampoule|[eé]clairage|disjoncteur|prise',
    ).hasMatch(t);
  }

  static bool _looksPlumbing(String t) {
    return RegExp(r'fuite|évier|evier|plomb|robinet|wc|eau').hasMatch(t);
  }
}
