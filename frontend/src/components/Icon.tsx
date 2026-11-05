const paths = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  calendar: 'M4 5h16v16H4ZM8 3v4m8-4v4M4 11h16m-12 4h2m4 0h2',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7-7a4 4 0 0 1 0 7',
  chart: 'M4 3v17h17M8 15v-4m5 4V7m5 8v-6',
  book: 'M12 5v16m0-16C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z',
  box: 'm3 7 9-4 9 4-9 4Zm0 0v10l9 4 9-4V7M12 11v10M7.5 5l9 4',
  leaf: 'M20 3C10 2 3 7 4 14c1 7 11 8 14 1 2-4 2-8 2-12ZM4 21l10-10',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  plus: 'M12 5v14M5 12h14',
  search: 'm21 21-5-5M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13',
  edit: 'm15 5 4 4M4 20l5-1L21 7l-4-4L5 15ZM4 20h16',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  arrow: 'M19 12H5m6-6-6 6 6 6',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  user: 'M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  mail: 'M3 5h18v14H3Zm0 1 9 7 9-7',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v6l4 2',
  wallet: 'M3 6h16v14H3Zm0 3h18v8h-5a4 4 0 0 1 0-8h5M16 13h.01',
  alert: 'M12 3 2 21h20Zm0 6v5m0 3h.01',
  list: 'M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01',
  chevron: 'm9 18 6-6-6-6',
  spark: 'm12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4Zm6 11 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8Z',
  bot: 'M12 8V4m-3 0h6M5 11h14v9H5Zm3 4h.01M16 15h.01M9 19h6M4 14H2m20 0h-2',
}
export type IconName = keyof typeof paths
export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={paths[name]} /></svg>
}
