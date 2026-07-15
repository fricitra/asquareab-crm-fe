import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "../api/auth";
import {
  getConfiguration,
  listConfigurationEngines,
  upsertConfiguration,
  type ConfigurationEngineCode
} from "../api/configuration";

type DuplicatePayload = {
  matchMode: "ALL" | "ANY" | "MIN_MATCHED";
  minMatchedFields: number;
  fields: Array<{ fieldKey: string; enabled: boolean; normalize: string }>;
  onMatch: { blockCreate: boolean; showWarning: boolean };
};

type ScoringPayload = {
  totalMax: 100;
  criteria: Array<{
    code: string;
    label: string;
    maxPoints: number;
    enabled: boolean;
    sourceFields: string[];
    rules: Array<{ id: string; label: string; points: number; when: { fieldKey: string; codes: string[] } }>;
  }>;
};

type QualificationPayload = {
  mode: "HYBRID";
  autoQualifyMinScore: number;
  requireExistingChecklist: boolean;
  allowManualQualifyBelowThreshold: boolean;
  manualWarnMessage: string;
};

type ClassificationPayload = {
  autoApplyRating: boolean;
  bands: Array<{
    id: string;
    minScore: number;
    maxScore: number;
    ratingCode: "HOT" | "WARM" | "COLD" | "NURTURE";
    label: string;
  }>;
};

type CustomerCreationPayload = {
  createCustomerAt: "LEAD_CONVERT" | "PROPOSAL_ACCEPTED" | "CONTRACT_SIGNED";
  provisionalStatus: "PROSPECT";
  customerStatus: "ACTIVE";
  remarks: string;
};

