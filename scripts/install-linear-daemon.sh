#!/usr/bin/env bash
# Installs the Linear local daemon as a launchd user agent.
#
# Idempotent — safe to re-run. Re-runs regenerate the plist (picks up any
# PATH changes for `tsx` / `claude`) and reload the agent.
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

# ─── Resolve absolute paths for tsx and claude ──────────────────────────
# Robust against the common gotchas:
#   - tsx is in ./node_modules/.bin/ but not on PATH (requires npm install
#     first; user forgot to prefix PATH="$PWD/node_modules/.bin:$PATH")
#   - claude CLI at ~/.local/bin/claude not on launchctl's default PATH
# If command -v finds the binary on PATH, use that. Otherwise fall back to
# the canonical install location so the installer just works.

resolve_absolute() {
  # realpath is portable-enough; macOS ships with coreutils-alt `realpath`.
  # Fall back to the input if realpath missing.
  if command -v realpath >/dev/null 2>&1; then
    realpath "$1"
  else
    # macOS default: resolve via python as a last resort
    python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$1"
  fi
}

if command -v tsx >/dev/null 2>&1; then
  TSX_PATH="$(resolve_absolute "$(command -v tsx)")"
elif [[ -x "${PROJECT_ROOT}/node_modules/.bin/tsx" ]]; then
  TSX_PATH="$(resolve_absolute "${PROJECT_ROOT}/node_modules/.bin/tsx")"
  log "tsx not on PATH; falling back to local node_modules"
else
  err "tsx not found on PATH and not at ${PROJECT_ROOT}/node_modules/.bin/tsx."
  err "Install with: cd ${PROJECT_ROOT} && npm install"
  err "(tsx is listed in devDependencies)"
  exit 1
fi
readonly TSX_PATH
log "tsx: ${TSX_PATH}"

if command -v claude >/dev/null 2>&1; then
  CLAUDE_PATH="$(resolve_absolute "$(command -v claude)")"
elif [[ -x "${HOME}/.local/bin/claude" ]]; then
  CLAUDE_PATH="${HOME}/.local/bin/claude"
  log "claude not on PATH; falling back to ~/.local/bin/claude"
else
  err "claude CLI not found on PATH and not at ~/.local/bin/claude."
  err "Install from https://claude.com/code or via the 'Claude Code' download."
  exit 1
fi
readonly CLAUDE_PATH
readonly CLAUDE_DIR="$(dirname "${CLAUDE_PATH}")"
log "claude: ${CLAUDE_PATH} (dir: ${CLAUDE_DIR})"

# ─── Soft-required prereqs (warn but don't block) ───────────────────────

if ! command -v tmux >/dev/null 2>&1; then
  warn "tmux not found — daemon will run but you won't be able to 'tmux attach' for live viewing."
  warn "Install with: brew install tmux"
fi

if ! gh auth status >/dev/null 2>&1; then
  err "gh CLI not authenticated. Run: gh auth login"
  exit 1
fi

# Ensure logs + launch agents dirs exist.
mkdir -p "${PROJECT_ROOT}/logs"
mkdir -p "${LAUNCH_AGENTS_DIR}"

# ─── Generate plist from template ───────────────────────────────────────
# Template has three placeholders: {{TSX_PATH}}, {{PROJECT_ROOT}}, {{EXTRA_PATH}}.
# EXTRA_PATH prepends claude's directory so launchd's spawned node process
# can find `claude` when the daemon runs `child_process.spawn('claude', ...)`.
log "Writing ${INSTALLED_PLIST}"
sed \
  -e "s|{{TSX_PATH}}|${TSX_PATH}|g" \
  -e "s|{{PROJECT_ROOT}}|${PROJECT_ROOT}|g" \
  -e "s|{{EXTRA_PATH}}|${CLAUDE_DIR}|g" \
  "${PLIST_TEMPLATE}" > "${INSTALLED_PLIST}"

# ─── Env-file setup (interactive) ───────────────────────────────────────
# Collects both LINEAR_API_KEY and CLAUDE_CODE_OAUTH_TOKEN at once so the
# daemon starts with a complete env on first load. Reads with `read -rs`
# to keep secrets out of shell history.

if [[ ! -f "${ENV_FILE}" ]]; then
  log "No ${ENV_FILE} found. Starting interactive env setup."
  cat <<'EOF'

