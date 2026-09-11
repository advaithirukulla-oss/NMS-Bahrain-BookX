export const statusLabel = (status) => ({ pending: "Requested", approved: "Accepted", rejected: "Declined", cancelled: "Cancelled", completed: "Completed", available: "Available", reserved: "Reserved", given: "Given" }[status] || status);
export function permittedActions(status, owner) {
  if (status === "pending") return owner ? ["approved", "rejected"] : ["cancelled"];
  return status === "approved" && owner ? ["completed"] : [];
}
export function requestTimeline(request) {
  return [["pending", request.request_date], ["approved", request.accepted_at], ["rejected", request.declined_at], ["cancelled", request.cancelled_at], ["completed", request.completed_at]]
    .filter(([, at]) => at && !Number.isNaN(Date.parse(at))).map(([status, at]) => ({ status, at }));
}
export function eventDate(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-BH", { dateStyle: "medium", timeStyle: "short" }).format(utcDate(value));
}
export function utcDate(value) {
  const utc = /Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`;
  return new Date(utc);
}
