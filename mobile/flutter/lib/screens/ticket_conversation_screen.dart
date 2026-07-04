import 'dart:async';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../config.dart';
import '../models/companion_state.dart';
import '../models/tenant_artisan_offer.dart';
import '../models/qualification_settings.dart';
import '../models/ticket_message.dart';
import '../models/lia_message_ui_status.dart';
import '../widgets/companion_safety_banner.dart';
import '../services/tenant_service.dart';
import '../services/ticket_flow_service.dart';
import '../services/ticket_service.dart';

/// Fil de conversation avec Lia pour un ticket.
class TicketConversationScreen extends StatefulWidget {
  final int ticketId;
  final List<TicketMessage>? initialMessages;
  final QualificationSettings? settings;

  const TicketConversationScreen({
    super.key,
    required this.ticketId,
    this.initialMessages,
    this.settings,
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
  bool _loading = false;
  bool _syncing = false;
  bool _sending = false;
  bool _uploadingPhoto = false;
  String? _error;
  Timer? _refreshTimer;
  Timer? _intakePollTimer;
  Timer? _postAnalysisPollTimer;
  int _lastMessageCount = 0;
  int _analyzePollCount = 0;
  int _intakePollCount = 0;
  bool _refreshInFlight = false;
  QualificationSettings _settings = QualificationSettings.defaults;

  @override
  void initState() {
    super.initState();
    _settings = widget.settings ?? QualificationSettings.defaults;
    final initial = widget.initialMessages;
    if (initial != null && initial.isNotEmpty) {
      _messages = List.from(initial);
      _lastMessageCount = _messages.length;
      _refresh(silent: true);
    } else {
      _refresh(silent: false);
    }
    if (widget.settings == null) {
      TenantService.instance.getQualificationSettings().then((s) {
        if (mounted) setState(() => _settings = s);
      });
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _intakePollTimer?.cancel();
    _postAnalysisPollTimer?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  int get _liaHostMessageCount =>
      _messages.where((m) => m.isLiaHost).length;

  bool get _needsBootstrapMessages =>
      _liaHostMessageCount < 1 &&
      !TicketService.isLiaAnalyzing(_ticket);

  /// Récupère les messages Lia (accueil async ou Expert-Compagnon).
  void _scheduleIntakePoll() {
    _intakePollTimer?.cancel();
    _intakePollCount = 0;
    final phase = TicketService.intakePhase(_ticket);
    final status = _ticket?['status'] as String?;
    final bootstrap = _needsBootstrapMessages;
    if (!bootstrap &&
        phase != 'INTAKE' &&
        phase != 'AWAITING_PHOTO' &&
        status != 'OPEN' &&
        status != 'AWAITING_TENANT_PHOTO') {
      return;
    }
    final interval =
        bootstrap ? const Duration(seconds: 2) : const Duration(seconds: 4);
    final maxPolls = bootstrap ? 25 : 8;
    final minMessages = bootstrap ? 1 : 5;
    _intakePollTimer = Timer.periodic(interval, (_) {
      _intakePollCount++;
      if (_intakePollCount > maxPolls) {
        _intakePollTimer?.cancel();
        return;
      }
      if (bootstrap && _liaHostMessageCount >= 1) {
        _intakePollTimer?.cancel();
        return;
      }
      if (!bootstrap && _messages.length >= minMessages) {
        _intakePollTimer?.cancel();
        return;
      }
      final p = TicketService.intakePhase(_ticket);
      if (p == 'DONE' && _messages.length >= 2) {
        _intakePollTimer?.cancel();
        return;
      }
      _refresh(silent: true);
    });
  }

  /// Après envoi photo : récupère la bulle « Diagnostic » ajoutée en fin d’analyse.
  void _schedulePostAnalysisPoll() {
    _postAnalysisPollTimer?.cancel();
    var count = 0;
    _postAnalysisPollTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      count++;
      if (count > 20) {
        _postAnalysisPollTimer?.cancel();
        return;
      }
      final hasDiagBubble = _messages.any(
        (m) =>
            m.isLiaHost &&
            (m.content.contains('Diagnostic') ||
                m.content.contains('votre charge') ||
                m.content.contains('entretien locatif')),
      );
      if (hasDiagBubble && TicketService.hasFinalDiagnostic(_ticket)) {
        _postAnalysisPollTimer?.cancel();
        _scrollToBottomIfNewMessages();
        return;
      }
      _refresh(silent: true);
    });
  }

  void _scheduleRefreshWhileAnalyzing() {
    _refreshTimer?.cancel();
    _analyzePollCount = 0;
    if (!TicketService.isLiaAnalyzing(_ticket)) return;
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _analyzePollCount++;
      if (_analyzePollCount > 36) {
        _refreshTimer?.cancel();
        return;
      }
      _refresh(silent: true);
    });
  }