───────────────────────────────────────────────────────────────────
  Interactive env setup.

  You'll be prompted for two secrets. Neither is echoed to the
  terminal; values are written to ~/.config/peanut-gallery/daemon.env
  with mode 600.

  1) Linear personal API key
     Generate at: https://linear.app → Settings → API → Personal API keys
     Click "Create key" (name it "peanut.gallery local daemon").
     Copy the value (starts with 'lin_api_').

  2) Claude Code OAuth token
     Generate by running, IN A DIFFERENT TERMINAL:
       CLAUDE_PATH="$(command -v claude)"
       "$CLAUDE_PATH" setup-token
     Follow the sign-in prompts. The token prints to stdout (starts
     with 'sk-ant-oat01-'). Copy it — it's shown ONCE.

───────────────────────────────────────────────────────────────────

EOF

  printf 'Paste LINEAR_API_KEY (input hidden): '
  IFS= read -rs LINEAR_KEY
  echo
  if [[ -z "${LINEAR_KEY}" || "${LINEAR_KEY}" != lin_api_* ]]; then
    warn "That doesn't look like a Linear API key (should start with 'lin_api_')."
    warn "Storing whatever you pasted anyway; daemon will 401 on first poll if wrong."
  fi

  printf 'Paste CLAUDE_CODE_OAUTH_TOKEN (input hidden): '
  IFS= read -rs CLAUDE_TOKEN
  echo
  if [[ -z "${CLAUDE_TOKEN}" || "${CLAUDE_TOKEN}" != sk-ant-oat01-* ]]; then
    warn "That doesn't look like a Claude OAuth token (should start with 'sk-ant-oat01-')."
    warn "Storing whatever you pasted anyway; daemon-spawned Claude will 'Not logged in' on first run if wrong."
  fi

  mkdir -p "${ENV_DIR}"
  chmod 700 "${ENV_DIR}"
  # Write atomically so an interrupt mid-write doesn't leave a partial file.
  umask 077
  tmpfile="$(mktemp "${ENV_DIR}/daemon.env.XXXXXX")"
  {
    printf 'LINEAR_API_KEY=%s\n' "${LINEAR_KEY}"
    printf 'CLAUDE_CODE_OAUTH_TOKEN=%s\n' "${CLAUDE_TOKEN}"
  } > "${tmpfile}"
  mv "${tmpfile}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  unset LINEAR_KEY CLAUDE_TOKEN
  log "Env file created at ${ENV_FILE} (mode 600)."
else
  # Check mode.
  mode="$(stat -f '%Lp' "${ENV_FILE}")"
  if [[ "${mode}" != "600" ]]; then
    warn "${ENV_FILE} mode is ${mode}; fixing to 600"
    chmod 600 "${ENV_FILE}"
  fi
  # Check both keys are present.
  missing=()
  grep -q '^LINEAR_API_KEY=' "${ENV_FILE}" || missing+=("LINEAR_API_KEY")
  grep -q '^CLAUDE_CODE_OAUTH_TOKEN=' "${ENV_FILE}" || missing+=("CLAUDE_CODE_OAUTH_TOKEN")
  if (( ${#missing[@]} > 0 )); then
    warn "${ENV_FILE} is missing: ${missing[*]}"
    warn "Delete the file and re-run this installer to re-prompt, OR add the missing lines manually."
  fi
  log "Found ${ENV_FILE} (mode 600)."
fi

# ─── Unload if already loaded (ignore error); load + verify ─────────────

log "Unloading prior agent (if any)..."
launchctl unload "${INSTALLED_PLIST}" 2>/dev/null || true
log "Loading agent..."
launchctl load "${INSTALLED_PLIST}"

# Give launchd a moment to register. The earlier timing race (agent loaded
# but list didn't show it yet) motivated this short sleep.
sleep 2

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
  - Stop the daemon (e.g. before editing logs/daemon-state.json externally):
      launchctl unload "${INSTALLED_PLIST}"
      # ... edit the file ...
      launchctl load "${INSTALLED_PLIST}"
  - Uninstall:
      ${SCRIPT_DIR}/uninstall-linear-daemon.sh
  - Worktrees land in: ${PROJECT_ROOT}/.claude/worktrees/

EOF
