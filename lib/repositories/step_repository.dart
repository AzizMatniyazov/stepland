// lib/repositories/step_repository.dart
// Репозиторий шагов: сохраняет валидные пакеты, вычисляет заработок токенов.
// Используем Isar как локальную БД (быстрее SQLite для потоковых данных).

import '../models/step_data_packet.dart';

/// Упрощённая реализация без генерации кода Isar.
/// В реальном проекте используй @Collection + isar_generator.
class StepRepository {
  // ─── Конфигурация ──────────────────────────────────────────────────────────

  /// Стоимость одного шага в токенах (базовая)
  static const double _tokensPerStep = 0.001;

  /// Максимум токенов в сутки (anti-inflation защита)
  static const double _dailyTokenCap = 50.0;

  // ─── Состояние (in-memory, заменить на Isar в проде) ──────────────────────

  final List<StepDataPacket> _validPackets = [];
  double _todayEarnings = 0.0;

  /// Сохраняет пакет если он не подозрительный.
  /// Возвращает true если пакет был сохранён.
  Future<bool> savePacket(StepDataPacket packet) async {
    if (packet.isSuspicious) return false;
    if (_todayEarnings >= _dailyTokenCap) return false;

    _validPackets.add(packet);
    return true;
  }

  /// Вычисляет заработок токенов за количество шагов.
  double computeEarnings(int steps) {
    if (steps <= 0) return 0.0;
    final earned = steps * _tokensPerStep;
    return earned.clamp(0.0, _dailyTokenCap - _todayEarnings);
  }

  /// Добавляет заработанные токены к дневному счётчику.
  void addEarnings(double amount) {
    _todayEarnings = (_todayEarnings + amount).clamp(0.0, _dailyTokenCap);
  }

  /// Общее количество сохранённых шагов за сессию.
  int get sessionSteps {
    if (_validPackets.isEmpty) return 0;
    return _validPackets.last.stepCount;
  }

  double get todayEarnings => _todayEarnings;
  double get dailyCap => _dailyTokenCap;
  bool get isDailyCapped => _todayEarnings >= _dailyTokenCap;

  void resetSession() => _validPackets.clear();
}