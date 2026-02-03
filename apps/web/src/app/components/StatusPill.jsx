const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function StatusPill({ status }) {
  if (!status) return null;
  const slug = slugify(status);
  return <span className={`status-pill status-${slug}`}>{status}</span>;
}
