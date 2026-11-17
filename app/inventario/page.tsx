"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import Marco from "@/components/Marco";
import { usePerfil } from "@/lib/usePerfil";
import { cantidadTexto, normalizar } from "@/lib/formato";
import { descargarPdfInventario } from "@/lib/pdfInventario";
import {
  ETIQUETA_CATEGORIA,
  ETIQUETA_ESTADO_EQUIPO,
  type Articulo,
  type Categoria,
  type Equipo,
  type EstadoEquipo,
} from "@/lib/tipos";
import { alertaError, alertaOk, botonPrimario, botonSecundario, campo, etiqueta, insignia, tarjeta } from "@/lib/estilos";

type Panel =
  | null
  | { tipo: "articulo"; editar: Articulo | null }
  | { tipo: "movimiento"; articulo: Articulo }
  | { tipo: "equipo"; editar: Equipo | null };

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
          <button onClick={onCerrar} className="rounded-lg px-3 py-1 text-slate-500" aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Formulario de artículo ---------- */
function FormArticulo({ supabase, editar, onListo }: { supabase: SupabaseClient; editar: Articulo | null; onListo: () => void }) {
  const [nombre, setNombre] = useState(editar?.nombre ?? "");
  const [categoria, setCategoria] = useState<Categoria>(editar?.categoria ?? "reactivo");
  const [unidad, setUnidad] = useState(editar?.unidad ?? "ml");
  const [stock, setStock] = useState("0");
  const [minimo, setMinimo] = useState(String(editar?.stock_minimo ?? 0));
  const [ubicacion, setUbicacion] = useState(editar?.ubicacion ?? "");
  const [notas, setNotas] = useState(editar?.notas ?? "");
  const [activo, setActivo] = useState(editar?.activo ?? true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nombre.trim().length < 2) return setError("Escribe el nombre.");
    if (!unidad.trim()) return setError("Indica la unidad (ml, g, pieza…).");
    if (Number(minimo) < 0 || (!editar && Number(stock) < 0)) return setError("Las cantidades no pueden ser negativas.");

    const datos = {
      nombre: nombre.trim(),
      categoria,
      unidad: unidad.trim(),
      stock_minimo: Number(minimo) || 0,
      ubicacion: ubicacion.trim() || null,
      notas: notas.trim() || null,
      activo,
    };

    setGuardando(true);
    const { error } = editar
      ? await supabase.from("articulos").update(datos).eq("id", editar.id)
      : await supabase.from("articulos").insert({ ...datos, stock: Number(stock) || 0 });
    setGuardando(false);

    if (error) {
      return setError(error.code === "23505" ? "Ya existe un artículo con ese nombre." : "No se pudo guardar.");
    }
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <label className="block"><span className={etiqueta}>Nombre</span>
        <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} required /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={etiqueta}>Categoría</span>
          <select className={campo} value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
            {(Object.keys(ETIQUETA_CATEGORIA) as Categoria[]).map((c) => <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>)}
          </select></label>
        <label className="block"><span className={etiqueta}>Unidad</span>
          <input className={campo} list="unidades" value={unidad} onChange={(e) => setUnidad(e.target.value)} required />
          <datalist id="unidades">{["ml", "L", "g", "kg", "pieza", "caja", "paquete"].map((u) => <option key={u} value={u} />)}</datalist></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!editar && (
          <label className="block"><span className={etiqueta}>Existencia inicial</span>
            <input className={campo} type="number" inputMode="decimal" min="0" step="any" value={stock} onChange={(e) => setStock(e.target.value)} /></label>
        )}
        <label className="block"><span className={etiqueta}>Mínimo (alerta)</span>
          <input className={campo} type="number" inputMode="decimal" min="0" step="any" value={minimo} onChange={(e) => setMinimo(e.target.value)} /></label>
      </div>
      <label className="block"><span className={etiqueta}>Ubicación</span>
        <input className={campo} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Ej. Estante A1" /></label>
      <label className="block"><span className={etiqueta}>Notas</span>
        <textarea className={campo} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></label>
      {editar && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-5 w-5" />
          Activo (los alumnos pueden elegirlo)
        </label>
      )}
      {editar && <p className="text-xs text-slate-500">La existencia se cambia con “Movimiento”, para que quede registro.</p>}
      {error && <p role="alert" className={alertaError}>{error}</p>}
      <button disabled={guardando} className={botonPrimario}>{guardando ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

/* ---------- Movimiento de existencia ---------- */
function FormMovimiento({ supabase, articulo, onListo }: { supabase: SupabaseClient; articulo: Articulo; onListo: () => void }) {
  const [tipo, setTipo] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const n = Number(cantidad);
    if (cantidad === "" || n < 0 || (tipo !== "ajuste" && n === 0)) return setError("Indica una cantidad válida.");
    if (motivo.trim().length < 3) return setError("Escribe el motivo.");

    setGuardando(true);
    const { error } = await supabase.rpc("ajustar_inventario", {
      p_articulo: articulo.id, p_tipo: tipo, p_cantidad: n, p_motivo: motivo.trim(),
    });
    setGuardando(false);
    if (error) return setError(error.message);
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <p className="text-sm text-slate-600">
        <strong>{articulo.nombre}</strong><br />Existencia actual: {cantidadTexto(articulo.stock)} {articulo.unidad}
      </p>
      <label className="block"><span className={etiqueta}>Tipo de movimiento</span>
        <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          <option value="entrada">Entrada: llegó material (suma)</option>
          <option value="salida">Salida: merma, caducidad, préstamo (resta)</option>
          <option value="ajuste">Ajuste: conteo físico (nueva existencia)</option>
        </select></label>
      <label className="block">
        <span className={etiqueta}>{tipo === "ajuste" ? `Existencia real contada (${articulo.unidad})` : `Cantidad (${articulo.unidad})`}</span>
        <input className={campo} type="number" inputMode="decimal" min="0" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required /></label>
      <label className="block"><span className={etiqueta}>Motivo</span>
        <input className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Compra factura 123 / Reactivo caducado" required /></label>
      {error && <p role="alert" className={alertaError}>{error}</p>}
      <button disabled={guardando} className={botonPrimario}>{guardando ? "Guardando…" : "Registrar movimiento"}</button>
    </form>
  );
}

