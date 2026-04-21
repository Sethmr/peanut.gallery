#!/usr/bin/env bash
# Installs the Linear local daemon as a launchd user agent.
#
# Idempotent — safe to re-run. Re-runs regenerate the plist (picks up any
# PATH changes for `tsx`) and reload the agent.
#
# See docs/GITHUB-MANUAL-STEPS.md § 18 for full context.

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly PLIST_TEMPLATE="${SCRIPT_DIR}/gallery.peanut.linear-daemon.plist"
readonly LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
readonly INSTALLED_PLIST="${LAUNCH_AGENTS_DIR}/gallery.peanut.linear-daemon.plist"
readonly ENV_DIR="${HOME}/.config/peanut-gallery"
readonly ENV_FILE="${ENV_DIR}/daemon.env"
readonly LABEL="gallery.peanut.linear-daemon"

log() { printf '\033[0;36m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[install]\033[0m %s\n' "$*" >&2; }
err() { printf '\033[0;31m[install]\033[0m %s\n' "$*" >&2; }

# Preflight: tsx must be on PATH.
if ! command -v tsx >/dev/null 2>&1; then
  err "tsx not found on PATH."
  err "Install with: cd ${PROJECT_ROOT} && npm install"
  err "(tsx is listed in devDependencies)"
  exit 1
fi
readonly TSX_PATH="$(command -v tsx)"
log "tsx found at: ${TSX_PATH}"

# Preflight: tmux recommended (daemon still works without it; no live view).
if ! command -v tmux >/dev/null 2>&1; then
  warn "tmux not found — daemon will run but you won't be able to 'tmux attach' for live viewing."
  warn "Install with: brew install tmux"
fi

# Preflight: gh must be authenticated.
if ! gh auth status >/dev/null 2>&1; then
  err "gh CLI not authenticated. Run: gh auth login"
  exit 1
fi

# Ensure logs + launch agents dirs exist.
mkdir -p "${PROJECT_ROOT}/logs"
mkdir -p "${LAUNCH_AGENTS_DIR}"

# Generate plist from template.
log "Writing ${INSTALLED_PLIST}"
sed \
  -e "s|{{TSX_PATH}}|${TSX_PATH}|g" \
  -e "s|{{PROJECT_ROOT}}|${PROJECT_ROOT}|g" \
  "${PLIST_TEMPLATE}" > "${INSTALLED_PLIST}"

# Env-file setup.
if [[ ! -f "${ENV_FILE}" ]]; then
  log "No ${ENV_FILE} found."
  cat <<EOF

───────────────────────────────────────────────────────────────────
  Create a Linear API key:
    1. https://linear.app → Settings → API → Personal API keys
    2. Click "Create key" (name it "peanut.gallery local daemon")
    3. Copy the value (starts with 'lin_api_')

  Then create the env file at:
    ${ENV_FILE}

  With content:
    LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxx

  And set mode 600:
    mkdir -p "${ENV_DIR}"
    chmod 700 "${ENV_DIR}"
    chmod 600 "${ENV_FILE}"
───────────────────────────────────────────────────────────────────

EOF
  warn "The daemon will log a fatal 'missing_linear_api_key' and exit until the env file exists."
else
  # Check mode.
  mode="$(stat -f '%Lp' "${ENV_FILE}")"
  if [[ "${mode}" != "600" ]]; then
    warn "${ENV_FILE} mode is ${mode}; fixing to 600"
    chmod 600 "${ENV_FILE}"
  fi
  log "Found ${ENV_FILE} (mode 600)."
fi

# Unload if already loaded (ignore error); load.
log "Unloading prior agent (if any)..."
launchctl unload "${INSTALLED_PLIST}" 2>/dev/null || true
log "Loading agent..."
launchctl load "${INSTALLED_PLIST}"

# Verify.
if launchctl list | grep -q "${LABEL}"; then
  log "Agent loaded: ${LABEL}"
else
  err "Agent did NOT appear in 'launchctl list'. Check ${PROJECT_ROOT}/logs/daemon-stderr.log"
  exit 1
fi

cat <<EOF

✓ Installed.

Next steps:
  - Tail the daemon log:
      tail -f ${PROJECT_ROOT}/logs/daemon-\$(date -u +%Y-%m-%d).jsonl
  - Watch a live Claude session (after a ticket fires):
      tmux ls
      tmux attach -t claude-<issue-id>
  - Stop the daemon:
      launchctl unload "${INSTALLED_PLIST}"
  - Worktrees land in: ${PROJECT_ROOT}/.claude/worktrees/

EOF
