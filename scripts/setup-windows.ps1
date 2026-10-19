$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$project = (Get-Location).Path

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 22 or newer from nodejs.org, reopen PowerShell, and retry.'
}
$nodeVersion = & node -p 'Number(process.versions.node.split(".")[0])'
if ([int]$nodeVersion -lt 22) { throw 'Node.js 22 or newer is required.' }
if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw 'Install Python 3.11 with the Python launcher from python.org, reopen PowerShell, and retry.'
}
Invoke-Checked 'py' @('-3.11', '--version')
Invoke-Checked 'npm.cmd' @('ci')
if (-not (Test-Path '.voice-venv/Scripts/python.exe')) {
    Invoke-Checked 'py' @('-3.11', '-m', 'venv', '.voice-venv')
}
$voicePython = Join-Path $project '.voice-venv/Scripts/python.exe'
# Install official CPU wheels to avoid downloading CUDA runtimes.
Invoke-Checked $voicePython @('-m', 'pip', 'install', 'torch==2.6.0', 'torchaudio==2.6.0', '--index-url', 'https://download.pytorch.org/whl/cpu')
Invoke-Checked $voicePython @('-m', 'pip', 'install', '-r', 'local_voice/requirements.txt')
Invoke-Checked $voicePython @('-c', 'import torch; from chatterbox.tts import ChatterboxTTS; print("Local engine imports successfully. CUDA available:", torch.cuda.is_available())')
Invoke-Checked 'npm.cmd' @('test')

New-Item -ItemType Directory -Force -Path 'references', 'output' | Out-Null
if (-not (Test-Path '.env')) {
    $pythonPath = $voicePython.Replace('\', '/')
    $referencePath = (Join-Path $project 'references/voice.wav').Replace('\', '/')
    $outputPath = (Join-Path $project 'output').Replace('\', '/')
    @"
VOICE_PYTHON="$pythonPath"
VOICE_REFERENCE_FILE="$referencePath"
VOICE_DEVICE=cpu
VOICE_OUTPUT_DIR="$outputPath"
"@ | Set-Content -Encoding utf8 '.env'
} else {
    Write-Host 'Existing .env preserved. Check VOICE_PYTHON, VOICE_REFERENCE_FILE and VOICE_DEVICE=cpu.'
}

$nodePath = (Get-Command node).Source
$config = @{
    mcpServers = @{
        'gpthub-voice' = @{
            command = $nodePath
            args = @("--env-file=$(Join-Path $project '.env')", (Join-Path $project 'mcp/server.js'))
        }
    }
}
$config | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 'claude-config.local.json'
Write-Host 'Dependencies installed. Live synthesis is not yet tested.'
Write-Host 'Place a clean 10-20 second voice reference at references/voice.wav.'
Write-Host 'Merge claude-config.local.json into Claude Desktop developer configuration, preserving existing servers; then restart Claude.'
Write-Host 'First generation downloads model weights and may take a while on CPU.'
