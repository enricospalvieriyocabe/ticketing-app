"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

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
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [commentAuthorsById, setCommentAuthorsById] = useState<Record<string, string>>({});

  const [events, setEvents] = useState<any[]>([]);
  const [handoffNote, setHandoffNote] = useState("");

  useEffect(() => {
    loadUser();
    loadTicket();
    loadAssignableUsers();
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

  async function addComment() {
    if (!user || !newComment.trim()) return;
  
    const { error } = await supabase.from("ticket_comments").insert([
      {
        ticket_id: id,
        user_id: user.id,
        body: newComment,
      },
    ]);
  
    if (error) {
      alert(error.message);
    } else {
      const mentionedEmails = extractMentionedEmails(newComment);
    
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
    
      setNewComment("");
      loadComments();
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

  async function updateTicketField(field: string, value: string) {
    await supabase
      .from("tickets")
      .update({ [field]: value })
      .eq("id", id);
  
    loadTicket();
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

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow">
        <button
          onClick={() => router.push("/")}
          className="mb-4 text-sm text-blue-600"
        >
          ← Torna alla dashboard
        </button>
  
        <h1 className="text-2xl font-bold text-black">{ticket.title}</h1>
  
        <div className="mt-6 grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="rounded border bg-white p-4">
              <h2 className="mb-2 text-lg font-bold text-black">Descrizione</h2>
              <p className="text-black">{ticket.description}</p>
            </div>
  
            <div className="mt-6">
              <h2 className="mb-2 text-lg font-bold text-black">Commenti</h2>
  
              <div className="space-y-2">
              {comments.map((c) => {
                const isMine = c.user_id === user?.id;
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

                      <p className="text-xs text-gray-500">
                        {new Date(c.created_at).toLocaleString("it-IT")}
                      </p>
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
                        <p className="text-black">
                          {renderCommentWithMentions(c.body)}
                        </p>

                        {wasEdited && (
                          <p className="mt-1 text-xs text-gray-500">
                            (modificato il {new Date(c.updated_at).toLocaleString("it-IT")})
                          </p>
                        )}

                        {isMine && (
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
  
            <div className="mt-4">
            <textarea
              className="w-full rounded border p-2 text-black"
              placeholder="Scrivi un commento..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addComment();
                }
              }}
            />
  
              <button
                onClick={addComment}
                className="mt-2 rounded bg-black px-4 py-2 text-white"
              >
                Aggiungi commento
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