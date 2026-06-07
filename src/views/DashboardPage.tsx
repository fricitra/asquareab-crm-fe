export function DashboardPage() {
  return (
    <>
      <section className="crm-grid">
        <article className="crm-card">
          <h3>New Leads</h3>
          <div className="crm-kpi">128</div>
          <p>Workbook-driven reference and CRM foundation are now ready for the first sales module build.</p>
        </article>
        <article className="crm-card">
          <h3>Open Opportunities</h3>
          <div className="crm-kpi">42</div>
          <p>Opportunity pipeline screens will grow next from the backend module roadmap already frozen in the CRM docs.</p>
        </article>
        <article className="crm-card">
          <h3>Units Reserved</h3>
          <div className="crm-kpi">11</div>
          <p>Reservation and contract workflows stay separate from ERP accounting while integrating through controlled APIs.</p>
        </article>
      </section>

      <section className="crm-section crm-grid">
        <article className="crm-card">
          <h4>MVP Focus</h4>
          <p>Lead capture, qualification, pipeline, unit visibility, reservations, contracts baseline, and ERP handoff readiness.</p>
        </article>
        <article className="crm-card">
          <h4>Deferred But Designed For</h4>
          <p>Portal, omnichannel automation, after-sales service, advanced AI scoring, and executive analytics remain out of MVP scope but structurally supported.</p>
        </article>
      </section>
    </>
  );
}
