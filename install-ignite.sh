#!/bin/bash

set -e

IGNITE_PATH="$HOME/.purecore/ignite"
BIN_PATH="$HOME/.local/bin"

mkdir -p "$IGNITE_PATH"
mkdir -p "$BIN_PATH"

echo "Installing PureCore Ignite..."

# exemplo: copia binário ou script JS empacotado
cp ./ignite "$IGNITE_PATH/ignite"
chmod +x "$IGNITE_PATH/ignite"

ln -sf "$IGNITE_PATH/ignite" "$BIN_PATH/ignite"

if [[ ":$PATH:" != *":$BIN_PATH:"* ]]; then
  echo "export PATH=\"$BIN_PATH:\$PATH\"" >> "$HOME/.bashrc"
  echo "export PATH=\"$BIN_PATH:\$PATH\"" >> "$HOME/.zshrc"
fi

echo "Ignite installed successfully."
echo "Restart your terminal and run: ignite"
