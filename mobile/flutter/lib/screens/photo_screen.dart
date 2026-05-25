import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/ticket_flow_service.dart';
import 'summary_screen.dart';

class PhotoScreen extends StatefulWidget {
  final String message;
  final String description;

  const PhotoScreen({
    super.key,
    required this.message,
    required this.description,
  });

  @override
  State<PhotoScreen> createState() => _PhotoScreenState();
}

class _PhotoScreenState extends State<PhotoScreen> {
  XFile? _pickedImage;
  Uint8List? _imageBytes;
  bool _loading = false;
  String? _error;

  Future<void> _pickImage(ImageSource source) async {
    final picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 85,
    );
    if (picked == null) return;

    final bytes = await picked.readAsBytes();

    setState(() {
      _pickedImage = picked;
      _imageBytes = bytes;
      _error = null;
    });
  }

  Future<void> _sendPhoto() async {
    if (_imageBytes == null || _pickedImage == null) {
      setState(() => _error = 'Veuillez choisir ou prendre une photo.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final photoUrl = await TicketFlowService.instance.uploadPhoto(
        filename: _pickedImage!.name,
        bytes: _imageBytes!,
      );

      final state = await TicketFlowService.instance.sendPhoto(photoUrl);

      if (state['next'] == 'ASK_PHOTO') {
        setState(() {
          _error = state['message'];
          _pickedImage = null;
          _imageBytes = null;
        });
      } else if (state['next'] == 'READY_TO_CREATE_TICKET') {
        if (!mounted) return;
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SummaryScreen(
              description: widget.description,
              diagnostic: state['diagnostic'],
            ),
          ),
        );
      } else {
        setState(() => _error = 'Réponse inattendue du serveur.');
      }
    } catch (e) {
      setState(() =>
          _error = 'Erreur lors de l’envoi. Vérifiez votre connexion.');
    }

    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Photo du problème'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.message,
              style: const TextStyle(fontSize: 18),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              'Sur émulateur, préférez « Galerie » pour choisir une image déjà enregistrée.',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            if (_imageBytes != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.memory(_imageBytes!, height: 250, fit: BoxFit.cover),
              ),
            const SizedBox(height: 20),
            if (_error != null)
              Text(
                _error!,
                style: const TextStyle(color: Colors.red),
              ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _loading ? null : () => _pickImage(ImageSource.gallery),
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('Choisir dans la galerie'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _loading ? null : () => _pickImage(ImageSource.camera),
              icon: const Icon(Icons.camera_alt_outlined),
              label: const Text('Prendre une photo'),
            ),
            const SizedBox(height: 20),
            _loading
                ? const Center(child: CircularProgressIndicator())
                : FilledButton(
                    onPressed: _sendPhoto,
                    child: const Text('Continuer'),
                  ),
          ],
        ),
      ),
    );
  }
}