  Future<void> _refresh({bool silent = false}) async {
    if (_refreshInFlight) return;
    _refreshInFlight = true;
    if (!silent) {
      setState(() {
        if (_messages.isEmpty && _ticket == null) {
          _loading = true;
        } else {
          _syncing = true;
        }
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
      _scheduleIntakePoll();
      _scrollToBottomIfNewMessages();
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (!silent) {
        setState(() => _error = msg);
      } else if (_needsBootstrapMessages || _messages.isEmpty) {
        setState(() => _error = 'Connexion au serveur (${getApiEndpoint()}) : $msg');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Connexion serveur : $msg')),
        );
      }
    } finally {
      _refreshInFlight = false;
      if (mounted) {
        setState(() {
          _loading = false;
          _syncing = false;
        });
      }
    }
  }

  void _scrollToBottomIfNewMessages() {
    if (_messages.length <= _lastMessageCount) return;
    _lastMessageCount = _messages.length;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      final target = _scroll.position.maxScrollExtent;
      if (!target.isFinite || target < 0) return;
      _scroll.jumpTo(target);
    });
  }

  Future<ImageSource?> _pickPhotoSource() {
    return showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Prendre une photo'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choisir dans la galerie'),
              subtitle: const Text('Utile si pas de réseau tout de suite'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _addPhoto({ImageSource? source}) async {
    if (_uploadingPhoto) return;

    final resolved = source ?? await _pickPhotoSource();
    if (resolved == null) return;

    final picked = await ImagePicker().pickImage(
      source: resolved,
      imageQuality: 85,
    );
    if (picked == null) return;

    setState(() => _uploadingPhoto = true);
    try {
      final bytes = await picked.readAsBytes();
      final rawUrl = await TicketFlowService.instance.uploadPhoto(
        filename: picked.name,
        bytes: bytes,
      );
      final url = normalizeUploadUrl(rawUrl);
      final ticket = await TicketService.instance.redoPhoto(
        widget.ticketId,
        photoUrl: url,
        feedback: 'Photo envoyée par le locataire.',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Photo envoyée — Lia réanalyse votre dossier.')),
      );
      setState(() => _ticket = ticket);
      await _refresh(silent: true);
      _scheduleRefreshWhileAnalyzing();
      _schedulePostAnalysisPoll();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _acceptArtisan() async {
    final offer = TenantArtisanOffer.fromTicket(_ticket);
    await _sendText(offer?.acceptMessage ?? 'Oui, je souhaite un artisan');
  }

  Future<void> _declineArtisan() async {
    if (_sending) return;
    setState(() => _sending = true);
    try {
      final offer = TenantArtisanOffer.fromTicket(_ticket);
      final updated = await TicketService.instance.postMessage(
        widget.ticketId,
        offer?.declineMessage ?? 'Non, je ne souhaite pas d’artisan',
      );
      if (!mounted) return;
      final ticket = await TicketService.instance.getTicket(widget.ticketId);
      if (!mounted) return;
      setState(() {
        _messages = updated;
        _ticket = ticket;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Dossier enregistré. Utilisez l’accueil pour une autre demande.',
          ),
        ),
      );
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _skipPhoto() async {
    if (_sending) return;
    await _sendText('Je n’ai pas de photo');
  }

  Future<void> _sendText(String text) async {
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);

    try {
      final updated =
          await TicketService.instance.postMessage(widget.ticketId, text);
      if (!mounted) return;
      final ticket = await TicketService.instance.getTicket(widget.ticketId);
      if (!mounted) return;
      setState(() {
        _messages = updated;
        _ticket = ticket;
      });
      _scheduleRefreshWhileAnalyzing();
      _scheduleIntakePoll();
      _scrollToBottomIfNewMessages();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    _input.clear();
    FocusManager.instance.primaryFocus?.unfocus();
    await _sendText(text);
  }

  @override
  Widget build(BuildContext context) {
    final analyzing = TicketService.isLiaAnalyzing(_ticket);
    final awaitingPhoto = TicketService.isAwaitingTenantPhoto(_ticket);
    final intakePhase = TicketService.intakePhase(_ticket);
    final inIntakeQuestions = intakePhase == 'INTAKE';
    final showPhotoActions =
        !analyzing && (awaitingPhoto || TicketService.shouldOfferPhoto(_ticket));
    final responsibility = _ticket?['responsibility'] as String?;
    final followUpClosed = TicketService.isFollowUpClosed(_ticket);
    final showComposerPhotoButton =
        !followUpClosed && !analyzing && !_uploadingPhoto;
    final showArtisanChoice = !followUpClosed &&
        !analyzing &&
        !awaitingPhoto &&
        responsibility == 'LOCATAIRE' &&
        !TicketService.hasArtisanChoiceInMessages(_messages);
    final showDiagnostic = TicketService.hasFinalDiagnostic(_ticket);
    final canSkipPhoto = !_settings.requirePhotoEvidence;
    final title = _ticket?['title'] as String? ?? 'Conversation avec Lia';
    final companion = CompanionState.fromTicketJson(_ticket);
    final artisanOffer = TenantArtisanOffer.fromTicket(_ticket);

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        title: Text(title, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: (_loading || _syncing) ? null : () => _refresh(),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
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
                      : ListView(
                          controller: _scroll,
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          padding: const EdgeInsets.only(bottom: 8),
                          children: [
                            if (_ticket?['caseNumber'] != null)
                              _CaseNumberBanner(
                                caseNumber: _ticket!['caseNumber'] as String,
                                dossierNumber:
                                    (_ticket!['tenant'] as Map<String, dynamic>?)?[
                                        'dossierNumber'] as String?,
                              ),
                            if (companion != null)
                              CompanionSafetyBanner(companion: companion),
                                            if (_needsBootstrapMessages && !analyzing)
                              _BootstrapBanner(
                                endpoint: getApiEndpoint(),
                                pollCount: _intakePollCount,
                              ),
                            if (analyzing) _AnalyzingBanner(),
                            if (showDiagnostic && !analyzing)
                              _DiagnosticResultBanner(ticket: _ticket!),
                            if (_syncing)
                              const Padding(
                                padding: EdgeInsets.all(8),
                                child: Center(
                                  child: SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                ),
                              ),
                            ..._messages.map(
                              (m) => Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                ),
                                child: _MessageBubble(message: m),
                              ),
                            ),
                          ],
                        ),
            ),
            if (followUpClosed)
              Material(
                color: Colors.grey.shade100,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Ce dossier est terminé. Pour un autre problème, ouvrez une nouvelle demande.',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade800,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: () => Navigator.of(context)
                            .pushNamedAndRemoveUntil('/home', (_) => false),
                        child: const Text('Retour à l’accueil'),
                      ),
                    ],
                  ),
                ),
              ),
            if (showArtisanChoice && artisanOffer != null)
              _ArtisanChoicePanel(
                offer: artisanOffer,
                sending: _sending,
                onAccept: _acceptArtisan,
                onDecline: _declineArtisan,
              ),
            if (!analyzing && inIntakeQuestions)
              Material(
                color: Colors.amber.shade50,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                  child: Text(
                    'Répondez à Lia en langage naturel (depuis quand, '
                    'ce que vous avez déjà essayé, quelle pièce…). '
                    'Elle adapte ses questions. Vous pouvez aussi ajouter une photo avec l’icône.',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.amber.shade900,
                      height: 1.35,
                    ),
                  ),
                ),
              ),
            if (showPhotoActions)
              _PhotoActionPanel(
                ticket: _ticket,
                companion: companion,
                uploading: _uploadingPhoto,
                sending: _sending,
                canSkipPhoto: canSkipPhoto,
                onGallery: () => _addPhoto(source: ImageSource.gallery),
                onCamera: () => _addPhoto(source: ImageSource.camera),
                onSkip: _skipPhoto,
              ),
            if (!followUpClosed)
              _MessageComposer(
                controller: _input,
                sending: _sending,
                onSend: _send,
                showPhotoButton: showComposerPhotoButton,
                onPhoto: _uploadingPhoto ? null : () => _addPhoto(),
              ),
          ],
        ),
      ),
    );
  }
}

