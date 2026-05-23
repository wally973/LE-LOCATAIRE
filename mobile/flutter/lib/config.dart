import 'package:flutter/foundation.dart';

/// PC / simulateur iOS sur la même machine que le backend.
const String apiLocal = 'http://localhost:3000';
/// Émulateur Android (localhost du PC = 10.0.2.2).
const String apiEmulator = 'http://10.0.2.2:3000';
/// Téléphone physique : IP du PC serveur sur le Wi-Fi local.
const String apiPhone = 'http://192.168.1.16:3000';

/// Téléphone Android physique sur le Wi-Fi : `flutter run --dart-define=USE_PHONE_API=true`
const bool usePhoneApi =
    bool.fromEnvironment('USE_PHONE_API', defaultValue: false);

enum DeviceEnvironment {
  android,
  ios,
  windows,
  macos,
  linux,
  web,
  unknown,
}

DeviceEnvironment getDeviceEnvironment() {
  if (kIsWeb) return DeviceEnvironment.web;
  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      return DeviceEnvironment.android;
    case TargetPlatform.iOS:
      return DeviceEnvironment.ios;
    case TargetPlatform.windows:
      return DeviceEnvironment.windows;
    case TargetPlatform.macOS:
      return DeviceEnvironment.macos;
    case TargetPlatform.linux:
      return DeviceEnvironment.linux;
    default:
      return DeviceEnvironment.unknown;
  }
}

String getApiEndpoint() {
  final environment = getDeviceEnvironment();

  if (environment == DeviceEnvironment.android) {
    // Émulateur par défaut (10.0.2.2) — évite les blocages sur 192.168.x.x
    return usePhoneApi ? apiPhone : apiEmulator;
  }

  if (environment == DeviceEnvironment.windows ||
      environment == DeviceEnvironment.linux ||
      environment == DeviceEnvironment.macos) {
    return apiLocal;
  }

  if (environment == DeviceEnvironment.ios) {
    // iPhone physique : même Wi-Fi que le PC serveur.
    return apiPhone;
  }

  if (environment == DeviceEnvironment.web) {
    return apiLocal;
  }

  return apiPhone;
}

/// Corrige les URLs d’upload renvoyées en localhost par le serveur de dev.
String normalizeUploadUrl(String url) {
  final base = getApiEndpoint();
  return url
      .replaceFirst('http://localhost:3000', base)
      .replaceFirst('http://127.0.0.1:3000', base);
}
