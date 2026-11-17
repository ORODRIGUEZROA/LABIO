"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Marco from "@/components/Marco";
import { usePerfil } from "@/lib/usePerfil";
import { fechaHora } from "@/lib/formato";
import { ETIQUETA_ESTADO_REPORTE, type EstadoReporte } from "@/lib/tipos";
import { alertaError, insignia, tarjeta } from "@/lib/estilos";

type Fila = {
  id: string;
  tipo: "incidente" | "equipo_mal_estado";
  gravedad: "baja" | "media" | "alta";
  descripcion: string;
  foto_path: string | null;
  estado: EstadoReporte;
  creado_en: string;
  equipos: { nombre: string } | null;
  perfiles: { nombre: string; matricula: string } | null;
};

const COLOR_GRAVEDAD = {
  baja: "bg-slate-100 text-slate-700",
  media: "bg-amber-100 text-amber-800",
  alta: "bg-red-100 text-red-700",
};

export default function Reportes() {
  const { supabase, esPersonal } = usePerfil();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("reportes")
        .select("id, tipo, gravedad, descripcion, foto_path, estado, creado_en, equipos(nombre), perfiles(nombre, matricula)")
        .order("creado_en", { ascending: false })
        .limit(100);
      if (error) {
        setError("No se pudieron cargar los reportes.");
        setCargando(false);
        return;
      }
      const lista = (data ?? []) as unknown as Fila[];
      setFilas(lista);
      setCargando(false);

      const rutas = lista.map((f) => f.foto_path).filter((r): r is string => !!r);
      if (rutas.length) {
        const { data: firmadas } = await supabase.storage.from("evidencias").createSignedUrls(rutas, 3600);
        const mapa: Record<string, string> = {};
        firmadas?.forEach((f) => {
          if (f.path && f.signedUrl) mapa[f.path] = f.signedUrl;
        });
        setFotos(mapa);
      }
    })();
  }, [supabase]);

  async function cambiarEstado(id: string, estado: EstadoReporte) {
    const { error } = await supabase.from("reportes").update({ estado }).eq("id", id);
    if (error) return setError("No se pudo cambiar el estado.");
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, estado } : f)));
  }

  return (
    <Marco
      titulo={esPersonal ? "Reportes (todos)" : "Mis reportes"}
      acciones={
        <Link href="/reportes/nuevo" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
          + Reportar
        </Link>
      }
    >
      {error && <p className={alertaError}>{error}</p>}
      {cargando && <p className="text-slate-500">Cargando…</p>}
      {!cargando && !error && filas.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
          No hay reportes todavía.
        </p>
      )}
      <ul className="space-y-3">
        {filas.map((f) => (
          <li key={f.id} className={tarjeta}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={insignia}>{f.tipo === "incidente" ? "Incidente" : "Equipo en mal estado"}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_GRAVEDAD[f.gravedad]}`}>
                Gravedad {f.gravedad}
              </span>
              <span className="ml-auto text-xs text-slate-500">{fechaHora(f.creado_en)}</span>
            </div>
            {f.equipos && <p className="mt-2 font-semibold text-slate-900">{f.equipos.nombre}</p>}
            {esPersonal && f.perfiles && (
              <p className="text-sm text-slate-500">{f.perfiles.nombre} ({f.perfiles.matricula})</p>
            )}
            <p className="mt-2 text-sm text-slate-800">{f.descripcion}</p>
            {f.foto_path && fotos[f.foto_path] && (
              <a href={fotos[f.foto_path]} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotos[f.foto_path]} alt="Evidencia del reporte" className="mt-3 max-h-56 rounded-xl border border-slate-200 object-contain" />
              </a>
            )}
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-slate-600">Estado:</span>
              {esPersonal ? (
                <select
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1"
                  value={f.estado}
                  onChange={(e) => cambiarEstado(f.id, e.target.value as EstadoReporte)}
                >
                  {(Object.keys(ETIQUETA_ESTADO_REPORTE) as EstadoReporte[]).map((k) => (
                    <option key={k} value={k}>{ETIQUETA_ESTADO_REPORTE[k]}</option>
                  ))}
                </select>
              ) : (
                <span className="font-medium">{ETIQUETA_ESTADO_REPORTE[f.estado]}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Marco>
  );
}
