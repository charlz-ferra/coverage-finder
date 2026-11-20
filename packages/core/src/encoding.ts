export function decodeText(bytes: Uint8Array): string {
  let encoding = 'utf-8'
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be'
  let result: string
  try {
    result = new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    // Some Node/ICU builds expose C1 controls here; browsers typically map these already.
    const c1 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ'
    result = new TextDecoder('windows-1252').decode(bytes)
      .replace(/[\u0080-\u009f]/g, c => c1[c.charCodeAt(0) - 128])
  }
  if (/[^\P{Cc}\t\n\r\f]/u.test(result)) {
    throw new Error('Не удалось прочитать текст. Сохраните файл в UTF-8.')
  }
  return result.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}
