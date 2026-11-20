import { Inflate } from 'fflate'

const maxEntries = 2048
const maxTotal = 64 * 1024 * 1024
const maxMember = 12 * 1024 * 1024
const invalid = () => new Error('Повреждённый или неподдерживаемый EPUB-архив.')
const tooLarge = () => new Error('EPUB слишком большой после распаковки (лимит 64 МБ суммарно и 12 МБ на запись).')

interface Member {
  offset: number
  size: number
  expanded: number
  method: number
}

/** Index central records first. Only members on the reading path are inflated. */
export function openArchive(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (offset: number) => view.getUint16(offset, true)
  const u32 = (offset: number) => view.getUint32(offset, true)
  let end = bytes.length - 22
  const furthest = Math.max(0, end - 65535)
  while (end >= furthest && !(u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length)) end--
  if (end < furthest || u16(end + 4) || u16(end + 6)) throw invalid()
  const count = u16(end + 10)
  if (count > maxEntries) throw new Error('В EPUB больше 2048 записей.')
  const members = new Map<string, Member>()
  let central = u32(end + 16)
  const centralEnd = central + u32(end + 12)
  if (centralEnd > end) throw invalid()
  let declaredTotal = 0
  for (let i = 0; i < count; i++) {
    if (central + 46 > centralEnd || u32(central) !== 0x02014b50) throw invalid()
    const nameLength = u16(central + 28)
    const next = central + 46 + nameLength + u16(central + 30) + u16(central + 32)
    if (next > centralEnd) throw invalid()
    const name = new TextDecoder().decode(bytes.subarray(central + 46, central + 46 + nameLength))
    if (members.has(name)) throw invalid()
    if (u16(central + 8) & 1) throw new Error('EPUB защищён паролем.')
    const member = {
      method: u16(central + 10), size: u32(central + 20),
      expanded: u32(central + 24), offset: u32(central + 42),
    }
    declaredTotal += member.expanded
    if (member.expanded > maxMember || declaredTotal > maxTotal) throw tooLarge()
    members.set(name, member)
    central = next
  }
  if (central !== centralEnd) throw invalid()
  let actualTotal = 0
  return function readMember(name: string): Uint8Array {
    const member = members.get(name)
    if (!member) throw new Error('В EPUB отсутствует файл «' + name + '».')
    const { offset, size, expanded, method } = member
    if (offset + 30 > bytes.length || u32(offset) !== 0x04034b50) throw invalid()
    const dataStart = offset + 30 + u16(offset + 26) + u16(offset + 28)
    if (dataStart + size > u32(end + 16) || actualTotal + expanded > maxTotal) throw invalid()
    const input = bytes.subarray(dataStart, dataStart + size)
    actualTotal += expanded
    if (method === 0 && size === expanded) return input
    if (method !== 8 || !size) throw invalid()

    // Bound actual output even when uncompressed sizes in the directory are wrong.
    let written = 0
    const result = new Uint8Array(expanded)
    const stream = new Inflate((chunk) => {
      if (written + chunk.length > expanded) throw tooLarge()
      result.set(chunk, written)
      written += chunk.length
    })
    const step = 4096
    for (let i = 0; i < size; i += step) stream.push(input.subarray(i, i + step), i + step >= size)
    if (written !== expanded) throw invalid()
    return result
  }
}
