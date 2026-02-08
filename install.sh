#!/bin/bash
set -e

REPO="dssnet/attache"
REPO_URL="https://github.com/$REPO"

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║       Attaché Installer               ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

# Step 1: Install Bun if not present
if command -v bun &>/dev/null; then
  echo "  ✓ Bun is already installed ($(bun --version))"
else
  echo "  Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  echo "  ✓ Bun installed ($(bun --version))"
fi

echo ""

# Step 2: Fetch latest release tag
echo "  Fetching latest version..."
TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')

if [ -z "$TAG" ]; then
  echo "  ✗ Failed to fetch latest version"
  exit 1
fi

echo "  ✓ Latest version: $TAG"
echo ""

# Step 3: Install from tag
echo "  Installing Attaché $TAG..."
bun install -g "$REPO_URL#$TAG"

# Step 4: Trust the package so postinstall can run
echo "  Trusting attache package..."
bun pm -g trust attache
bun install -g

echo "  ✓ Installed"
echo ""

# Step 5: Run setup wizard
attache install
