// lib/models/step_data_packet.dart
// Единый пакет данных за один тик трекинга (~1 секунда).
// Содержит всё необходимое для проверки на фрод и сохранения в БД.

import 'gps_point.dart';

enum SuspicionReason {
  none,
  lowVariance,   // телефон на механической качалке
  highSpeed,     // пользователь едет на транспорте
  combined,      // оба признака одновременно
  poorGpsSignal, // нет доверия GPS (точность > 50 м)
}

class StepDataPacket {
  final int stepCount;
  final GpsPoint position;       // уже сглаженная фильтром Калмана
  final double accelVariance;    // дисперсия вектора ускорения за окно
  final double speed;            // скорость из GPS в м/с
  final bool isSuspicious;       // финальный флаг античита
  final SuspicionReason reason;  // причина подозрения
  final double confidenceScore;  // 0.0–1.0, «человечность» движения
  final DateTime timestamp;

  const StepDataPacket({
    required this.stepCount,
    required this.position,
    required this.accelVariance,
    required this.speed,
    required this.isSuspicious,
    required this.reason,
    required this.confidenceScore,
    required this.timestamp,
  });

  @override
  String toString() =>
      'StepDataPacket(steps: $stepCount, suspicious: $isSuspicious, reason: $reason, score: ${confidenceScore.toStringAsFixed(2)})';
}