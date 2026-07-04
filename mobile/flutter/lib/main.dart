import 'package:flutter/material.dart';
import 'services/fcm_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/start_screen.dart';
import 'screens/notification_settings_screen.dart';
import 'screens/my_tickets_screen.dart';
import 'screens/ticket_conversation_screen.dart';
import 'services/auth_service.dart';
import 'services/backend_connectivity_service.dart';
import 'services/notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FcmService.instance.init();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Assistant Technique',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        scaffoldBackgroundColor: Colors.white,
        useMaterial3: true,
      ),
      home: const AuthWrapper(),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/home': (context) => const StartScreen(),
        '/notifications/settings': (context) =>
            const NotificationSettingsScreen(),
        '/tickets': (context) => const MyTicketsScreen(),
        '/ticket/conversation': (context) {
          final args =
              ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
          return TicketConversationScreen(
            ticketId: args['ticketId'] as int,
          );
        },
      },
    );
  }
}

/// Affiche la connexion ou l’accueil selon le token enregistré (sans écran vide).
class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _isLoading = true;
  bool _isLoggedIn = false;
  BackendConnectivityResult? _backendStatus;

  @override
  void initState() {
    super.initState();
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    final backendStatus = await BackendConnectivityService.instance.check();
    final isLoggedIn = await AuthService.instance.isLoggedIn();
    if (isLoggedIn) {
      try {
        await NotificationService.instance.syncDeviceTokenAfterLogin();
      } catch (_) {}
    }
    if (!mounted) return;
    setState(() {
      _isLoggedIn = isLoggedIn;
      _backendStatus = backendStatus;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    final child = _isLoggedIn ? const StartScreen() : const LoginScreen();
    return Stack(
      children: [
        child,
        if (_backendStatus?.reachable == false)
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: SafeArea(
              child: _BackendOfflineBanner(endpoint: _backendStatus!.endpoint),
            ),
          ),
      ],
    );
  }
}

class _BackendOfflineBanner extends StatelessWidget {
  final String endpoint;

  const _BackendOfflineBanner({required this.endpoint});

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(12),
      color: Colors.red.shade50,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.wifi_off, color: Colors.red.shade800),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Connexion serveur impossible.\n'
                'Vérifiez que le PC et le téléphone sont sur le même Wi-Fi.\n'
                'Serveur : $endpoint',
                style: TextStyle(color: Colors.red.shade900, height: 1.25),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
