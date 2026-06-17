import { useEffect, useState } from "react";
import { FaMedal, FaStar, FaTrophy } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { DEMO_USERS } from "../data/DemoData";

function Leaderboard({ onBack }) {
  const { demoMode } = useUser();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demoMode) {
      const timeout = setTimeout(() => {
        setUsers([...DEMO_USERS].sort((a, b) => b.trust_points - a.trust_points));
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timeout);
    }
    API.get("/leaderboard")
      .then((response) => setUsers(response.data))
      .catch((requestError) => setError(requestError.response?.data?.detail || "Could not load the leaderboard."))
      .finally(() => setIsLoading(false));
  }, [demoMode]);

  return (
    <div className="page utility-page">
      <button className="back-link" type="button" onClick={onBack}>Back to Profile</button>
      <header className="page-heading">
        <div><p className="eyebrow">Community stars</p><h1>Leaderboard</h1></div>
        <FaTrophy aria-hidden="true" />
      </header>

      {isLoading && <p className="status-card">Loading rankings...</p>}
      {error && <p className="status-card error" role="alert">{error}</p>}
      {!isLoading && !error && users.length === 0 && <p className="empty-state">No students are ranked yet.</p>}

      <section className="leaderboard-list" aria-label="Trust points leaderboard">
        {users.map((student, index) => (
          <article className={`leaderboard-card rank-${index + 1}`} key={student.id}>
            <div className="rank-badge">{index < 3 ? <FaMedal aria-hidden="true" /> : <span>{index + 1}</span>}</div>
            <div className="leaderboard-copy">
              <strong>{student.name}</strong>
              <span>Grade {student.grade} | Section {student.section}</span>
            </div>
            <div className="points-badge"><FaStar aria-hidden="true" /> {student.trust_points ?? 0}</div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default Leaderboard;
