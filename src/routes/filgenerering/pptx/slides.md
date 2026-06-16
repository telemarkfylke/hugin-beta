---
title: "Prosjektpresentasjon"
subtitle: "Status, løsning og neste steg"
author: "Ditt navn / Firma"
date: "2026"
---

# Prosjektpresentasjon

## Status, løsning og neste steg

Ditt navn / Firma  
2026

---

# Agenda

- Bakgrunn
- Problemstilling
- Foreslått løsning
- Fremdriftsplan
- Risiko og avklaringer
- Neste steg

---

# Bakgrunn

Prosjektet handler om å forbedre måten brukere kan opprette og laste ned presentasjoner automatisk.

Målet er å gjøre prosessen:

- Raskere
- Enklere
- Mer konsistent
- Bedre tilpasset PowerPoint

---

# Problemstilling

Dagens løsning fungerer, men presentasjonene blir ofte enkle og lite varierte.

Typiske utfordringer:

- Mye hvit bakgrunn
- Mange punktlister
- Lite visuell variasjon
- Ingen tydelig PowerPoint-mal
- Presentasjonen føles automatisk generert

---

# Mål

Målet er å lage en løsning der KI-agenten kan generere presentasjoner som:

- Har tydelig struktur
- Følger en fast mal
- Kan eksporteres til PowerPoint
- Er enkle å redigere etterpå
- Ser mer profesjonelle ut

---

# Foreslått løsning

Bruk Markdown til selve innholdet, og PowerPoint til designet.

Dette gir en enkel arbeidsflyt:

1. Brukeren skriver inn hva presentasjonen skal handle om
2. KI-agenten lager en `.md`-fil
3. Pandoc konverterer Markdown til PowerPoint
4. PowerPoint-malen bestemmer utseendet

---

# Anbefalt oppsett

| Del | Beskrivelse |
|---|---|
| `presentasjon.md` | Innholdet i presentasjonen |
| `powerpoint-mal.pptx` | PowerPoint-mal med design |
| Pandoc | Konverterer `.md` til `.pptx` |
| KI-agent | Genererer Markdown-innhold |

---

# Hvordan PowerPoint-malen brukes

Lag først en vanlig PowerPoint-fil med ønsket design.

Du kan for eksempel bruke en av PowerPoint sine egne maler:

- Ion
- Facet
- Gallery
- Retrospect
- Integral
- Berlin
- Circuit