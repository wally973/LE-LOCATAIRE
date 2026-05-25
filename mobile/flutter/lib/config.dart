import 'package:flutter/foundation.dart';

/// IP du PC sur le Wi-Fi — surcharge : --dart-define=API_HOST=192.168.x.x
const String _apiHost = String.fromEnvironment(
  'API_HOST',
  defaultValue: '192.168.1.16',
);

/// PC / simulateur iOS sur la même machine que le backend.
String get apiLocal => 'http://localhost:3000';

/// Émulateur Android (localhost du PC = 10.0.2.2).
String get apiEmulator => 'http://10.0.2.2:3000';

/// Téléphone physique ou iPhone sur le même Wi-Fi que le PC.
String get apiPhone => 'http://$_apiHost:3000';

/// Émulateur Android uniquement : --dart-define=USE_EMULATOR_API=true
const bool useEmulatorApi =
    bool.fromEnvironment('USE_EMULATOR_API', defaultValue: false);

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
    // Téléphone physique par défaut ; émulateur avec USE_EMULATOR_API=true
    return useEmulatorApi ? apiEmulator : apiPhone;
  }

  if (environment == DeviceEnvironment.windows ||
      environment == DeviceEnvironment.linux ||
      environment == DeviceEnvironment.macos) {
    return apiLocal;
  }

  if (environment == DeviceEnvironment.ios) {
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
