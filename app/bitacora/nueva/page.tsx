"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Marco from "@/components/Marco";
import { usePerfil } from "@/lib/usePerfil";
import { normalizar } from "@/lib/formato";
import { ETIQUETA_ESTADO_EQUIPO, type Equipo } from "@/lib/tipos";
import { alertaError, alertaOk, botonPrimario, botonSecundario, campo, etiqueta } from "@/lib/estilos";

export default function NuevaBitacora() {
  const { supabase } = usePerfil();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [equipoId, setEquipoId] = useState("");
  const [uso, setUso] = useState("");
  const [iniciales, setIniciales] = useState("");
  const [finales, setFinales] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [guardada, setGuardada] = useState(false);

  useEffect(() => {
    supabase
      .from("equipos")
      .select("id, nombre, marca, modelo, ubicacion, estado, activo")
      .eq("activo", true)
      .neq("estado", "fuera_de_servicio")
      .order("nombre")
      .then(({ data, error }) => {
        if (error) setError("No se pudo cargar la lista de equipos.");
        else setEquipos((data ?? []) as Equipo[]);
        setCargando(false);
      });
  }, [supabase]);

  const q = normalizar(filtro);
  const visibles = equipos.filter(
    (e) => e.id === equipoId || normalizar(`${e.nombre} ${e.marca ?? ""} ${e.modelo ?? ""}`).includes(q)
  );

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!equipoId) return setError("Selecciona el equipo.");
    if (uso.trim().length < 3) return setError("Describe para qué usaste el equipo.");
    if (iniciales.trim().length < 2) return setError("Anota en qué condiciones lo encontraste.");
    if (finales.trim().length < 2) return setError("Anota en qué condiciones lo dejaste.");

    setEnviando(true);
    const { error } = await supabase.from("bitacora_equipos").insert({
      equipo_id: equipoId,
      uso: uso.trim(),
      condiciones_iniciales: iniciales.trim(),
      condiciones_finales: finales.trim(),
    });
    setEnviando(false);

    if (error) return setError("No se pudo guardar el registro. Inténtalo de nuevo.");
    setGuardada(true);
  }

  if (guardada) {
    return (
      <Marco titulo="Registro guardado" volver="/bitacora">
        <p className={alertaOk}>Tu uso del equipo quedó registrado con la fecha y hora actuales.</p>
        <div className="mt-5 flex flex-col gap-3">
          <Link href="/bitacora" className={`${botonSecundario} text-center`}>Ver la bitácora</Link>
          <Link href="/inicio" className={`${botonSecundario} text-center`}>Ir al inicio</Link>
        </div>
      </Marco>
    );
  }

  return (
    <Marco titulo="Registrar uso de equipo" volver="/bitacora">
      <form onSubmit={enviar} className="space-y-5">
        <section>
          <span className={etiqueta}>Equipo</span>
          <input
            className={campo}
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar: balanza, centrífuga…"
          />
          <select
            className={`${campo} mt-2`}
            value={equipoId}
            onChange={(e) => setEquipoId(e.target.value)}
            size={Math.min(Math.max(visibles.length, 2), 6)}
            aria-label="Equipo"
          >
            {cargando && <option disabled>Cargando…</option>}
            {!cargando && visibles.length === 0 && <option disabled>No hay equipos con ese nombre</option>}
            {visibles.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
                {e.modelo ? ` · ${e.modelo}` : ""}
                {e.ubicacion ? ` (${e.ubicacion})` : ""}
                {e.estado !== "disponible" ? ` — ${ETIQUETA_ESTADO_EQUIPO[e.estado]}` : ""}
              </option>
            ))}
          </select>
        </section>

        <label className="block">
          <span className={etiqueta}>¿Para qué lo usaste?</span>
          <textarea className={campo} rows={2} value={uso} onChange={(e) => setUso(e.target.value)} placeholder="Ej. Pesar 2 g de NaOH para la práctica 3" required />
        </label>

        <label className="block">
          <span className={etiqueta}>Condiciones en que lo encontraste</span>
          <textarea className={campo} rows={2} value={iniciales} onChange={(e) => setIniciales(e.target.value)} placeholder="Ej. Limpio, calibrado, sin daños visibles" required />
        </label>

        <label className="block">
          <span className={etiqueta}>Condiciones en que lo dejaste</span>
          <textarea className={campo} rows={2} value={finales} onChange={(e) => setFinales(e.target.value)} placeholder="Ej. Limpio, apagado, sin derrames" required />
        </label>

        {error && <p role="alert" className={alertaError}>{error}</p>}

        <button disabled={enviando} className={botonPrimario}>
          {enviando ? "Guardando…" : "Guardar registro"}
        </button>
        <p className="text-center text-xs text-slate-500">
          La fecha y la hora se registran automáticamente. Un registro guardado no se puede editar.
          Si el equipo está dañado, usa <Link href="/reportes/nuevo" className="underline">Reportar</Link>.
        </p>
      </form>
    </Marco>
  );
}
