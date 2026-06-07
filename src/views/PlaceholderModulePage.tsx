type PlaceholderModulePageProps = {
  title: string;
  description: string;
};

export function PlaceholderModulePage({ title, description }: PlaceholderModulePageProps) {
  return (
    <section className="crm-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  );
}
