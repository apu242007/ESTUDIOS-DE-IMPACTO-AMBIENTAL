# Arranca el worker en esta PC, sin Docker (A.3): carga .env, suma LibreOffice al PATH y deja un log.
# Uso: powershell -ExecutionPolicy Bypass -File apps\worker\run_worker.ps1
Set-Location $PSScriptRoot
Get-Content .env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
  $k, $v = $_ -split '=', 2
  [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), 'Process')
}
$lo = Join-Path $env:LOCALAPPDATA 'Programs\LibreOffice\program'
if (Test-Path $lo) { $env:PATH = "$env:PATH;$lo" }
$env:PYTHONIOENCODING = 'utf-8'
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001 *>> worker.log
