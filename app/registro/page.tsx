"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

type Clase = { id: string; nombre: string; periodo: string | null };

const DOMINIO = process.env.NEXT_PUBLIC_DOMINIO_CORREO?.trim().toLowerCase();

export default function Registro() {
  const [supabase] = useState(() => crearClienteNavegador());
  const router = useRouter();

  const [clases, setClases] = useState<Clase[]>([]);
  const [nombre, setNombre] = useState("");
  const [matricula, setMatricula] = useState("");
  const [claseId, setClaseId] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

useEffect(() => {
  supabase
    .from("clases")
    .select("id, nombre, periodo")
    .order("nombre")
    .then(({ data, error }) => {
      if (error) {
        console.error("Error cargando clases:", error);
        setError("No se pudieron cargar las clases.");
        return;
      }
      setClases(data ?? []);
    });
}, [supabase]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const correoLimpio = correo.trim().toLowerCase();
    if (nombre.trim().length < 3) return setError("Escribe tu nombre completo.");
    if (matricula.trim().length < 4) return setError("Revisa tu matrícula.");
    if (!claseId) return setError("Selecciona tu clase.");
    if (DOMINIO && !correoLimpio.endsWith(DOMINIO))
      return setError(`Usa tu correo institucional (${DOMINIO}).`);
    if (clave.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (clave !== clave2) return setError("Las contraseñas no coinciden.");

    setCargando(true);
    const { error } = await supabase.auth.signUp({
      email: correoLimpio,
      password: clave,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { nombre: nombre.trim(), matricula: matricula.trim(), clase_id: claseId },
      },
    });
    setCargando(false);

    if (error) {
      // Mensajes claros para los errores más comunes
      if (error.message.toLowerCase().includes("already"))
        return setError("Ese correo ya está registrado. Inicia sesión.");
      if (error.message.toLowerCase().includes("matricula") || error.message.includes("unique"))
        return setError("Esa matrícula ya está registrada.");
      return setError("No se pudo crear la cuenta. Revisa tus datos e inténtalo de nuevo.");
    }

    router.push(`/verificar?correo=${encodeURIComponent(correoLimpio)}`);
  }

  const campo =
    "w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Crear cuenta</h1>
      <p className="mb-6 mt-1 text-slate-600">Laboratorio de Bioquímica</p>

      <form onSubmit={enviar} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nombre completo</span>
          <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Matrícula</span>
          <input className={campo} value={matricula} onChange={(e) => setMatricula(e.target.value)} autoCapitalize="characters" required />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Clase</span>
          <select className={campo} value={claseId} onChange={(e) => setClaseId(e.target.value)} required>
            <option value="">Selecciona tu clase…</option>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}{c.periodo ? ` · ${c.periodo}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Correo electrónico</span>
          <input type="email" className={campo} value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" required />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Contraseña (mínimo 8 caracteres)</span>
          <input type="password" className={campo} value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" required />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Repite la contraseña</span>
          <input type="password" className={campo} value={clave2} onChange={(e) => setClave2(e.target.value)} autoComplete="new-password" required />
        </label>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button disabled={cargando} className="w-full rounded-xl bg-emerald-700 px-4 py-4 text-lg font-semibold text-white disabled:opacity-60">
          {cargando ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-slate-600">
        ¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-emerald-700">Inicia sesión</Link>
      </p>
    </main>
  );
}
