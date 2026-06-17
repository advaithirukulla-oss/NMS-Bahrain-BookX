import { FaCheckCircle, FaClipboardList } from "react-icons/fa";

const RULES = [
  "Only NMS Bahrain students can use the app.",
  "Only school syllabus books are allowed.",
  "Out-of-syllabus books are not allowed.",
  "All messages must be respectful.",
  "Fake or misleading posts can be removed by an admin.",
  "Books are for giveaway or exchange only. Selling and payments are not allowed.",
];

function Terms({ onBack }) {
  return (
    <div className="page utility-page">
      <button className="back-link" type="button" onClick={onBack}>Back to Profile</button>
      <header className="page-heading">
        <div><p className="eyebrow">Community guidelines</p><h1>Terms &amp; Conditions</h1></div>
        <FaClipboardList aria-hidden="true" />
      </header>

      <section className="terms-card">
        <p>NMS Bahrain BookX is a student-only space for sharing school books safely and fairly.</p>
        <div className="rules-list">
          {RULES.map((rule) => (
            <div className="rule-row" key={rule}><FaCheckCircle aria-hidden="true" /><span>{rule}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Terms;
