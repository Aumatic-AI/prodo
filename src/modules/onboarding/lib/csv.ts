export interface CsvProduct {
  name: string;
  price: number | null;
  url: string;
}

/** Splits one CSV line, keeping commas inside quotes. */
function splitLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += c;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/** Reads products from a CSV with columns like name/title, price, url/link. */
export function parseProductsCsv(text: string): CsvProduct[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const nameCol = col("name", "title", "product");
  const priceCol = col("price", "cost");
  const urlCol = col("url", "link");
  if (nameCol < 0) throw new Error("The CSV needs a column called name or title.");

  return lines.slice(1).flatMap((line) => {
    const cells = splitLine(line);
    const name = cells[nameCol]?.trim();
    if (!name) return [];
    const price = priceCol >= 0 ? Number(cells[priceCol]?.replace(/[^0-9.]/g, "")) : NaN;
    return [{ name, price: Number.isFinite(price) && cells[priceCol] ? price : null, url: urlCol >= 0 ? cells[urlCol] ?? "" : "" }];
  });
}
