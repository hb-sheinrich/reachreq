import { createI18n } from 'vue-i18n'
import { useCaseMessages } from '../locales/useCase'

export const messages = {
  de: {
    tag: {
      createOption: "'{name}' anlegen",
      create: 'Tag anlegen',
      addPlaceholder: 'Tag hinzufügen...',
    },
    comment: {
      title: 'Kommentare',
      placeholder: 'Kommentar schreiben...',
      submit: 'Senden',
      reply: 'Antworten',
      cancelReply: 'Abbrechen',
      resolve: 'Erledigt',
      reopen: 'Wieder öffnen',
      replyingTo: 'Antwort an {name}',
      anchorHint: 'Textstelle: {field}',
      empty: 'Keine Kommentare.',
    },
    app: {
      title: 'ReachReq — Anforderungen & Glossar',
      dashboard: 'Dashboard',
      requirements: 'Anforderungen',
      glossary: 'Glossar',
      modules: 'Module',
      login: 'Anmelden',
      logout: 'Abmelden',
      save: 'Speichern',
      submit: 'Zur Freigabe einreichen',
      approve: 'Freigeben',
      reject: 'Ablehnen',
      reopen: 'Wieder öffnen',
      review: 'KI-Prüfung',
      cancel: 'Abbrechen',
      create: 'Erstellen',
      search: 'Suchen',
      status: 'Status',
      classification: 'Klassifizierung',
      module: 'Modul',
      tags: 'Tags',
      language: 'Sprache',
      theme: 'Design',
      loading: 'Laden',
      error: 'Fehler',
      success: 'Erfolg',
      all: 'Alle',
      none: 'Keine',
      close: 'Schließen',
      actions: 'Aktionen',
      noResults: 'Keine Einträge gefunden',
      notFound: 'Nicht gefunden',
      author: 'Autor',
      date: 'Datum',
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
    classification: {
      MUST_HAVE: 'Muss',
      SHOULD_HAVE: 'Soll',
      NICE_TO_HAVE: 'Kann',
      WONT_HAVE: 'Wird nicht',
    },
    requirements: {
      title: 'Anforderungen',
      new: 'Neue Anforderung',
      filters: 'Filter',
      search: 'Suche',
      export: 'Export JSON',
      import: 'Import Use-Cases',
      importTitle: 'Use-Cases importieren',
      selectFile: 'JSON-Datei auswählen',
      selectModule: 'Modul auswählen',
      selectClassification: 'Klassifizierung auswählen',
      selectStatus: 'Status auswählen',
      targetLanguage: 'Zielsprache',
      importSuccess: '{count} Use-Cases importiert',
      importError: 'Import fehlgeschlagen',
      invalidJson: 'Ungültige JSON-Datei',
      noFile: 'Bitte eine Datei auswählen',
      adminOnly: 'Nur für Administratoren',
      tags: 'Tags',
      tagFilter: 'Tags filtern',
      tagSearch: 'Tags suchen',
      id: 'ID',
      tagClickHint: 'Nach diesem Tag filtern',
      titleColumn: 'Titel',
    },
    glossary: {
      title: 'Glossar',
      new: 'Neuer Eintrag',
      term: 'Begriff',
      definition: 'Definition',
      example: 'Beispiel',
      aliases: 'Aliase',
      aliasFilter: 'Alias filtern',
      originalLanguage: 'Ursprungssprache',
      translations: 'Übersetzungen',
      translate: 'Übersetzen',
      translateTo: 'Übersetzen in {language}',
      translationResult: 'Übersetzungsergebnis',
      viewLanguage: 'Anzeigesprache',
      language: 'Sprache',
      noEntries: 'Keine Glossar-Einträge gefunden',
      searchTerm: 'Begriff oder Definition suchen',
      editor: 'Editor',
      versions: 'Versionen',
      comments: 'Kommentare',
      translation: 'Übersetzung',
      translationSaved: 'Übersetzung gespeichert',
      translationError: 'Übersetzung fehlgeschlagen',
      translationSameLanguage: 'Zielsprache entspricht der Ursprungssprache',
    },
    useCase: useCaseMessages.de.useCase,
  },
  en: {
    app: {
      title: 'ReachReq — Requirements & Glossary',
      dashboard: 'Dashboard',
      requirements: 'Requirements',
      glossary: 'Glossary',
      modules: 'Modules',
      login: 'Log in',
      logout: 'Log out',
      save: 'Save',
      submit: 'Submit for release',
      approve: 'Approve',
      reject: 'Reject',
      reopen: 'Reopen',
      review: 'AI Review',
      cancel: 'Cancel',
      create: 'Create',
      search: 'Search',
      status: 'Status',
      classification: 'Classification',
      module: 'Module',
      tags: 'Tags',
      language: 'Language',
      theme: 'Theme',
      loading: 'Loading',
      error: 'Error',
      success: 'Success',
      all: 'All',
      none: 'None',
      close: 'Close',
      actions: 'Actions',
      noResults: 'No entries found',
      notFound: 'Not found',
      author: 'Author',
      date: 'Date',
    },
    status: {
      DRAFT: 'Draft',
      IN_REVIEW: 'In Review',
      SUBMITTED_FOR_RELEASE: 'Ready for Approval',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      POSTPONED: 'Postponed',
      ARCHIVED: 'Archived',
    },
    classification: {
      MUST_HAVE: 'Must have',
      SHOULD_HAVE: 'Should have',
      NICE_TO_HAVE: 'Nice to have',
      WONT_HAVE: "Won't have",
    },
    requirements: {
      title: 'Requirements',
      new: 'New Requirement',
      filters: 'Filters',
      search: 'Search',
      export: 'Export JSON',
      import: 'Import Use-Cases',
      importTitle: 'Import Use-Cases',
      selectFile: 'Select JSON file',
      selectModule: 'Select module',
      selectClassification: 'Select classification',
      selectStatus: 'Select status',
      targetLanguage: 'Target language',
      importSuccess: '{count} use cases imported',
      importError: 'Import failed',
      invalidJson: 'Invalid JSON file',
      noFile: 'Please select a file',
      adminOnly: 'Admin only',
      tags: 'Tags',
      tagFilter: 'Filter tags',
      tagSearch: 'Search tags',
      id: 'ID',
      titleColumn: 'Title',
    },
    tag: {
      createOption: "Create '{name}'",
      create: 'Create tag',
      addPlaceholder: 'Add tag...',
    },
    comment: {
      title: 'Comments',
      placeholder: 'Write a comment...',
      submit: 'Send',
      reply: 'Reply',
      cancelReply: 'Cancel',
      resolve: 'Resolve',
      reopen: 'Reopen',
      replyingTo: 'Replying to {name}',
      anchorHint: 'Text anchor: {field}',
      empty: 'No comments yet.',
    },
    glossary: {
      title: 'Glossary',
      new: 'New Entry',
      term: 'Term',
      definition: 'Definition',
      example: 'Example',
      aliases: 'Aliases',
      aliasFilter: 'Filter alias',
      originalLanguage: 'Original language',
      translations: 'Translations',
      translate: 'Translate',
      translateTo: 'Translate to {language}',
      translationResult: 'Translation result',
      viewLanguage: 'Display language',
      language: 'Language',
      noEntries: 'No glossary entries found',
      searchTerm: 'Search term or definition',
      editor: 'Editor',
      versions: 'Versions',
      comments: 'Comments',
      translation: 'Translation',
      translationSaved: 'Translation saved',
      translationError: 'Translation failed',
      translationSameLanguage: 'Target language equals original language',
    },
    useCase: useCaseMessages.en.useCase,
  },
}

export const i18n = createI18n({
  legacy: false,
  locale: 'de',
  fallbackLocale: 'de',
  globalInjection: true,
  messages,
})

const STORAGE_KEY = 'reachreq-language'
const VALID_LOCALES = ['de', 'en'] as const
export type SupportedLocale = (typeof VALID_LOCALES)[number]

function detectNavigatorLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return 'de'
  const lang = navigator.language
  if (lang && lang.startsWith('en')) return 'en'
  return 'de'
}

export function setI18nLocale(value: SupportedLocale) {
  if (i18n.global.locale.value === value) return
  i18n.global.locale.value = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore
  }
}

export function getStoredLocale(): SupportedLocale | null {
  if (typeof localStorage === 'undefined') return null
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'de' || stored === 'en') return stored
  return null
}

export function initLocale(userLocale?: string | null) {
  const stored = getStoredLocale()
  if (stored) {
    setI18nLocale(stored)
    return
  }
  if (userLocale === 'de' || userLocale === 'en') {
    setI18nLocale(userLocale)
    return
  }
  setI18nLocale(detectNavigatorLocale())
}
