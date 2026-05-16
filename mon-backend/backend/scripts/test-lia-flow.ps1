# Test automatique du flux Lia (API) - backend sur :3000
$BaseUrl = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3000" }
$Email = if ($env:TEST_TENANT_EMAIL) { $env:TEST_TENANT_EMAIL } else { "demo.locataire@lelocataire.test" }
$Password = if ($env:TEST_TENANT_PASSWORD) { $env:TEST_TENANT_PASSWORD } else { "DemoLocataire1!" }

Write-Host "=== Test Lia API ===" -ForegroundColor Cyan
Write-Host "URL: $BaseUrl"

$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
  $login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
} catch {
  Write-Host "ECHEC login: $_" -ForegroundColor Red
  exit 1
}
$token = $login.access_token
if (-not $token) { Write-Host "ECHEC: pas de token"; exit 1 }
Write-Host "OK login locataire" -ForegroundColor Green

$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$me = Invoke-RestMethod -Uri "$BaseUrl/tenant/me" -Headers $headers
$housingId = $me.tenant.housingId
if (-not $housingId) { Write-Host "ECHEC: pas de logement"; exit 1 }
Write-Host "OK logement id=$housingId ($($me.tenant.firstName))" -ForegroundColor Green

$createBody = @{
  title = "Fuite sous l evier (test)"
  description = "De l eau coule depuis ce matin sous l evier de la cuisine."
  housingId = $housingId
} | ConvertTo-Json
$ticket = Invoke-RestMethod -Uri "$BaseUrl/tickets" -Method POST -Headers $headers -Body $createBody
$ticketId = $ticket.id
$msgCount = @($ticket.messages).Count
Write-Host "OK ticket #$ticketId statut=$($ticket.status) $msgCount messages immediats" -ForegroundColor Green

foreach ($m in $ticket.messages) {
  $preview = $m.content.Substring(0, [Math]::Min(80, $m.content.Length))
  Write-Host "  [$($m.role)] $preview..."
}

Write-Host "Attente analyse (6 s)..." -ForegroundColor Gray
Start-Sleep -Seconds 6

$messages = Invoke-RestMethod -Uri "$BaseUrl/tickets/$ticketId/messages" -Headers $headers
$ticket2 = Invoke-RestMethod -Uri "$BaseUrl/tickets/$ticketId" -Headers $headers
Write-Host "Apres analyse: statut=$($ticket2.status) total=$($messages.Count) messages" -ForegroundColor Green
foreach ($m in $messages) {
  $preview = $m.content.Substring(0, [Math]::Min(60, $m.content.Length))
  Write-Host "  [$($m.role)] $preview..."
}

$replyBody = @{ content = "La fuite a empire depuis hier soir." } | ConvertTo-Json
$afterReply = Invoke-RestMethod -Uri "$BaseUrl/tickets/$ticketId/messages" -Method POST -Headers $headers -Body $replyBody
Write-Host "OK message locataire total=$($afterReply.Count)" -ForegroundColor Green

Write-Host ""
Write-Host "=== Test API OK ===" -ForegroundColor Cyan
Write-Host "Flutter - Email: $Email"
Write-Host "Flutter - Mot de passe: $Password"
