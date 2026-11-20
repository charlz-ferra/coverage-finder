<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props()
  const paths: Record<string, string> = {
    gear: 'm10 3-.7 2.4-2 .9-2.3-.8-2 3.4 1.8 1.7-.1 2.7L3 15l2 3.4 2.4-.6 1.9 1.1.7 2.1h4l.7-2.1 1.9-1.1 2.4.6 2-3.4-1.7-1.7-.1-2.7L21 8.9l-2-3.4-2.3.8-2-.9L14 3z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0',
    grid: 'M3.5 3.5h7v7h-7z M14 3.5h6.5v7H14z M3.5 14h7v6.5h-7z M14 14h6.5v6.5H14z',
    bookmark: 'M6 3h12v18l-6-4-6 4z',
    book: 'M3 5.5c3.4-.8 6-.4 9 1.8 3-2.2 5.6-2.6 9-1.8v13c-3.4-.8-6-.3-9 1.8-3-2.1-5.6-2.6-9-1.8z M12 7.3v13',
    library: 'M3 4.5h4v15H3z M10 4.5h3.5v15H10z M15.8 5.5l3.4-.9 3.5 14.5-3.4.8z',
    words: 'M3 5h12v13H3z M7 3h12v13 M7 14l2.1-5 2.1 5 M7.8 12.3h2.6',
    settings: 'M3 6h8m5 0h5M3 12h3m5 0h10M3 18h11m5 0h2 M11 4h5v4h-5zM6 10h5v4H6zM14 16h5v4h-5z',
    plus: 'M12 5v14M5 12h14',
    close: 'm6 6 12 12M18 6 6 18',
    search: 'M20 20l-4.6-4.6 M17 10a7 7 0 1 1-14 0 7 7 0 1 1 14 0',
    shield: 'M12 3 4 6v6c0 4.2 3.7 7.1 8 9 4.3-1.9 8-4.8 8-9V6z M8.5 12l2.5 2.5 4.5-5',
    chevron: 'm9 5 7 7-7 7',
    down: 'm6 9 6 6 6-6',
    back: 'm14.5 5-7 7 7 7',
    filter:
      'M3 6h11m5 0h2M3 12h4m5 0h9M3 18h11m5 0h2 M14 3.8h4.7v4.4H14zM7 9.8h4.7v4.4H7zM14 15.8h4.7v4.4H14z',
    sort: 'M4 6h15M4 12h10M4 18h5 M18 11v9m-3-3 3 3 3-3',
    upload: 'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5',
    download: 'M12 3v13m-5-5 5 5 5-5M4 16v4h16v-4',
    sprout: 'M12 21v-8C12 7 16 4 21 4c0 5-3 9-9 9M12 17C6 17 3 13 3 8c5 0 9 3 9 9',
    check: 'm4 12 5 5L20 6',
    circle: 'M20 12a8 8 0 1 1-16 0 8 8 0 1 1 16 0',
    checkCircle: 'M21 12a9 9 0 1 1-5-8M7 11l4 4 10-11',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0M12 7v5l3 2',
    doc: 'M5 3h9l5 5v13H5z M14 3v6h5M8 13h8m-8 4h6',
    info: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0M12 11v5m0-9v.5',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0M3.5 12h17M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
    layers: 'm12 3 9 5-9 5-9-5z M3 12l9 5 9-5M3 16l9 5 9-5',
    chart: 'M4 20h16M6 16v-4m6 4V6m6 10V9',
    target: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0',
    trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
    tag: 'M3 4h8l10 10-7 7L3 10z M7.7 7.5h.5',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1',
    test: 'M4 5h16v14H4zM8 9h8M8 13h5',
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.65"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name] || paths.book} /></svg
>
