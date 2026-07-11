# cerebra installieren oder upgraden

Die vollständige Anleitung (Neuinstallation auf neuer SD-Karte + Upgrade eines bestehenden pib) liegt im [`pib-backend-mod`-Repo](https://github.com/mrguybrush/pib-backend-mod/blob/main/UPGRADE.md), da die Installation beide Repos gemeinsam betrifft.

Kurzfassung für dieses Repo allein:

```
git remote set-url origin git@github-cerebra-mod:mrguybrush/cerebra-mod.git
git fetch origin
git pull --ff-only origin main
git submodule sync
git submodule update --init --recursive
```

Voraussetzung: SSH-Deploy-Key-Zugriff eingerichtet (siehe verlinkte Anleitung, Abschnitt „Zugriff einrichten").
