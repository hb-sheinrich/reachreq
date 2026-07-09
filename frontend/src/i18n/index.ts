import { createI18n } from 'vue-i18n'

const messages = {
  de: {
    app: {
      title: 'ReachReq — Anforderungen & Glossar',
      login: 'Anmelden',
      logout: 'Abmelden',
      save: 'Speichern',
      submit: 'Zur Freigabe einreichen',
      approve: 'Freigeben',
      reject: 'Ablehnen',
      reopen: 'Wieder öffnen',
      review: 'KI-Prüfung',
      cancel: 'Abbrechen',
      status: 'Status',
      classification: 'Klassifizierung',
    },
    status: {
      DRAFT: 'Entwurf',
      IN_REVIEW: 'In Prüfung',
      SUBMITTED_FOR_RELEASE: 'Zur Freigabe',
      APPROVED: 'Freigegeben',
      REJECTED: 'Abgelehnt',
      POSTPONED: 'Zurückgestellt',
      ARCHIVED: 'Archiviert',
    },
  },
}

export const i18n = createI18n({
  locale: 'de',
  fallbackLocale: 'de',
  messages,
})
