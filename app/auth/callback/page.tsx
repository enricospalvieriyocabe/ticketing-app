"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { syncProfileFromMetadata } from "@/lib/profile-sync";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Conferma in corso...");

  useEffect(() => {
    async function completeAuth() {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setMessage("Conferma email fallita.");
          router.replace("/?auth_error=confirm");
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await syncProfileFromMetadata(userData.user);
        }

        router.replace("/");
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage("Conferma email fallita.");
          router.replace("/?auth_error=confirm");
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await syncProfileFromMetadata(userData.user);
        }

        router.replace("/");
        return;
      }

      setMessage("Link di conferma non valido.");
      router.replace("/?auth_error=missing_code");
    }

    completeAuth();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f6] p-4">
      <p className="text-sm text-gray-700">{message}</p>
    </main>
  );
}
