<#
.SYNOPSIS
  Rotate the Daily.co webhook signing secret for the Pulse Meetings recording
  pipeline (daily-webhook edge function).

.DESCRIPTION
  Generates a fresh cryptographically-random base64 secret LOCALLY, registers a
  new Daily webhook with it, points the Supabase function's DAILY_WEBHOOK_SECRET
  at the same value, then deletes the old webhook(s) for this URL. The new secret
  is never printed or echoed — it only lives in this process and in the two
  systems that need it (Daily + the function secret).

  Order is create -> set-secret -> delete-old, so an early failure never leaves
  you with a working secret nowhere.

.PARAMETER DailyApiKey
  Your Daily REST API key (Bearer token). Find it at https://dashboard.daily.co/developers.
  Passed at the CLI so it stays out of any saved file.

.EXAMPLE
  .\scripts\rotate-daily-webhook.ps1 -DailyApiKey "your-daily-key"

.NOTES
  Requires the Supabase CLI on PATH (used for `supabase secrets set`).
  The function reads the secret at runtime, so no redeploy is needed.
#>
param(
  [Parameter(Mandatory = $true)][string]$DailyApiKey,
  [string]$ProjectRef = "ucaeuszgoihoyrvhewxk",
  [string]$WebhookUrl = "https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/daily-webhook"
)

$ErrorActionPreference = "Stop"
$headers = @{ Authorization = "Bearer $DailyApiKey" }

# 1. Generate a fresh 32-byte base64 secret (cryptographically secure). Never printed.
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$newSecret = [Convert]::ToBase64String($bytes)
Write-Host "1/4  Generated a new base64 secret (kept local, not printed)."

# 2. Create the NEW webhook first — if this fails, nothing has changed yet.
$createBody = @{
  url        = $WebhookUrl
  eventTypes = @("recording.ready-to-download", "recording.error")
  hmac       = $newSecret
} | ConvertTo-Json -Compress
$new = Invoke-RestMethod -Method Post -Uri "https://api.daily.co/v1/webhooks" `
  -Headers $headers -ContentType "application/json" -Body $createBody
Write-Host "2/4  Created new Daily webhook: $($new.uuid)  (state=$($new.state))"

# 3. Point the function secret at the same value (runtime pickup, no redeploy).
& supabase secrets set "DAILY_WEBHOOK_SECRET=$newSecret" --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "supabase secrets set failed (exit $LASTEXITCODE)" }
Write-Host "3/4  Updated DAILY_WEBHOOK_SECRET on the function."

# 4. Delete every OTHER webhook pointing at this URL (the old / leaked one).
$list = Invoke-RestMethod -Method Get -Uri "https://api.daily.co/v1/webhooks" -Headers $headers
$webhooks = if ($list.PSObject.Properties.Name -contains 'data') { $list.data } else { $list }
$deleted = 0
foreach ($wh in $webhooks) {
  if ($wh.url -eq $WebhookUrl -and $wh.uuid -ne $new.uuid) {
    Invoke-RestMethod -Method Delete -Uri "https://api.daily.co/v1/webhooks/$($wh.uuid)" -Headers $headers | Out-Null
    Write-Host "4/4  Deleted old webhook: $($wh.uuid)"
    $deleted++
  }
}
if ($deleted -eq 0) { Write-Host "4/4  No other webhooks for this URL to delete." }

Write-Host ""
Write-Host "Rotation complete. Active webhook uuid: $($new.uuid)"
Write-Host "The previously-leaked secret is now dead. Run a recorded meeting to confirm"
Write-Host "daily-webhook keeps returning 200 (signature still verifies)."
