import { FILTERS, type FilterKey } from "../metrics/filter";

export function FilterPicker({ value, onChange }: { value: FilterKey; onChange: (k: FilterKey) => void }) {
  return (
    <select class={`range ${value !== "all" ? "active" : ""}`} value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as FilterKey)} aria-label="Filter by type">
      {FILTERS.map((f) => (
        <option key={f.key} value={f.key}>
          {f.label}
        </option>
      ))}
    </select>
  );
}
