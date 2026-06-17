const NMS_EMAIL_PATTERN = /^[^\s@]+@nmsedu\.bh$/i;
const GRADE_PATTERN = /^(?:[1-9]|1[0-2])$/;
const SECTION_PATTERN = /^[A-Za-z0-9 -]{1,12}$/;

export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export function validateLoginForm({ email, password }) {
  if (!normalizeEmail(email)) return "Please enter your student email.";
  if (!password) return "Please enter your password.";
  return "";
}

export function validateRegistrationForm({ name, email, grade, section, password, acceptedTerms }) {
  if (name.trim().length < 2) return "Please enter your full name.";
  if (!NMS_EMAIL_PATTERN.test(normalizeEmail(email))) return "Use your NMS student email ending in @nmsedu.bh.";
  if (!GRADE_PATTERN.test(grade.trim())) return "Grade must be a number from 1 to 12.";
  if (!SECTION_PATTERN.test(section.trim())) return "Section can contain letters, numbers, spaces, or hyphens only.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!acceptedTerms) return "Please accept the Terms & Conditions.";
  return "";
}

export function validateBookForm({ title, subject, grade, description, isSyllabusBook }) {
  if (title.trim().length < 2) return "Please enter a clear book title.";
  if (subject.trim().length < 2) return "Please enter the subject.";
  if (!GRADE_PATTERN.test(grade.trim())) return "Grade must be a number from 1 to 12.";
  if (description.trim().length < 8) return "Please add a short description of the book.";
  if (!isSyllabusBook) return "Only school syllabus books are allowed.";
  return "";
}
