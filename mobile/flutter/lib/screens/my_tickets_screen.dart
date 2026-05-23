import 'package:flutter/material.dart';
import '../services/notification_navigation.dart';
import '../services/ticket_service.dart';
import 'ticket_conversation_screen.dart';

/// Liste des demandes du locataire.
class MyTicketsScreen extends StatefulWidget {
  const MyTicketsScreen({super.key});

  @override
  State<MyTicketsScreen> createState() => _MyTicketsScreenState();
}

class _MyTicketsScreenState extends State<MyTicketsScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _tickets = [];

  @override
  void initState() {
    super.initState();
    _load();
    _openPendingFromNotification();
  }

  Future<void> _openPendingFromNotification() async {
    final pending = await NotificationNavigation.takePendingTicketId();
    if (pending != null && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openConversation(pending);
      });
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await TicketService.instance.getMyTickets();
      if (!mounted) return;
      setState(() => _tickets = list);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openConversation(int ticketId) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => TicketConversationScreen(ticketId: ticketId),
      ),
    ).then((_) => _load());
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'LIA_ANALYZING':
        return 'Lia analyse…';
      case 'AWAITING_TENANT_PHOTO':
        return 'Photo demandée';
      case 'AUTO_CLOSED':
        return 'Clôturé';
      case 'OPEN':
        return 'En cours';
      default:
        return status ?? '—';
    }
  }

  Color _statusColor(String? status) {
    if (status == 'LIA_ANALYZING') return Colors.amber.shade800;
    if (status == 'AWAITING_TENANT_PHOTO') return Colors.orange;
    if (status == 'AUTO_CLOSED') return Colors.grey;
    return Colors.blue;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes demandes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _load,
                          child: const Text('Réessayer'),
                        ),
                      ],
                    ),
                  ),
                )
              : _tickets.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'Aucune demande pour le moment.\n'
                          'Utilisez « Déclarer un problème » pour contacter Lia.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _tickets.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final t = _tickets[index] as Map<String, dynamic>;
                          final id = t['id'] as int;
                          final title = t['title'] as String? ?? 'Demande';
                          final status = t['status'] as String?;
                          final caseNumber = t['caseNumber'] as String?;
                          final responsibility =
                              t['responsibility'] as String?;
                          final respLabel = responsibility != null &&
                                  responsibility != 'PENDING'
                              ? TicketService.responsibilityLabel(responsibility)
                              : null;
                          return ListTile(
                            title: Text(title),
                            subtitle: Text(
                              [
                                if (caseNumber != null) caseNumber else 'Ticket #$id',
                                _statusLabel(status),
                                if (respLabel != null) respLabel,
                              ].join(' · '),
                            ),
                            trailing: Chip(
                              label: Text(
                                _statusLabel(status),
                                style: const TextStyle(fontSize: 11),
                              ),
                              backgroundColor:
                                  _statusColor(status).withOpacity(0.15),
                              side: BorderSide.none,
                            ),
                            onTap: () => _openConversation(id),
                          );
                        },
                      ),
                    ),
    );
  }
}
