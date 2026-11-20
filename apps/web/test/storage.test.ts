import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/lib/storage'
import { service } from '../src/lib/service'

beforeEach(async () => { await db.delete(); await db.open() })

describe('local library workflow', () => {
  it('opens with calculated sample scores and preserves explicit choices across repeated imports', async () => {
    const first = await service.loadLibrary()
    expect(first.profile).toBe('demo')
    expect(first.documents.length).toBeGreaterThanOrEqual(10)
    expect(first.knownCount).toBe(3000)
    await service.setWord('boat', 'unknown')
    const state = await service.importVocabulary('front,back\nboat,лодка\nsail,плыть', 0, true)
    expect(state.knownCount).toBe(1)
    expect(state.profile).toBe('personal')
    expect(state.words.find(entry => entry.lemma === 'boat')?.status).toBe('unknown')
    expect((await service.loadLibrary()).vocabVersion).toBe(state.vocabVersion)
    expect((await service.importVocabulary('cat')).knownCount).toBe(2)
  })

  it('deduplicates concurrent uploads and changed filenames by content', async () => {
    await service.eraseData()
    const upload = (name: string) => new File(['A boat. A blue boat.'], name)
    const results = await Promise.allSettled([service.addFile(upload('my.txt')), service.addFile(upload('copy.txt'))])
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected'])
    const { documents } = await service.loadLibrary()
    expect(documents).toHaveLength(1)
    await expect(service.addFile(upload('another.txt'))).rejects.toThrow('уже есть')
    expect((await service.removeDocument(documents[0].id)).documents).toEqual([])
  })

  it('invalidates statistics and restores exact subtitle boundaries, words, times, and picks', async () => {
    await service.eraseData()
    const srt = '1\n00:00:02,125 --> 00:00:04,250\nA boat.\nA boat!\n\n2\n00:00:05,000 --> 00:00:06,000\nA ship.'
    const added = await service.addFile(new File([srt], 'subtitles.srt'))
    const id = added.documents[0].id
    await service.importVocabulary('a')
    const state = await service.setWord('boat', 'known')
    expect(state.documents[0].stats.cSent).toBe(0.5)
    const detail = await service.getDetail(id, 25, 1, 1)
    expect(detail.units).toHaveLength(1)
    expect(detail.units[0].start).toBe(5)
    expect(detail.picks[0].lemma).toBe('ship')
    expect(await service.exportWords(id)).toContain('ship')
    const backup = await service.exportBackup()
    await service.eraseData()
    expect((await service.loadLibrary()).documents).toHaveLength(0)
    const restored = await service.restoreBackup(backup)
    expect(restored.documents).toEqual(state.documents)
    expect(restored.words).toEqual(state.words)
    expect((await service.getDetail(id, 25, 1, 1)).units).toEqual(detail.units)
  })

  it('keeps existing records intact after a malformed restore', async () => {
    await service.eraseData()
    await service.importVocabulary('boat')
    const backup = await service.exportBackup()
    const corrupt = JSON.parse(backup)
    corrupt.documents.push({ id: 'broken' })
    await expect(service.restoreBackup(JSON.stringify(corrupt))).rejects.toThrow('Копия')
    expect(await service.exportBackup()).toBe(backup)
  })

  it('preserves personal daily observations and the last test correction through a backup', async () => {
    await service.loadLibrary()
    expect(await service.getProgress()).toEqual([])
    await service.applyTest(Array(80).fill(true))
    const lastTest = await service.getLastTest()
    expect(lastTest).toMatchObject({ size: 0, falseAlarmRate: 1 })
    await service.eraseData()
    expect(await service.getLastTest()).toBeNull()
    await service.applyTest(Array(80).fill(true))
    await service.addFile(new File(['Boat.'], 'One.txt'))
    await service.setWord('boat', 'known')
    const history = await service.getProgress()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ knownCount: 1, readyTitles: ['One'] })
    const backup = await service.exportBackup()
    await service.eraseData()
    expect(await service.getProgress()).toEqual([])
    await service.restoreBackup(backup)
    expect(await service.getProgress()).toEqual(history)
    expect(await service.getLastTest()).toMatchObject({ size: 0, falseAlarmRate: 1 })
  })
})
