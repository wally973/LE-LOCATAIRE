import 'package:http/http.dart' as http;
import '../config.dart';

class BackendConnectivityResult {
  final String endpoint;
  final bool reachable;

  const BackendConnectivityResult({
    required this.endpoint,
    required this.reachable,
  });
}

class BackendConnectivityService {
  BackendConnectivityService._();
  static final BackendConnectivityService instance = BackendConnectivityService._();

  Future<BackendConnectivityResult> check() async {
    final endpoint = getApiEndpoint();
    try {
      final response = await http
          .get(Uri.parse(endpoint))
          .timeout(const Duration(seconds: 4));

      // Même un 404 prouve que le serveur répond : le problème n'est pas le réseau.
      return BackendConnectivityResult(
        endpoint: endpoint,
        reachable: response.statusCode < 500 || response.statusCode == 404,
      );
    } catch (_) {
      return BackendConnectivityResult(endpoint: endpoint, reachable: false);
    }
  }
}
