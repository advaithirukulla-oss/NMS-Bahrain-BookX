export function smartError(error) {
  if (error?.response?.status === 422) return "Check your input: use KG 1–2 or Grade 1–12 and keep your query or notes under 500 characters.";
  return error?.response?.status === 429 ? "Please wait a minute before asking for more suggestions." : "Smart suggestions are temporarily unavailable. You can continue manually.";
}
export function applySuggestion(current, field, value) {
  const allowed = new Set(["title", "subject", "grade", "condition", "description"]);
  return allowed.has(field) && typeof value === "string" ? { ...current, [field]: value } : current;
}
