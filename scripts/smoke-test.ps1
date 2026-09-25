# End-to-end smoke test for the Africinnovate assessment (run against `npm start` on :3000)
$ErrorActionPreference = "Stop"
$base = if ($env:SMOKE_BASE) { $env:SMOKE_BASE } else { "http://localhost:3001" }
$script:pass = 0; $script:fail = 0

function Check($name, $cond, $detail = "") {
  if ($cond) { $script:pass++; Write-Host "PASS  $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "FAIL  $name  $detail" -ForegroundColor Red }
}

# --- wait for server (max ~60s) ---
$up = $false
for ($i = 0; $i -lt 30; $i++) {
  try { $r = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $up = $true; break } } catch { Start-Sleep -Seconds 2 }
}
Check "server starts" $up
if (-not $up) { Write-Host "`nSERVER NEVER CAME UP"; exit 1 }

# --- 1. public pages ---
Check "landing page" ((Invoke-WebRequest -Uri "$base/" -UseBasicParsing).StatusCode -eq 200)
$intro = Invoke-WebRequest -Uri "$base/a/tech-aptitude-1" -UseBasicParsing
Check "intro page renders a question count" ($intro.StatusCode -eq 200 -and $intro.Content -match "\b7[0-9] questions")
Check "intro page shows consent" ($intro.Content -match "consent|Consent")

# unique per run so re-runs don't collide with a previously submitted attempt
$email = "smoke-$(Get-Date -Format yyyyMMddHHmmss)@example.com"
$body = @{
  fullName = "Smoke Test Candidate"; email = $email; phone = "08012345678"
  educationLevel = "Undergraduate"; occupation = "Student"
  ageRange = "18-24"; techExposure = "Some (I have tried a tool or tutorial)"
  hoursPerWeek = "5-10 hours"; preferredFormat = "Live classes"; consent = $true
} | ConvertTo-Json
$reg = Invoke-RestMethod -Method Post -Uri "$base/api/public/assessments/tech-aptitude-1/attempts" -ContentType "application/json" -Body $body
Check "register -> attempt token" ([bool]$reg.attemptToken)
$token = $reg.attemptToken

# resume with same email returns same attempt
$reg2 = Invoke-RestMethod -Method Post -Uri "$base/api/public/assessments/tech-aptitude-1/attempts" -ContentType "application/json" -Body $body
Check "resume returns same attempt" ($reg2.attemptToken -eq $token -and $reg2.resumed -eq $true)

# --- 3. engine payload: no answer-key leakage ---
$engine = Invoke-RestMethod -Uri "$base/api/attempts/$token"
Check "engine payload has 73 questions" ($engine.questions.Count -eq 73) "got $($engine.questions.Count)"
Check "engine payload has 9 sections" ($engine.sections.Count -eq 9)
$engineJson = $engine | ConvertTo-Json -Depth 12
Check "no isCorrect leaked" ($engineJson -notmatch '"isCorrect"')
Check "no mapJson leaked" ($engineJson -notmatch '"mapJson"')
Check "no competency tags leaked" ($engineJson -notmatch '"comps"')
Check "no correctPosition leaked" ($engineJson -notmatch '"correctPosition"')
Check "timer config present" ($engine.config.timerMode -eq "OVERALL")

# --- 4. answer a handful of questions (first of each type we hit) ---
$answered = 0
foreach ($q in $engine.questions) {
  if ($answered -ge 10) { break }
  $sel = @()
  if ($q.options.Count -gt 0 -and $q.type -ne "OPEN_ENDED") { $sel = @($q.options[0].id) }
  $resp = @{ questionId = $q.id; selectedOptionIds = $sel; textResponse = $(if ($q.type -eq "OPEN_ENDED") { "I would keep clear records, check them regularly and fix problems early." } else { $null }); timeSpentMs = 1500; currentQuestionId = $q.id } | ConvertTo-Json -Depth 5
  try {
    $save = Invoke-RestMethod -Method Post -Uri "$base/api/attempts/$token/responses" -ContentType "application/json" -Body $resp
    $answered++
  } catch { Write-Host "  save failed for $($q.type): $($_.Exception.Message)" }
}
Check "autosaved >=10 responses" ($answered -ge 10) "saved $answered"

# --- 5. submit (idempotent) ---
$sub = Invoke-RestMethod -Method Post -Uri "$base/api/attempts/$token/submit" -ContentType "application/json" -Body '{"timedOut":false}'
Check "submit ok -> reportUrl" ($sub.ok -eq $true -and $sub.reportUrl) 
$sub2 = Invoke-RestMethod -Method Post -Uri "$base/api/attempts/$token/submit" -ContentType "application/json" -Body '{"timedOut":false}'
Check "duplicate submit idempotent" ($sub2.alreadySubmitted -eq $true)

# --- 6. student report: no internal data ---
$report = Invoke-RestMethod -Uri "$base/api/attempts/$token/report"
Check "report has profile" ([bool]$report.profileType)
Check "report has primary/why content" (($report.why.Count -gt 0) -or ($report.explorerMessage))
Check "report has disclaimer" ($report.disclaimer.Length -gt 20)
$reportJson = $report | ConvertTo-Json -Depth 8
Check "report hides weights/thresholds" ($reportJson -notmatch '"weight"|"minScore"|"confidence"|"isCorrect"')
$reportPage = Invoke-WebRequest -Uri "$base/report/$token" -UseBasicParsing
Check "report page renders" ($reportPage.StatusCode -eq 200)

