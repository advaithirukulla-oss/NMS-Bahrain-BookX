import { useState } from "react";
import { FaBookOpen, FaEye, FaEyeSlash, FaShieldAlt, FaUserGraduate } from "react-icons/fa";
import { useUser } from "../context/UserContext";
import { normalizeEmail, validateLoginForm } from "../utils/validation";

function Login({ onRegisterClick }) {
  const { login, startDemo } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="auth-kicker"><FaUserGraduate /> Student book exchange</div>
        <div className="logo-circle">
          <FaBookOpen />
        </div>

        <h1>BookSpins</h1>

        <p className="auth-subtitle">Giving Books a Second Spin</p>

        <div className="notice-box">
          <p><FaShieldAlt aria-hidden="true" /> Only NMS Bahrain students are allowed.</p>
          <p><FaBookOpen aria-hidden="true" /> Only school syllabus books are permitted.</p>
        </div>

        <form autoComplete="off" data-form-type="other" onSubmit={handleLogin}>
          <label className="sr-only" htmlFor="login-email">Student ID Email</label>
          <div className="password-field"><input
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
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            autoCorrect="off"
            data-lpignore="true"
            data-form-type="other"
            spellCheck={false}
            required
          /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <FaEyeSlash /> : <FaEye />}</button></div>

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
