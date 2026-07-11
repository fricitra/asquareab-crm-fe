export type UnitVelocityTag = {
  code: string;
  name: string;
  kind: "sold" | "unsold" | "unknown";
  days: number | null;
};

type UnitVelocityBadgeProps = {
  tag: UnitVelocityTag;
};

function badgeClass(kind: UnitVelocityTag["kind"], code: string) {
  if (kind === "sold") {
    return "crm-unit-velocity-sold";
  }

  if (code === "CRITICAL_INVENTORY" || code === "AGED_INVENTORY") {
    return "crm-unit-velocity-risk";
  }

  if (kind === "unsold") {
    return "crm-unit-velocity-market";
  }

  return "crm-unit-velocity-unknown";
}

export function UnitVelocityBadge({ tag }: UnitVelocityBadgeProps) {
  return (
    <span className={`crm-velocity-badge ${badgeClass(tag.kind, tag.code)}`} title={tag.days != null ? `${tag.days} days` : undefined}>
      {tag.name}
      {tag.days != null ? ` · ${tag.days}d` : ""}
    </span>
  );
}
