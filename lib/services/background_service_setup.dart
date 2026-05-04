// lib/services/background_service_setup.dart
// Настройка flutter_background_service.
// Запускает MovementService в отдельном Isolate при старте приложения.

import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';

import 'movement_service.dart';

/// Инициализация фонового сервиса. Вызывать в main() до runApp().
Future<void> initBackgroundService() async {
  final service = FlutterBackgroundService();

  await service.configure(
    // ── Android: Foreground Service (обязательное уведомление) ───────────────
    androidConfiguration: AndroidConfiguration(
      onStart: onServiceStart,
      autoStart: false,    // запускаем вручную при начале трекинга
      isForegroundMode: true,
      notificationChannelId: 'stepland_tracking',
      initialNotificationTitle: 'Stepland активен',
      initialNotificationContent: 'Считаем ваши шаги...',
      foregroundServiceNotificationId: 888,
    ),
    // ── iOS: Background fetch + background processing ─────────────────────────
    iosConfiguration: IosConfiguration(
      autoStart: false,
      onForeground: onServiceStart,
      onBackground: onIosBackground,
    ),
  );
}

/// Точка входа фонового Isolate.
/// @pragma необходим для AOT-компиляции (Flutter release mode).
@pragma('vm:entry-point')
void onServiceStart(ServiceInstance service) async {
  // Инициализируем Flutter bindings в новом Isolate
  DartPluginRegistrant.ensureInitialized();

  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((_) {
      service.setAsForegroundService();
    });
    service.on('setAsBackground').listen((_) {
      service.setAsBackgroundService();
    });
  }

  final movementService = MovementService();

  // Слушаем команду старта трекинга от UI Isolate
  service.on('startTracking').listen((_) {
    movementService.start();

    // Пробрасываем данные из фонового Isolate → UI через invoke
    movementService.dataStream.listen((packet) {
      service.invoke('stepData', {
        'stepCount': packet.stepCount,
        'latitude': packet.position.latitude,
        'longitude': packet.position.longitude,
        'accuracy': packet.position.accuracy,
        'accelVariance': packet.accelVariance,
        'speed': packet.speed,
        'isSuspicious': packet.isSuspicious,
        'reason': packet.reason.name,
        'confidenceScore': packet.confidenceScore,
        'timestamp': packet.timestamp.toIso8601String(),
      });
    });
  });

  // Слушаем команду остановки
  service.on('stopTracking').listen((_) {
    movementService.dispose();
    service.stopSelf();
  });
}

/// iOS background handler — минимальная логика для фонового режима.
@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}