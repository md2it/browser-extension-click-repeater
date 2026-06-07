# MACROS REPEATER

=-=-=-=-=-=-=-=-= | DE | [EN](../README.md) | [ES](./ES.md) | [FR](./FR.md) | [RU](./RU.md) | [中文](./ZH.md) | [عربي](./AR.md) | =-=-=-=-=-=-=-=-=

## INSTALLATION

### Stores

Store-Versionen sind noch nicht veröffentlicht.

### Entwicklungsmodus

Laden Sie das gesamte Verzeichnis [`extension`](../extension) als entpackte Erweiterung.

## BESCHREIBUNG

Macros Repeater zeichnet Klicks auf einer Webseite auf und wiederholt sie später.

Erstellen Sie ein Makro, konfigurieren Sie seine Ausführung und starten Sie es über das Erweiterungsfenster oder eine Tastenkombination. Makros können aufgezeichnete Koordinaten oder Seitenelemente verwenden.

## HAUPTFUNKTIONEN

- Klickfolgen auf Webseiten aufzeichnen
- Makros im Positions- oder Elementmodus ausführen
- Sichtbare oder unsichtbare Ausführung
- Ein vollständiges Makro bis zu 999-mal wiederholen
- Vier Ausführungsgeschwindigkeiten
- Ein Standardmakro per Tastenkombination starten
- Gespeicherte Makros bearbeiten, löschen und sortieren
- Helles und dunkles Design

## DATENSCHUTZ

- Keine Datenerfassung
- Kein Tracking
- Keine Netzwerkanfragen
- Makros und Einstellungen werden lokal im Browser gespeichert

## OBERFLÄCHENSPRACHEN

- Englisch
- Russisch
- Spanisch
- Französisch
- Deutsch
- Vereinfachtes Chinesisch
- Arabisch

## VERWENDUNG

### Makro erstellen

1. Öffnen Sie das Erweiterungsfenster
2. Starten Sie die Makroerstellung
3. Klicken Sie auf die erforderlichen Punkte oder Elemente der Seite
4. Klicken Sie erneut auf das Erweiterungssymbol
5. Benennen und konfigurieren Sie das Makro und speichern Sie es

### Makro ausführen

1. Öffnen Sie das Erweiterungsfenster
2. Starten Sie das gewünschte Makro
3. Die Erweiterung wiederholt die aufgezeichneten Klicks und meldet das Ergebnis

Ein Benutzerklick oder `Esc` stoppt die Ausführung. Das Standardmakro kann auch mit `Ctrl+Shift+X` → `M` oder auf dem Mac mit `Cmd+Shift+X` → `M` gestartet werden.

Weitere Informationen finden Sie unter [alle Benutzerpfade](../SPEC/user-path.md).

## EINSCHRÄNKUNGEN

- Browsererweiterungen funktionieren nicht auf Systemseiten des Browsers oder geschützten Websites
- Der Elementmodus setzt voraus, dass die aufgezeichneten Elemente weiterhin auf der Seite vorhanden sind
- Der Positionsmodus setzt voraus, dass sich der relevante Inhalt weiterhin an den aufgezeichneten Koordinaten befindet
- Änderungen an einer Website können verhindern, dass ein älteres Makro abgeschlossen wird
- Die Erweiterung zeichnet ausschließlich Klicks auf und wiederholt sie
- Simulierte Klicks können von Websites auch im Stealth-Modus erkannt werden — browsergenerierte Ereignisse tragen nicht das Flag `isTrusted: true`, das echten Nutzerinteraktionen vorbehalten ist; Seiten, die `event.isTrusted` prüfen, erkennen die Automatisierung unabhängig davon, wie der Klick ausgelöst wurde

## LIZENZ

[MIT-Lizenz](../LICENSE)
