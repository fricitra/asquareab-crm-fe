import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import type { Contract } from "../api/contracts";
import { getReferenceFamily } from "../api/reference-data";
import { useModalEscape } from "../hooks/useModalEscape";
import { DateField } from "./DateField";

export type PaymentPlanFormValues = {
  planName: string;
  remarks: string;
  stages: Array<{
    milestoneRefId: string;
    milestoneLabel: string;
    dueDate: string;
    percentage: string;
  }>;
};

type PaymentPlanDialogProps = {
  open: boolean;
  contract: Contract | null;
  isSaving: boolean;
  formatInBase: (value: number | null, currencyCode: string | null) => string;
  formatMoney: (value: number | null, currencyCode?: string | null) => string;
  onClose: () => void;
  onSave: (values: PaymentPlanFormValues) => void;
  onNotice: (title: string, message: string, variant: "error" | "success" | "info") => void;
  noticeOpen?: boolean;
};

function pickNumber(value: string) {
  const normalized = value.replace(/[% ,]/g, "").trim();
  return normalized === "" ? undefined : Number(normalized);
}

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function toAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function PaymentPlanDialog({
  open,
  contract,
  isSaving,
  formatInBase,
  formatMoney,
  onClose,
  onSave,
  onNotice,
  noticeOpen = false
}: PaymentPlanDialogProps) {
  const activePaymentPlan = contract?.paymentPlans?.find((plan) => plan.isActive) ?? null;

  const [formError, setFormError] = useState<string | null>(null);

  const paymentPlanForm = useForm<PaymentPlanFormValues>({
    defaultValues: {
      planName: "Standard Payment Plan",
      remarks: "",
      stages: [
        { milestoneRefId: "", milestoneLabel: "", dueDate: "", percentage: "20" },
        { milestoneRefId: "", milestoneLabel: "", dueDate: "", percentage: "80" }
      ]
    }
  });
  const paymentStageFields = useFieldArray({
    control: paymentPlanForm.control,
    name: "stages"
  });
  const watchedPaymentStages = paymentPlanForm.watch("stages");
  const paymentPercentageTotal = (watchedPaymentStages ?? []).reduce(
    (sum, stage) => sum + (pickNumber(stage.percentage) ?? 0),
    0
  );

  const schedule = useMemo(() => {
    if (!contract) {
      return {
        spa: 0,
        reservation: 0,
        balance: 0,
        currencyCode: null as string | null
      };
    }
    const spa = toAmount(contract.commercialSummary?.contractValue ?? contract.contractValue);
    const reservation = toAmount(contract.commercialSummary?.reservationAmount ?? contract.reservation.amount);
    return {
      spa,
      reservation,
      balance: Math.max(0, Number((spa - reservation).toFixed(2))),
      currencyCode: contract.commercialSummary?.currencyCode ?? contract.currencyCode
    };
  }, [contract]);

  const paymentStagesQuery = useQuery({
    queryKey: ["reference-family", "CONTRACT", "PAYMENT_STAGE"],
    queryFn: () => getReferenceFamily("CONTRACT", "PAYMENT_STAGE"),
    enabled: open,
    staleTime: 60_000
  });

  useEffect(() => {
    if (!open || !contract) return;
    setFormError(null);
    const installmentLines = activePaymentPlan?.lines.filter((line) => line.lineType === "INSTALLMENT") ?? [];
    paymentPlanForm.reset({
      planName: activePaymentPlan?.planName ?? "Standard Payment Plan",
      remarks: "",
      stages:
        installmentLines.length > 0
          ? installmentLines.map((line) => ({
              milestoneRefId: line.milestoneRefId ?? "",
              milestoneLabel: line.milestoneLabel ?? "",
              dueDate: line.dueDate ?? "",
              percentage: line.percentageOfContract == null ? "" : String(line.percentageOfContract)
            }))
          : [
              { milestoneRefId: "", milestoneLabel: "", dueDate: "", percentage: "20" },
              { milestoneRefId: "", milestoneLabel: "", dueDate: "", percentage: "80" }
            ]
    });
  }, [activePaymentPlan?.id, contract?.id, open]);

  useModalEscape(open, onClose, { disabled: noticeOpen });

  if (!open || !contract) {
    return null;
  }

  const showFormError = (title: string, message: string) => {
    setFormError(message);
    onNotice(title, message, "error");
  };

  const onSubmit = paymentPlanForm.handleSubmit((values) => {
    if (contract.contractStatus.code === "DRAFT") {
      showFormError("Issue Contract First", "Step 1 is issuing the contract. Save the payment plan after it is issued.");
      return;
    }
    if (schedule.spa <= 0) {
      showFormError(
        "SPA Value Required",
        "Contract/SPA value is missing or zero. Set the contract value before saving the payment plan."
      );
      return;
    }
    if (values.stages.some((stage) => !stage.milestoneRefId)) {
      showFormError(
        "Payment Stage Missing",
        "Select a payment stage for every installment row (for example SPA Signing, Handover Balance)."
      );
      return;
    }
    if (values.stages.some((stage) => !pickString(stage.dueDate))) {
      showFormError("Due Date Required", "Select a due date for every installment stage.");
      return;
    }
    const total = values.stages.reduce((sum, stage) => sum + (pickNumber(stage.percentage) ?? 0), 0);
    if (Math.abs(total - 100) > 0.0001) {
      showFormError(
        "Percentages Incomplete",
        `Payment-stage percentages must total exactly 100% of SPA. Current total: ${total.toFixed(2)}%.`
      );
      return;
    }
    if (contract.contractStatus.code === "SIGNED" && !pickString(values.remarks)) {
      showFormError("Change Notes Required", "Enter change notes before updating a signed payment plan.");
      return;
    }
    setFormError(null);
    onSave(values);
  });

  return (
    <div className="crm-modal-backdrop is-nested" role="presentation">
      <section aria-modal="true" className="crm-modal crm-management-modal crm-contract-modal" role="dialog">
        <div className="crm-panel-header">
          <div>
            <h3>Payment Plan</h3>
            <p className="crm-muted-text">
              {contract.contractNo} · {activePaymentPlan ? "Edit saved plan" : "Configure SPA payment stages"}
            </p>
          </div>
          <button className="crm-secondary-button crm-fit-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="crm-opportunity-detail-body" onSubmit={onSubmit}>
          <p className="crm-muted-text">
            Reservation is recorded as Stage 1 deposit. Configure installment stages totaling 100% of SPA, then save before
            signing.
          </p>

          <dl className="crm-detail-grid">
            <div>
              <dt>SPA / Unit Value</dt>
              <dd>{formatMoney(schedule.spa, schedule.currencyCode)}</dd>
            </div>
            <div>
              <dt>Stage 1 · Reservation (deposit)</dt>
              <dd>{formatMoney(schedule.reservation, schedule.currencyCode)}</dd>
            </div>
            <div>
              <dt>Schedule Base (SPA)</dt>
              <dd>{formatMoney(schedule.spa, schedule.currencyCode)}</dd>
            </div>
            <div>
              <dt>Taxes / Fees (outside CRM)</dt>
              <dd>
                {formatInBase(
                  contract.commercialSummary?.totalTaxAmount ?? 0,
                  contract.commercialSummary?.baseCurrencyCode ?? null
                )}
              </dd>
            </div>
            <div>
              <dt>Total Payable incl. Taxes</dt>
              <dd>
                {formatInBase(
                  contract.commercialSummary?.totalPayableBase ?? 0,
                  contract.commercialSummary?.baseCurrencyCode ?? null
                )}
              </dd>
            </div>
          </dl>

          <section className="crm-activity-list">
            <h4>Configured Kenya Taxes and Fees</h4>
            {(contract.commercialSummary?.taxLines ?? []).map((tax) => (
              <article key={tax.id}>
                <strong>{tax.taxName}</strong>
                <span>
                  {tax.calculationType === "PERCENT" ? `${tax.ratePercent ?? 0}% of SPA` : "Fixed fee"} ·{" "}
                  {formatInBase(tax.taxAmount, tax.currencyCode)}
                </span>
                <p>Paid outside CRM; included in the payment-plan summary.</p>
              </article>
            ))}
            {(contract.commercialSummary?.taxLines ?? []).length === 0 ? (
              <p className="crm-muted-text">No tax lines on this contract summary.</p>
            ) : null}
          </section>

          <label className="crm-field">
            <span className="crm-label">Plan Name</span>
            <input className="crm-input" {...paymentPlanForm.register("planName")} />
          </label>

          {formError ? (
            <section className="crm-next-action">
              <div>
                <span className="crm-label">Cannot Save</span>
                <strong>Complete required fields</strong>
                <p>{formError}</p>
              </div>
            </section>
          ) : null}

          {paymentStageFields.fields.map((field, index) => {
            const percentage = pickNumber(watchedPaymentStages?.[index]?.percentage ?? "") ?? 0;
            const calculatedAmount = Number(((schedule.spa * percentage) / 100).toFixed(2));
            const milestoneMissing = !(watchedPaymentStages?.[index]?.milestoneRefId ?? "").trim();
            const dueDateMissing = !(watchedPaymentStages?.[index]?.dueDate ?? "").trim();
            return (
              <section className="crm-opportunity-action-card-fields" key={field.id}>
                <div className="crm-two-col">
                  <label className="crm-field">
                    <span className="crm-label">Stage {index + 2}</span>
                    <select
                      className={`crm-input${milestoneMissing && formError ? " is-invalid" : ""}`}
                      {...paymentPlanForm.register(`stages.${index}.milestoneRefId`, {
                        onChange: () => setFormError(null)
                      })}
                    >
                      <option value="">Select payment stage</option>
                      {(paymentStagesQuery.data ?? []).map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.level2Name}
                        </option>
                      ))}
                    </select>
                    {milestoneMissing && formError ? (
                      <span className="crm-muted-text">Required: choose a payment stage.</span>
                    ) : null}
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Percentage of SPA</span>
                    <input
                      className="crm-input"
                      inputMode="decimal"
                      {...paymentPlanForm.register(`stages.${index}.percentage`, {
                        onChange: () => setFormError(null)
                      })}
                    />
                  </label>
                </div>
                <div className="crm-two-col">
                  <label className="crm-field">
                    <span className="crm-label">Due Date</span>
                    <Controller
                      control={paymentPlanForm.control}
                      name={`stages.${index}.dueDate`}
                      render={({ field: dateField }) => (
                        <DateField
                          onBlur={dateField.onBlur}
                          onChange={(value) => {
                            dateField.onChange(value);
                            setFormError(null);
                          }}
                          ref={dateField.ref}
                          value={dateField.value}
                        />
                      )}
                    />
                    {dueDateMissing && formError ? (
                      <span className="crm-muted-text">Required: select a due date.</span>
                    ) : null}
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Calculated Amount</span>
                    <input
                      className="crm-input"
                      readOnly
                      value={formatMoney(calculatedAmount, schedule.currencyCode)}
                    />
                    <span className="crm-muted-text">
                      {percentage}% of SPA {formatMoney(schedule.spa, schedule.currencyCode)}
                    </span>
                  </label>
                </div>
                <div className="crm-opportunity-action-card-footer">
                  <button
                    className="crm-secondary-button crm-opportunity-action-button"
                    disabled={paymentStageFields.fields.length === 1}
                    onClick={() => paymentStageFields.remove(index)}
                    type="button"
                  >
                    Remove Stage
                  </button>
                </div>
              </section>
            );
          })}

          <div className="crm-opportunity-action-card-footer">
            <button
              className="crm-secondary-button crm-opportunity-action-button"
              onClick={() =>
                paymentStageFields.append({
                  milestoneRefId: "",
                  milestoneLabel: "",
                  dueDate: "",
                  percentage: ""
                })
              }
              type="button"
            >
              Add Payment Stage
            </button>
            <strong>Total: {paymentPercentageTotal.toFixed(2)}%</strong>
          </div>

          <label className="crm-field">
            <span className="crm-label">
              {contract.contractStatus.code === "SIGNED" ? "Change Notes (required)" : "Plan Notes"}
            </span>
            <textarea
              className="crm-input crm-textarea"
              placeholder="Explain payment-plan changes, especially after signing"
              {...paymentPlanForm.register("remarks")}
            />
          </label>

          <div className="crm-opportunity-action-card-footer">
            <button className="crm-secondary-button crm-opportunity-action-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="crm-primary-button crm-opportunity-action-button" disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : activePaymentPlan ? "Update Payment Plan" : "Save Payment Plan"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
