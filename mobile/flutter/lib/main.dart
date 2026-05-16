import 'package:flutter/material.dart';
import 'services/fcm_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/start_screen.dart';
import 'screens/notification_settings_screen.dart';
import 'screens/my_tickets_screen.dart';
import 'screens/ticket_conversation_screen.dart';
import 'services/auth_service.dart';
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
      // Définition des routes
      routes: {
        '/': (context) => const AuthWrapper(), // Route par défaut avec vérification auth
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
      initialRoute: '/', // Route initiale
    );
  }
}

/// Widget qui vérifie si l'utilisateur est connecté et redirige automatiquement
class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _isLoading = true;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkAuthStatus();
  }

  /// Vérifier si l'utilisateur a déjà un token valide
  Future<void> _checkAuthStatus() async {
    final isLoggedIn = await AuthService.instance.isLoggedIn();
    if (isLoggedIn) {
      try {
        await NotificationService.instance.syncDeviceTokenAfterLogin();
      } catch (_) {}
    }
    setState(() {
      _isLoggedIn = isLoggedIn;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      // Afficher un loader pendant la vérification
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    // Redirection automatique
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_isLoggedIn) {
        Navigator.pushReplacementNamed(context, '/home');
      } else {
        Navigator.pushReplacementNamed(context, '/login');
      }
    });

    // Retourner un widget temporaire
    return const SizedBox.shrink();
  }
}
