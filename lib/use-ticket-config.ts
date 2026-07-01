"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import {
  DEFAULT_CASE_TYPES,
  DEFAULT_TICKET_CATEGORIES,
  type TicketConfigItem,
} from "@/lib/ticket-config";

export function useTicketConfig() {
  const [categories, setCategories] = useState<TicketConfigItem[]>(DEFAULT_TICKET_CATEGORIES);
  const [caseTypes, setCaseTypes] = useState<TicketConfigItem[]>(DEFAULT_CASE_TYPES);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }

    const response = await fetch("/api/ticket-config", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setCategories(payload.categories ?? DEFAULT_TICKET_CATEGORIES);
      setCaseTypes(payload.caseTypes ?? DEFAULT_CASE_TYPES);
      setRole(payload.role ?? null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { categories, caseTypes, loading, role, reload };
}
