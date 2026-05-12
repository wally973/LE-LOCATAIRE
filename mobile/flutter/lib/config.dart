import 'package:flutter/foundation.dart';

const String apiLocal = "http://192.168.x.x:3000";
const String apiEmulator = "http://10.0.2.2:3000";

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

  return apiLocal;
}
