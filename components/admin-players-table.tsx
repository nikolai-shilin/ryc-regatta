'use client';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

// The players' table on /admin/players, sorted by the column whose head was clicked (components/admin-players.tsx
// draws each cell on the server and gives each its value to sort by). A second click turns the order round; a column
// with nothing in it for a player puts that player last either way. At first: the last seen first.
export type Col = { label: string; asc?: boolean };   // asc: sorted low to high at its first click
export type Row = { key: string; name: string; sub: string; isNew: boolean; cells: ReactNode[]; vals: (number | string | null)[]; href?: string; sort?: number | string };   // href: the player's log; sort: what the first column sorts by, when not its name

export function PlayersTable({ cols, rows, first, label, newLabel, start }: {
  cols: Col[]; rows: Row[]; first: Col; label: string; newLabel: string; start: number;
}) {
  const all = [first, ...cols];
  const [sort, setSort] = useState<{ i: number; asc: boolean }>({ i: start, asc: false });
  const sorted = useMemo(() => {
    const val = (r: Row) => (sort.i === 0 ? (r.sort ?? r.name) : r.vals[sort.i - 1]);
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.asc ? c : -c;
    });
  }, [rows, sort]);
  const click = (i: number) => setSort((s) => (s.i === i ? { i, asc: !s.asc } : { i, asc: !!all[i].asc }));
  return (
    <div className="adm-tab-scroll" tabIndex={0} role="region" aria-label={label}>
      <table className="adm-players">
        <thead>
          <tr>
            {all.map((c, i) => (
              <th key={c.label} scope="col" aria-sort={sort.i === i ? (sort.asc ? 'ascending' : 'descending') : undefined}>
                <button type="button" className={sort.i === i ? 'on' : undefined} onClick={() => click(i)}>
                  {c.label}<span className="adm-sort" aria-hidden="true">{sort.i === i ? (sort.asc ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key}>
              <th scope="row">
                {r.href ? <Link className="adm-pl-name adm-pl-link" href={r.href}>{r.name}</Link> : <span className="adm-pl-name">{r.name}</span>}
                <span className="adm-pl-sub">{r.sub}{r.isNew && <b className="adm-pl-new">{newLabel}</b>}</span>
              </th>
              {r.cells.map((c, i) => <td key={i}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
