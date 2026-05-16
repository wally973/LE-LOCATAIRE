# Test Sprint G — pipeline pathologiste + juriste (simulation ou LLM selon .env)
$BaseUrl = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3000" }
$Email = if ($env:TEST_TENANT_EMAIL) { $env:TEST_TENANT_EMAIL } else { "demo.locataire@lelocataire.test" }
$Password = if ($env:TEST_TENANT_PASSWORD) { $env:TEST_TENANT_PASSWORD } else { "DemoLocataire1!" }

Write-Host "=== Test Sprint G (pipeline Lia) ===" -ForegroundColor Cyan
Write-Host "AI_PIPELINE_MODE = $(if ($env:AI_PIPELINE_MODE) { $env:AI_PIPELINE_MODE } else { '(defaut: lia)' })"

$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.access_token)"; "Content-Type" = "application/json" }

$me = Invoke-RestMethod -Uri "$BaseUrl/tenant/me" -Headers $headers
$housingId = $me.tenant.housingId

$cases = @(
  @{ title = "Fuite sous evier"; description = "De l eau coule sous l evier de la cuisine depuis ce matin." },
  @{ title = "Moisissure mur"; description = "Taches noires sur le mur du salon pres de la fenetre." }
)

foreach ($c in $cases) {
  Write-Host ""
  Write-Host "--- Cas: $($c.title) ---" -ForegroundColor Yellow
  $body = @{ title = $c.title; description = $c.description; housingId = $housingId } | ConvertTo-Json
  $ticket = Invoke-RestMethod -Uri "$BaseUrl/tickets" -Method POST -Headers $headers -Body $body
  Write-Host "Ticket #$($ticket.id) statut=$($ticket.status) resp=$($ticket.responsibility)"
  Start-Sleep -Seconds 6
  $t2 = Invoke-RestMethod -Uri "$BaseUrl/tickets/$($ticket.id)" -Headers $headers
  $decision = $t2.aiLastDecision
  if ($decision) {
    Write-Host "  categorie: $($decision.category) confiance: $($decision.confidence)"
    Write-Host "  message: $($decision.messageForTenant.Substring(0, [Math]::Min(100, $decision.messageForTenant.Length)))..."
    $steps = $decision.pipelineSteps
    if ($steps) {
      foreach ($s in $steps) {
        Write-Host "  step [$($s.name)] -> $($s.decision)"
      }
    }
  }
}

Write-Host ""
Write-Host "=== Fin test Sprint G ===" -ForegroundColor Cyan
