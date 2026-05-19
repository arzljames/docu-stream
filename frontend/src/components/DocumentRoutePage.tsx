type DocumentRoutePageProps = {
  title: string;
  eyebrow?: string;
  description?: string;
};

export function DocumentRoutePage({
  title,
  eyebrow = "Documents",
  description = "Browse and manage documentation for this section.",
}: DocumentRoutePageProps) {
  return (
    <section className="min-h-full w-full bg-white p-6">
      <p className="text-xs font-semibold uppercase text-slate-500">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
    </section>
  );
}
