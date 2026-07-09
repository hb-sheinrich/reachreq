# ReachReq — Internes Anforderungserfassungs- und Modul-Tool

ReachReq ist eine interne Web-Anwendung zur strukturierten Erfassung, Diskussion, Versionierung und Freigabe von Projektanforderungen im Team. Zusätzlich pflegt das Tool ein zentrales, versioniertes Glossar/Wissensverzeichnis.

## Funktionen

- **Modul-Segmentierung**: Hierarchischer Modulbaum, administrativ pflegbar.
- **Anforderungen**: Strukturierte Felder, menschenlesbare IDs (`MOD-LOG-0001`), Klassifizierung, Status-Workflow, Versionierung, Kommentare, Verknüpfungen.
- **Glossar**: Zentrale Begriffe, versioniert und freigebbar, mit Verknüpfung zu Anforderungen.
- **KI-Qualitätsprüfung**: Vor dem Speichern prüft Anthropic Claude auf Blocker, Warnungen und Vorschläge.
- **Freigabe-Workflow**: `DRAFT` → `IN_REVIEW` → `SUBMITTED_FOR_RELEASE` → `APPROVED`/`REJECTED`/`POSTPONED`.
- **Autosave**: Debounced Speicherung, lokaler Entwurf im Browser, optimistisches Locking/Konflikterkennung über `editVersion`.
- **M365-Login**: Server-seitiger OAuth2/OIDC-Flow gegen Azure AD / Microsoft 365.
- **Audit-Log**: Alle Änderungen werden protokolliert.

## Tech-Stack

- **Backend**: Fastify 5, Prisma 6, PostgreSQL 16, Redis 7, TypeScript, Anthropic Claude, Zod
- **Frontend**: Vue 3.5, Vite 6, Pinia 3, Vue Router 4, PrimeVue 4, Tailwind CSS 3, vue-i18n
- **Auth**: JWT-Backend-Session, M365 OAuth2/OIDC
- **DevOps**: Docker Compose

## Lokale Entwicklung

1. `.env` aus `.env.example` kopieren und anpassen:
   ```bash
   cp .env.example .env
   ```
2. Abhängigkeiten installieren und Datenbank starten:
   ```bash
   docker compose up -d postgres redis
   cd backend && npm install && npx prisma migrate dev && npx prisma generate
   cd ../frontend && npm install
   ```
3. Backend starten:
   ```bash
   cd backend && npm run dev
   ```
4. Frontend starten:
   ```bash
   cd frontend && npm run dev
   ```

## Tests

- **Backend**: `cd backend && npm run test`
- **Frontend Build**: `cd frontend && npm run build`

## Annahmen / Offene Punkte (zu bestätigen)

- **Worksheets-Referenz**: Das im Auftrag genannte Worksheets-Repo war nicht auffindbar. Autosave-/M365-UX-Muster wurden aus dem verfügbaren `feature_board`-Projekt abgeleitet und müssen ggf. an das tatsächliche Worksheets-Verhalten angeglichen werden.
- **M365-Zertifikate**: `M365_CLIENT_ID`, `M365_CLIENT_SECRET` und `M365_TENANT_ID` müssen in `.env` hinterlegt werden.
- **Anthropic API**: `ANTHROPIC_API_KEY` optional; ohne Schlüssel wird die KI-Prüfung übersprungen.
- **Freigabe-Workflow**: Derzeit submittiert jede Nutzerin/jeder Nutzer; Freigabe/Ablehnung ist admin-only.
- **Versions-Restore**: Rollback erstellt eine neue Version aus dem alten Snapshot; der ursprüngliche Status ist `DRAFT`.

## Datenmodell

Siehe `backend/prisma/schema.prisma`.

## Lizenz

Internes Projekt der Haiberg / HUP.
