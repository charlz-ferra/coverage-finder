import { releaseProxy, wrap, type Remote } from 'comlink'
import type { service } from './service'
import type { WordStatus } from './types'

export type { WordEntry, WordStatus, LibraryDocument, LibraryState, ReadingUnit, ProgressDay, TestResult, Detail } from './types'
export type { DocStats } from '@coverage/core'

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
function workerConnection() {
  const worker = createWorker()
  const api = wrap<typeof service>(worker)
  let failure: Error | undefined
  const pending = new Set<(error: Error) => void>()
  const failed = () => {
    failure = new Error('Не удалось загрузить модуль анализа. Перезагрузите страницу.')
    for (const reject of pending) reject(failure)
    pending.clear()
  }
  worker.addEventListener('error', failed)
  worker.addEventListener('messageerror', failed)
  function call<T>(operation: (api: Remote<typeof service>) => Promise<T>): Promise<T> {
    if (failure) return Promise.reject(failure)
    return new Promise<T>((resolve, reject) => {
      pending.add(reject)
      operation(api).then(resolve, reject).finally(() => pending.delete(reject))
    })
  }
  return { call, close: () => { api[releaseProxy](); worker.terminate() } }
}

const worker = workerConnection()
export const loadLibrary = () => worker.call(api => api.loadLibrary())
export const removeDocument = (id: string) => worker.call(api => api.removeDocument(id))
export const setWord = (lemma: string, status: WordStatus) => worker.call(api => api.setWord(lemma, status))
export const previewVocabulary = (text: string) => worker.call(api => api.previewVocabulary(text))
export const importVocabulary = (text: string, column = 0, skipHeader = false) => {
  requestPersistence()
  return worker.call(api => api.importVocabulary(text, column, skipHeader))
}
export const getTest = () => worker.call(api => api.getTest())
export const getProgress = () => worker.call(api => api.getProgress())
export const getLastTest = () => worker.call(api => api.getLastTest())
export const applyTest = (answers: boolean[]) => {
  requestPersistence()
  return worker.call(api => api.applyTest([...answers]))
}
export const getDetail = (id: string, limit = 25, offset = 0, pageSize = 80) => worker.call(api => api.getDetail(id, limit, offset, pageSize))
export const exportWords = (id: string, limit = 25) => worker.call(api => api.exportWords(id, limit))
export const exportBackup = () => worker.call(api => api.exportBackup())
export const restoreBackup = (json: string) => { requestPersistence(); return worker.call(api => api.restoreBackup(json)) }
export const eraseData = () => worker.call(api => api.eraseData())

function requestPersistence() {
  void navigator.storage?.persist?.().catch(() => false)
}

export async function addFile(file: File, signal?: AbortSignal) {
  requestPersistence()
  if (!signal) return worker.call(api => api.addFile(file))
  signal.throwIfAborted()
  // A separate worker makes cancellation effective during synchronous decompression and tokenization.
  const parser = workerConnection()
  let onAbort: (() => void) | undefined
  try {
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(new DOMException('Загрузка отменена.', 'AbortError'))
      signal.addEventListener('abort', onAbort, { once: true })
    })
    await Promise.race([parser.call(api => api.prepareFile(file)), cancelled])
    signal.throwIfAborted()
    if (onAbort) signal.removeEventListener('abort', onAbort)
    return await parser.call(api => api.commitPrepared())
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
    parser.close()
  }
}
