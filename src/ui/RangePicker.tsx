import { RANGES, type RangeKey } from "../metrics/range";

export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <select class="range" value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as RangeKey)} aria-label="Date range">
      {RANGES.map((r) => (
        <option key={r.key} value={r.key}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
