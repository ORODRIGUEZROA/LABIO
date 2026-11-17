"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Marco from "@/components/Marco";
import { usePerfil } from "@/lib/usePerfil";
import { fechaHora, normalizar } from "@/lib/formato";
import { alertaError, campo, tarjeta } from "@/lib/estilos";

type Fila = {
  id: string;
  uso: string;
  condiciones_iniciales: string;
  condiciones_finales: string;
  creado_en: string;
  equipos: { nombre: string } | null;
  perfiles: { nombre: string; matricula: string } | null;
};

export default function Bitacora() {
  const { supabase, esPersonal } = usePerfil();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    supabase
      .from("bitacora_equipos")
      .select("id, uso, condiciones_iniciales, condiciones_finales, creado_en, equipos(nombre), perfiles(nombre, matricula)")
      .order("creado_en", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) setError("No se pudo cargar la bitácora.");
        else setFilas((data ?? []) as unknown as Fila[]);
        setCargando(false);
      });
  }, [supabase]);

  const q = normalizar(filtro);
  const visibles = filas.filter((f) =>
    normalizar(`${f.equipos?.nombre ?? ""} ${f.perfiles?.nombre ?? ""} ${f.uso}`).includes(q)
  );

  return (
    <Marco
      titulo={esPersonal ? "Bitácora (todos)" : "Mi bitácora"}
      acciones={
        <Link href="/bitacora/nueva" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
          + Registrar
        </Link>
      }
    >
      {filas.length > 5 && (
        <input className={`${campo} mb-4`} type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por equipo, persona o uso" />
      )}
      {error && <p className={alertaError}>{error}</p>}
      {cargando && <p className="text-slate-500">Cargando…</p>}
      {!cargando && !error && visibles.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
          No hay registros todavía.
        </p>
      )}
      <ul className="space-y-3">
        {visibles.map((f) => (
          <li key={f.id} className={tarjeta}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-900">{f.equipos?.nombre ?? "Equipo"}</p>
              <p className="shrink-0 text-xs text-slate-500">{fechaHora(f.creado_en)}</p>
            </div>
            {esPersonal && f.perfiles && (
              <p className="text-sm text-slate-500">{f.perfiles.nombre} ({f.perfiles.matricula})</p>
            )}
            <p className="mt-2 text-sm text-slate-800">{f.uso}</p>
            <dl className="mt-2 grid gap-1 text-sm">
              <div><dt className="inline font-medium text-slate-600">Al inicio: </dt><dd className="inline">{f.condiciones_iniciales}</dd></div>
              <div><dt className="inline font-medium text-slate-600">Al final: </dt><dd className="inline">{f.condiciones_finales}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </Marco>
  );
}
