export type CatalogLayout = 'list' | 'shelf'
const layoutKey = 'coverage-finder.catalog-layout'

export function createCatalogPreferences() {
  let layout: CatalogLayout = 'list'
  try {
    if (localStorage.getItem(layoutKey) === 'shelf') layout = 'shelf'
  } catch {
    /* Storage can be disabled for display preferences. */
  }
  return {
    collection: 'all',
    query: '',
    format: 'all',
    band: 'all',
    sort: 'sent',
    layout,
  }
}

export type CatalogPreferences = ReturnType<typeof createCatalogPreferences>

export function rememberLayout(layout: CatalogLayout) {
  try {
    localStorage.setItem(layoutKey, layout)
  } catch {
    /* The selection still applies to this session. */
  }
}