class _ArtisanChoicePanel extends StatelessWidget {
  final TenantArtisanOffer offer;
  final bool sending;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const _ArtisanChoicePanel({
    required this.offer,
    required this.sending,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.purple.shade50,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              offer.panelDescription,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.purple.shade900,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: sending ? null : onAccept,
                    icon: Icon(offer.icon, size: 18),
                    label: const Text('Oui'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: sending ? null : onDecline,
                    child: const Text('Non'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PhotoActionPanel extends StatelessWidget {
  final Map<String, dynamic>? ticket;
  final CompanionState? companion;
  final bool uploading;
  final bool sending;
  final bool canSkipPhoto;
  final VoidCallback onGallery;
  final VoidCallback onCamera;
  final VoidCallback onSkip;

  const _PhotoActionPanel({
    required this.ticket,
    required this.companion,
    required this.uploading,
    required this.sending,
    required this.canSkipPhoto,
    required this.onGallery,
    required this.onCamera,
    required this.onSkip,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.orange.shade50,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              ticket?['status'] == 'AWAITING_TENANT_PHOTO'
                  ? 'Lia a besoin d’une photo plus nette ou d’une précision.'
                  : 'Étape suivante : envoyez une photo du problème.',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.orange.shade900,
              ),
            ),
            if (companion != null &&
                companion!.photoGuidanceSteps.isNotEmpty) ...[
              const SizedBox(height: 6),
              ...companion!.photoGuidanceSteps.asMap().entries.map(
                    (e) => Text(
                      '${e.key + 1}. ${e.value}',
                      style: const TextStyle(fontSize: 12, height: 1.3),
                    ),
                  ),
            ],
            const SizedBox(height: 4),
            Text(
              'Sur émulateur ou sans appareil photo : utilisez la galerie.',
              style: TextStyle(fontSize: 11, color: Colors.orange.shade800),
            ),
            const SizedBox(height: 8),
            if (uploading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(12),
                  child: CircularProgressIndicator(),
                ),
              )
            else
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: onGallery,
                      icon: const Icon(Icons.photo_library_outlined),
                      label: const Text('Galerie'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onCamera,
                      icon: const Icon(Icons.camera_alt_outlined),
                      label: const Text('Caméra'),
                    ),
                  ),
                ],
              ),
            if (canSkipPhoto)
              TextButton(
                onPressed: sending ? null : onSkip,
                child: const Text('Continuer sans photo'),
              ),
          ],
        ),
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

