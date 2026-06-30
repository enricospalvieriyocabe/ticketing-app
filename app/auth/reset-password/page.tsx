"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Verifica link in corso...");

  useEffect(() => {
    async function prepareRecovery() {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      if (accessToken && refreshToken && type === "recovery") {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setMessage("Link di recupero non valido o scaduto.");
          return;
        }

        window.history.replaceState({}, "", window.location.pathname);
        setReady(true);
        setMessage("");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
        setMessage("");
        return;
      }

      setMessage("Link di recupero non valido o scaduto. Richiedi una nuova email.");
    }

    prepareRecovery();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (password.length < 8) {
      alert("La password deve avere almeno 8 caratteri.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Le password non coincidono.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      alert(`Impossibile aggiornare la password: ${error.message}`);
      return;
    }

    alert("Password aggiornata. Ora puoi accedere.");
    router.replace("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f6] p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-bold text-[#1a2e2b]">Nuova password</h1>

        {!ready ? (
          <p className="text-sm text-gray-700">{message}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              className="mb-3 w-full rounded border p-2 text-black"
              placeholder="Nuova password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <input
              className="mb-4 w-full rounded border p-2 text-black"
              placeholder="Conferma password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button
              type="submit"
              className="yocabe-btn-primary w-full rounded-lg p-2.5 font-medium"
            >
              Salva password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
