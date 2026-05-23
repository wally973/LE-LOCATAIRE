import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';
import '../models/legal_reference.dart';

/// Catalogue juridique embarqué + sync optionnelle via API (hors ligne d’abord).
class LegalReferenceStore {
  LegalReferenceStore._();
  static final LegalReferenceStore instance = LegalReferenceStore._();

  static const _assetPath = 'assets/legal/legal_references.json';
  static const _prefVersion = 'legal_refs_version';
  static const _prefUpdatedAt = 'legal_refs_updated_at';

  LegalReferencesCatalog? _catalog;

  Future<LegalReferencesCatalog> loadCatalog({bool forceReload = false}) async {
    if (_catalog != null && !forceReload) {
      return _catalog!;
    }
    final jsonStr = await rootBundle.loadString(_assetPath);
    _catalog = LegalReferencesCatalog.fromJson(
      jsonDecode(jsonStr) as Map<String, dynamic>,
    );
    return _catalog!;
  }

  /// Recherche locale par mots-clés (sans réseau).
  Future<List<LegalReferenceEntry>> search({
    required String query,
    String? category,
    int limit = 8,
  }) async {
    final catalog = await loadCatalog();
    final tokens = query
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((t) => t.length > 2)
        .toList();

    final scored = <LegalReferenceEntry>[];
    for (final entry in catalog.entries) {
      if (category != null && entry.category != category) {
        continue;
      }
      final hay =
          '${entry.title} ${entry.summary} ${entry.content} ${entry.keywords.join(' ')} ${entry.category}'
              .toLowerCase();
      var score = 0.0;
      for (final token in tokens) {
        if (hay.contains(token)) score += 2;
      }
      if (category != null && entry.category == category) score += 3;
      if (score > 0) {
        scored.add(LegalReferenceEntry(
          slug: entry.slug,
          kind: entry.kind,
          category: entry.category,
          title: entry.title,
          summary: entry.summary,
          content: entry.content,
          responsibilityHint: entry.responsibilityHint,
          keywords: entry.keywords,
          sources: entry.sources,
          exceptions: entry.exceptions,
          sortOrder: entry.sortOrder,
          score: score,
        ));
      }
    }
    scored.sort((a, b) => b.score.compareTo(a.score));
    return scored.take(limit).toList();
  }

  /// Sync API si réseau (remplace le cache mémoire, pas l’asset).
  Future<bool> trySyncFromApi() async {
    try {
      final base = getApiEndpoint();
      final versionUri = Uri.parse('$base/legal-references/version');
      final versionRes = await http
          .get(versionUri)
          .timeout(const Duration(seconds: 8));
      if (versionRes.statusCode != 200) return false;

      final remoteVersion =
          (jsonDecode(versionRes.body) as Map<String, dynamic>)['version']
              as int?;
      final prefs = await SharedPreferences.getInstance();
      final localVersion = prefs.getInt(_prefVersion) ?? 0;
      if (remoteVersion != null && remoteVersion <= localVersion) {
        return false;
      }

      final catalogUri = Uri.parse('$base/legal-references/catalog');
      final catalogRes = await http
          .get(catalogUri)
          .timeout(const Duration(seconds: 15));
      if (catalogRes.statusCode != 200) return false;

      final catalog = LegalReferencesCatalog.fromJson(
        jsonDecode(catalogRes.body) as Map<String, dynamic>,
      );
      _catalog = catalog;
      await prefs.setInt(_prefVersion, catalog.version);
      await prefs.setString(_prefUpdatedAt, catalog.updatedAt);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> versionInfo() async {
    final prefs = await SharedPreferences.getInstance();
    final catalog = await loadCatalog();
    return {
      'version': prefs.getInt(_prefVersion) ?? catalog.version,
      'updatedAt': prefs.getString(_prefUpdatedAt) ?? catalog.updatedAt,
      'entryCount': catalog.entries.length,
      'source': 'asset',
    };
  }
}