class _DiagnosticResultBanner extends StatelessWidget {
  final Map<String, dynamic> ticket;

  const _DiagnosticResultBanner({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final responsibility = ticket['responsibility'] as String?;
    final label = TicketService.responsibilityLabel(responsibility);
    final message = TicketService.tenantMessageFromTicket(ticket);
    final expertValidated = TicketService.isExpertValidated(ticket);
    final referent = TicketService.expertReferentName(ticket);
    final takeCharge = TicketService.isExpertTakeCharge(ticket);
    final isTenantCharge = responsibility == 'LOCATAIRE';
    final isLandlord = responsibility == 'BAILLEUR' ||
        responsibility == 'ESCALADE_BAILLEUR';
    final isSocial = responsibility == 'SOCIAL';

    Color bg = Colors.green.shade50;
    Color fg = Colors.green.shade900;
    if (expertValidated) {
      bg = Colors.teal.shade50;
      fg = Colors.teal.shade900;
    } else if (isTenantCharge) {
      bg = Colors.orange.shade50;
      fg = Colors.orange.shade900;
    } else if (responsibility == 'NON_RECEVABLE') {
      bg = Colors.grey.shade100;
      fg = Colors.grey.shade800;
    } else if (isSocial) {
      bg = Colors.purple.shade50;
      fg = Colors.purple.shade900;
    }

    final title = expertValidated
        ? (referent != null
            ? 'Diagnostic confirmé par $referent — $label'
            : 'Diagnostic confirmé par votre référent — $label')
        : 'Diagnostic Lia — $label';

    return Material(
      color: bg,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: fg,
                fontSize: 14,
              ),
            ),
            if (takeCharge) ...[
              const SizedBox(height: 6),
              Text(
                'Votre demande est prise en charge par le bailleur.',
                style: TextStyle(
                  color: fg,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message,
                style: TextStyle(color: fg, fontSize: 13, height: 1.35),
              ),
            ],
            if (isTenantCharge) ...[
              const SizedBox(height: 8),
              Text(
                'Menues réparations / entretien sous l’évier : à régler par le locataire. '
                'Le lavabo qui fonctionne et un évier seul bouché orientent vers un bouchon local, pas le bailleur.',
                style: TextStyle(
                  color: fg,
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  height: 1.3,
                ),
              ),
            ],
            if (isLandlord) ...[
              const SizedBox(height: 8),
              Text(
                expertValidated
                    ? 'Un référent ou prestataire vous recontacte selon la priorité du dossier. '
                        'En cas d’urgence, coupez l’eau ou l’électricité si possible.'
                    : 'Un prestataire vous contactera selon son planning. '
                        'En cas d’urgence, coupez l’eau ou l’électricité si possible '
                        'et attendez son appel.',
                style: TextStyle(
                  color: fg,
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  height: 1.3,
                ),
              ),
            ],
            if (isSocial) ...[
              const SizedBox(height: 8),
              Text(
                'Un accompagnement social peut être proposé en complément. '
                'Vous serez recontacté si besoin.',
                style: TextStyle(
                  color: fg,
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  height: 1.3,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _BootstrapBanner extends StatelessWidget {
  final String endpoint;
  final int pollCount;

  const _BootstrapBanner({
    required this.endpoint,
    this.pollCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.blue.shade50,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.blue.shade800,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                pollCount > 12
                    ? 'Lia met un peu plus de temps que prévu…\n'
                        'Vérifiez que le backend tourne et que le Wi-Fi est le même.\n'
                        'Serveur : $endpoint'
                    : 'Lia prépare votre conversation…\nServeur : $endpoint',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.blue.shade900,
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
            if (!isTenant && message.uiStatus != null)
              _LiaStatusChip(status: message.uiStatus!),
          ],
        ),
      ),
    );
  }
}

class _LiaStatusChip extends StatelessWidget {
  final LiaMessageUiStatus status;

  const _LiaStatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final tone = status.tone;
    final Color bg;
    final Color fg;
    final IconData icon;
    switch (tone) {
      case 'success':
        bg = Colors.green.shade50;
        fg = Colors.green.shade900;
        icon = Icons.check_circle_outline;
        break;
      case 'warning':
        bg = Colors.orange.shade50;
        fg = Colors.orange.shade900;
        icon = Icons.warning_amber_outlined;
        break;
      default:
        bg = Colors.blue.shade50;
        fg = Colors.blue.shade900;
        icon = Icons.info_outline;
    }
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: fg.withValues(alpha: 0.25)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: fg),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    status.label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: fg,
                    ),
                  ),
                  if (status.detail != null && status.detail!.trim().isNotEmpty)
                    Text(
                      status.detail!,
                      style: TextStyle(fontSize: 11, color: fg, height: 1.25),
                    ),
                ],
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
  final bool showPhotoButton;
  final VoidCallback? onPhoto;

  const _MessageComposer({
    required this.controller,
    required this.sending,
    required this.onSend,
    this.showPhotoButton = false,
    this.onPhoto,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
      child: Row(
        children: [
          if (showPhotoButton)
            IconButton(
              tooltip: 'Photo (galerie ou caméra)',
              onPressed: onPhoto,
              icon: const Icon(Icons.add_photo_alternate_outlined),
            ),
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
    );
  }
}
