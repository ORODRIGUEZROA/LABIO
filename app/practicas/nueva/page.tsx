"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Marco from "@/components/Marco";
import { usePerfil } from "@/lib/usePerfil";
import { cantidadTexto, normalizar } from "@/lib/formato";
import { ETIQUETA_CATEGORIA, type ArticuloCatalogo, type Categoria } from "@/lib/tipos";
import { alertaError, alertaOk, botonPrimario, botonSecundario, campo, etiqueta, insignia, tarjeta } from "@/lib/estilos";

type Seleccion = { articulo: ArticuloCatalogo; cantidad: string };
type Filtro = "todas" | Categoria;

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "todas", texto: "Todo" },
  { valor: "reactivo", texto: "Reactivos" },
  { valor: "consumible", texto: "Consumibles" },
  { valor: "material", texto: "Material" },
];

export default function NuevaPractica() {
  const { supabase } = usePerfil();
  const [catalogo, setCatalogo] = useState<ArticuloCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [seleccion, setSeleccion] = useState<Seleccion[]>([]);
  const [titulo, setTitulo] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [registrada, setRegistrada] = useState(false);

  useEffect(() => {
    supabase
      .from("articulos_catalogo")
      .select("id, nombre, categoria, unidad, ubicacion, disponible")
      .order("nombre")
      .then(({ data, error }) => {
        if (error) setError("No se pudo cargar el catálogo de materiales.");
        else setCatalogo((data ?? []) as ArticuloCatalogo[]);
        setCargando(false);
      });
  }, [supabase]);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda);
    const elegidos = new Set(seleccion.map((s) => s.articulo.id));
    return catalogo
      .filter((a) => !elegidos.has(a.id))
      .filter((a) => filtro === "todas" || a.categoria === filtro)
      .filter((a) => normalizar(a.nombre).includes(q))
      .slice(0, 30);
  }, [catalogo, busqueda, filtro, seleccion]);

  function agregar(a: ArticuloCatalogo) {
    setSeleccion((s) => [...s, { articulo: a, cantidad: "" }]);
    setBusqueda("");
  }
  function cambiarCantidad(id: string, valor: string) {
    setSeleccion((s) => s.map((x) => (x.articulo.id === id ? { ...x, cantidad: valor } : x)));
  }
  function quitar(id: string) {
    setSeleccion((s) => s.filter((x) => x.articulo.id !== id));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (titulo.trim().length < 3) return setError("Escribe el nombre de la práctica.");
    if (seleccion.length === 0) return setError("Agrega al menos un material.");

    const items: { articulo_id: string; cantidad: number }[] = [];
    for (const s of seleccion) {
      const n = Number(s.cantidad);
      if (!s.cantidad || !(n > 0))
        return setError(`Indica la cantidad de "${s.articulo.nombre}".`);
      if (s.articulo.categoria !== "reactivo" && !Number.isInteger(n))
        return setError(`"${s.articulo.nombre}" se cuenta en unidades enteras.`);
      items.push({ articulo_id: s.articulo.id, cantidad: n });
    }

    setEnviando(true);
    const { error } = await supabase.rpc("registrar_practica", {
      p_titulo: titulo.trim(),
      p_notas: notas.trim(),
      p_items: items,
    });
    setEnviando(false);

    if (error) return setError(error.message);
    setRegistrada(true);
  }

  if (registrada) {
    return (
      <Marco titulo="Práctica registrada" volver="/practicas">
        <p className={alertaOk}>
          Listo. Se guardó tu práctica y se descontó el material del inventario.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Link href="/practicas" className={`${botonSecundario} text-center`}>Ver mis prácticas</Link>
          <Link href="/inicio" className={`${botonSecundario} text-center`}>Ir al inicio</Link>
        </div>
      </Marco>
    );
  }

  return (
    <Marco titulo="Nueva práctica" volver="/practicas">
      <form onSubmit={enviar} className="space-y-5">
        <label className="block">
          <span className={etiqueta}>Nombre de la práctica</span>
          <input className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Titulación ácido-base" required />
        </label>

        <section>
          <span className={etiqueta}>Buscar material o reactivo</span>
          <input
            className={campo}
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Escribe: matraz, puntas, ácido…"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button
                type="button"
                key={f.valor}
                onClick={() => setFiltro(f.valor)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  filtro === f.valor ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"
                }`}
              >
                {f.texto}
              </button>
            ))}
          </div>

          <ul className="mt-3 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {cargando && <li className="p-4 text-sm text-slate-500">Cargando…</li>}
            {!cargando && resultados.length === 0 && (
              <li className="p-4 text-sm text-slate-500">No se encontró nada con esa búsqueda.</li>
            )}
            {resultados.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{a.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {ETIQUETA_CATEGORIA[a.categoria]} · {a.unidad}
                    {a.ubicacion ? ` · ${a.ubicacion}` : ""}
                  </p>
                </div>
                {a.disponible ? (
                  <button type="button" onClick={() => agregar(a)} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                    Agregar
                  </button>
                ) : (
                  <span className={`${insignia} shrink-0`}>Agotado</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Material de tu práctica ({seleccion.length})
          </h2>
          {seleccion.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Aún no agregas nada. Busca arriba y pulsa “Agregar”.
            </p>
          )}
          <ul className="space-y-3">
            {seleccion.map((s) => {
              const esReactivo = s.articulo.categoria === "reactivo";
              return (
                <li key={s.articulo.id} className={tarjeta}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{s.articulo.nombre}</p>
                    <button type="button" onClick={() => quitar(s.articulo.id)} className="text-sm text-red-600 underline">
                      Quitar
                    </button>
                  </div>
                  <label className="mt-2 flex items-center gap-3">
                    <span className="text-sm text-slate-600">
                      {esReactivo ? "Cantidad usada" : "Unidades usadas"}
                    </span>
                    <input
                      className={`${campo} max-w-28`}
                      type="number"
                      inputMode={esReactivo ? "decimal" : "numeric"}
                      min="0"
                      step={esReactivo ? "any" : "1"}
                      value={s.cantidad}
                      onChange={(e) => cambiarCantidad(s.articulo.id, e.target.value)}
                      required
                    />
                    <span className="text-sm font-medium text-slate-700">{s.articulo.unidad}</span>
                  </label>
                  {s.cantidad && Number(s.cantidad) > 0 && (
                    <p className="mt-1 text-xs text-slate-500">Registrarás {cantidadTexto(Number(s.cantidad))} {s.articulo.unidad}.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <label className="block">
          <span className={etiqueta}>Notas (opcional)</span>
          <textarea className={campo} rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>

        {error && <p role="alert" className={alertaError}>{error}</p>}

        <button disabled={enviando} className={botonPrimario}>
          {enviando ? "Guardando…" : "Registrar práctica"}
        </button>
        <p className="text-center text-xs text-slate-500">
          Al registrar, el material se descuenta del inventario. Una práctica registrada no se puede editar.
        </p>
      </form>
    </Marco>
  );
}
