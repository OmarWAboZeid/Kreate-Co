export default function ActivityLog({ entries }) {
  if (!entries || entries.length === 0) {
    return <p className="muted">No activity logged yet.</p>;
  }

  return (
    <ul className="activity-log">
      {entries.map((entry) => (
        <li key={entry.id}>
          <div>
            <strong>{entry.action}</strong>
            <span>
              {entry.actor} · {new Date(entry.timestamp).toLocaleString()}
            </span>
          </div>
          {entry.note && <p>{entry.note}</p>}
        </li>
      ))}
    </ul>
  );
}
