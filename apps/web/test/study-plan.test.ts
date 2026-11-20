import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/lib/storage'
import { service } from '../src/lib/service'

beforeEach(async () => { await db.delete(); await db.open() })

describe('saved multi-text selection', () => {
  it('remembers only an explicitly generated selection, exports it and prunes it on deletion', async () => {
    const { documents } = await service.loadLibrary()
    const ids = documents.slice(0, 3).map(doc => doc.id)
    await service.getStudyPlan(ids, 5)
    expect(await service.getSavedStudySelection()).toBeNull()
    const plan = await service.getStudyPlan([...ids, ids[0]], 5, true)
    expect(plan.documents.map(doc => doc.id)).toEqual(ids)
    await service.getStudyPlan(ids.slice(0, 2), 2)
    await expect(service.getStudyPlan(['missing', ids[0]], 2, true)).rejects.toThrow()
    expect(await service.getSavedStudySelection()).toEqual({ ids, limit: 5 })

    const backup = await service.exportBackup()
    await service.eraseData()
    expect(await service.getSavedStudySelection()).toBeNull()
    await service.restoreBackup(backup)
    expect(await service.getSavedStudySelection()).toEqual({ ids, limit: 5 })
    expect(await service.getStudyPlan(ids, 5)).toEqual(plan)
    await service.removeDocument(ids[1])
    expect(await service.getSavedStudySelection()).toEqual({ ids: [ids[0], ids[2]], limit: 5 })
    await service.removeDocument(ids[2])
    expect(await service.getSavedStudySelection()).toBeNull()
  })

  it('reads legacy backups, drops absent documents and rejects malformed input atomically', async () => {
    const { documents } = await service.loadLibrary()
    const ids = documents.slice(0, 2).map(doc => doc.id)
    const legacy = await service.exportBackup()
    const backup = JSON.parse(legacy)
    backup.studySelection = { ids: [...ids, 'missing'], limit: 3 }
    await service.restoreBackup(JSON.stringify(backup))
    expect(await service.getSavedStudySelection()).toEqual({ ids, limit: 3 })
    backup.studySelection.limit = 0
    await expect(service.restoreBackup(JSON.stringify(backup))).rejects.toThrow()
    expect(await service.getSavedStudySelection()).toEqual({ ids, limit: 3 })
    await service.restoreBackup(legacy)
    expect(await service.getSavedStudySelection()).toBeNull()
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
