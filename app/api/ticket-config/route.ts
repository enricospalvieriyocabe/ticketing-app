import { NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  enrichCaseTypesWithUsage,
  enrichCategoriesWithUsage,
} from "@/lib/ticket-config-usage";
import {
  DEFAULT_CASE_TYPES,
  DEFAULT_TICKET_CATEGORIES,
  type TicketConfigItem,
} from "@/lib/ticket-config";
import { DEFAULT_FORM_TEMPLATE } from "@/lib/ticket-form-templates";

async function loadRole(userId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role ?? null;
}

function mapCategoryRows(rows: TicketConfigItem[] | null): TicketConfigItem[] {
  return (rows ?? []).map((row) => {
    const code = String(row.code);
    const defaultMatch = DEFAULT_TICKET_CATEGORIES.find((item) => item.code === code);
    return {
      id: String(row.id),
      code,
      label: String(row.label),
      sort_order: Number(row.sort_order ?? 0),
      is_active: Boolean(row.is_active),
      form_template: row.form_template
        ? String(row.form_template)
        : (defaultMatch?.form_template ?? DEFAULT_FORM_TEMPLATE),
    };
  });
}

function mapCaseTypeRows(rows: TicketConfigItem[] | null): TicketConfigItem[] {
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    label: String(row.label),
    sort_order: Number(row.sort_order ?? 0),
    is_active: Boolean(row.is_active),
  }));
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthUserFromRequest(request);
    if (auth.error || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const role = await loadRole(auth.user.id);
    const admin = getSupabaseAdmin();

    let categoriesQuery = admin
      .from("ticket_categories")
      .select("id, code, label, sort_order, is_active, form_template")
      .order("sort_order")
      .order("label");

    let caseTypesQuery = admin
      .from("ticket_case_types")
      .select("id, code, label, sort_order, is_active")
      .order("sort_order")
      .order("label");

    if (role !== "team_leader") {
      categoriesQuery = categoriesQuery.eq("is_active", true);
      caseTypesQuery = caseTypesQuery.eq("is_active", true);
    }

    const [{ data: categories, error: catError }, { data: caseTypes, error: caseError }] =
      await Promise.all([categoriesQuery, caseTypesQuery]);

    if (catError?.message?.includes("does not exist")) {
      return NextResponse.json({
        categories: DEFAULT_TICKET_CATEGORIES,
        caseTypes: DEFAULT_CASE_TYPES,
        fallback: true,
      });
    }

    if (catError || caseError) {
      return NextResponse.json(
        { error: catError?.message ?? caseError?.message ?? "Errore caricamento configurazione" },
        { status: 500 }
      );
    }

    let mappedCategories = mapCategoryRows(categories as TicketConfigItem[]);
    let mappedCaseTypes = mapCaseTypeRows(caseTypes as TicketConfigItem[]);

    if (role === "team_leader") {
      [mappedCategories, mappedCaseTypes] = await Promise.all([
        enrichCategoriesWithUsage(admin, mappedCategories),
        enrichCaseTypesWithUsage(admin, mappedCaseTypes),
      ]);
    }

    return NextResponse.json({
      categories: mappedCategories,
      caseTypes: mappedCaseTypes,
      fallback: false,
      role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
