import { useState } from "react";
import { FaBookOpen } from "react-icons/fa";
import { useUser } from "../context/UserContext";
import { normalizeEmail, validateLoginForm } from "../utils/validation";

function Login({ onRegisterClick }) {
  const { login, startDemo } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    const validationError = validateLoginForm({ email, password });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await login(normalizeEmail(email), password);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to login. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-circle">
          <FaBookOpen />
        </div>

        <h1>NMS Bahrain BookX</h1>

        <p className="auth-subtitle">
          Share, find, and request school syllabus books.
        </p>

        <div className="notice-box">
          <p>Only NMS Bahrain students are allowed.</p>
          <p>Only school syllabus books are permitted.</p>
        </div>

        <form autoComplete="off" data-form-type="other" onSubmit={handleLogin}>
          <label className="sr-only" htmlFor="login-email">Student ID Email</label>
          <input
            id="login-email"
            name="login-email"
            type="email"
            placeholder="Student ID Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            data-lpignore="true"
            data-form-type="other"
            spellCheck={false}
            required
          />

          <label className="sr-only" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="login-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            autoCorrect="off"
            data-lpignore="true"
            data-form-type="other"
            spellCheck={false}
            required
          />

          <button className="primary-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <button className="demo-entry-btn" type="button" onClick={startDemo}>Enter Demo Mode</button>

        {error && <p className="form-message error" role="alert">{error}</p>}

        <p className="switch-text">
          New student?{" "}
          <button type="button" onClick={onRegisterClick}>
            Create account
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
