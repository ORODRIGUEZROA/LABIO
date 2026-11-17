import Link from "next/link";

export default function Marco({
  titulo,
  volver = "/inicio",
  acciones,
  children,
}: {
  titulo: string;
  volver?: string;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-16 pt-5">
      <header className="mb-5 flex items-center gap-3">
        <Link
          href={volver}
          aria-label="Volver"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          ←
        </Link>
        <h1 className="flex-1 text-xl font-bold text-slate-900">{titulo}</h1>
        {acciones}
      </header>
      {children}
    </main>
  );
}
