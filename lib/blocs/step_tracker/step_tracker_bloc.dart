// lib/blocs/step_tracker/step_tracker_bloc.dart
// BLoC для трекинга шагов.
// Подписывается на MovementService, управляет сессией, сохраняет данные.

import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../models/gps_point.dart';
import '../../models/step_data_packet.dart';
import '../../repositories/step_repository.dart';
import '../../services/movement_service.dart';

part 'step_tracker_event.dart';
part 'step_tracker_state.dart';

class StepTrackerBloc extends Bloc<StepTrackerEvent, StepTrackerState> {
  final MovementService _movementService;
  final StepRepository _repository;

  StreamSubscription<StepDataPacket>? _dataSubscription;

  StepTrackerBloc({
    required MovementService movementService,
    required StepRepository repository,
  })  : _movementService = movementService,
        _repository = repository,
        super(const StepTrackerIdle()) {
    on<TrackingStarted>(_onStart);
    on<TrackingStopped>(_onStop);
    on<StepDataReceived>(_onData);
  }

  // ─── Обработчики событий ───────────────────────────────────────────────────

  void _onStart(TrackingStarted event, Emitter<StepTrackerState> emit) {
    _movementService.start();

    // Подписываемся на стрим и конвертируем данные в события BLoC
    _dataSubscription = _movementService.dataStream.listen(
      (packet) => add(StepDataReceived(packet)),
      onError: (e) => addError(e),
      cancelOnError: false, // не останавливаемся при одной ошибке
    );

    emit(StepTrackerRunning(
      totalSteps: 0,
      currentPosition: const GpsPoint(
        latitude: 41.2995,
        longitude: 69.2401,
        accuracy: 0,
        timestamp: null, // заглушка
      ),
      isSuspicious: false,
      confidenceScore: 1.0,
      sessionEarnings: 0.0,
      suspicionStreak: 0,
    ));
  }

  Future<void> _onData(
    StepDataReceived event,
    Emitter<StepTrackerState> emit,
  ) async {
    final packet = event.packet;

    // Проверяем накопленный паттерн подозрений
    if (_movementService.antiCheat.shouldBlockSession) {
      emit(const StepTrackerBlocked(
        reason: 'Обнаружена механическая симуляция шагов. Сессия заблокирована.',
      ));
      await _dataSubscription?.cancel();
      return;
    }

    // Сохраняем только валидные пакеты
    if (!packet.isSuspicious) {
      final earned = _repository.computeEarnings(packet.stepCount);
      _repository.addEarnings(earned);
      await _repository.savePacket(packet);
    }

    emit(StepTrackerRunning(
      totalSteps: packet.stepCount,
      currentPosition: packet.position,
      isSuspicious: packet.isSuspicious,
      confidenceScore: packet.confidenceScore,
      sessionEarnings: _repository.todayEarnings,
      suspicionStreak: _movementService.antiCheat.suspicionStreak,
    ));
  }

  Future<void> _onStop(
    TrackingStopped event,
    Emitter<StepTrackerState> emit,
  ) async {
    await _dataSubscription?.cancel();
    _movementService.dispose();
    _repository.resetSession();
    emit(const StepTrackerIdle());
  }

  @override
  Future<void> close() async {
    await _dataSubscription?.cancel();
    _movementService.dispose();
    return super.close();
  }
}