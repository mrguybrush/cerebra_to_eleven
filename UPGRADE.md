# cerebra installieren oder upgraden

Die vollständige Anleitung (Neuinstallation auf neuer SD-Karte + Upgrade eines bestehenden pib) liegt im [`pib-backend_to_eleven`-Repo](https://github.com/mrguybrush/pib-backend_to_eleven/blob/main/UPGRADE.md), da die Installation beide Repos gemeinsam betrifft.

Kurzfassung für dieses Repo allein (öffentlich, kein Zugriffs-Setup nötig):

```
git remote set-url origin https://github.com/mrguybrush/cerebra_to_eleven.git
git fetch origin
git pull --ff-only origin main
```
