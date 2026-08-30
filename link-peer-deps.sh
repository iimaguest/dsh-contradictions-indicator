#!/bin/sh
# Link the @deepseek-ai peer dependencies into package/node_modules so the
# plugin's bare imports resolve when dsh loads it from this directory.
#
# The profile installs this plugin with a `link:` dependency pointing at
# ./package. Node resolves imports from the REAL path (symlinks are
# followed), so it never walks through the profile's node_modules where the
# dsh host provides its packages. Regular profile plugins resolve peers from
# ~/.dsh/profiles/node_modules/@deepseek-ai/; this script makes the same
# instances visible from ./package by symlinking them in.
#
# node_modules/ is gitignored — re-run this after a fresh clone.

set -e

PEERS_ROOT="${DSH_PROFILE_PEERS:-$HOME/.dsh/profiles/node_modules/@deepseek-ai}"
PEERS="dsh-settings schemastery"

for pkg in $PEERS; do
  if [ ! -d "$PEERS_ROOT/$pkg" ]; then
    echo "error: $PEERS_ROOT/$pkg not found — is dsh installed and the profile bootstrapped?" >&2
    exit 1
  fi
done

mkdir -p package/node_modules/@deepseek-ai
for pkg in $PEERS; do
  ln -sfn "$PEERS_ROOT/$pkg" "package/node_modules/@deepseek-ai/$pkg"
  echo "linked @deepseek-ai/$pkg -> $PEERS_ROOT/$pkg"
done

echo "done. verify with: node -e \"await import('file://'\$(pwd)'/package/lib/index.js')\""
