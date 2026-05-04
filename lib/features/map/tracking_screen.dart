// lib/features/map/tracking_screen.dart
// Главный экран трекинга: карта + панель статистики + кнопки управления.

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../blocs/step_tracker/step_tracker_bloc.dart';
import '../../models/mahalla_polygon.dart';
import 'mahalla_map_widget.dart';

class TrackingScreen extends StatelessWidget {
  const TrackingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocConsumer<StepTrackerBloc, StepTrackerState>(
        // Слушаем блокировку — показываем диалог
        listener: (context, state) {
          if (state is StepTrackerBlocked) {
            _showBlockedDialog(context, state.reason);
          }
        },
        builder: (context, state) {
          return Stack(
            children: [
              // ── Карта (весь экран) ─────────────────────────────────────────
              _buildMap(state),

              // ── Верхняя панель: статистика ─────────────────────────────────
              Positioned(
                top: MediaQuery.of(context).padding.top + 8,
                left: 16,
                right: 16,
                child: _StatsCard(state: state),
              ),

              // ── Нижняя панель: кнопки управления ──────────────────────────
              Positioned(
                bottom: 32,
                left: 16,
                right: 16,
                child: _ControlPanel(state: state),
              ),

              // ── Индикатор подозрения (если активен) ───────────────────────
              if (state is StepTrackerRunning && state.isSuspicious)
                const Positioned(
                  top: 120,
                  left: 0,
                  right: 0,
                  child: _SuspicionBanner(),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMap(StepTrackerState state) {
    // Ташкент — координаты по умолчанию
    const defaultPosition = LatLng(41.2995, 69.2401);

    final position = state is StepTrackerRunning
        ? LatLng(
            state.currentPosition.latitude,
            state.currentPosition.longitude,
          )
        : defaultPosition;

    return MahallaMapWidget(
      polygons: const [], // загружается через MapRepository
      userPosition: position,
    );
  }

  void _showBlockedDialog(BuildContext context, String reason) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: const Text('Сессия заблокирована'),
        content: Text(reason),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              context.read<StepTrackerBloc>().add(TrackingStopped());
            },
            child: const Text('Понятно'),
          ),
        ],
      ),
    );
  }
}

// ─── Карточка статистики ───────────────────────────────────────────────────────

class _StatsCard extends StatelessWidget {
  final StepTrackerState state;
  const _StatsCard({required this.state});

  @override
  Widget build(BuildContext context) {
    final steps = state is StepTrackerRunning
        ? (state as StepTrackerRunning).totalSteps
        : 0;
    final earnings = state is StepTrackerRunning
        ? (state as StepTrackerRunning).sessionEarnings
        : 0.0;
    final score = state is StepTrackerRunning
        ? (state as StepTrackerRunning).confidenceScore
        : 0.0;

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _Stat(
              icon: Icons.directions_walk,
              value: '$steps',
              label: 'шагов',
              color: Colors.green,
            ),
            _Stat(
              icon: Icons.token,
              value: earnings.toStringAsFixed(3),
              label: 'STEP',
              color: Colors.amber,
            ),
            _Stat(
              icon: Icons.shield_outlined,
              value: '${(score * 100).toInt()}%',
              label: 'trust',
              color: score > 0.7
                  ? Colors.green
                  : score > 0.4
                      ? Colors.orange
                      : Colors.red,
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;

  const _Stat({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(height: 4),
        Text(value,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.bold)),
        Text(label,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: Colors.grey)),
      ],
    );
  }
}

// ─── Панель кнопок ─────────────────────────────────────────────────────────────

class _ControlPanel extends StatelessWidget {
  final StepTrackerState state;
  const _ControlPanel({required this.state});

  @override
  Widget build(BuildContext context) {
    final isRunning = state is StepTrackerRunning;

    return FilledButton.icon(
      onPressed: () {
        final bloc = context.read<StepTrackerBloc>();
        if (isRunning) {
          bloc.add(TrackingStopped());
        } else {
          bloc.add(TrackingStarted());
        }
      },
      icon: Icon(isRunning ? Icons.stop_circle : Icons.play_circle),
      label: Text(isRunning ? 'Остановить трекинг' : 'Начать трекинг'),
      style: FilledButton.styleFrom(
        backgroundColor: isRunning ? Colors.red : Colors.green,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }
}

// ─── Баннер подозрения ─────────────────────────────────────────────────────────

class _SuspicionBanner extends StatelessWidget {
  const _SuspicionBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.orange.shade100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.orange),
      ),
      child: const Row(
        children: [
          Icon(Icons.warning_amber, color: Colors.orange),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Обнаружено нетипичное движение. Шаги не засчитываются.',
              style: TextStyle(color: Colors.orange, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}