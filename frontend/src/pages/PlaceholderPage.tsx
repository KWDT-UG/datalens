type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <p className="eyebrow">Foundation route</p>
          <h1>{title}</h1>
          <p className="page-header__description">
            This route is wired into the app shell and ready for the next UI milestone.
          </p>
        </div>
      </div>
      <div className="state-box">Implementation will connect this page to the MVP API surface.</div>
    </section>
  );
}
