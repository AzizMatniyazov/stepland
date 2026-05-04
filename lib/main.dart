// lib/main.dart
// Точка входа приложения Stepland.
// Инициализирует фоновый сервис, внедряет зависимости, запускает приложение.

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'blocs/step_tracker/step_tracker_bloc.dart';
import 'features/map/tracking_screen.dart';
import 'repositories/step_repository.dart';
import 'services/background_service_setup.dart';
import 'services/movement_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Инициализация фонового сервиса (Android Foreground + iOS Background)
  await initBackgroundService();

  runApp(const SteplandApp());
}

class SteplandApp extends StatelessWidget {
  const SteplandApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      // ── Внедряем репозитории ────────────────────────────────────────────────
      providers: [
        RepositoryProvider(create: (_) => StepRepository()),
        RepositoryProvider(create: (_) => MovementService()),
      ],
      child: MultiBlocProvider(
        // ── Внедряем BLoC с зависимостями из репозиториев ──────────────────
        providers: [
          BlocProvider(
            create: (ctx) => StepTrackerBloc(
              movementService: ctx.read<MovementService>(),
              repository: ctx.read<StepRepository>(),
            ),
          ),
        ],
        child: MaterialApp(
          title: 'Stepland',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            colorSchemeSeed: Colors.green,
            useMaterial3: true,
          ),
          home: const TrackingScreen(),
        ),
      ),
    );
  }
}