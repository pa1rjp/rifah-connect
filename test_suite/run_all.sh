#!/usr/bin/env bash
# RIFAH Connect — Full Regression Test Runner
# Runs all flow test suites in sequence and reports overall pass/fail.
#
# Usage:
#   ./test_suite/run_all.sh           → run all suites
#   ./test_suite/run_all.sh --clean   → clean all test data first, then run

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

CLEAN=0
[[ "${1:-}" == "--clean" ]] && CLEAN=1

FLOWS=(test_flow1.js test_flow2a.js test_flow2b.js test_flow3.js test_flow4.js test_flow5.js)

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; RESET='\033[0m'; GREY='\033[0;90m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   RIFAH Connect — Full Regression Suite      ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# ── Optional clean ────────────────────────────────────────────────────────────
if [[ $CLEAN -eq 1 ]]; then
  echo -e "${YELLOW}Cleaning test data from all flows...${RESET}"
  for flow in "${FLOWS[@]}"; do
    echo -e "${GREY}  → $flow --clean${RESET}"
    node "$SCRIPT_DIR/$flow" --clean 2>&1 | grep -E "Deleted|Cleaned|done|error" || true
  done
  echo ""
fi

# ── Run suites ────────────────────────────────────────────────────────────────
PASSED_SUITES=0
FAILED_SUITES=0
FAILED_NAMES=()

for flow in "${FLOWS[@]}"; do
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${YELLOW}▶ Running: $flow${RESET}"
  echo ""

  if node "$SCRIPT_DIR/$flow"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
  else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    FAILED_NAMES+=("$flow")
  fi

  echo ""
done

# ── Final summary ─────────────────────────────────────────────────────────────
TOTAL=$((PASSED_SUITES + FAILED_SUITES))
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  REGRESSION SUMMARY${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}  ✓ Suites passed: ${PASSED_SUITES}/${TOTAL}${RESET}"

if [[ $FAILED_SUITES -gt 0 ]]; then
  echo -e "${RED}  ✗ Suites failed: ${FAILED_SUITES}/${TOTAL}${RESET}"
  echo ""
  echo -e "${BOLD}  Failed suites:${RESET}"
  for name in "${FAILED_NAMES[@]}"; do
    echo -e "${RED}    • $name${RESET}"
  done
  echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
  echo ""
  exit 1
else
  echo -e "${GREY}  ✗ Suites failed: 0${RESET}"
  echo ""
  PCT=100
  echo -e "${GREEN}${BOLD}  Score: 100% (${PASSED_SUITES}/${TOTAL}) — All suites passing${RESET}"
  echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
  echo ""
  exit 0
fi