/* ---------- Formulario de equipo ---------- */
function FormEquipo({ supabase, editar, onListo }: { supabase: SupabaseClient; editar: Equipo | null; onListo: () => void }) {
  const [nombre, setNombre] = useState(editar?.nombre ?? "");
  const [marca, setMarca] = useState(editar?.marca ?? "");
  const [modelo, setModelo] = useState(editar?.modelo ?? "");
  const [ubicacion, setUbicacion] = useState(editar?.ubicacion ?? "");
  const [estado, setEstado] = useState<EstadoEquipo>(editar?.estado ?? "disponible");
  const [activo, setActivo] = useState(editar?.activo ?? true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nombre.trim().length < 2) return setError("Escribe el nombre del equipo.");
    const datos = {
      nombre: nombre.trim(), marca: marca.trim() || null, modelo: modelo.trim() || null,
      ubicacion: ubicacion.trim() || null, estado, activo,
    };
    setGuardando(true);
    const { error } = editar
      ? await supabase.from("equipos").update(datos).eq("id", editar.id)
      : await supabase.from("equipos").insert(datos);
    setGuardando(false);
    if (error) return setError("No se pudo guardar.");
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <label className="block"><span className={etiqueta}>Nombre</span>
        <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} required /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={etiqueta}>Marca</span>
          <input className={campo} value={marca} onChange={(e) => setMarca(e.target.value)} /></label>
        <label className="block"><span className={etiqueta}>Modelo</span>
          <input className={campo} value={modelo} onChange={(e) => setModelo(e.target.value)} /></label>
      </div>
      <label className="block"><span className={etiqueta}>Ubicación</span>
        <input className={campo} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} /></label>
      <label className="block"><span className={etiqueta}>Estado</span>
        <select className={campo} value={estado} onChange={(e) => setEstado(e.target.value as EstadoEquipo)}>
          {(Object.keys(ETIQUETA_ESTADO_EQUIPO) as EstadoEquipo[]).map((k) => <option key={k} value={k}>{ETIQUETA_ESTADO_EQUIPO[k]}</option>)}
        </select></label>
      {editar && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-5 w-5" />
          Activo (aparece en la bitácora y reportes)
        </label>
      )}
      {error && <p role="alert" className={alertaError}>{error}</p>}
      <button disabled={guardando} className={botonPrimario}>{guardando ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

/* ---------- Página ---------- */
export default function Inventario() {
  const { supabase, perfil, cargando: cargandoPerfil, esPersonal } = usePerfil();
  const [tab, setTab] = useState<"materiales" | "equipos">("materiales");
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todas" | Categoria | "bajo">("todas");
  const [inactivos, setInactivos] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    const [a, e] = await Promise.all([
      supabase.from("articulos").select("*").order("nombre"),
      supabase.from("equipos").select("*").order("nombre"),
    ]);
    if (a.error || e.error) setError("No se pudo cargar el inventario.");
    else {
      setError("");
      setArticulos((a.data ?? []) as Articulo[]);
      setEquipos((e.data ?? []) as Equipo[]);
    }
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    if (esPersonal) cargar();
  }, [esPersonal, cargar]);

  const articulosVisibles = useMemo(() => {
    const q = normalizar(busqueda);
    return articulos
      .filter((a) => inactivos || a.activo)
      .filter((a) => filtro === "todas" || (filtro === "bajo" ? a.stock <= a.stock_minimo : a.categoria === filtro))
      .filter((a) => normalizar(`${a.nombre} ${a.ubicacion ?? ""}`).includes(q));
  }, [articulos, busqueda, filtro, inactivos]);

  const equiposVisibles = useMemo(() => {
    const q = normalizar(busqueda);
    return equipos
      .filter((e) => inactivos || e.activo)
      .filter((e) => normalizar(`${e.nombre} ${e.marca ?? ""} ${e.modelo ?? ""} ${e.ubicacion ?? ""}`).includes(q));
  }, [equipos, busqueda, inactivos]);

  const bajos = articulos.filter((a) => a.activo && a.stock <= a.stock_minimo).length;

  async function listo(mensaje: string) {
    setPanel(null);
    setAviso(mensaje);
    await cargar();
  }

  async function pdf() {
    if (!perfil) return;
    setGenerando(true);
    try { await descargarPdfInventario(supabase, perfil.nombre); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo generar el PDF."); }
    setGenerando(false);
  }

  if (cargandoPerfil) return <Marco titulo="Inventario"><p className="text-slate-500">Cargando…</p></Marco>;
  if (!esPersonal) {
    return (
      <Marco titulo="Inventario">
        <p className={alertaError}>Esta sección es solo para profesores y administradores.</p>
        <Link href="/inicio" className={`${botonSecundario} mt-4 block text-center`}>Volver al inicio</Link>
      </Marco>
    );
  }

  return (
    <Marco
      titulo="Inventario"
      acciones={
        <button onClick={pdf} disabled={generando} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60">
          {generando ? "Generando…" : "📄 PDF"}
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["materiales", "equipos"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setBusqueda(""); setAviso(""); }}
            className={`rounded-xl border px-3 py-3 text-sm font-semibold ${tab === t ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"}`}>
            {t === "materiales" ? `Materiales y reactivos (${articulos.filter((a) => a.activo).length})` : `Equipos (${equipos.filter((e) => e.activo).length})`}
          </button>
        ))}
      </div>

      {aviso && <p className={`${alertaOk} mb-3`}>{aviso}</p>}
      {error && <p role="alert" className={`${alertaError} mb-3`}>{error}</p>}

      <div className="mb-3 flex gap-2">
        <input className={campo} type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" />
        <button
          onClick={() => setPanel(tab === "materiales" ? { tipo: "articulo", editar: null } : { tipo: "equipo", editar: null })}
          className="shrink-0 rounded-xl bg-emerald-700 px-4 font-semibold text-white"
        >
          + Nuevo
        </button>
      </div>

      {tab === "materiales" && (
        <div className="mb-3 flex flex-wrap gap-2">
          {([["todas", "Todo"], ["reactivo", "Reactivos"], ["consumible", "Consumibles"], ["material", "Material"], ["bajo", `Stock bajo (${bajos})`]] as const).map(([v, t]) => (
            <button key={v} onClick={() => setFiltro(v)}
              className={`rounded-full border px-3 py-1.5 text-sm ${filtro === v ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"}`}>{t}</button>
          ))}
        </div>
      )}
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} className="h-4 w-4" />
        Mostrar inactivos
      </label>

      {cargando && <p className="text-slate-500">Cargando…</p>}

      {tab === "materiales" && (
        <ul className="space-y-3">
          {!cargando && articulosVisibles.length === 0 && <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">No hay resultados.</li>}
          {articulosVisibles.map((a) => {
            const bajo = a.stock <= a.stock_minimo;
            return (
              <li key={a.id} className={`${tarjeta} ${!a.activo ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{a.nombre}</p>
                    <p className="text-xs text-slate-500">{ETIQUETA_CATEGORIA[a.categoria]}{a.ubicacion ? ` · ${a.ubicacion}` : ""}{!a.activo ? " · inactivo" : ""}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-lg font-bold ${bajo ? "text-red-600" : "text-slate-900"}`}>{cantidadTexto(a.stock)} <span className="text-sm font-medium">{a.unidad}</span></p>
                    {bajo && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{a.stock === 0 ? "Agotado" : "Stock bajo"}</span>}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setPanel({ tipo: "movimiento", articulo: a })} className={`${botonSecundario} flex-1 py-2 text-sm`}>± Movimiento</button>
                  <button onClick={() => setPanel({ tipo: "articulo", editar: a })} className={`${botonSecundario} flex-1 py-2 text-sm`}>Editar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "equipos" && (
        <ul className="space-y-3">
          {!cargando && equiposVisibles.length === 0 && <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">No hay resultados.</li>}
          {equiposVisibles.map((e) => (
            <li key={e.id} className={`${tarjeta} ${!e.activo ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{e.nombre}</p>
                  <p className="text-xs text-slate-500">{[e.marca, e.modelo, e.ubicacion].filter(Boolean).join(" · ")}{!e.activo ? " · inactivo" : ""}</p>
                </div>
                <span className={`${insignia} shrink-0 ${e.estado !== "disponible" ? "!bg-amber-100 !text-amber-800" : ""}`}>{ETIQUETA_ESTADO_EQUIPO[e.estado]}</span>
              </div>
              <button onClick={() => setPanel({ tipo: "equipo", editar: e })} className={`${botonSecundario} mt-3 w-full py-2 text-sm`}>Editar</button>
            </li>
          ))}
        </ul>
      )}

      {panel?.tipo === "articulo" && (
        <Modal titulo={panel.editar ? "Editar material" : "Nuevo material"} onCerrar={() => setPanel(null)}>
          <FormArticulo supabase={supabase} editar={panel.editar} onListo={() => listo("Material guardado.")} />
        </Modal>
      )}
      {panel?.tipo === "movimiento" && (
        <Modal titulo="Movimiento de inventario" onCerrar={() => setPanel(null)}>
          <FormMovimiento supabase={supabase} articulo={panel.articulo} onListo={() => listo("Movimiento registrado.")} />
        </Modal>
      )}
      {panel?.tipo === "equipo" && (
        <Modal titulo={panel.editar ? "Editar equipo" : "Nuevo equipo"} onCerrar={() => setPanel(null)}>
          <FormEquipo supabase={supabase} editar={panel.editar} onListo={() => listo("Equipo guardado.")} />
        </Modal>
      )}
    </Marco>
  );
}
