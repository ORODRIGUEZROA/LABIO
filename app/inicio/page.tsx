"use client";

import { useState } from "react";
import Link from "next/link";
import { usePerfil } from "@/lib/usePerfil";
import { ETIQUETA_ROL } from "@/lib/tipos";
import { descargarPdfInventario } from "@/lib/pdfInventario";
import { alertaError } from "@/lib/estilos";

const tarjetaMenu =
  "flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm active:bg-slate-50";

function Opcion({ href, icono, titulo, detalle }: { href: string; icono: string; titulo: string; detalle: string }) {
  return (
    <Link href={href} className={tarjetaMenu}>
      <span className="text-3xl" aria-hidden>{icono}</span>
      <span>
        <span className="block text-lg font-semibold text-slate-900">{titulo}</span>
        <span className="block text-sm text-slate-600">{detalle}</span>
      </span>
    </Link>
  );
}

export default function Inicio() {
  const { supabase, perfil, cargando, esPersonal } = usePerfil();
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  async function pdf() {
    if (!perfil) return;
    setError("");
    setGenerando(true);
    try {
      await descargarPdfInventario(supabase, perfil.nombre);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    }
    setGenerando(false);
  }

  if (cargando) {
    return <main className="mx-auto max-w-md px-5 py-10 text-slate-500">Cargando…</main>;
  }
  if (!perfil) {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <p className="text-slate-700">No encontramos tu perfil. Cierra sesión y vuelve a entrar.</p>
        <form action="/auth/salir" method="post" className="mt-4">
          <button className="underline">Cerrar sesión</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hola, {perfil.nombre.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-slate-600">{perfil.matricula}</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
          {ETIQUETA_ROL[perfil.rol] ?? perfil.rol}
        </span>
      </div>

      <div className="mt-6 space-y-3">
        <Opcion href="/practicas" icono="🧪" titulo="Práctica" detalle="Registra los materiales y reactivos que usaste" />
        <Opcion href="/bitacora" icono="📒" titulo="Bitácora de equipos" detalle="Registra el uso de un equipo" />
        <Opcion href="/reportes" icono="⚠️" titulo="Reportar" detalle="Incidentes o equipos en mal estado, con foto" />
      </div>

      {esPersonal && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Administración
          </h2>
          <div className="space-y-3">
            <Opcion href="/inventario" icono="📦" titulo="Inventario" detalle="Editar materiales, reactivos y equipos" />
            <button onClick={pdf} disabled={generando} className={`${tarjetaMenu} w-full text-left disabled:opacity-60`}>
              <span className="text-3xl" aria-hidden>📄</span>
              <span>
                <span className="block text-lg font-semibold text-slate-900">
                  {generando ? "Generando PDF…" : "Descargar inventario (PDF)"}
                </span>
                <span className="block text-sm text-slate-600">Estado actual del inventario</span>
              </span>
            </button>
          </div>
          {error && <p role="alert" className={`${alertaError} mt-3`}>{error}</p>}
        </>
      )}

      <form action="/auth/salir" method="post" className="mt-10">
        <button className="text-sm text-slate-500 underline">Cerrar sesión</button>
      </form>
    </main>
  );
}
