import type { AgreedPack, AgreedPackCompleteness } from "../api/agreed-pack";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function formatMoney(value: number | null | undefined, currencyCode: string | null | undefined, formatInBase: (value: number, currency?: string | null) => string) {
  if (value == null) return "—";
  return formatInBase(value, currencyCode);
}

function CompletenessBadge({
  completeness,
  completeCount,
  totalSections
}: {
  completeness: AgreedPackCompleteness;
  completeCount: number;
  totalSections: number;
}) {
  return (
    <div className="crm-agreed-pack-completeness">
      <strong>
        {completeCount}/{totalSections} complete
      </strong>
      <div className="crm-agreed-pack-pills">
        {(
          [
            ["reservation", "Reservation"],
            ["proposal", "Proposal"],
            ["paymentPlan", "Payment plan"],
            ["agreement", "Agreement"]
          ] as const
        ).map(([key, label]) => (
          <span className={`crm-status-pill${completeness[key] ? " is-complete" : " is-pending"}`} key={key}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgreedPackView({
  pack,
  formatInBase
}: {
  pack: AgreedPack;
  formatInBase: (value: number, currency?: string | null) => string;
}) {
  return (
    <section className="crm-agreed-pack">
      <div className="crm-agreed-pack-header">
        <div>
          <h4>Agreed Pack</h4>
          <p className="crm-muted-text">
            Single read-only view of reservation, accepted proposal, payment plan, and signed SPA reference for sales,
            legal, and ERP.
          </p>
        </div>
        <CompletenessBadge
          completeCount={pack.completeCount}
          completeness={pack.completeness}
          totalSections={pack.totalSections}
        />
      </div>

      <div className="crm-agreed-pack-prices">
        <div>
          <span className="crm-label">Proposal accepted price</span>
          <strong>
            {formatMoney(pack.prices.proposalAcceptedPrice, pack.prices.proposalCurrencyCode, formatInBase)}
          </strong>
        </div>
        <div>
          <span className="crm-label">Contract (SPA) value</span>
          <strong>{formatMoney(pack.prices.contractValue, pack.prices.contractCurrencyCode, formatInBase)}</strong>
        </div>
      </div>

      <div className="crm-agreed-pack-grid">
        <article className="crm-agreed-pack-card">
          <h5>1. Reservation</h5>
          {pack.reservation ? (
            <dl className="crm-detail-list">
              <div>
                <dt>Reservation</dt>
                <dd>{pack.reservation.reservationNo}</dd>
              </div>
              <div>
                <dt>Unit</dt>
                <dd>{pack.reservation.unit.unitCode ?? "—"}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>{pack.reservation.project.projectCode ?? "—"}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatMoney(pack.reservation.amount, pack.reservation.currencyCode, formatInBase)}</dd>
              </div>
              <div>
                <dt>Dates</dt>
                <dd>
                  {formatDate(pack.reservation.reservationDate)} → {formatDate(pack.reservation.expiryDate)}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{pack.reservation.status.name ?? pack.reservation.status.code ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="crm-muted-text">No reservation linked.</p>
          )}
        </article>

        <article className="crm-agreed-pack-card">
          <h5>2. Proposal</h5>
          {pack.proposal ? (
            <dl className="crm-detail-list">
              <div>
                <dt>Proposal</dt>
                <dd>{pack.proposal.proposalNo}</dd>
              </div>
              <div>
                <dt>Accepted price</dt>
                <dd>{formatMoney(pack.proposal.acceptedPrice, pack.proposal.currencyCode, formatInBase)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>
                  {formatMoney(pack.proposal.discountAmount, pack.proposal.currencyCode, formatInBase)}
                  {pack.proposal.discountPercent != null ? ` (${pack.proposal.discountPercent}%)` : ""}
                </dd>
              </div>
              <div>
                <dt>Valid until</dt>
                <dd>{formatDate(pack.proposal.validUntil)}</dd>
              </div>
              <div>
                <dt>Accepted</dt>
                <dd>
                  {formatDate(pack.proposal.acceptedAt)}
                  {pack.proposal.acceptedBy.name ? ` · ${pack.proposal.acceptedBy.name}` : ""}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="crm-muted-text">No accepted proposal matched for this opportunity/unit yet.</p>
          )}
        </article>

        <article className="crm-agreed-pack-card">
          <h5>3. Payment plan</h5>
          {pack.paymentPlan ? (
            <>
              <p className="crm-muted-text">
                {pack.paymentPlan.planName} ({pack.paymentPlan.planCode})
              </p>
              <div className="crm-agreed-pack-table-wrap">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Stage</th>
                      <th>Due</th>
                      <th>%</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pack.paymentPlan.lines.map((line) => (
                      <tr key={`${line.sequenceNo}-${line.milestoneLabel}`}>
                        <td>{line.sequenceNo}</td>
                        <td>{line.milestoneLabel ?? line.lineType}</td>
                        <td>{formatDate(line.dueDate)}</td>
                        <td>{line.percentageOfContract != null ? `${line.percentageOfContract}%` : "—"}</td>
                        <td>{formatMoney(line.amount, pack.paymentPlan?.currencyCode, formatInBase)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pack.paymentPlan.taxLines.length ? (
                <>
                  <h6>Taxes as agreed</h6>
                  <div className="crm-agreed-pack-table-wrap">
                    <table className="crm-table">
                      <thead>
                        <tr>
                          <th>Tax</th>
                          <th>Basis</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.paymentPlan.taxLines.map((tax) => (
                          <tr key={`${tax.sequenceNo}-${tax.taxCode}`}>
                            <td>
                              {tax.taxName}
                              {tax.paymentOutsideCrm ? " (outside CRM)" : ""}
                            </td>
                            <td>
                              {tax.calculationType === "PERCENT"
                                ? `${tax.ratePercent ?? 0}%`
                                : formatMoney(tax.fixedAmount, tax.currencyCode, formatInBase)}
                            </td>
                            <td>{formatMoney(tax.taxAmount, tax.currencyCode, formatInBase)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="crm-muted-text">No tax lines on the active plan.</p>
              )}
            </>
          ) : (
            <p className="crm-muted-text">Payment plan not saved yet.</p>
          )}
        </article>

        <article className="crm-agreed-pack-card">
          <h5>4. Agreement (SPA)</h5>
          <dl className="crm-detail-list">
            <div>
              <dt>Contract</dt>
              <dd>{pack.agreement.contractNo}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{pack.agreement.contractStatus.name ?? pack.agreement.contractStatus.code ?? "—"}</dd>
            </div>
            <div>
              <dt>SPA value</dt>
              <dd>{formatMoney(pack.agreement.contractValue, pack.agreement.currencyCode, formatInBase)}</dd>
            </div>
            <div>
              <dt>Signed</dt>
              <dd>
                {formatDate(pack.agreement.signedAt)}
                {pack.agreement.signedBy.name ? ` · ${pack.agreement.signedBy.name}` : ""}
              </dd>
            </div>
            <div>
              <dt>ERP Contract ID</dt>
              <dd>{pack.agreement.erpContractId ?? "—"}</dd>
            </div>
            <div>
              <dt>ERP handoff</dt>
              <dd>{pack.agreement.erpHandoffStatus ?? "—"}</dd>
            </div>
            <div>
              <dt>SPA document</dt>
              <dd>{pack.agreement.spaDocumentNote}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}
