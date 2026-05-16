import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import '../firebase_options.dart';
import 'push_handler_service.dart';

/// Handler FCM en arrière-plan (processus isolé).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (!DefaultFirebaseOptions.isConfigured) return;
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await PushHandlerService.instance.handleRemoteData(message.data);
}

/// Initialisation FCM (tap notification → ticket Lia).
class FcmService {
  FcmService._();
  static final FcmService instance = FcmService._();

  bool _initialized = false;

  bool get isAvailable => DefaultFirebaseOptions.isConfigured && _initialized;

  Future<void> init() async {
    if (_initialized) return;
    if (!DefaultFirebaseOptions.isConfigured) {
      debugPrint(
        'FCM désactivé : exécutez flutterfire configure puis '
        'mettez DefaultFirebaseOptions.isConfigured à true.',
      );
      return;
    }

    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();

    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      await PushHandlerService.instance.handleRemoteData(initial.data);
    }

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      PushHandlerService.instance.handleRemoteData(message.data);
    });

    _initialized = true;
  }

  /// Jeton FCM réel, ou null si non configuré.
  Future<String?> getToken() async {
    if (!isAvailable) return null;
    return FirebaseMessaging.instance.getToken();
  }
}
