"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Marco from "@/components/Marco";
import { usePerfil } from "@/lib/usePerfil";
import { cantidadTexto, fechaHora } from "@/lib/formato";
import { alertaError, tarjeta } from "@/lib/estilos";

type Fila = {
  id: string;
  titulo: string;
  notas: string | null;
  creado_en: string;
  perfiles: { nombre: string; matricula: string } | null;
  practica_items: { nombre: string; unidad: string; cantidad: number }[];
};

export default function Practicas() {
  const { supabase, esPersonal } = usePerfil();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("practicas")
      .select("id, titulo, notas, creado_en, perfiles(nombre, matricula), practica_items(nombre, unidad, cantidad)")
      .order("creado_en", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError("No se pudieron cargar las prácticas.");
        else setFilas((data ?? []) as unknown as Fila[]);
        setCargando(false);
      });
  }, [supabase]);

  return (
    <Marco
      titulo={esPersonal ? "Prácticas (todas)" : "Mis prácticas"}
      acciones={
        <Link href="/practicas/nueva" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
          + Nueva
        </Link>
      }
    >
      {error && <p className={alertaError}>{error}</p>}
      {cargando && <p className="text-slate-500">Cargando…</p>}
      {!cargando && !error && filas.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
          Todavía no hay prácticas registradas.
        </p>
      )}
      <ul className="space-y-3">
        {filas.map((f) => (
          <li key={f.id} className={tarjeta}>
            <details>
              <summary className="cursor-pointer list-none">
                <p className="font-semibold text-slate-900">{f.titulo}</p>
                <p className="text-sm text-slate-500">
                  {fechaHora(f.creado_en)}
                  {esPersonal && f.perfiles ? ` · ${f.perfiles.nombre} (${f.perfiles.matricula})` : ""}
                  {` · ${f.practica_items.length} material${f.practica_items.length === 1 ? "" : "es"}`}
                </p>
              </summary>
              <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                {f.practica_items.map((i, k) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="text-slate-800">{i.nombre}</span>
                    <span className="shrink-0 font-medium text-slate-700">
                      {cantidadTexto(i.cantidad)} {i.unidad}
                    </span>
                  </li>
                ))}
              </ul>
              {f.notas && <p className="mt-3 text-sm text-slate-600">Notas: {f.notas}</p>}
            </details>
          </li>
        ))}
      </ul>
    </Marco>
  );
}
