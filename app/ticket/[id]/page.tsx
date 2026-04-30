"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { CASE_TYPE_OPTIONS, getCaseTypeLabel } from "@/lib/ticket-classification";
import { extractOrderReference } from "@/lib/order-reference";
import { parseTicketContent } from "@/lib/ticket-content";

export default function TicketPage() {
  const { id } = useParams();
  const router = useRouter();

  const [ticket, setTicket] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState("");
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [requester, setRequester] = useState<any>(null);
  const [assignee, setAssignee] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);

  const [comments, setComments] = useState<any[]>([]);
  const [composeMode, setComposeMode] = useState<"comment" | "reply">("comment");
  const [composeBody, setComposeBody] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [commentAuthorsById, setCommentAuthorsById] = useState<Record<string, string>>({});
  const [slaPolicies, setSlaPolicies] = useState<any[]>([]);

  const [events, setEvents] = useState<any[]>([]);
  const [handoffNote, setHandoffNote] = useState("");

  useEffect(() => {
    loadUser();
    loadTicket();
    loadAssignableUsers();
    loadSlaPolicies();
    loadComments();
    loadEvents();
  }, []);

  async function loadUser() {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setUser(data.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile) setRole(profile.role);
    }
  }

  async function loadTicket() {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", id)
      .single();
  
    if (error || !data) {
      alert(error?.message || "Errore ticket");
      return;
    }
  
    setTicket(data);
  
    // carica profili collegati
    loadProfiles(data);
  }

  async function loadComments() {
    const { data, error } = await supabase
      .from("ticket_comments")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
  
    if (error) {
      alert(error.message);
      return;
    }
  
    const loadedComments = data ?? [];
    setComments(loadedComments);

    const authorIds = Array.from(
      new Set(
        loadedComments
          .map((comment: any) => comment.user_id)
          .filter((authorId: string | null | undefined) => Boolean(authorId))
      )
    );

    if (authorIds.length === 0) {
      setCommentAuthorsById({});
      return;
    }

    const { data: authorProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", authorIds);

    const authorsMap: Record<string, string> = {};
    for (const profile of authorProfiles ?? []) {
      const fullName = String(profile.full_name ?? "").trim();
      const composedName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
      const genericName = String(profile.name ?? "").trim();
      authorsMap[profile.id] = fullName || composedName || genericName || profile.email || "Utente";
    }

    setCommentAuthorsById(authorsMap);
  }

  async function addComment(inputBody?: string) {
    const body = String(inputBody ?? composeBody).trim();
    if (!user || !body) return;
  
    const { error } = await supabase.from("ticket_comments").insert([
      {
        ticket_id: id,
        user_id: user.id,
        body,
      },
    ]);
  
    if (error) {
      alert(error.message);
    } else {
      await ensureTicketAssignedToCurrentUser("primo commento");
      const mentionedEmails = extractMentionedEmails(body);
    
      for (const email of mentionedEmails) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single();
    
        if (profile) {
          await addNotification(
            profile.id,
            "Sei stato menzionato in un commento"
          );
        }
      }
    
      setComposeBody("");
      loadComments();
    }
  }

  async function sendReplyEmail(inputBody?: string) {
    const body = String(inputBody ?? composeBody).trim();
    if (!user || !body) return;
    setReplySending(true);
    try {
      await ensureTicketAssignedToCurrentUser("invio risposta email");
      const response = await fetch(`/api/ticket/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          actorUserId: user.id,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result?.error || "Errore invio email");
        return;
      }
      setComposeBody("");
      await loadComments();
      await loadEvents();
      alert("Risposta in invio. Sara inviata dallo script Gmail.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Errore invio email");
    } finally {
      setReplySending(false);
    }
  }

  async function startEditComment(comment: any) {
    setEditingCommentId(comment.id);
    setEditingCommentBody(comment.body ?? "");
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentBody("");
  }

  async function saveEditedComment(commentId: string) {
    if (!user) return;
    if (!editingCommentBody.trim()) {
      alert("Il commento non puo essere vuoto");
      return;
    }

    const { error } = await supabase
      .from("ticket_comments")
      .update({ body: editingCommentBody.trim() })
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    cancelEditComment();
    loadComments();
  }

  async function addEvent(type: string, description: string) {
    if (!user) return;
  
    await supabase.from("ticket_events").insert([
      {
        ticket_id: id,
        user_id: user.id,
        type,
        description,
      },
    ]);

    loadEvents();
  }

  async function addNotification(userId: string, message: string) {
    await supabase.from("notifications").insert([
      {
        user_id: userId,
        ticket_id: id,
        type: "info",
        message,
      },
    ]);
  }

  function extractMentionedEmails(text: string) {
    const regex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    return [...text.matchAll(regex)].map((match) => match[1]);
  }

  function renderCommentWithMentions(text: string) {
    const parts = text.split(/(@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
  
    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        return (
          <span key={index} className="font-bold text-blue-600">
            {part}
          </span>
        );
      }
  
      return <span key={index}>{part}</span>;
    });
  }

  function cleanInternalCommentMarkers(text: string) {
    return String(text ?? "")
      .replace(/^\[email-reply-id:[^\]]+\]\s*/i, "")
      .replace(/^\[email-reply-status:[^\]]+\]\s*/i, "")
      .replace(/^📤\s*Risposta cliente \((in coda|inviata|errore invio)\)\s*/i, "")
      .trim();
  }

  function extractEmailReplyIdFromComment(text: string) {
    const match = String(text ?? "").match(/^\[email-reply-id:(\d+)\]/i);
    return match?.[1] ?? null;
  }

  function extractEmailReplyStatusFromComment(text: string) {
    const match = String(text ?? "").match(/^\[email-reply-status:(pending|sent|failed)\]/im);
    return match?.[1] ?? null;
  }

  function getReplyStatusBadgeFromComment(text: string) {
    const rawText = String(text ?? "");
    const queueId = extractEmailReplyIdFromComment(text);
    const markerStatus = extractEmailReplyStatusFromComment(text);
    if (queueId && markerStatus) {
      if (markerStatus === "sent") return { label: "Inviata", tone: "sent", detail: null };
      if (markerStatus === "failed") return { label: "Errore invio", tone: "failed", detail: null };
      return { label: "In invio", tone: "pending", detail: null };
    }
    if (!queueId) {
      const legacyMatch = rawText.match(/^📤\s*Risposta cliente \((in coda|inviata|errore invio)\)/i);
      if (!legacyMatch) return null;
      const legacyStatus = legacyMatch[1].toLowerCase();
      if (legacyStatus === "inviata") return { label: "Inviata", tone: "sent", detail: null };
      if (legacyStatus === "errore invio") {
        const detailMatch = rawText.match(/Dettaglio errore:\s*(.+)$/im);
        return {
          label: "Errore invio",
          tone: "failed",
          detail: detailMatch?.[1]?.trim() ?? null,
        };
      }
      return { label: "In invio", tone: "pending", detail: null };
    }
    return { label: "In invio", tone: "pending", detail: null };
  }

  async function ensureTicketAssignedToCurrentUser(reason: string) {
    if (!user || !ticket?.id || ticket.assigned_to) return;
    const nextStatus = ticket.status === "open" ? "assigned" : ticket.status;
    const { error } = await supabase
      .from("tickets")
      .update({
        assigned_to: user.id,
        status: nextStatus,
      })
      .eq("id", ticket.id)
      .is("assigned_to", null);

    if (error) return;

    await supabase.from("ticket_events").insert([
      {
        ticket_id: ticket.id,
        user_id: user.id,
        type: "auto_assigned",
        description: `Assegnazione automatica (${reason})`,
      },
    ]);
    await loadTicket();
    await loadEvents();
  }

  async function loadProfiles(ticket: any) {
    function getProfileDisplayName(profile: any) {
      if (!profile) return "Utente";
      const fullName = String(profile.full_name ?? "").trim();
      const composedName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
      const genericName = String(profile.name ?? "").trim();
      return fullName || composedName || genericName || profile.email || "Utente";
    }

    // requester
    if (ticket.requester_id) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", ticket.requester_id)
        .single();
  
      setRequester(data ? { ...data, display_name: getProfileDisplayName(data) } : null);
    }
  
    // assignee
    if (ticket.assigned_to) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", ticket.assigned_to)
        .single();
  
      setAssignee(data ? { ...data, display_name: getProfileDisplayName(data) } : null);
    }
  
    // creator
    if (ticket.created_by) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", ticket.created_by)
        .single();
  
      setCreator(data ? { ...data, display_name: getProfileDisplayName(data) } : null);
    }
  }

  async function loadAssignableUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["operator", "team_leader"]);

    const usersWithDisplayName = (data ?? []).map((person) => {
      const fullName = String(person.full_name ?? "").trim();
      const composedName = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
      const genericName = String(person.name ?? "").trim();
      const displayName = fullName || composedName || genericName || person.email || "Utente";
      return { ...person, display_name: displayName };
    });

    setAssignableUsers(usersWithDisplayName);
  }

  async function loadSlaPolicies() {
    const { data } = await supabase
      .from("sla_policies")
      .select("id, name, sla_hours, is_active, category, ticket_priority")
      .eq("is_active", true)
      .order("priority", { ascending: true });
    setSlaPolicies(data ?? []);
  }

  async function assignSlaPolicy(policyIdRaw: string) {
    if (!ticket) return;
    if (!policyIdRaw) {
      await supabase
        .from("tickets")
        .update({
          sla_policy_id: null,
          sla_hours: null,
          sla_due_at: null,
          sla_status: "on_track",
        })
        .eq("id", ticket.id);
      await addEvent("sla_policy_removed", "Policy SLA rimossa dal ticket");
      loadTicket();
      return;
    }

    const policyId = Number(policyIdRaw);
    const policy = slaPolicies.find((item) => Number(item.id) === policyId);
    if (!policy) {
      alert("Policy SLA non trovata");
      return;
    }

    const slaHours = Number(policy.sla_hours);
    if (Number.isNaN(slaHours) || slaHours <= 0) {
      alert("La policy SLA selezionata non ha ore valide.");
      return;
    }

    const createdAtMs = new Date(ticket.created_at ?? "").getTime();
    if (Number.isNaN(createdAtMs)) {
      alert("Data creazione ticket non valida.");
      return;
    }

    const dueAt = new Date(createdAtMs + slaHours * 3600000).toISOString();
    await supabase
      .from("tickets")
      .update({
        sla_policy_id: policy.id,
        sla_hours: slaHours,
        sla_due_at: dueAt,
        sla_status: "on_track",
      })
      .eq("id", ticket.id);

    await addEvent("sla_policy_assigned", `Policy SLA assegnata: ${policy.name ?? `#${policy.id}`}`);
    loadTicket();
  }

  async function assignTicket(assigneeId: string) {
    await supabase
      .from("tickets")
      .update({
        assigned_to: assigneeId || null,
        status: assigneeId ? "assigned" : "open",
      })
      .eq("id", id);
  
    await addEvent(
      "assigned",
      assigneeId ? "Ticket assegnato" : "Assegnazione rimossa"
    );
  
    if (assigneeId) {
      await addNotification(
        assigneeId,
        "Ti è stato assegnato un ticket"
      );
    }
  
    loadTicket();
  }

  async function handoffTicket(newAssigneeId: string) {
    if (!user) return;
  
    if (!newAssigneeId) {
      alert("Seleziona un operatore o team leader");
      return;
    }
  
    if (!handoffNote.trim()) {
      alert("Inserisci una nota per il passaggio di consegne");
      return;
    }
  
    await supabase
      .from("tickets")
      .update({
        assigned_to: newAssigneeId,
        status: "assigned",
      })
      .eq("id", id);
  
    await addEvent("handoff", `Passaggio di consegne: ${handoffNote}`);
  
    await addNotification(
      newAssigneeId,
      "Ti è stato passato un ticket"
    );
  
    setHandoffNote("");
    loadTicket();
  }

  async function updateTicketField(field: string, value: string | null) {
    await supabase
      .from("tickets")
      .update({ [field]: value })
      .eq("id", id);
  
    loadTicket();
  }

  async function saveOrderReference(rawValue: string) {
    if (!ticket) return;
    const nextValue = rawValue.trim() || null;
    const currentValue = ticket.order_reference ?? null;
    if (nextValue === currentValue) return;
    await updateTicketField("order_reference", nextValue);
  }

  async function startTicket() {
    if (!user) return;
  
    await supabase
      .from("tickets")
      .update({ status: "waiting" })
      .eq("assigned_to", user.id)
      .eq("status", "in_progress");
  
    const updateData =
      role === "team_leader"
        ? { status: "in_progress", assigned_to: user.id }
        : { status: "in_progress" };
  
    await supabase.from("tickets").update(updateData).eq("id", id);
  
    await addEvent("in_progress", "Ticket preso in carico");
  
    loadTicket();
  }

  async function pauseTicket() {
    await supabase
      .from("tickets")
      .update({ status: "waiting" })
      .eq("id", id);
  
    await addEvent("waiting", "Ticket messo in attesa");
  
    loadTicket();
  }

  async function closeTicket() {
    await supabase
      .from("tickets")
      .update({ status: "closed" })
      .eq("id", id);
  
    await addEvent("closed", "Ticket chiuso");
  
    loadTicket();
  }

  async function reopenTicket() {
    await supabase
      .from("tickets")
      .update({ status: "open" })
      .eq("id", id);
  
    await addEvent("reopened", "Ticket riaperto");
  
    loadTicket();
  }

  async function loadEvents() {
    const { data } = await supabase
      .from("ticket_events")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false });
  
    setEvents(data ?? []);
  }

  if (!ticket) return <p className="p-6">Caricamento...</p>;
  const parsedContent = parseTicketContent(ticket);
  const orderReferenceDefault =
    ticket.order_reference ??
    parsedContent.orderReference ??
    extractOrderReference(ticket.title ?? "", ticket.description ?? "") ??
    "";

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow">
        <button
          onClick={() => router.push("/")}
          className="mb-4 text-sm text-blue-600"
        >
          ← Torna alla dashboard
        </button>
  
        <h1 className="text-2xl font-bold text-black">{parsedContent.cleanTitle}</h1>
  
        <div className="mt-6 grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="rounded border bg-white p-4">
              <h2 className="mb-2 text-lg font-bold text-black">Richiesta</h2>
              <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words text-sm text-black [overflow-wrap:anywhere]">
                {parsedContent.rawBody || parsedContent.summary}
              </pre>
              {(parsedContent.from || parsedContent.messageId) && (
                <p className="mt-3 break-words text-xs text-gray-600 [overflow-wrap:anywhere]">
                  {parsedContent.from ? `Mittente: ${parsedContent.from}` : ""}
                  {parsedContent.from && parsedContent.messageId ? " - " : ""}
                  {parsedContent.messageId ? `Message-ID: ${parsedContent.messageId}` : ""}
                </p>
              )}
            </div>
  
            <div className="mt-6">
              <h2 className="mb-2 text-lg font-bold text-black">Commenti</h2>
  
              <div className="space-y-2">
              {comments.map((c) => {
                const isMine = c.user_id === user?.id;
                const isSystemTrackedReply = /^\[email-reply-id:[^\]]+\]/i.test(String(c.body ?? ""));
                const replyStatusBadge = getReplyStatusBadgeFromComment(String(c.body ?? ""));
                const isOutboundReplyComment = Boolean(replyStatusBadge);
                const typeBadgeLabel = isOutboundReplyComment ? "Risposta email" : "Commento interno";
                const isEditing = editingCommentId === c.id;
                const wasEdited =
                  c.updated_at &&
                  c.created_at &&
                  new Date(c.updated_at).getTime() > new Date(c.created_at).getTime();

                return (
                  <div
                    key={c.id}
                    className={`rounded border p-3 text-sm ${
                      isMine ? "bg-blue-50 text-black" : "bg-white text-black"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-600">
                        {isMine
                          ? "Tu"
                          : commentAuthorsById[c.user_id] || "Altro utente"}
                      </p>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            isOutboundReplyComment
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {typeBadgeLabel}
                        </span>
                        {replyStatusBadge && (
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                              replyStatusBadge.tone === "sent"
                                ? "bg-green-100 text-green-700"
                                : replyStatusBadge.tone === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                            title={replyStatusBadge.detail ?? undefined}
                          >
                            {replyStatusBadge.label}
                          </span>
                        )}
                        <p className="text-xs text-gray-500">
                          {new Date(c.created_at).toLocaleString("it-IT")}
                        </p>
                      </div>
                    </div>

                    {isEditing ? (
                      <div>
                        <textarea
                          className="w-full rounded border p-2 text-black"
                          value={editingCommentBody}
                          onChange={(e) => setEditingCommentBody(e.target.value)}
                        />

                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => saveEditedComment(c.id)}
                            className="rounded bg-green-600 px-3 py-1 text-white"
                          >
                            Salva
                          </button>
                          <button
                            onClick={cancelEditComment}
                            className="rounded bg-gray-500 px-3 py-1 text-white"
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap break-words text-black">
                          {renderCommentWithMentions(cleanInternalCommentMarkers(c.body))}
                        </p>

                        {wasEdited && (
                          <p className="mt-1 text-xs text-gray-500">
                            (modificato il {new Date(c.updated_at).toLocaleString("it-IT")})
                          </p>
                        )}

                        {isMine && !isSystemTrackedReply && !isOutboundReplyComment && (
                          <button
                            onClick={() => startEditComment(c)}
                            className="mt-2 rounded bg-gray-200 px-2 py-1 text-xs text-black"
                          >
                            Modifica
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
  
            <div className="mt-6 rounded border bg-gray-50 p-4">
              <h2 className="mb-2 text-lg font-bold text-black">Nuovo aggiornamento</h2>
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => setComposeMode("comment")}
                  className={`rounded px-3 py-1 text-sm font-semibold ${
                    composeMode === "comment"
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Commento interno
                </button>
                <button
                  onClick={() => setComposeMode("reply")}
                  className={`rounded px-3 py-1 text-sm font-semibold ${
                    composeMode === "reply"
                      ? "bg-indigo-700 text-white"
                      : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  Risposta email
                </button>
              </div>
              <p className="mb-2 text-xs text-gray-600">
                {composeMode === "reply"
                  ? "Questa azione invia una email al mittente e registra l'invio nello storico attività."
                  : "Questo testo resta interno al ticket e non viene inviato al cliente."}
              </p>
              <textarea
                className="w-full rounded border p-2 text-black"
                placeholder={
                  composeMode === "reply"
                    ? "Scrivi la risposta da inviare al cliente..."
                    : "Scrivi un commento interno..."
                }
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={6}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (composeMode === "reply") {
                      sendReplyEmail(composeBody);
                    } else {
                      addComment(composeBody);
                    }
                  }
                }}
              />
              <button
                onClick={() =>
                  composeMode === "reply" ? sendReplyEmail(composeBody) : addComment(composeBody)
                }
                disabled={replySending || !composeBody.trim()}
                className="mt-2 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
              >
                {composeMode === "reply"
                  ? replySending
                    ? "Invio in corso..."
                    : "Invia risposta email"
                  : "Aggiungi commento"}
              </button>
            </div>
          </div>
  
          <div className="col-span-1 space-y-4">
            <div className="rounded border bg-gray-50 p-3">
              <h2 className="mb-2 font-bold text-black">Stato</h2>
  
              <span
                className={`inline-block rounded px-2 py-1 text-xs font-bold ${
                  ticket.status === "open"
                    ? "bg-gray-200 text-gray-800"
                    : ticket.status === "assigned"
                    ? "bg-blue-200 text-blue-800"
                    : ticket.status === "in_progress"
                    ? "bg-green-200 text-green-800"
                    : ticket.status === "waiting"
                    ? "bg-yellow-200 text-yellow-800"
                    : "bg-red-200 text-red-800"
                }`}
              >
                {ticket.status}
              </span>
            </div>
  
            <div className="rounded border bg-gray-50 p-3 text-sm text-gray-700">
              <h2 className="mb-2 font-bold text-black">Persone</h2>
              {requester && <p>Richiedente: {requester.display_name}</p>}
              {creator && <p>Creato da: {creator.display_name}</p>}
              {assignee && <p>Assegnato a: {assignee.display_name}</p>}
              {!assignee && <p>Assegnato a: Nessuno</p>}
            </div>
  
            <div className="rounded border bg-gray-50 p-3 text-sm text-gray-700">
              <h2 className="mb-2 font-bold text-black">Dettagli</h2>

              <label className="block">
                Casistica:
                <select
                  className="mt-1 w-full rounded border p-2 text-black"
                  value={ticket.case_type || ""}
                  onChange={(e) =>
                    updateTicketField(
                      "case_type",
                      e.target.value ? e.target.value : null
                    )
                  }
                >
                  <option value="">Non classificato</option>
                  {CASE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="mt-2 inline-block rounded bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
                  {getCaseTypeLabel(ticket.case_type)}
                </span>
              </label>

              {Array.isArray(ticket.case_tags) && ticket.case_tags.length > 0 && (
                <p className="mt-2 text-xs text-gray-600">
                  Tag: {ticket.case_tags.join(", ")}
                </p>
              )}

              <label className="mt-3 block">
                Riferimento ordine:
                <input
                  key={`${ticket.id}-${ticket.order_reference ?? ""}`}
                  className="mt-1 w-full rounded border p-2 text-black"
                  defaultValue={orderReferenceDefault}
                  onBlur={(e) => saveOrderReference(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveOrderReference((e.target as HTMLInputElement).value);
                    }
                  }}
                  placeholder="Es. 11003151416998"
                />
              </label>
  
              <label className="block">
                Categoria:
                <select
                  className="mt-1 w-full rounded border p-2 text-black"
                  value={ticket.category || "general"}
                  onChange={(e) => updateTicketField("category", e.target.value)}
                >
                  <option value="general">Generale</option>
                  <option value="it">IT</option>
                  <option value="hr">HR</option>
                  <option value="admin">Amministrazione</option>
                  <option value="bug">Bug</option>
                </select>
              </label>
  
              <label className="mt-3 block">
                Priorità:
                <select
                  className="mt-1 w-full rounded border p-2 text-black"
                  value={ticket.priority || "medium"}
                  onChange={(e) => updateTicketField("priority", e.target.value)}
                >
                  <option value="low">Bassa</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
  
                <span
                  className={`mt-2 inline-block rounded px-2 py-1 text-xs font-bold ${
                    ticket.priority === "low"
                      ? "bg-green-100 text-green-700"
                      : ticket.priority === "medium"
                      ? "bg-blue-100 text-blue-700"
                      : ticket.priority === "high"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {ticket.priority}
                </span>
              </label>

              <div className="mt-3 rounded border bg-white p-2">
                <p className="text-xs font-bold text-gray-700">SLA</p>
                {!ticket.sla_policy_id ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Nessuna policy SLA associata a questo ticket.
                    {role === "team_leader"
                      ? " Seleziona una policy qui sotto."
                      : " Avvisa un team leader per associare una policy."}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-green-700">
                    Policy SLA associata (ID: {ticket.sla_policy_id})
                  </p>
                )}

                {ticket.sla_due_at && (
                  <p className="mt-1 text-xs text-gray-600">
                    Scadenza SLA: {new Date(ticket.sla_due_at).toLocaleString("it-IT")}
                  </p>
                )}

                {role === "team_leader" && (
                  <label className="mt-2 block text-xs text-gray-700">
                    Associa policy SLA
                    <select
                      className="mt-1 w-full rounded border p-2 text-black"
                      value={ticket.sla_policy_id ? String(ticket.sla_policy_id) : ""}
                      onChange={(e) => assignSlaPolicy(e.target.value)}
                    >
                      <option value="">Nessuna policy</option>
                      {slaPolicies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy.name} ({policy.sla_hours}h)
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
  
              <p className="mt-3">
                Aperto il:{" "}
                {ticket.created_at
                  ? new Date(ticket.created_at).toLocaleString("it-IT")
                  : "N/D"}
              </p>
            </div>
  
            {role === "team_leader" && ticket.status !== "closed" && (
              <div className="rounded border bg-gray-50 p-3">
                <h2 className="mb-2 font-bold text-black">Assegnazione</h2>
  
                <select
                  className="w-full rounded border p-2 text-black"
                  value={ticket.assigned_to ?? ""}
                  onChange={(e) => assignTicket(e.target.value)}
                >
                  <option value="">Non assegnato</option>
  
                  {assignableUsers.map((person: any) => (
                    <option key={person.id} value={person.id}>
                      {person.display_name} ({person.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(role === "operator" || role === "team_leader") && ticket.status !== "closed" && (
              <div className="rounded border bg-gray-50 p-3">
                <h2 className="mb-2 font-bold text-black">Passaggio di consegne</h2>

                <textarea
                  className="mb-2 w-full rounded border p-2 text-black"
                  placeholder="Nota per il collega..."
                  value={handoffNote}
                  onChange={(e) => setHandoffNote(e.target.value)}
                />

                <select
                  className="mb-2 w-full rounded border p-2 text-black"
                  defaultValue=""
                  onChange={(e) => handoffTicket(e.target.value)}
                >
                  <option value="">Passa a...</option>

                  {assignableUsers.map((person: any) => (
                    <option key={person.id} value={person.id}>
                      {person.display_name} ({person.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
  
            <div className="rounded border bg-gray-50 p-3">
              <h2 className="mb-2 font-bold text-black">Azioni</h2>
  
              <div className="flex flex-wrap gap-2">
                {ticket.status === "assigned" &&
                  (role === "operator" || role === "team_leader") && (
                  <button
                    onClick={startTicket}
                    className="rounded bg-blue-600 px-3 py-1 text-white"
                  >
                    Prendi in carico
                  </button>
                )}
  
                {ticket.status === "in_progress" && (
                  <button
                    onClick={pauseTicket}
                    className="rounded bg-yellow-600 px-3 py-1 text-white"
                  >
                    Metti in attesa
                  </button>
                )}
  
                {ticket.status === "waiting" && (
                  <button
                    onClick={startTicket}
                    className="rounded bg-blue-600 px-3 py-1 text-white"
                  >
                    Riprendi
                  </button>
                )}
  
                {ticket.status !== "closed" && (
                  <button
                    onClick={closeTicket}
                    className="rounded bg-gray-800 px-3 py-1 text-white"
                  >
                    Chiudi ticket
                  </button>
                )}
  
                {ticket.status === "closed" && (
                  <button
                    onClick={reopenTicket}
                    className="rounded bg-gray-600 px-3 py-1 text-white"
                  >
                    Riapri ticket
                  </button>
                )}
              </div>
            </div>

            <div className="rounded border bg-gray-50 p-3">
                <h2 className="mb-2 font-bold text-black">Storico attività</h2>

                {events.length === 0 && (
                    <p className="text-sm text-gray-500">Nessun evento</p>
                )}

                <div className="space-y-2">
                    {events.map((event) => (
                    <div key={event.id} className="border-l-2 border-gray-300 pl-3 text-sm">
                        <p className="font-bold text-black">{event.description}</p>
                        <p className="text-xs text-gray-500">
                        {new Date(event.created_at).toLocaleString("it-IT")}
                        </p>
                    </div>
                    ))}
                </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}