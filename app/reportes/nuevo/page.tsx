"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Marco from "@/components/Marco";
import { usePerfil } from "@/lib/usePerfil";
import { comprimirImagen } from "@/lib/imagen";
import type { Equipo } from "@/lib/tipos";
import { alertaError, alertaOk, botonPrimario, botonSecundario, campo, etiqueta } from "@/lib/estilos";

type Tipo = "incidente" | "equipo_mal_estado";

export default function NuevoReporte() {
  const { supabase, perfil } = usePerfil();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [tipo, setTipo] = useState<Tipo>("equipo_mal_estado");
  const [equipoId, setEquipoId] = useState("");
  const [gravedad, setGravedad] = useState("media");
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [vista, setVista] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    supabase
      .from("equipos")
      .select("id, nombre, marca, modelo, ubicacion, estado, activo")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setEquipos((data ?? []) as Equipo[]));
  }, [supabase]);

  useEffect(() => {
    if (!foto) return setVista("");
    const url = URL.createObjectURL(foto);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const esEquipo = tipo === "equipo_mal_estado";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!perfil) return setError("No se pudo identificar tu sesión. Recarga la página.");
    if (esEquipo && !equipoId) return setError("Selecciona el equipo.");
    if (descripcion.trim().length < 10) return setError("Describe lo que encontraste (mínimo 10 caracteres).");
    if (esEquipo && !foto) return setError("Para un equipo en mal estado la foto de evidencia es obligatoria.");

    setEnviando(true);
    let ruta: string | null = null;

    if (foto) {
      try {
        const blob = await comprimirImagen(foto);
        ruta = `${perfil.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: errFoto } = await supabase.storage
          .from("evidencias")
          .upload(ruta, blob, { contentType: "image/jpeg" });
        if (errFoto) throw new Error("No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.");
      } catch (err) {
        setEnviando(false);
        return setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
      }
    }

    const { error: errReporte } = await supabase.from("reportes").insert({
      tipo,
      equipo_id: esEquipo ? equipoId : equipoId || null,
      gravedad,
      descripcion: descripcion.trim(),
      foto_path: ruta,
    });
    setEnviando(false);

    if (errReporte) return setError("No se pudo guardar el reporte. Inténtalo de nuevo.");
    setEnviado(true);
  }

  if (enviado) {
    return (
      <Marco titulo="Reporte enviado" volver="/reportes">
        <p className={alertaOk}>Gracias. Tu reporte quedó registrado y el personal del laboratorio podrá revisarlo.</p>
        <div className="mt-5 flex flex-col gap-3">
          <Link href="/reportes" className={`${botonSecundario} text-center`}>Ver mis reportes</Link>
          <Link href="/inicio" className={`${botonSecundario} text-center`}>Ir al inicio</Link>
        </div>
      </Marco>
    );
  }

  return (
    <Marco titulo="Nuevo reporte" volver="/reportes">
      <form onSubmit={enviar} className="space-y-5">
        <fieldset>
          <legend className={etiqueta}>¿Qué quieres reportar?</legend>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["equipo_mal_estado", "Equipo en mal estado"],
              ["incidente", "Incidente"],
            ] as [Tipo, string][]).map(([valor, texto]) => (
              <button
                type="button"
                key={valor}
                onClick={() => setTipo(valor)}
                className={`rounded-xl border px-3 py-3 text-sm font-medium ${
                  tipo === valor ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className={etiqueta}>{esEquipo ? "Equipo" : "Equipo involucrado (opcional)"}</span>
          <select className={campo} value={equipoId} onChange={(e) => setEquipoId(e.target.value)}>
            <option value="">{esEquipo ? "Selecciona el equipo…" : "Ninguno"}</option>
            {equipos.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nombre}{q.ubicacion ? ` (${q.ubicacion})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={etiqueta}>Gravedad</span>
          <select className={campo} value={gravedad} onChange={(e) => setGravedad(e.target.value)}>
            <option value="baja">Baja: no afecta el trabajo</option>
            <option value="media">Media: afecta pero se puede trabajar</option>
            <option value="alta">Alta: riesgo o equipo inutilizable</option>
          </select>
        </label>

        <label className="block">
          <span className={etiqueta}>Describe las condiciones</span>
          <textarea
            className={campo}
            rows={4}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={esEquipo ? "Ej. La balanza no enciende; la pantalla muestra ERR 3" : "Ej. Se derramó ácido en la mesa 2; se limpió con neutralizante"}
            required
          />
        </label>

        <div>
          <span className={etiqueta}>Foto de evidencia {esEquipo ? "(obligatoria)" : "(opcional)"}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-3 file:font-semibold file:text-white"
          />
          {vista && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vista} alt="Vista previa de la evidencia" className="mt-3 max-h-60 rounded-xl border border-slate-200 object-contain" />
          )}
        </div>

        {error && <p role="alert" className={alertaError}>{error}</p>}

        <button disabled={enviando} className={botonPrimario}>
          {enviando ? "Enviando…" : "Enviar reporte"}
        </button>
      </form>
    </Marco>
  );
}