function DuplicateEditor({
  value,
  onChange
}: {
  value: DuplicatePayload;
  onChange: (next: DuplicatePayload) => void;
}) {
  return (
    <div className="crm-form">
      <label className="crm-field">
        <span className="crm-label">Match Mode</span>
        <select
          className="crm-input"
          onChange={(event) => onChange({ ...value, matchMode: event.target.value as DuplicatePayload["matchMode"] })}
          value={value.matchMode}
        >
          <option value="ALL">All enabled fields must match</option>
          <option value="ANY">Any enabled field may match</option>
          <option value="MIN_MATCHED">Minimum matched fields</option>
        </select>
      </label>
      {value.matchMode === "MIN_MATCHED" ? (
        <label className="crm-field">
          <span className="crm-label">Minimum Matched Fields</span>
          <input
            className="crm-input"
            max={4}
            min={1}
            onChange={(event) => onChange({ ...value, minMatchedFields: Number(event.target.value) })}
            type="number"
            value={value.minMatchedFields}
          />
        </label>
      ) : null}
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Enabled</th>
              <th>Normalize</th>
            </tr>
          </thead>
          <tbody>
            {(value.fields ?? []).map((field, index) => (
              <tr key={field.fieldKey}>
                <td>{field.fieldKey}</td>
                <td>
                  <input
                    checked={field.enabled}
                    onChange={(event) => {
                      const fields = (value.fields ?? []).map((item, itemIndex) =>
                        itemIndex === index ? { ...item, enabled: event.target.checked } : item
                      );
                      onChange({ ...value, fields });
                    }}
                    type="checkbox"
                  />
                </td>
                <td>{field.normalize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="crm-muted-text">On match: Block create with warning (organization policy).</p>
    </div>
  );
}

function ScoringEditor({ value, onChange }: { value: ScoringPayload; onChange: (next: ScoringPayload) => void }) {
  const total = useMemo(
    () => (value.criteria ?? []).reduce((sum, item) => sum + (item.enabled ? item.maxPoints : 0), 0),
    [value.criteria]
  );

  return (
    <div className="crm-form">
      <div className={`crm-config-total${total === 100 ? " is-valid" : " is-invalid"}`}>
        Enabled criteria total: <strong>{total}</strong> / 100 {total === 100 ? "✓" : "(must equal 100)"}
      </div>
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Criteria</th>
              <th>Max Score</th>
              <th>Enabled</th>
              <th>Sample Rules</th>
            </tr>
          </thead>
          <tbody>
            {(value.criteria ?? []).map((criterion, index) => (
              <tr key={criterion.code}>
                <td>
                  <strong>{criterion.label}</strong>
                  <div className="crm-muted-text">{criterion.code}</div>
                </td>
                <td>
                  <input
                    className="crm-input"
                    min={0}
                    onChange={(event) => {
                      const criteria = value.criteria.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, maxPoints: Number(event.target.value) } : item
                      );
                      onChange({ ...value, criteria });
                    }}
                    type="number"
                    value={criterion.maxPoints}
                  />
                </td>
                <td>
                  <input
                    checked={criterion.enabled}
                    onChange={(event) => {
                      const criteria = value.criteria.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, enabled: event.target.checked } : item
                      );
                      onChange({ ...value, criteria });
                    }}
                    type="checkbox"
                  />
                </td>
                <td>
                  <ul className="crm-config-rule-list">
                    {(criterion.rules ?? []).map((rule) => (
                      <li key={rule.id}>
                        {rule.label}: <strong>{rule.points}</strong>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QualificationEditor({
  value,
  onChange
}: {
  value: QualificationPayload;
  onChange: (next: QualificationPayload) => void;
}) {
  return (
    <div className="crm-form">
      <label className="crm-field">
        <span className="crm-label">Auto-qualify minimum score</span>
        <input
          className="crm-input"
          max={100}
          min={0}
          onChange={(event) => onChange({ ...value, autoQualifyMinScore: Number(event.target.value) })}
          type="number"
          value={value.autoQualifyMinScore}
        />
      </label>
      <label className="crm-field crm-check-row">
        <input
          checked={value.allowManualQualifyBelowThreshold}
          onChange={(event) => onChange({ ...value, allowManualQualifyBelowThreshold: event.target.checked })}
          type="checkbox"
        />
        <span>Allow manual qualify below threshold (with warning)</span>
      </label>
      <label className="crm-field">
        <span className="crm-label">Warning message</span>
        <textarea
          className="crm-input crm-textarea"
          onChange={(event) => onChange({ ...value, manualWarnMessage: event.target.value })}
          rows={3}
          value={value.manualWarnMessage}
        />
      </label>
    </div>
  );
}

function ClassificationEditor({
  value,
  onChange
}: {
  value: ClassificationPayload;
  onChange: (next: ClassificationPayload) => void;
}) {
  return (
    <div className="crm-form">
      <label className="crm-field crm-check-row">
        <input
          checked={value.autoApplyRating}
          onChange={(event) => onChange({ ...value, autoApplyRating: event.target.checked })}
          type="checkbox"
        />
        <span>Auto-apply suggested rating when score is recalculated (default: suggest only)</span>
      </label>
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Rating</th>
              <th>Min</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            {(value.bands ?? []).map((band, index) => (
              <tr key={band.id}>
                <td>
                  <input
                    className="crm-input"
                    onChange={(event) => {
                      const bands = value.bands.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item
                      );
                      onChange({ ...value, bands });
                    }}
                    value={band.label}
                  />
                </td>
                <td>{band.ratingCode}</td>
                <td>
                  <input
                    className="crm-input"
                    max={100}
                    min={0}
                    onChange={(event) => {
                      const bands = value.bands.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, minScore: Number(event.target.value) } : item
                      );
                      onChange({ ...value, bands });
                    }}
                    type="number"
                    value={band.minScore}
                  />
                </td>
                <td>
                  <input
                    className="crm-input"
                    max={100}
                    min={0}
                    onChange={(event) => {
                      const bands = value.bands.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, maxScore: Number(event.target.value) } : item
                      );
                      onChange({ ...value, bands });
                    }}
                    type="number"
                    value={band.maxScore}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="crm-muted-text">Bands must cover 0–100 with no gaps or overlaps.</p>
    </div>
  );
}

function CustomerCreationEditor({
  value,
  onChange
}: {
  value: CustomerCreationPayload;
  onChange: (next: CustomerCreationPayload) => void;
}) {
  return (
    <div className="crm-form">
      <p className="crm-muted-text">
        Business rule: a person becomes a Customer only after Sale & Purchase Agreement commitment. Before that they remain a
        prospective buyer (PROSPECT). Opportunity / reservation / proposal still link to the provisional person record for
        workflow continuity.
      </p>
      <label className="crm-field">
        <span className="crm-label">Promote to Customer when</span>
        <select
          className="crm-input"
          onChange={(event) =>
            onChange({
              ...value,
              createCustomerAt: event.target.value as CustomerCreationPayload["createCustomerAt"]
            })
          }
          value={value.createCustomerAt}
        >
          <option value="PROPOSAL_ACCEPTED">Proposal accepted (recommended — SPA equivalent)</option>
          <option value="CONTRACT_SIGNED">Contract / SPA signed</option>
          <option value="LEAD_CONVERT">Lead converted to opportunity (legacy)</option>
        </select>
      </label>
      <label className="crm-field">
        <span className="crm-label">Policy note</span>
        <textarea
          className="crm-input crm-textarea"
          onChange={(event) => onChange({ ...value, remarks: event.target.value })}
          rows={3}
          value={value.remarks}
        />
      </label>
      <p className="crm-muted-text">
        Before trigger: status <strong>{value.provisionalStatus}</strong>. After trigger: status{" "}
        <strong>{value.customerStatus}</strong> (Customer).
      </p>
    </div>
  );
}

function isDuplicatePayload(value: unknown): value is DuplicatePayload {
  return Boolean(value && typeof value === "object" && Array.isArray((value as DuplicatePayload).fields));
}

function isScoringPayload(value: unknown): value is ScoringPayload {
  return Boolean(value && typeof value === "object" && Array.isArray((value as ScoringPayload).criteria));
}

function isQualificationPayload(value: unknown): value is QualificationPayload {
  return Boolean(
    value && typeof value === "object" && typeof (value as QualificationPayload).autoQualifyMinScore === "number"
  );
}

function isClassificationPayload(value: unknown): value is ClassificationPayload {
  return Boolean(value && typeof value === "object" && Array.isArray((value as ClassificationPayload).bands));
}

function isCustomerCreationPayload(value: unknown): value is CustomerCreationPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as CustomerCreationPayload).createCustomerAt === "string"
  );
}

export function ConfigurationPage() {
  const queryClient = useQueryClient();
  const [selectedEngine, setSelectedEngine] = useState<ConfigurationEngineCode>("LEAD_SCORING");
  const [draftPayload, setDraftPayload] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enginesQuery = useQuery({
    queryKey: ["configuration", "engines"],
    queryFn: listConfigurationEngines,
    staleTime: 60_000
  });

  const configQuery = useQuery({
    queryKey: ["configuration", selectedEngine],
    queryFn: () => getConfiguration(selectedEngine),
    staleTime: 15_000
  });

  useEffect(() => {
    setDraftPayload(null);
    setMessage(null);
    setError(null);
  }, [selectedEngine]);

  useEffect(() => {
    if (configQuery.data && configQuery.data.engineCode === selectedEngine) {
      setDraftPayload(structuredClone(configQuery.data.payload));
      setMessage(null);
      setError(null);
    }
  }, [configQuery.data, selectedEngine]);

  const saveMutation = useMutation({
    mutationFn: (status: "DRAFT" | "PUBLISHED") =>
      upsertConfiguration(selectedEngine, {
        status,
        payload: draftPayload
      }),
    onSuccess: async (_data, status) => {
      setMessage(status === "PUBLISHED" ? "Configuration published. Live rules are now active." : "Draft saved. Publish to apply live.");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["configuration", selectedEngine] });
    },
    onError: (saveError) => {
      setError(getApiErrorMessage(saveError));
      setMessage(null);
    }
  });

  const activeMeta = enginesQuery.data?.find((item) => item.code === selectedEngine);
  const editorReady = Boolean(configQuery.data?.engineCode === selectedEngine && draftPayload);
  const hasUnpublishedChanges = Boolean(configQuery.data?.hasUnpublishedChanges || configQuery.data?.isDefault);

  return (
    <div className="crm-workspace crm-configuration-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Settings</p>
          <h2>Business Rules Configuration</h2>
          <p className="crm-muted-text">
            Flexible org rules for lead duplication, scoring, qualification, and classification. Extensible for more modules.
          </p>
        </div>
      </section>

      <div className="crm-configuration-layout">
        <aside className="crm-panel crm-configuration-nav">
          <h3>Engines</h3>
          <div className="crm-configuration-engine-list">
            {(enginesQuery.data ?? []).map((engine) => (
              <button
                className={`crm-configuration-engine-button${selectedEngine === engine.code ? " is-active" : ""}`}
                key={engine.code}
                onClick={() => setSelectedEngine(engine.code)}
                type="button"
              >
                <strong>{engine.name}</strong>
                <span>{engine.module}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="crm-panel crm-configuration-editor">
          <div className="crm-panel-header">
            <div>
              <h3>{activeMeta?.name ?? selectedEngine}</h3>
              <p className="crm-muted-text">{activeMeta?.description}</p>
              {configQuery.data?.isDefault ? (
                <p className="crm-muted-text">Showing system defaults — save a draft or publish for this organization.</p>
              ) : (
                <p className="crm-muted-text">
                  Version {configQuery.data?.configVersion ?? "-"} · Draft: {configQuery.data?.status ?? "-"}
                  {configQuery.data?.publishedAt
                    ? ` · Published ${new Date(configQuery.data.publishedAt).toLocaleString()}`
                    : " · Not published yet"}
                  {hasUnpublishedChanges ? " · Unpublished changes" : ""}
                </p>
              )}
            </div>
            <div className="crm-inline-actions">
              <button
                className="crm-secondary-button crm-fit-button"
                disabled={saveMutation.isPending || !editorReady}
                onClick={() => saveMutation.mutate("DRAFT")}
                type="button"
              >
                Save Draft
              </button>
              <button
                className="crm-primary-button crm-fit-button"
                disabled={saveMutation.isPending || !editorReady}
                onClick={() => saveMutation.mutate("PUBLISHED")}
                type="button"
              >
                Publish
              </button>
            </div>
          </div>

          {error ? <div className="crm-error-banner">{error}</div> : null}
          {message ? <div className="crm-success-banner">{message}</div> : null}
          {configQuery.isLoading || !editorReady ? <p className="crm-muted-text">Loading configuration...</p> : null}

          {editorReady && selectedEngine === "LEAD_DUPLICATE" && isDuplicatePayload(draftPayload) ? (
            <DuplicateEditor onChange={setDraftPayload} value={draftPayload} />
          ) : null}
          {editorReady && selectedEngine === "LEAD_SCORING" && isScoringPayload(draftPayload) ? (
            <ScoringEditor onChange={setDraftPayload} value={draftPayload} />
          ) : null}
          {editorReady && selectedEngine === "LEAD_QUALIFICATION" && isQualificationPayload(draftPayload) ? (
            <QualificationEditor onChange={setDraftPayload} value={draftPayload} />
          ) : null}
          {editorReady && selectedEngine === "LEAD_CLASSIFICATION" && isClassificationPayload(draftPayload) ? (
            <ClassificationEditor onChange={setDraftPayload} value={draftPayload} />
          ) : null}
          {editorReady && selectedEngine === "CUSTOMER_CREATION" && isCustomerCreationPayload(draftPayload) ? (
            <CustomerCreationEditor onChange={setDraftPayload} value={draftPayload} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