# --- 7. admin auth ---
# unauthenticated admin API must 401
try {
  Invoke-RestMethod -Uri "$base/api/admin/questions" -TimeoutSec 5 | Out-Null
  Check "admin API 401 without session" $false "got 200"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Check "admin API 401 without session" ($code -eq 401) "got $code"
}
# unauthenticated admin page redirects to login
$redir = Invoke-WebRequest -Uri "$base/admin" -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
if (-not $redir) { $redir = $null }
try { $redir = Invoke-WebRequest -Uri "$base/admin" -UseBasicParsing -MaximumRedirection 0 } catch { $redir = $_.Exception.Response }
Check "admin page redirects when signed out" ($redir.StatusCode -eq 307 -or $redir.StatusCode -eq 302 -or ([int]$redir.StatusCode) -eq 307)

# login
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body '{"email":"admin@africinnovate.com","password":"Admin123!"}' -WebSession $session
Check "admin login" ([bool]$login.user -or $login.ok -eq $true -or [bool]$login.role) ($login | ConvertTo-Json -Compress)
$me = Invoke-RestMethod -Uri "$base/api/auth/me" -WebSession $session
Check "session me = ADMIN" ($me.user.role -eq "ADMIN") ($me | ConvertTo-Json -Compress)

# --- 8. admin pages ---
$dash = Invoke-WebRequest -Uri "$base/admin" -UseBasicParsing -WebSession $session
Check "dashboard renders" ($dash.StatusCode -eq 200 -and $dash.Content -match "Dashboard")
Check "dashboard shows our candidate" ($dash.Content -match "Smoke Test Candidate")
$cands = Invoke-WebRequest -Uri "$base/admin/candidates" -UseBasicParsing -WebSession $session
Check "candidates list renders" ($cands.Content -match [regex]::Escape($email))

# find attempt id for detail page
$attemptId = $null
if ($cands.Content -match '/admin/candidates/([a-z0-9]+)') { $attemptId = $Matches[1] }
Check "candidate detail link present" ([bool]$attemptId)
if ($attemptId) {
  $detail = Invoke-WebRequest -Uri "$base/admin/candidates/$attemptId" -UseBasicParsing -WebSession $session
  Check "candidate detail renders scores" ($detail.StatusCode -eq 200 -and $detail.Content -match "Course fit ranking|Overall result")
}

# --- 9. config pages (admin) ---
foreach ($p in @("questions", "versions", "courses", "weights", "competencies", "settings")) {
  try {
    $r = Invoke-WebRequest -Uri "$base/admin/$p" -UseBasicParsing -WebSession $session -TimeoutSec 15
    Check "admin/$p renders" ($r.StatusCode -eq 200)
  } catch { Check "admin/$p renders" $false $_.Exception.Message }
}

# --- 10. settings PATCH + weights PUT sanity ---
$patch = Invoke-RestMethod -Method Patch -Uri "$base/api/admin/settings" -ContentType "application/json" -Body '{"duration_minutes":60}' -WebSession $session
Check "settings PATCH" ($patch.applied.duration_minutes -eq "60")

# --- 11. CSV export ---
$csv = Invoke-WebRequest -Uri "$base/api/admin/export" -UseBasicParsing -WebSession $session
Check "CSV export returns rows" ($csv.StatusCode -eq 200 -and $csv.Content -match [regex]::Escape($email))
Check "CSV has competency columns" ($csv.Content -match "Logical Reasoning")

# --- 12. version immutability ---
$vers = Invoke-RestMethod -Uri "$base/api/admin/versions" -WebSession $session
$pub = $vers.versions | Where-Object { $_.status -eq "PUBLISHED" } | Select-Object -First 1
if ($pub) {
  $qInPub = Invoke-RestMethod -Uri "$base/api/admin/questions?versionId=$($pub.id)" -WebSession $session
  if ($qInPub.questions.Count -gt 0) {
    $qid = $qInPub.questions[0].id
    $orig = $qInPub.questions[0].prompt
    try {
      Invoke-RestMethod -Method Patch -Uri "$base/api/admin/questions/$qid" -ContentType "application/json" -Body (@{ sectionId=$qInPub.questions[0].sectionId; type=$qInPub.questions[0].type; prompt="$orig (edited)"; difficulty=2; active=$true; position=$qInPub.questions[0].position; options=@(); competencies=@() } | ConvertTo-Json -Depth 6) -WebSession $session | Out-Null
      Check "published question edit BLOCKED" $false "edit succeeded!"
    } catch {
      $code = $_.Exception.Response.StatusCode.value__
      Check "published question edit BLOCKED" ($code -eq 409) "got $code"
    }
  } else { Check "published question edit BLOCKED" $false "no questions returned" }
} else { Check "published version exists" $false }

Write-Host ""
Write-Host "===============================" 
Write-Host " PASSED: $script:pass   FAILED: $script:fail" -ForegroundColor $(if ($script:fail -eq 0) { "Green" } else { "Red" })
Write-Host "==============================="
if ($script:fail -gt 0) { exit 1 }
