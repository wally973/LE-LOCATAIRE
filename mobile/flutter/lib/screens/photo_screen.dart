import 'dart:typed_data';
import 'package:flutter/foundation.dart';
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

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera);

    if (picked == null) return;

    final bytes = await picked.readAsBytes();

    setState(() {
      _pickedImage = picked;
      _imageBytes = bytes;
    });
  }

  Future<void> _sendPhoto() async {
if (_imageBytes == null || _pickedImage == null) {
      setState(() => _error = "Veuillez prendre une photo.");
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      // 1. Upload de la photo (à remplacer par ton upload réel)
      final photoUrl = await TicketFlowService.instance.uploadPhoto(
        filename: _pickedImage!.name,
        bytes: _imageBytes!,
      );

      // 2. Envoi au backend IA
      final state = await TicketFlowService.instance.sendPhoto(photoUrl);

      if (state["next"] == "ASK_PHOTO") {
        // Photo floue → l’IA demande une nouvelle photo
        setState(() {
          _error = state["message"];
          _pickedImage = null;
          _imageBytes = null;
        });
      } else if (state["next"] == "READY_TO_CREATE_TICKET") {
        // Tout est OK → on passe au résumé
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SummaryScreen(
              description: widget.description,
              diagnostic: state["diagnostic"],
            ),
          ),
        );
      } else {
        setState(() => _error = "Réponse inattendue du serveur.");
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
        title: const Text("Prendre une photo"),
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

            const SizedBox(height: 20),

            // Affichage de la photo prise
            if (_imageBytes != null)
              Image.memory(_imageBytes!, height: 250),

            const SizedBox(height: 20),

            if (_error != null)
              Text(
                _error!,
                style: const TextStyle(color: Colors.red),
              ),

            const SizedBox(height: 20),

            ElevatedButton(
              onPressed: _takePhoto,
              child: const Text("Prendre une photo"),
            ),

            const SizedBox(height: 20),

            _loading
                ? const CircularProgressIndicator()
                : ElevatedButton(
                    onPressed: _sendPhoto,
                    child: const Text("Continuer"),
                  ),
          ],
        ),
      ),
    );
  }
}
