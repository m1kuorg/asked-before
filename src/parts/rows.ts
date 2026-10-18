// Rows: a table set between two iron hairlines, with Rule Gray between its
// rows, a header row in label type, and numbers right-aligned in tabular
// figures. A row can open a full-width detail row under it, such as its
// delete confirmation. On a narrow screen each row stacks: its title, a line
// of its counts with their names, then its actions.

import { el, type Child } from "./dom";

export type Column<T> = {
  label: string;
  /** Right-aligned, for counts. */
  numeric?: boolean;
  /** The row's actions: the column's label is read by assistive technology but not drawn, since its buttons say what they do, and its cells are set as row actions. */
  actions?: boolean;
  /** A class for the column, which the surface's stylesheet can size. */
  className?: string;
  cell: (item: T) => Child | Child[];
};

export type RowsOptions<T> = {
  /** What the table lists, for assistive technology. */
  caption: string;
  columns: Column<T>[];
  items: T[];
  /** A full-width row under an item, or null for none. */
  detail?: (item: T) => Child | null;
};

export function rows<T>({ caption, columns, items, detail }: RowsOptions<T>): HTMLTableElement {
  const head = el("tr");
  const group = el("colgroup");
  for (const column of columns) {
    const header = el("th", column.numeric ? "is-numeric" : undefined, column.actions ? el("span", "visually-hidden", column.label) : column.label);
    header.scope = "col";
    head.append(header);
    group.append(el("col", column.className));
  }
  const body = el("tbody");
  for (const item of items) {
    const row = el("tr");
    for (const column of columns) {
      const content = column.cell(item);
      const cell = el("td", [column.numeric ? "is-numeric" : "", column.actions ? "row-actions" : ""].filter(Boolean).join(" "));
      // On a narrow screen the header row is hidden and each count carries its column's name.
      cell.dataset.label = column.label;
      cell.append(...(Array.isArray(content) ? content : [content]));
      row.append(cell);
    }
    body.append(row);
    const extra = detail?.(item);
    if (extra) {
      const cell = el("td", undefined, extra);
      cell.colSpan = columns.length;
      body.append(el("tr", "row-detail", cell));
    }
  }
  return el("table", "rows", el("caption", "visually-hidden", caption), group, el("thead", undefined, head), body);
}
