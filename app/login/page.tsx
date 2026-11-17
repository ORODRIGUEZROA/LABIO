"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

function Formulario() {
  const supabase = crearClienteNavegador();
  const router = useRouter();
  const errorEnlace = useSearchParams().get("error") === "enlace";

  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState(
    errorEnlace ? "El enlace de verificación no es válido o ya expiró. Inicia sesión o pide otro correo." : ""
  );
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
      password: clave,
    });
    setCargando(false);

    if (error) {
      if (error.message.toLowerCase().includes("not confirmed"))
        return setError("Aún no verificas tu correo. Abre el enlace que te enviamos.");
      return setError("Correo o contraseña incorrectos.");
    }

    router.push("/inicio");
    router.refresh();
  }

  const campo =
    "w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <h1 className="text-2xl font-bold text-slate-900">Iniciar sesión</h1>
      <p className="mb-6 mt-1 text-slate-600">Laboratorio de Bioquímica</p>

      <form onSubmit={entrar} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Correo electrónico</span>
          <input type="email" className={campo} value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Contraseña</span>
          <input type="password" className={campo} value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
        </label>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button disabled={cargando} className="w-full rounded-xl bg-emerald-700 px-4 py-4 text-lg font-semibold text-white disabled:opacity-60">
          {cargando ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-slate-600">
        ¿Primera vez? <Link href="/registro" className="font-semibold text-emerald-700">Crea tu cuenta</Link>
      </p>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}
