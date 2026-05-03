#!/bin/bash

echo "Iniciando sessão aninhada do GNOME (Wayland)..."
echo "Para sair, pressione Ctrl+C nesta janela ou feche a janela do GNOME."

dbus-run-session gnome-shell --devkit --wayland