"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [tickets, setTickets] = useState<any[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [showNotifications, setShowNotifications] = useState(false);
  const [handoffNote, setHandoffNote] = useState("");
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAssignableUsers();

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        loadTickets(data.user);
        loadNotifications(data.user);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadTickets(session.user);
        loadNotifications(session.user);
      } else {
        setUser(null);
        setTickets([]);
        setRole("");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
  
    document.addEventListener("mousedown", handleClickOutside);
  
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });
    alert(error ? error.message : "Controlla la mail per confermare");
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    alert(error ? error.message : "Login effettuato!");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function loadAssignableUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, role")
      .in("role", ["operator", "team_leader"]);

    setAssignableUsers(data ?? []);
  }

  async function loadTickets(currentUser: any) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (!profile) {
      alert("Profilo non trovato");
      return;
    }

    setRole(profile.role);

    let query = supabase.from("tickets").select("*");

    if (profile.role === "user") {
      query = query.eq("requester_id", currentUser.id);
    }

    if (profile.role === "operator") {
      query = query.or(`assigned_to.eq.${currentUser.id},created_by.eq.${currentUser.id}`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) alert(error.message);
    else setTickets(data ?? []);
  }

  async function loadNotifications(currentUser: any) {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("read", false)
      .order("created_at", { ascending: false });
  
    setNotifications(data ?? []);
  }

  async function markAsRead(notificationId: string, ticketId: string) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);
  
    window.location.href = `/ticket/${ticketId}`;
  }

  async function createTicket() {
    if (!user) return;

    const { error } = await supabase.from("tickets").insert([
      {
        title,
        description,
        category,
        priority,
        created_by: user.id,
        requester_id: user.id,
      },
    ]);

    if (error) {
      alert(error.message);
    } else {
      setTitle("");
      setDescription("");
      loadTickets(user);
    }
  }

  async function closeTicket(id: string) {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "closed" })
      .eq("id", id);

    if (error) alert(error.message);
    else if (user) loadTickets(user);
  }

  async function reopenTicket(id: string) {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "open" })
      .eq("id", id);
  
    if (error) {
      alert(error.message);
    } else if (user) {
      loadTickets(user);
    }
  }

  async function startTicket(id: string) {
    if (!user) return;
  
    // 1. metti eventuali ticket già in_progress in waiting
    await supabase
      .from("tickets")
      .update({ status: "waiting" })
      .eq("assigned_to", user.id)
      .eq("status", "in_progress");
  
    // 2. prendi in carico il nuovo ticket
    const updateData =
      role === "team_leader"
        ? { status: "in_progress", assigned_to: user.id }
        : { status: "in_progress" };
  
    const { error } = await supabase
      .from("tickets")
      .update(updateData)
      .eq("id", id);
  
    if (error) {
      alert(error.message);
    } else {
      loadTickets(user);
    }
  }

  async function pauseTicket(id: string) {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "waiting" })
      .eq("id", id);
  
    if (error) {
      alert(error.message);
    } else if (user) {
      loadTickets(user);
    }
  }

  async function assignTicket(ticketId: string, assigneeId: string) {
    const { error } = await supabase
      .from("tickets")
      .update({
        assigned_to: assigneeId || null,
        status: assigneeId ? "assigned" : "open",
      })
      .eq("id", ticketId);

    if (error) alert(error.message);
    else if (user) loadTickets(user);
  }

  const myAssignedTickets = tickets.filter(
    (ticket) => ticket.assigned_to === user?.id && ticket.status === "assigned"
  );
  
  const myInProgressTickets = tickets.filter(
    (ticket) => ticket.assigned_to === user?.id && ticket.status === "in_progress"
  );
  
  const myRequesterOpenTickets = tickets.filter(
    (ticket) => ticket.requester_id === user?.id && ticket.status !== "closed"
  );
  
  const myWaitingTickets = tickets.filter(
    (ticket) => ticket.assigned_to === user?.id && ticket.status === "waiting"
  );

  const filteredTickets = tickets.filter((t) => {
    const matchCategory =
      filterCategory === "all" || t.category === filterCategory;
  
    const matchPriority =
      filterPriority === "all" || t.priority === filterPriority;
  
    return matchCategory && matchPriority;
  });
  
  const assignedTickets = filteredTickets.filter(
    (t) => t.status === "assigned"
  );
  
  const inProgressTickets = filteredTickets.filter(
    (t) => t.status === "in_progress"
  );
  
  const waitingTickets = filteredTickets.filter(
    (t) => t.status === "waiting"
  );
  
  const unassignedTickets = filteredTickets.filter(
    (t) => !t.assigned_to && t.status !== "closed"
  );

  const assigneeEmailById = new Map(
    assignableUsers.map((person) => [person.id, person.email])
  );

  if (user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow">
        <div className="sticky top-0 z-20 mb-6 rounded border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">Dashboard Ticketing</h1>
              <p className="text-black">Benvenuto {user.email}</p>
              <p className="text-sm text-gray-600">Ruolo: {role}</p>
            </div>

            <div className="mb-6 flex items-center justify-between">
            <div />

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="rounded border bg-white px-4 py-2 text-black shadow-sm"
              >
                🔔 {notifications.length}
              </button>

              {showNotifications && (
                <div className="absolute right-0 z-10 mt-2 w-80 rounded border bg-white p-3 shadow">
                  <h2 className="mb-2 font-bold text-black">Notifiche</h2>

                  {notifications.length === 0 && (
                    <p className="text-sm text-gray-500">Nessuna notifica</p>
                  )}

                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="mb-2 cursor-pointer rounded bg-gray-50 p-3 text-sm text-black hover:bg-gray-100"
                      onClick={() => markAsRead(notification.id, notification.ticket_id)}
                    >
                      <p>{notification.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(notification.created_at).toLocaleString("it-IT")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          </div>
        </div>

          

          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="rounded bg-black px-4 py-2 text-white"
            >
              {showCreateForm ? "Chiudi form" : "+ Nuovo ticket"}
            </button>
          </div>

          {showCreateForm && (
            <div className="mb-6 rounded border p-4">
              <h2 className="mb-4 text-xl font-bold text-black">Crea ticket</h2>

              <input
                className="mb-3 w-full rounded border p-2 text-black"
                placeholder="Titolo ticket"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <textarea
                className="mb-3 w-full rounded border p-2 text-black"
                placeholder="Descrizione"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <select
                className="mb-3 w-full rounded border p-2 text-black"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="general">Generale</option>
                <option value="it">IT</option>
                <option value="hr">HR</option>
                <option value="admin">Amministrazione</option>
                <option value="bug">Bug</option>
              </select>

              <select
                className="mb-3 w-full rounded border p-2 text-black"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Bassa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>

              <button
                onClick={createTicket}
                className="rounded bg-black px-4 py-2 text-white"
              >
                Crea ticket
              </button>
            </div>
          )}

          {selectedTicket && (
            <div className="mt-6 rounded border p-4 bg-gray-50">
              <h2 className="text-xl font-bold text-black mb-2">
                Dettaglio ticket
              </h2>

              <p className="font-bold text-black">{selectedTicket.title}</p>
              <p className="text-black mb-2">{selectedTicket.description}</p>

              <p className="text-sm text-gray-600">
                Stato: {selectedTicket.status}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedTicket.status === "assigned" && (
                  <button
                    onClick={() => startTicket(selectedTicket.id)}
                    className="rounded bg-blue-600 px-3 py-1 text-white"
                  >
                    Prendi in carico
                  </button>
                )}

                {selectedTicket.status === "in_progress" && (
                  <button
                    onClick={() => pauseTicket(selectedTicket.id)}
                    className="rounded bg-yellow-600 px-3 py-1 text-white"
                  >
                    Metti in attesa
                  </button>
                )}

                {selectedTicket.status === "waiting" && (
                  <button
                    onClick={() => startTicket(selectedTicket.id)}
                    className="rounded bg-blue-600 px-3 py-1 text-white"
                  >
                    Riprendi
                  </button>
                )}

                {selectedTicket.status !== "closed" && (
                  <button
                    onClick={() => closeTicket(selectedTicket.id)}
                    className="rounded bg-gray-800 px-3 py-1 text-white"
                  >
                    Chiudi ticket
                  </button>
                )}

                {selectedTicket.status === "closed" && (
                  <button
                    onClick={() => reopenTicket(selectedTicket.id)}
                    className="rounded bg-gray-600 px-3 py-1 text-white"
                  >
                    Riapri ticket
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="mt-3 rounded bg-gray-800 px-3 py-1 text-white"
              >
                Chiudi scheda
              </button>
            </div>
          )}

          <div className="mb-6 flex gap-4">
            <select
              className="rounded border p-2 text-black"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">Tutte le categorie</option>
              <option value="general">Generale</option>
              <option value="it">IT</option>
              <option value="hr">HR</option>
              <option value="admin">Amministrazione</option>
              <option value="bug">Bug</option>
            </select>

            <select
              className="rounded border p-2 text-black"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">Tutte le priorità</option>
              <option value="low">Bassa</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

        <div className="mb-6 space-y-6">
            <div>
            <h2 className="mb-2 font-bold text-black">
              🟦 Da fare ({assignedTickets.length})
            </h2>
              <div className="space-y-2">
                {assignedTickets.length === 0 && (
                  <p className="text-sm text-gray-500">Nessun ticket</p>
                )}

                {assignedTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    showAssignee={role === "team_leader"}
                    assigneeEmail={
                      ticket.assigned_to
                        ? assigneeEmailById.get(ticket.assigned_to)
                        : null
                    }
                  />
                ))}
              </div>
            </div>

            <div>
            <h2 className="mb-2 font-bold text-black">
              🟩 In lavorazione ({inProgressTickets.length})
            </h2>
              <div className="space-y-2">
                {inProgressTickets.length === 0 && (
                  <p className="text-sm text-gray-500">Nessun ticket</p>
                )}

                {inProgressTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    showAssignee={role === "team_leader"}
                    assigneeEmail={
                      ticket.assigned_to
                        ? assigneeEmailById.get(ticket.assigned_to)
                        : null
                    }
                  />
                ))}
              </div>
            </div>

            <div>
            <h2 className="mb-2 font-bold text-black">
              🟨 In attesa ({waitingTickets.length})
            </h2>
              <div className="space-y-2">
                {waitingTickets.length === 0 && (
                  <p className="text-sm text-gray-500">Nessun ticket</p>
                )}

                {waitingTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    showAssignee={role === "team_leader"}
                    assigneeEmail={
                      ticket.assigned_to
                        ? assigneeEmailById.get(ticket.assigned_to)
                        : null
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 font-bold text-black">
                ⚪ Non assegnati ({unassignedTickets.length})
              </h2>

              <div className="space-y-2">
                {unassignedTickets.length === 0 && (
                  <p className="text-sm text-gray-500">Nessun ticket</p>
                )}

                {unassignedTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    showAssignee={role === "team_leader"}
                    assigneeEmail={
                      ticket.assigned_to
                        ? assigneeEmailById.get(ticket.assigned_to)
                        : null
                    }
                  />
                ))}
              </div>
            </div>

          </div>

                    
          <button onClick={logout} className="rounded bg-black px-4 py-2 text-white">
            Logout
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow">
        <h1 className="mb-6 text-2xl font-bold text-black">Login Ticketing</h1>

        <input
          className="mb-3 w-full rounded border p-2 text-black"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="mb-4 w-full rounded border p-2 text-black"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={signIn} className="mb-3 w-full rounded bg-black p-2 text-white">
          Accedi
        </button>

        <button onClick={signUp} className="w-full rounded border p-2 text-black">
          Registrati
        </button>
      </div>
    </main>
  );
}

function TicketCard({ ticket, showAssignee, assigneeEmail }: any) {
  return (
    <div
      className="cursor-pointer rounded border bg-white p-3 shadow-sm hover:bg-gray-50"
      onClick={() => (window.location.href = `/ticket/${ticket.id}`)}
    >
      <p className="font-bold text-black">{ticket.title}</p>

      <p className="truncate text-sm text-gray-600">
        {ticket.description}
      </p>

      {showAssignee && (
        <p className="mt-1 text-xs text-gray-600">
          Assegnato a: {assigneeEmail || "Nessuno"}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`rounded px-2 py-1 text-xs font-bold ${
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

        <span className="text-xs text-gray-400">
          {ticket.category}
        </span>
      </div>
    </div>
  );
}