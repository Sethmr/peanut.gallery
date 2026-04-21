#!/usr/bin/env bash
# Uninstalls the Linear local daemon. Optionally removes the env file.
# See docs/GITHUB-MANUAL-STEPS.md § 18.

set -euo pipefail

readonly INSTALLED_PLIST="${HOME}/Library/LaunchAgents/gallery.peanut.linear-daemon.plist"
readonly ENV_FILE="${HOME}/.config/peanut-gallery/daemon.env"
readonly LABEL="gallery.peanut.linear-daemon"

log() { printf '\033[0;36m[uninstall]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[uninstall]\033[0m %s\n' "$*" >&2; }

if [[ -f "${INSTALLED_PLIST}" ]]; then
  log "Unloading ${LABEL}..."
  launchctl unload "${INSTALLED_PLIST}" 2>/dev/null || true
  log "Removing ${INSTALLED_PLIST}"
  rm -f "${INSTALLED_PLIST}"
else
  warn "${INSTALLED_PLIST} not found; nothing to unload."
fi

if launchctl list | grep -q "${LABEL}"; then
  warn "Agent still showing in 'launchctl list' — you may need to reboot or check for a stale copy."
else
  log "Agent removed from launchctl."
fi

if [[ -f "${ENV_FILE}" ]]; then
  read -r -p "Remove ${ENV_FILE} (contains LINEAR_API_KEY)? [y/N] " reply
  if [[ "${reply}" =~ ^[Yy]$ ]]; then
    rm -f "${ENV_FILE}"
    log "Removed ${ENV_FILE}"
  else
    log "Kept ${ENV_FILE}"
  fi
fi

log "Done. Worktrees under .claude/worktrees/ are NOT removed — clean those manually if desired."
