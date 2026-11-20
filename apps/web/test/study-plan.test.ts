import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/lib/storage'
import { service } from '../src/lib/service'

beforeEach(async () => { await db.delete(); await db.open() })

describe('saved multi-text selection', () => {
  it.each([true, false])('saves skipLikelyNames=%s only on generation, including backup and pruning', async skipLikelyNames => {
    const library = await service.importVocabulary('bird\nrun')
    const ids = library.documents.slice(0, 3).map(doc => doc.id)
    const selection = { ids, limit: 5, skipLikelyNames }
    await service.getStudyPlan(ids, 5, false, { skipLikelyNames })
    expect(await service.getSavedStudySelection()).toBeNull()
    const plan = await service.getStudyPlan([...ids, ids[0]], 5, true, { skipLikelyNames })
    expect(plan.documents.map(doc => doc.id)).toEqual(ids)
    await service.getStudyPlan(ids.slice(0, 2), 2, false, { skipLikelyNames: !skipLikelyNames })
    await expect(service.getStudyPlan(['missing', ids[0]], 2, true)).rejects.toThrow()
    expect(await service.getSavedStudySelection()).toEqual(selection)
    expect((await db.meta.get('library'))?.studySelection).toEqual(selection)
    expect(await service.loadLibrary()).toEqual(library)

    const backup = JSON.parse(await service.exportBackup())
    expect(backup.studySelection).toEqual(selection)
    backup.studySelection.ids.push('missing')
    await service.eraseData()
    expect(await service.getSavedStudySelection()).toBeNull()
    await service.restoreBackup(JSON.stringify(backup))
    expect(await service.getSavedStudySelection()).toEqual(selection)
    expect(await service.getStudyPlan(ids, 5, false, { skipLikelyNames })).toEqual(plan)
    await service.removeDocument(ids[1])
    expect(await service.getSavedStudySelection()).toEqual({ ...selection, ids: [ids[0], ids[2]] })
    await service.removeDocument(ids[2])
    expect(await service.getSavedStudySelection()).toBeNull()
  })

  it('filters plan cards without changing the dictionary or overriding a manual unknown mark', async () => {
    await service.eraseData()
    await service.importVocabulary('i\nsee\nrun')
    await service.addFile(new File(['I see Zorvella.'], 'One.txt'))
    const library = await service.addFile(new File(['Zorvella runs.'], 'Two.txt'))
    const ids = library.documents.map(doc => doc.id)
    const filtered = await service.getStudyPlan(ids, 5, true, { skipLikelyNames: true })
    expect(filtered.picks).toEqual([])
    expect(await service.loadLibrary()).toEqual(library)
    const normal = await service.getStudyPlan(ids, 5, true)
    expect(normal.picks.map(p => p.lemma)).toEqual(['zorvella'])
    expect(await service.getSavedStudySelection()).toEqual({ ids, limit: 5, skipLikelyNames: false })
    const marked = await service.setWord('zorvella', 'unknown')
    const overridden = await service.getStudyPlan(ids, 5, true, { skipLikelyNames: true })
    expect(overridden.picks.map(p => p.lemma)).toEqual(['zorvella'])
    expect(await service.loadLibrary()).toEqual(marked)
    for (const status of ['known', 'ignored'] as const) {
      const updated = await service.setWord('zorvella', status)
      expect(updated.knownCount).toBe(library.knownCount + (status === 'known' ? 1 : 0))
      const plan = await service.getStudyPlan(ids, 5, true, { skipLikelyNames: true })
      expect(plan).toMatchObject({ understoodBefore: 2, understoodAfter: 2, picks: [] })
      expect(await service.loadLibrary()).toEqual(updated)
    }
  })

  it('reads legacy backups, drops absent documents and rejects malformed input atomically', async () => {
    const { documents } = await service.loadLibrary()
    const ids = documents.slice(0, 2).map(doc => doc.id)
    const legacy = await service.exportBackup()
    const backup = JSON.parse(legacy)
    backup.studySelection = { ids: [...ids, 'missing'], limit: 3 }
    await service.restoreBackup(JSON.stringify(backup))
    expect(await service.getSavedStudySelection()).toEqual({ ids, limit: 3, skipLikelyNames: false })
    backup.studySelection.limit = 0
    await expect(service.restoreBackup(JSON.stringify(backup))).rejects.toThrow()
    expect(await service.getSavedStudySelection()).toEqual({ ids, limit: 3, skipLikelyNames: false })
    await service.restoreBackup(legacy)
    expect(await service.getSavedStudySelection()).toBeNull()
  })

  it('reads a selection saved in IndexedDB before the flag existed', async () => {
    const { documents } = await service.loadLibrary()
    const ids = documents.slice(0, 2).map(doc => doc.id)
    await db.meta.update('library', { studySelection: { ids, limit: 3 } })
    const expected = { ids, limit: 3, skipLikelyNames: false }
    expect(await service.getSavedStudySelection()).toEqual(expected)
    expect(JSON.parse(await service.exportBackup()).studySelection).toEqual(expected)
  })

  it('rejects a non-boolean backup flag before replacing any library data', async () => {
    const { documents } = await service.importVocabulary('bird')
    const ids = documents.slice(0, 2).map(doc => doc.id)
    await service.getStudyPlan(ids, 5, true, { skipLikelyNames: true })
    const original = await service.exportBackup()
    const backup = JSON.parse(original)
    backup.words = []
    backup.documents = []
    for (const invalid of ['false', 0, null]) {
      backup.studySelection.skipLikelyNames = invalid
      await expect(service.restoreBackup(JSON.stringify(backup))).rejects.toThrow()
      expect(await service.exportBackup()).toBe(original)
    }
  })

  it('keeps deletions effective when a plan is being saved in the same library', async () => {
    const { documents } = await service.loadLibrary()
    const ids = documents.slice(0, 2).map(doc => doc.id)
    const [, removal] = await Promise.allSettled([
      service.getStudyPlan(ids, 20, true),
      service.removeDocument(ids[0]),
    ])
    expect(removal.status).toBe('fulfilled')
    expect(await service.getSavedStudySelection()).toBeNull()
  })
})
