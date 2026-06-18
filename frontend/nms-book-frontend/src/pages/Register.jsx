import { useState } from "react";
import { FaBookOpen, FaShieldAlt, FaUserGraduate } from "react-icons/fa";
import API from "../api/api";
import { normalizeEmail, validateRegistrationForm } from "../utils/validation";

function Register({ onLoginClick }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (event) => {
    event.preventDefault();
    setMessage("");
    setIsSuccess(false);

    const validationError = validateRegistrationForm({ name, email, grade, section, password, acceptedTerms });
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await API.post("/register", {
        name: name.trim(),
        email: normalizeEmail(email),
        grade: grade.trim(),
        section: section.trim(),
        password,
        accepted_terms: acceptedTerms,
      });

      setMessage("Registration successful! Please login.");
      setIsSuccess(true);
      setName("");
      setEmail("");
      setGrade("");
      setSection("");
      setPassword("");
      setAcceptedTerms(false);
    } catch (err) {
      setMessage(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-kicker"><FaUserGraduate /> Student access</div>
        <div className="logo-circle">
          <FaBookOpen />
        </div>

        <h1>Create Account</h1>

        <p className="auth-subtitle">
          Join NMS Bahrain BookX
        </p>

        <form autoComplete="off" data-form-type="other" onSubmit={handleRegister}>
          <input type="text" name="register-name" placeholder="Full Name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" autoCorrect="off" data-lpignore="true" data-form-type="other" spellCheck={false} aria-label="Full Name" required />
          <input type="email" name="register-email" placeholder="Student ID Email (@nmsedu.bh)" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" data-lpignore="true" data-form-type="other" spellCheck={false} aria-label="Student ID Email" required />
          <input type="text" name="register-grade" placeholder="Grade" value={grade} onChange={(event) => setGrade(event.target.value)} autoComplete="off" autoCorrect="off" data-lpignore="true" data-form-type="other" spellCheck={false} aria-label="Grade" required />
          <input type="text" name="register-section" placeholder="Section" value={section} onChange={(event) => setSection(event.target.value)} autoComplete="off" autoCorrect="off" data-lpignore="true" data-form-type="other" spellCheck={false} aria-label="Section" required />
          <input type="password" name="register-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" autoCorrect="off" data-lpignore="true" data-form-type="other" spellCheck={false} aria-label="Password" minLength="8" required />

          <label className="terms-row">
            <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
            <span>I agree to the Terms & Conditions</span>
          </label>

          <div className="notice-box">
            <p><FaShieldAlt aria-hidden="true" /> Only NMS Bahrain students can register.</p>
            <p><FaBookOpen aria-hidden="true" /> Only school syllabus books are allowed.</p>
          </div>

          <button className="primary-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>

        {message && <p className={`form-message ${isSuccess ? "success" : "error"}`} role="alert">{message}</p>}

        <p className="switch-text">
          Already have an account?{" "}
          <button type="button" onClick={onLoginClick}>
            Login
          </button>
        </p>

      </div>
    </div>
  );
}

export default Register;
