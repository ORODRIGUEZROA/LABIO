"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

function Contenido() {
  const supabase = crearClienteNavegador();
  const correo = useSearchParams().get("correo") ?? "";
  const [mensaje, setMensaje] = useState("");

  async function reenviar() {
    setMensaje("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: correo,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMensaje(
      error
        ? "Espera un minuto antes de pedir otro correo."
        : "Te enviamos otro correo de verificación."
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 text-center">
      <div className="text-5xl">📧</div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Revisa tu correo</h1>
      <p className="mt-3 text-slate-600">
        Enviamos un enlace de verificación a{" "}
        <strong className="text-slate-900">{correo || "tu correo"}</strong>. Ábrelo para activar tu cuenta.
      </p>
      <p className="mt-2 text-sm text-slate-500">Si no lo ves, revisa la carpeta de spam.</p>

      {correo && (
        <button onClick={reenviar} className="mt-6 rounded-xl border border-slate-300 px-4 py-3 font-medium">
          Reenviar correo
        </button>
      )}
      {mensaje && <p className="mt-3 text-sm text-slate-600">{mensaje}</p>}

      <Link href="/login" className="mt-8 font-semibold text-emerald-700">Ir a iniciar sesión</Link>
    </main>
  );
}

export default function Verificar() {
  return (
    <Suspense>
      <Contenido />
    </Suspense>
  );
}
