import type { ReactNode } from "react";

export type SalesPipelineStageId =
  | "lead"
  | "opportunity"
  | "reservation"
  | "proposal"
  | "contract"
  | "erp";

export type SalesPipelineStage = {
  id: SalesPipelineStageId;
  label: string;
  status: "completed" | "current" | "upcoming";
};

export const SALES_PIPELINE_LABELS: Record<SalesPipelineStageId, string> = {
  lead: "Lead",
  opportunity: "Opportunity",
  reservation: "Reservation",
  proposal: "Proposal",
  contract: "Contract",
  erp: "ERP"
};

/** Canonical primary handoff CTAs — keep wording identical across modules. */
export const MOVE_TO_CTA = {
  opportunity: "Move to Opportunity",
  reservation: "Move to Reservation",
  proposal: "Move to Proposal",
  contract: "Move to Contract",
  handoff: "Move to Handoff",
  erp: "Move to ERP"
} as const;

export function buildSalesPipeline(current: SalesPipelineStageId): SalesPipelineStage[] {
  const order: SalesPipelineStageId[] = ["lead", "opportunity", "reservation", "proposal", "contract", "erp"];
  const currentIndex = order.indexOf(current);
  return order.map((id, index) => ({
    id,
    label: SALES_PIPELINE_LABELS[id],
    status: index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming"
  }));
}

export type ContinuePanelProps = {
  nowLabel: string;
  nowSummary: string;
  nextLabel: string;
  nextSummary: string;
  dataNeeded?: string;
  notesLabel?: string;
  notesValue?: string;
  notesPlaceholder?: string;
  notesHint?: string;
  onNotesChange?: (value: string) => void;
  children?: ReactNode;
};

export function SalesPipelineStrip({ current }: { current: SalesPipelineStageId }) {
  const stages = buildSalesPipeline(current);
  return (
    <nav aria-label="Sales pipeline" className="crm-sales-pipeline">
      {stages.map((stage, index) => (
        <div className={`crm-sales-pipeline-stage is-${stage.status}`} key={stage.id}>
          {index > 0 ? <span aria-hidden="true" className="crm-sales-pipeline-connector" /> : null}
          <span className="crm-sales-pipeline-label">{stage.label}</span>
        </div>
      ))}
    </nav>
  );
}

export function ContinuePanel({
  nowLabel,
  nowSummary,
  nextLabel,
  nextSummary,
  dataNeeded,
  notesLabel = "Quick notes",
  notesValue,
  notesPlaceholder = "Add a short note for this action…",
  notesHint,
  onNotesChange,
  children
}: ContinuePanelProps) {
  const showNotes = typeof onNotesChange === "function";

  return (
    <section className="crm-continue-panel">
      <div className="crm-continue-panel-grid">
        <div>
          <span className="crm-label">Now</span>
          <strong>{nowLabel}</strong>
          <p>{nowSummary}</p>
        </div>
        <div>
          <span className="crm-label">Next</span>
          <strong>{nextLabel}</strong>
          <p>{nextSummary}</p>
        </div>
        {dataNeeded ? (
          <div>
            <span className="crm-label">Data needed</span>
            <p>{dataNeeded}</p>
          </div>
        ) : null}
      </div>
      {showNotes ? (
        <label className="crm-field crm-continue-panel-notes">
          <span className="crm-label">{notesLabel}</span>
          <textarea
            className="crm-input crm-textarea"
            onChange={(event) => onNotesChange?.(event.target.value)}
            placeholder={notesPlaceholder}
            rows={3}
            value={notesValue ?? ""}
          />
          {notesHint ? <small className="crm-muted-text">{notesHint}</small> : null}
        </label>
      ) : null}
      {children ? <div className="crm-continue-panel-actions">{children}</div> : null}
    </section>
  );
}
