import 'package:flutter/material.dart';
import '../models/qualification_settings.dart';
import '../services/auth_service.dart';
import '../services/tenant_service.dart';
import 'description_screen.dart';
import 'my_tickets_screen.dart';
import '../services/notification_navigation.dart';
import '../services/pending_claims_store.dart';
import 'multi_claim_screen.dart';
import 'ticket_conversation_screen.dart';

class StartScreen extends StatefulWidget {
  const StartScreen({super.key});

  @override
  State<StartScreen> createState() => _StartScreenState();
}

class _StartScreenState extends State<StartScreen> {
  QualificationSettings _settings = QualificationSettings.defaults;

  @override
  void initState() {
    super.initState();
    _loadSettings();
    WidgetsBinding.instance.addPostFrameCallback((_) => _openPendingNotification());
  }

  Future<void> _loadSettings() async {
    try {
      final s = await TenantService.instance.getQualificationSettings();
      if (mounted) setState(() => _settings = s);
    } catch (_) {}
  }

  Future<void> _openPendingNotification() async {
    final ticketId = await NotificationNavigation.takePendingTicketId();
    if (ticketId == null || !mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => TicketConversationScreen(
          ticketId: ticketId,
          settings: _settings,
        ),
      ),
    );
  }

  void _openNewTicket() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DescriptionScreen(settings: _settings),
      ),
    );
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Se déconnecter ?'),
        content: const Text(
          'Vous reviendrez à l’écran de connexion (email et mot de passe).',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Déconnexion'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    await AuthService.instance.logout();
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final intro = _settings.liaConversationEnabled
        ? 'Chaque problème = une demande séparée (WC, électricité, fuite…). '
            'Lia vous guide pour chaque dossier.'
        : 'Chaque problème = une demande séparée. Lia pourra demander une photo '
            'puis le diagnostic pour chaque dossier.';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Assistant technique'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            tooltip: 'Préférences notifications',
            onPressed: () =>
                Navigator.pushNamed(context, '/notifications/settings'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Se déconnecter',
            onPressed: _logout,
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: IntrinsicHeight(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Bienvenue !\n\n$intro',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 18, height: 1.35),
                    ),
                    if (PendingClaimsStore.instance.hasPending) ...[
                      Card(
                        color: Colors.amber.shade50,
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                'Vous aviez aussi signalé '
                                '${PendingClaimsStore.instance.remaining.length} '
                                'autre(s) problème(s).',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: Colors.amber.shade900,
                                ),
                              ),
                              const SizedBox(height: 8),
                              FilledButton(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => MultiClaimScreen(
                                        claims: PendingClaimsStore
                                            .instance.remaining,
                                        settings: _settings,
                                      ),
                                    ),
                                  );
                                },
                                child: const Text('Traiter le problème suivant'),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                    const SizedBox(height: 16),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 40,
                          vertical: 20,
                        ),
                        textStyle: const TextStyle(fontSize: 18),
                      ),
                      onPressed: _openNewTicket,
                      child: const Text('Déclarer un problème'),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 40,
                          vertical: 16,
                        ),
                      ),
                      onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const MyTicketsScreen(),
                                ),
                              );
                            },
                      child: const Text('Mes demandes'),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
