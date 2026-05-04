// lib/blocs/step_tracker/step_tracker_event.dart
part of 'step_tracker_bloc.dart';

sealed class StepTrackerEvent {}

/// Пользователь нажал «Начать трекинг»
final class TrackingStarted extends StepTrackerEvent {}

/// Пользователь нажал «Остановить»
final class TrackingStopped extends StepTrackerEvent {}

/// Новый пакет данных от MovementService
final class StepDataReceived extends StepTrackerEvent {
  final StepDataPacket packet;
  StepDataReceived(this.packet);
}