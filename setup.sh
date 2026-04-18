#!/bin/bash
# ── Peanut Gallery — One-Command Setup ──
# Run this and you'll be watching podcasts with AI commentary in 2 minutes.

set -e

BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}🥜 Peanut Gallery — Local Setup${RESET}"
echo -e "${DIM}Your podcast's AI writers' room${RESET}"
echo ""

# ── Check dependencies ──
missing=()

if ! command -v node &>/dev/null; then
  missing+=("node (https://nodejs.org)")
elif [[ $(node -v | sed 's/v//' | cut -d. -f1) -lt 18 ]]; then
  echo -e "${RED}Node.js 18+ required (you have $(node -v))${RESET}"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  missing+=("npm (comes with node)")
fi

if ! command -v yt-dlp &>/dev/null; then
  missing+=("yt-dlp (brew install yt-dlp)")
fi

if ! command -v ffmpeg &>/dev/null; then
  missing+=("ffmpeg (brew install ffmpeg)")
fi

if [ ${#missing[@]} -gt 0 ]; then
  echo -e "${RED}Missing dependencies:${RESET}"
  for dep in "${missing[@]}"; do
    echo -e "  ${YELLOW}→ $dep${RESET}"
  done
  echo ""
  echo -e "Install them and re-run ${BOLD}./setup.sh${RESET}"
  exit 1
fi

echo -e "${GREEN}✓${RESET} Dependencies OK (node $(node -v), yt-dlp, ffmpeg)"

# ── Install packages ──
if [ ! -d "node_modules" ]; then
  echo ""
  echo -e "${DIM}Installing packages...${RESET}"
  npm install --silent
  echo -e "${GREEN}✓${RESET} Packages installed"
else
  echo -e "${GREEN}✓${RESET} Packages already installed"
fi

# ── Set up API keys ──
if [ ! -f ".env.local" ]; then
  echo ""
  echo -e "${BOLD}Let's set up your API keys.${RESET}"
  echo -e "${DIM}These stay on your machine — never sent anywhere except directly to each API.${RESET}"
  echo ""

  echo -e "${YELLOW}Deepgram${RESET} (required) — Real-time transcription"
  echo -e "${DIM}Get yours: https://console.deepgram.com/signup${RESET}"
  read -rp "  Deepgram API key: " DEEPGRAM_KEY

  echo ""
  echo -e "${YELLOW}Anthropic${RESET} (required) — Claude Haiku for Producer + Joker"
  echo -e "${DIM}Get yours: https://console.anthropic.com${RESET}"
  read -rp "  Anthropic API key: " ANTHROPIC_KEY

  echo ""
  echo -e "${YELLOW}xAI${RESET} (required) — Grok 4.1 Fast for Troll + Sound FX (also powers optional Live Search)"
  echo -e "${DIM}Get yours: https://console.x.ai${RESET}"
  read -rp "  xAI API key: " XAI_KEY

  echo ""
  echo -e "${YELLOW}Brave Search${RESET} (optional) — Live fact-checking (only needed if SEARCH_ENGINE=brave)"
  echo -e "${DIM}Get yours: https://brave.com/search/api/ — press Enter to skip if you're using xAI Live Search${RESET}"
  read -rp "  Brave Search API key: " BRAVE_KEY

  echo ""
  echo -e "${YELLOW}Search engine${RESET} — 'brave' (default, separate API) or 'xai' (reuses xAI key)"
  read -rp "  Search engine [brave]: " SEARCH_ENGINE
  SEARCH_ENGINE="${SEARCH_ENGINE:-brave}"

  cat > .env.local <<EOF
DEEPGRAM_API_KEY=${DEEPGRAM_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
XAI_API_KEY=${XAI_KEY}
BRAVE_SEARCH_API_KEY=${BRAVE_KEY}
SEARCH_ENGINE=${SEARCH_ENGINE}
EOF

  echo ""
  echo -e "${GREEN}✓${RESET} Keys saved to .env.local (git-ignored, never leaves your machine)"
else
  echo -e "${GREEN}✓${RESET} .env.local already exists"
fi

# ── Launch ──
echo ""
echo -e "${BOLD}${GREEN}🚀 Starting Peanut Gallery...${RESET}"
echo -e "${DIM}Opening http://localhost:3000${RESET}"
echo ""

# Open browser after a short delay
(sleep 2 && open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null) &

npm run dev
