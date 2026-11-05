$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    Push-Location backend
    try {
        & ./.venv/Scripts/python.exe -m pytest -q
        if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
    } finally { Pop-Location }
    Push-Location frontend
    try {
        & npm.cmd run lint
        if ($LASTEXITCODE -ne 0) { throw 'Frontend lint failed' }
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    } finally { Pop-Location }
} finally { Pop-Location }
