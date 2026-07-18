import { useEffect, useMemo, useState } from "react";

export type WorkflowStep = {
  id: string;
  title: string;
  status: "completed" | "current" | "next" | "blocked";
  timestamp?: string | null;
  user?: string | null;
  role?: string | null;
  summary?: string | null;
  details: Array<{ label: string; value: string | number | null | undefined }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function valueText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export function WorkflowTracker({
  steps,
  showDetail = true
}: {
  steps: WorkflowStep[];
  showDetail?: boolean;
}) {
  const defaultStepId = useMemo(() => {
    const lastCompleted = [...steps].reverse().find((step) => step.status === "completed");
    return steps.find((step) => step.status === "current")?.id ?? lastCompleted?.id ?? steps[0]?.id;
  }, [steps]);
  const [selectedStepId, setSelectedStepId] = useState(defaultStepId);
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? steps[0];

  useEffect(() => {
    setSelectedStepId(defaultStepId);
  }, [defaultStepId]);

  if (!selectedStep) return null;

  return (
    <section className={`crm-workflow${showDetail ? "" : " crm-workflow-compact"}`}>
      <div className="crm-workflow-header">
        <h4>Workflow Status</h4>
        {showDetail ? <span>{selectedStep.title}</span> : null}
      </div>
      <div className="crm-workflow-steps">
        {steps.map((step) => (
          <button
            className={`crm-workflow-step is-${step.status}${showDetail && selectedStep.id === step.id ? " is-active" : ""}`}
            key={step.id}
            onClick={showDetail ? () => setSelectedStepId(step.id) : undefined}
            tabIndex={showDetail ? 0 : -1}
            type="button"
          >
            <strong>{step.title}</strong>
            <span>{step.status}</span>
          </button>
        ))}
      </div>
      {showDetail ? (
        <article className="crm-workflow-detail">
          <div className="crm-workflow-detail-title">
            <strong>{selectedStep.title}</strong>
            <span>{formatDate(selectedStep.timestamp)}</span>
          </div>
          <p>{selectedStep.summary ?? "No additional summary captured for this step."}</p>
          <dl className="crm-workflow-data">
            <div>
              <dt>User</dt>
              <dd>{valueText(selectedStep.user)}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{valueText(selectedStep.role)}</dd>
            </div>
            {selectedStep.details.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{valueText(item.value)}</dd>
              </div>
            ))}
          </dl>
        </article>
      ) : null}
    </section>
  );
}
