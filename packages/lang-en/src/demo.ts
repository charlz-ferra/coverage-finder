import books from '../../../data/demo/library.json'

export interface DemoText {
  id: string
  title: string
  author: string
  year: number
  genre: string
  kind: 'txt'
  text: string
  source: string
}

export const demoLibrary: DemoText[] = books.map(book => ({ ...book, kind: 'txt' }))
