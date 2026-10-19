export type ClaimStatus = "pending" | "on_hold" | "approved" | "rejected" | "collected";

const labels: Record<ClaimStatus, string> = {
  pending: "Pending",
  on_hold: "On Hold",
  approved: "Approved",
  rejected: "Rejected",
  collected: "Collected",
};

const explanations: Record<ClaimStatus, string> = {
  pending: "Staff at the desk will check your answer and proof.",
  on_hold: "Claims without proof wait before staff can approve them.",
  approved: "Bring photo ID to the desk to pick it up.",
  rejected: "Staff could not confirm this item is yours.",
  collected: "You picked this item up.",
};

export function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === "string" && value in labels;
}

export function claimStatusLabel(status: ClaimStatus) {
  return labels[status];
}

export function claimStatusExplanation(status: ClaimStatus) {
  return explanations[status];
}
