export const classificationClasses: Record<string, string> = {
  MUST_HAVE: 'bg-classification-must-bg text-classification-must-fg',
  SHOULD_HAVE: 'bg-classification-should-bg text-classification-should-fg',
  NICE_TO_HAVE: 'bg-classification-nice-bg text-classification-nice-fg',
  WONT_HAVE: 'bg-classification-wont-bg text-classification-wont-fg',
  IMPORTED: 'bg-classification-imported-bg text-classification-imported-fg',
}

export function classificationClass(classification?: string) {
  return classificationClasses[classification ?? ''] || 'bg-surface-2 text-text-muted'
}
