import 'package:flutter/foundation.dart';

/// PC / simulateur iOS sur la même machine que le backend.
const String apiLocal = "http://localhost:3000";
/// Émulateur Android (localhost du PC = 10.0.2.2).
const String apiEmulator = "http://10.0.2.2:3000";
/// Téléphone physique : remplacez par l’IP locale du PC (ex. 192.168.1.42).
const String apiPhone = "http://192.168.x.x:3000";

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
    return apiEmulator;
  }

  if (environment == DeviceEnvironment.windows ||
      environment == DeviceEnvironment.linux ||
      environment == DeviceEnvironment.macos) {
    return apiLocal;
  }

  if (environment == DeviceEnvironment.ios ||
      environment == DeviceEnvironment.web) {
    return apiLocal;
  }

  return apiPhone;
}
