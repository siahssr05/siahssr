const LABELS = {
  submitted: "Submitted",
  under_review: "Under Review",
  accepted: "Accepted",
  rejected: "Rejected",
  published: "Published",
  withdrawn: "Withdrawn",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge badge-status-${status}`}>{LABELS[status] || status}</span>
  );
}
