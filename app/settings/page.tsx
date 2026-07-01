"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchCurrentUserProfile } from "@/lib/profile-sync";
import { supabase } from "@/lib/supabase";
import { slugifyConfigCode, type TicketConfigItem } from "@/lib/ticket-config";
import { useTicketConfig } from "@/lib/use-ticket-config";

type SettingsTab = "categories" | "case_types" | "sla" | "templates";

async function authFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione non valida");

  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

function ConfigListEditor({
  title,
  description,
  items,
  onSave,
  onCreate,
}: {
  title: string;
  description: string;
  items: TicketConfigItem[];
  onSave: (item: TicketConfigItem) => Promise<void>;
  onCreate: (label: string, code: string, sortOrder: number) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, TicketConfigItem>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newSort, setNewSort] = useState("100");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, TicketConfigItem> = {};
    for (const item of items) next[item.id] = { ...item };
    setDrafts(next);
  }, [items]);

  function updateDraft(id: string, patch: Partial<TicketConfigItem>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  return (
    <div className="rounded border bg-white p-4">
      <h2 className="mb-1 text-lg font-bold text-black">{title}</h2>
      <p className="mb-4 text-sm text-gray-600">{description}</p>

      <div className="space-y-3">
        {items.map((item) => {
          const draft = drafts[item.id] ?? item;
          return (
            <div key={item.id} className="grid gap-2 rounded border p-3 md:grid-cols-12">
              <input
                className="rounded border p-2 text-black md:col-span-4"
                value={draft.label}
                onChange={(e) => updateDraft(item.id, { label: e.target.value })}
              />
              <input
                className="rounded border p-2 font-mono text-sm text-black md:col-span-3"
                value={draft.code}
                onChange={(e) => updateDraft(item.id, { code: e.target.value })}
              />
              <input
                className="rounded border p-2 text-black md:col-span-2"
                type="number"
                value={draft.sort_order}
                onChange={(e) =>
                  updateDraft(item.id, { sort_order: Number(e.target.value) || 0 })
                }
              />
              <label className="flex items-center gap-2 text-sm text-black md:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => updateDraft(item.id, { is_active: e.target.checked })}
                />
                Attiva
              </label>
              <button
                disabled={busyId === item.id}
                onClick={async () => {
                  setBusyId(item.id);
                  try {
                    await onSave(draft);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="rounded bg-black px-3 py-2 text-sm text-white md:col-span-1"
              >
                Salva
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded border border-dashed p-4">
        <p className="mb-3 text-sm font-semibold text-black">Aggiungi nuova voce</p>
        <div className="grid gap-2 md:grid-cols-12">
          <input
            className="rounded border p-2 text-black md:col-span-4"
            placeholder="Nome visibile (es. Resi)"
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value);
              if (!newCode) setNewCode(slugifyConfigCode(e.target.value));
            }}
          />
          <input
            className="rounded border p-2 font-mono text-sm text-black md:col-span-3"
            placeholder="codice_interno"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
          />
          <input
            className="rounded border p-2 text-black md:col-span-2"
            type="number"
            value={newSort}
            onChange={(e) => setNewSort(e.target.value)}
          />
          <button
            onClick={async () => {
              setBusyId("new");
              try {
                await onCreate(newLabel, newCode, Number(newSort) || 100);
                setNewLabel("");
                setNewCode("");
                setNewSort("100");
              } finally {
                setBusyId(null);
              }
            }}
            className="rounded bg-[#1a2e2b] px-3 py-2 text-sm text-white md:col-span-3"
          >
            Aggiungi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { categories, caseTypes, loading, role, reload } = useTicketConfig();
  const [tab, setTab] = useState<SettingsTab>("categories");
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function guard() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }

      const { profile } = await fetchCurrentUserProfile(data.user);
      if (profile?.role !== "team_leader") {
        router.replace("/");
        return;
      }

      setAuthLoading(false);
    }

    guard();
  }, [router]);

  async function saveCategory(item: TicketConfigItem) {
    const response = await authFetch("/api/settings/categories", {
      method: "PATCH",
      body: JSON.stringify(item),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload.error ?? "Salvataggio non riuscito");
      return;
    }
    await reload();
  }

  async function createCategory(label: string, code: string, sortOrder: number) {
    const response = await authFetch("/api/settings/categories", {
      method: "POST",
      body: JSON.stringify({ label, code, sort_order: sortOrder }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload.error ?? "Creazione non riuscita");
      return;
    }
    await reload();
  }

  async function saveCaseType(item: TicketConfigItem) {
    const response = await authFetch("/api/settings/case-types", {
      method: "PATCH",
      body: JSON.stringify(item),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload.error ?? "Salvataggio non riuscito");
      return;
    }
    await reload();
  }

  async function createCaseType(label: string, code: string, sortOrder: number) {
    const response = await authFetch("/api/settings/case-types", {
      method: "POST",
      body: JSON.stringify({ label, code, sort_order: sortOrder }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload.error ?? "Creazione non riuscita");
      return;
    }
    await reload();
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7f6] p-4">
        <p className="text-sm text-gray-700">Caricamento impostazioni...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7f6] p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1a2e2b]">Impostazioni ticketing</h1>
            <p className="text-sm text-gray-600">
              Configurazione riservata ai team leader ({role ?? "team_leader"})
            </p>
          </div>
          <Link href="/" className="rounded border border-black bg-white px-4 py-2 text-black">
            ← Torna alla dashboard
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              ["categories", "Categorie"],
              ["case_types", "Casistiche"],
              ["sla", "SLA"],
              ["templates", "Template email"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded px-4 py-2 text-sm ${
                tab === id ? "bg-black text-white" : "border bg-white text-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "categories" && (
          <ConfigListEditor
            title="Categorie ticket"
            description="Usate in apertura ticket, filtri e policy SLA. Il codice resta stabile nei dati storici."
            items={categories}
            onSave={saveCategory}
            onCreate={createCategory}
          />
        )}

        {tab === "case_types" && (
          <ConfigListEditor
            title="Casistiche"
            description="Tipologie di richiesta (es. pacco non ricevuto). La classificazione automatica email usa ancora regole dedicate nel codice."
            items={caseTypes}
            onSave={saveCaseType}
            onCreate={createCaseType}
          />
        )}

        {tab === "sla" && (
          <div className="rounded border bg-white p-6">
            <h2 className="mb-2 text-lg font-bold text-black">Policy SLA</h2>
            <p className="mb-4 text-sm text-gray-600">
              Per ora la gestione SLA resta nella dashboard principale. Nel prossimo step la
              spostiamo qui insieme alle altre impostazioni.
            </p>
            <Link href="/?open=sla" className="rounded bg-black px-4 py-2 text-white">
              Apri gestione SLA in dashboard
            </Link>
          </div>
        )}

        {tab === "templates" && (
          <div className="rounded border bg-white p-6">
            <h2 className="mb-2 text-lg font-bold text-black">Template risposta automatica</h2>
            <p className="mb-4 text-sm text-gray-600">
              Per ora i template restano nella dashboard principale. Nel prossimo step li
              centralizziamo in questa pagina.
            </p>
            <Link href="/?open=templates" className="rounded bg-black px-4 py-2 text-white">
              Apri gestione template in dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
