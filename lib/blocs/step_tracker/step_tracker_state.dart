// lib/blocs/step_tracker/step_tracker_state.dart
part of 'step_tracker_bloc.dart';

sealed class StepTrackerState extends Equatable {
  const StepTrackerState();
}

/// Трекинг не запущен
final class StepTrackerIdle extends StepTrackerState {
  const StepTrackerIdle();
  @override
  List<Object> get props => [];
}

/// Трекинг активен — обновляется каждый тик
final class StepTrackerRunning extends StepTrackerState {
  final int totalSteps;
  final GpsPoint currentPosition;
  final bool isSuspicious;       // текущий тик подозрителен
  final double confidenceScore;  // насколько «честное» движение (0.0–1.0)
  final double sessionEarnings;  // токенов заработано сегодня
  final int suspicionStreak;     // подряд идущих подозрительных тиков

  const StepTrackerRunning({
    required this.totalSteps,
    required this.currentPosition,
    required this.isSuspicious,
    required this.confidenceScore,
    required this.sessionEarnings,
    required this.suspicionStreak,
  });

  @override
  List<Object> get props => [
        totalSteps,
        isSuspicious,
        sessionEarnings,
        suspicionStreak,
      ];
}

/// Сессия заблокирована античитом
final class StepTrackerBlocked extends StepTrackerState {
  final String reason;
  const StepTrackerBlocked({required this.reason});
  @override
  List<Object> get props => [reason];
}