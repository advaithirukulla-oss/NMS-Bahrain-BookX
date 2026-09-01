export const GRADE_OPTIONS = [
  { value: "KG 1", label: "KG 1" },
  { value: "KG 2", label: "KG 2" },
  ...Array.from({ length: 12 }, (_, index) => {
    const grade = String(index + 1);
    return { value: grade, label: `Grade ${grade}` };
  }),
];

export const VALID_GRADES = new Set(GRADE_OPTIONS.map(({ value }) => value));

export function formatGrade(grade) {
  const value = String(grade ?? "").trim();
  if (value === "KG 1" || value === "KG 2") return value;
  return value ? `Grade ${value}` : "Not set";
}

export function gradeSortValue(grade) {
  const value = String(grade ?? "").trim();
  if (value === "KG 1") return 0;
  if (value === "KG 2") return 0.5;
  return Number(value) || Number.MAX_SAFE_INTEGER;
}
