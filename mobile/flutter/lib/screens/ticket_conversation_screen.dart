import 'dart:async';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/ticket_message.dart';
import '../services/ticket_flow_service.dart';
import '../services/ticket_service.dart';

/// Fil de conversation avec Lia pour un ticket.
class TicketConversationScreen extends StatefulWidget {
  final int ticketId;
  final List<TicketMessage>? initialMessages;

  const TicketConversationScreen({
    super.key,
    required this.ticketId,
    this.initialMessages,
  });

  @override
  State<TicketConversationScreen> createState() =>
      _TicketConversationScreenState();
}

class _TicketConversationScreenState extends State<TicketConversationScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  List<TicketMessage> _messages = [];
  Map<String, dynamic>? _ticket;
  bool _loading = true;
  bool _sending = false;
  bool _uploadingPhoto = false;
  String? _error;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    if (widget.initialMessages != null) {
      _messages = List.from(widget.initialMessages!);
    }
    _refresh(silent: widget.initialMessages != null);
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scheduleRefreshWhileAnalyzing() {
    _refreshTimer?.cancel();
    if (!TicketService.isLiaAnalyzing(_ticket)) return;
    _refreshTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      _refresh(silent: true);
    });
  }

  Future<void> _refresh({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final ticket = await TicketService.instance.getTicket(widget.ticketId);
      final messages =
          await TicketService.instance.getMessages(widget.ticketId);
      if (!mounted) return;
      setState(() {
        _ticket = ticket;
        _messages = messages;
      });
      _scheduleRefreshWhileAnalyzing();
      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      if (!silent) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted && !silent) setState(() => _loading = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _addPhoto() async {
    if (_uploadingPhoto) return;

    final picked = await ImagePicker().pickImage(source: ImageSource.camera);
    if (picked == null) return;

    setState(() => _uploadingPhoto = true);
    try {
      final bytes = await picked.readAsBytes();
      final url = await TicketFlowService.instance.uploadPhoto(
        filename: picked.name,
        bytes: bytes,
      );
      await TicketService.instance.redoPhoto(
        widget.ticketId,
        feedback: 'Photo ajoutée : $url',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Photo envoyée — Lia réanalyse votre dossier.')),
      );
      await _refresh(silent: true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _requestPlumber() async {
    if (_sending) return;
    setState(() => _sending = true);
    try {
      final updated = await TicketService.instance.postMessage(
        widget.ticketId,
        'Je souhaite un plombier',
      );
      if (!mounted) return;
      setState(() {
        _messages = updated;
        _sending = false;
      });
      await _refresh(silent: true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    _input.clear();

    try {
      final updated =
          await TicketService.instance.postMessage(widget.ticketId, text);
      if (!mounted) return;
      setState(() => _messages = updated);
      _scheduleRefreshWhileAnalyzing();
      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final analyzing = TicketService.isLiaAnalyzing(_ticket);
    final responsibility = _ticket?['responsibility'] as String?;
    final showArtisanAction =
        !analyzing && responsibility == 'LOCATAIRE';
    final title = _ticket?['title'] as String? ?? 'Conversation avec Lia';

    return Scaffold(
      appBar: AppBar(
        title: Text(title, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : () => _refresh(),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_ticket?['caseNumber'] != null) _CaseNumberBanner(
            caseNumber: _ticket!['caseNumber'] as String,
            dossierNumber: (_ticket!['tenant'] as Map<String, dynamic>?)?['dossierNumber'] as String?,
          ),
          if (analyzing) _AnalyzingBanner(),
          Expanded(
            child: _loading && _messages.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : _error != null && _messages.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(_error!, textAlign: TextAlign.center),
                        ),
                      )
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          return _MessageBubble(message: _messages[index]);
                        },
                      ),
          ),
          if (showArtisanAction)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: ActionChip(
                  avatar: const Icon(Icons.plumbing, size: 18),
                  label: const Text('Demander un plombier'),
                  onPressed: _sending ? null : _requestPlumber,
                ),
              ),
            ),
          if (!analyzing && _ticket?['status'] == 'AWAITING_TENANT_PHOTO')
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Lia a besoin d’une photo plus nette ou d’une précision.',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.orange.shade900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _uploadingPhoto ? null : _addPhoto,
                    icon: _uploadingPhoto
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.camera_alt_outlined),
                    label: Text(
                      _uploadingPhoto ? 'Envoi en cours…' : 'Prendre une photo',
                    ),
                  ),
                ],
              ),
            ),
          _MessageComposer(
            controller: _input,
            sending: _sending,
            onSend: _send,
          ),
        ],
      ),
    );
  }
}

class _CaseNumberBanner extends StatelessWidget {
  final String caseNumber;
  final String? dossierNumber;

  const _CaseNumberBanner({
    required this.caseNumber,
    this.dossierNumber,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.blue.shade50,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Icon(Icons.tag_outlined, color: Colors.blue.shade800, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                dossierNumber != null
                    ? 'Affaire $caseNumber · Dossier $dossierNumber'
                    : 'Numéro d’affaire : $caseNumber',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.blue.shade900,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnalyzingBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.amber.shade50,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.amber.shade900,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Lia analyse votre dossier… Vous pouvez fermer l’application : '
                'vous serez prévenu(e) par notification.',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.amber.shade900,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final TicketMessage message;

  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    if (message.isSystem) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Center(
          child: Text(
            message.content,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontStyle: FontStyle.italic,
              color: Colors.grey.shade700,
            ),
          ),
        ),
      );
    }

    final isTenant = message.isTenant;
    return Align(
      alignment: isTenant ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.82,
        ),
        decoration: BoxDecoration(
          color: isTenant ? Colors.blue.shade600 : Colors.grey.shade200,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isTenant ? 16 : 4),
            bottomRight: Radius.circular(isTenant ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment:
              isTenant ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!isTenant)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  'Lia',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.teal.shade800,
                  ),
                ),
              ),
            Text(
              message.content,
              style: TextStyle(
                color: isTenant ? Colors.white : Colors.black87,
                fontSize: 15,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageComposer extends StatelessWidget {
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  const _MessageComposer({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                decoration: InputDecoration(
                  hintText: 'Écrire à Lia…',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                ),
                onSubmitted: (_) => onSend(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: sending ? null : onSend,
              icon: sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}
