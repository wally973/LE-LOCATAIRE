# Script de démarrage rapide Le Locataire
# Lance tous les composants du système

Write-Host "🚀 Démarrage Le Locataire" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# 1. Vérifier si Node.js est installé
Write-Host "1. Vérification des prérequis..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✓ Node.js détecté: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org" -ForegroundColor Red
    exit 1
}

# 2. Vérifier si Flutter est installé
try {
    $flutterVersion = flutter --version | Select-Object -First 1
    Write-Host "   ✓ Flutter détecté: $flutterVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Flutter n'est pas installé. Veuillez l'installer depuis https://flutter.dev" -ForegroundColor Red
    exit 1
}

# 3. Configuration réseau
Write-Host "2. Configuration réseau..." -ForegroundColor Yellow
$setupScript = "$PSScriptRoot\setup-network.ps1"
if (Test-Path $setupScript) {
    Write-Host "   Exécution du script de configuration réseau..." -ForegroundColor White
    & $setupScript
} else {
    Write-Host "   ⚠️ Script setup-network.ps1 non trouvé" -ForegroundColor Yellow
}

# 4. Démarrage du backend
Write-Host "3. Démarrage du backend NestJS..." -ForegroundColor Yellow
$backendPath = "$PSScriptRoot\..\backend"

if (Test-Path "$backendPath\package.json") {
    Set-Location $backendPath

    # Installer les dépendances si node_modules n'existe pas
    if (!(Test-Path "node_modules")) {
        Write-Host "   Installation des dépendances..." -ForegroundColor White
        npm install
    }

    # Démarrer le backend en arrière-plan
    Write-Host "   Démarrage du serveur..." -ForegroundColor White
    Start-Process -FilePath "npm" -ArgumentList "run", "start:dev" -NoNewWindow

    Write-Host "   ✓ Backend démarré sur http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "   ❌ Dossier backend non trouvé" -ForegroundColor Red
}

# 5. Démarrage de Flutter
Write-Host "4. Préparation de Flutter..." -ForegroundColor Yellow
$flutterPath = "$PSScriptRoot\..\mobile\flutter"

if (Test-Path "$flutterPath\pubspec.yaml") {
    Set-Location $flutterPath

    # Installer les dépendances Flutter
    Write-Host "   Installation des packages Flutter..." -ForegroundColor White
    flutter pub get

    Write-Host "   ✓ Flutter prêt. Lancez 'flutter run' dans un nouveau terminal" -ForegroundColor Green
} else {
    Write-Host "   ❌ Dossier Flutter non trouvé" -ForegroundColor Red
}

# 6. Instructions finales
Write-Host "" -ForegroundColor White
Write-Host "🎉 Système Le Locataire démarré !" -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "📋 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "1. Backend: http://localhost:3000 (API + Swagger)" -ForegroundColor White
Write-Host "2. Admin Web: Ouvrez web-admin/index.html dans votre navigateur" -ForegroundColor White
Write-Host "3. Bailleur Web: Ouvrez web-bailleur/index.html dans votre navigateur" -ForegroundColor White
Write-Host "4. Mobile: Dans un nouveau terminal, allez dans mobile/flutter et tapez 'flutter run'" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "🔑 Comptes de test :" -ForegroundColor Cyan
Write-Host "• Admin: admin@lelocataire.com / admin123" -ForegroundColor White
Write-Host "• Bailleur: bailleur@lelocataire.com / bailleur123" -ForegroundColor White
Write-Host "• Locataire: locataire@lelocataire.com / locataire123" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "📚 Documentation: Lisez README.md pour plus de détails" -ForegroundColor Cyan

Write-Host "" -ForegroundColor White
Read-Host "Appuyez sur Entrée pour quitter"