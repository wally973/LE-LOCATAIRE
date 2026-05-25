# Lance le test E2E flux mobile (client simulé)
Set-Location $PSScriptRoot\..
Write-Host "Seed demo (si besoin)…" -ForegroundColor Cyan
npx ts-node scripts/seed-lia-demo.ts
Write-Host "Test flux mobile…" -ForegroundColor Cyan
npm run test:mobile-flow
exit $LASTEXITCODE
