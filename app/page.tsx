"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

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
  const [kpiStartDate, setKpiStartDate] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return start.toISOString().slice(0, 10);
  });
  const [kpiEndDate, setKpiEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [slaHours, setSlaHours] = useState("24");
  const [operatorPerformance, setOperatorPerformance] = useState<any[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [profileNameById, setProfileNameById] = useState<Record<string, string>>({});
  const [closedInfoByTicketId, setClosedInfoByTicketId] = useState<
    Record<string, { closedByName: string; closedAt: string }>
  >({});
  const [autoReplyTemplates, setAutoReplyTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateEditorTitle, setTemplateEditorTitle] = useState("");
  const [templateEditorBody, setTemplateEditorBody] = useState("");
  const [templateEditorEnabled, setTemplateEditorEnabled] = useState(true);
  const [autoReplyTemplateLoading, setAutoReplyTemplateLoading] = useState(false);
  const [autoReplyTemplateSaving, setAutoReplyTemplateSaving] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showOnlyCriticalUrgent, setShowOnlyCriticalUrgent] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    in_progress: false,
    assigned: false,
    waiting: false,
    unassigned: false,
    closed: false,
  });
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAssignableUsers();

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        loadTickets(data.user);
        loadNotifications(data.user);
      } else {
        setUser(null);
        setTickets([]);
        setRole("");
      }
      setAuthLoading(false);
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
      setAuthLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (role === "team_leader") {
      loadOperatorPerformance();
      loadAutoReplyTemplates();
    } else {
      setOperatorPerformance([]);
    }
  }, [role, tickets, assignableUsers, kpiStartDate, kpiEndDate, slaHours]);

  useEffect(() => {
    loadTicketListMetadata();
  }, [tickets]);

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
    const first = firstName.trim();
    const last = lastName.trim();
    const full = `${first} ${last}`.trim();

    if (!first || !last) {
      alert("Inserisci nome e cognome");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: first,
          last_name: last,
          full_name: full,
        },
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (data.user?.id) {
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email,
          first_name: first,
          last_name: last,
          full_name: full,
        },
        { onConflict: "id" }
      );
    }

    setFirstName("");
    setLastName("");
    alert("Controlla la mail per confermare");
  }

  async function signIn() {
    if (!email.trim() || !password.trim()) {
      alert("Inserisci email e password");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message = error.message.toLowerCase();
      if (
        message.includes("invalid login credentials") ||
        message.includes("invalid") ||
        message.includes("credenzial")
      ) {
        alert("Credenziali non valide. Controlla email e password.");
      } else {
        alert(error.message);
      }
      return;
    }

    alert("Login effettuato!");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function loadAssignableUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["operator", "team_leader"]);

    setAssignableUsers(data ?? []);
  }

  function getProfileDisplayName(profile: any) {
    if (!profile) return "Utente";
    const fullName = String(profile.full_name ?? "").trim();
    const composedName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    const genericName = String(profile.name ?? "").trim();
    return fullName || composedName || genericName || profile.email || "Utente";
  }

  async function loadTickets(currentUser: any) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (!profile) {
      alert("Profilo non trovato");
      return;
    }

    setRole(profile.role);
    setCurrentProfile(profile);

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

  async function loadTicketListMetadata() {
    if (tickets.length === 0) {
      setProfileNameById({});
      setClosedInfoByTicketId({});
      return;
    }

    const baseUserIds = tickets
      .flatMap((ticket) => [ticket.requester_id, ticket.created_by, ticket.assigned_to])
      .filter((id) => Boolean(id));
    const closedTicketIds = tickets
      .filter((ticket) => ticket.status === "closed")
      .map((ticket) => ticket.id);

    let closerEvents: any[] = [];
    if (closedTicketIds.length > 0) {
      const { data } = await supabase
        .from("ticket_events")
        .select("ticket_id, user_id, created_at")
        .in("ticket_id", closedTicketIds)
        .eq("type", "closed")
        .order("created_at", { ascending: false });
      closerEvents = data ?? [];
    }

    const allUserIds = Array.from(
      new Set([...baseUserIds, ...closerEvents.map((event) => event.user_id)].filter(Boolean))
    );
    if (allUserIds.length === 0) return;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", allUserIds);

    const names: Record<string, string> = {};
    for (const profile of profiles ?? []) {
      names[profile.id] = getProfileDisplayName(profile);
    }
    setProfileNameById(names);

    const closedMap: Record<string, { closedByName: string; closedAt: string }> = {};
    for (const event of closerEvents) {
      if (!closedMap[event.ticket_id]) {
        closedMap[event.ticket_id] = {
          closedByName: names[event.user_id] || "N/D",
          closedAt: event.created_at,
        };
      }
    }
    setClosedInfoByTicketId(closedMap);
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

    const { data, error } = await supabase
      .from("tickets")
      .insert([
        {
          title,
          description,
          category,
          priority,
          created_by: user.id,
          requester_id: user.id,
        },
      ])
      .select("id, created_at, requester_id")
      .single();

    if (error) {
      alert(error.message);
    } else {
      if (data?.id && data?.requester_id && data?.created_at) {
        await sendAutoReplyIfNeeded(data.id, data.requester_id, data.created_at);
      }
      setTitle("");
      setDescription("");
      loadTickets(user);
    }
  }

  async function addTicketEvent(ticketId: string, type: string, description: string) {
    if (!user) return;

    await supabase.from("ticket_events").insert([
      {
        ticket_id: ticketId,
        user_id: user.id,
        type,
        description,
      },
    ]);
  }

  async function closeTicket(id: string) {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "closed" })
      .eq("id", id);

    if (error) alert(error.message);
    else if (user) {
      await addTicketEvent(id, "closed", "Ticket chiuso");
      loadTickets(user);
    }
  }

  async function reopenTicket(id: string) {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "open" })
      .eq("id", id);
  
    if (error) {
      alert(error.message);
    } else if (user) {
      await addTicketEvent(id, "reopened", "Ticket riaperto");
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
      await addTicketEvent(id, "in_progress", "Ticket preso in carico");
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
      await addTicketEvent(id, "waiting", "Ticket messo in attesa");
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
    else if (user) {
      const assignee = assignableUsers.find((person) => person.id === assigneeId);
      const description = assignee
        ? `Ticket assegnato a ${getProfileDisplayName(assignee)}`
        : "Assegnazione rimossa";

      await addTicketEvent(ticketId, "assigned", description);
      loadTickets(user);
    }
  }

  function toDateOrNull(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function hoursBetween(start: Date, end: Date) {
    return (end.getTime() - start.getTime()) / 3600000;
  }

  function formatHours(hours: number | null) {
    if (hours === null || Number.isNaN(hours)) return "-";
    return `${hours.toFixed(1)}h`;
  }

  function getSlaRiskLabel(breachRate: number) {
    if (breachRate >= 0.3) return "Alto";
    if (breachRate >= 0.15) return "Medio";
    return "Basso";
  }

  function getSlaRiskClass(riskLabel: string) {
    if (riskLabel === "Alto") return "bg-red-100 text-red-700";
    if (riskLabel === "Medio") return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  }

  function getUrgentRiskClass(progress: number) {
    if (progress >= 1) return "bg-red-100 text-red-700";
    if (progress >= 0.8) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  }

  function getUrgentRiskLabel(progress: number) {
    if (progress >= 1) return "Fuori SLA";
    if (progress >= 0.8) return "A rischio";
    return "Sotto controllo";
  }

  function getEuropeRomeParts(date: Date) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      weekday: "short",
      hour: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const weekday = parts.find((part) => part.type === "weekday")?.value?.toLowerCase() ?? "";
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    return { weekday, hour };
  }

  function shouldSendAutoReplyForDate(date: Date) {
    const { weekday, hour } = getEuropeRomeParts(date);
    const isWeekendWindow =
      weekday === "sat" ||
      weekday === "sun" ||
      (weekday === "fri" && hour >= 18) ||
      (weekday === "mon" && hour < 9);

    const isWeekdayNightWindow =
      ["mon", "tue", "wed", "thu", "fri"].includes(weekday) &&
      (hour < 9 || hour >= 18);

    return isWeekendWindow || isWeekdayNightWindow;
  }

  async function loadAutoReplyTemplates() {
    setAutoReplyTemplateLoading(true);
    const { data, error } = await supabase
      .from("ticket_auto_reply_templates")
      .select("id, title, template_body, is_enabled, updated_at")
      .order("id", { ascending: true });

    if (!error) {
      const templates = data ?? [];
      setAutoReplyTemplates(templates);

      if (templates.length > 0) {
        const firstTemplate = templates[0];
        setSelectedTemplateId(firstTemplate.id);
        setTemplateEditorTitle(firstTemplate.title ?? "");
        setTemplateEditorBody(firstTemplate.template_body ?? "");
        setTemplateEditorEnabled(Boolean(firstTemplate.is_enabled));
      } else {
        setSelectedTemplateId(1);
        setTemplateEditorTitle("");
        setTemplateEditorBody("");
        setTemplateEditorEnabled(true);
      }
    }

    setAutoReplyTemplateLoading(false);
  }

  function selectTemplateForEditing(templateId: number) {
    const template = autoReplyTemplates.find((item) => item.id === templateId);
    if (!template) return;

    setSelectedTemplateId(template.id);
    setTemplateEditorTitle(template.title ?? "");
    setTemplateEditorBody(template.template_body ?? "");
    setTemplateEditorEnabled(Boolean(template.is_enabled));
  }

  function createNewTemplateDraft() {
    const maxId = autoReplyTemplates.reduce(
      (acc, item) => (item.id > acc ? item.id : acc),
      0
    );
    setSelectedTemplateId(maxId + 1);
    setTemplateEditorTitle("");
    setTemplateEditorBody("");
    setTemplateEditorEnabled(true);
  }

  async function saveAutoReplyTemplate() {
    if (role !== "team_leader") return;

    let templateId = selectedTemplateId;
    if (!templateId) {
      const maxId = autoReplyTemplates.reduce(
        (acc, item) => (item.id > acc ? item.id : acc),
        0
      );
      templateId = maxId + 1;
      setSelectedTemplateId(templateId);
    }

    setAutoReplyTemplateSaving(true);
    const { error } = await supabase
      .from("ticket_auto_reply_templates")
      .upsert(
        {
          id: templateId,
          title: templateEditorTitle.trim() || `Template #${templateId}`,
          template_body: templateEditorBody.trim(),
          is_enabled: templateEditorEnabled,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    setAutoReplyTemplateSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    await loadAutoReplyTemplates();
    alert("Template salvato");
  }

  async function sendAutoReplyIfNeeded(ticketId: string, requesterId: string, createdAt: string) {
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) return;
    if (!shouldSendAutoReplyForDate(createdDate)) return;

    const { data: templateData, error: templateError } = await supabase
      .from("ticket_auto_reply_templates")
      .select("id, title, template_body, is_enabled, updated_at")
      .eq("is_enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (templateError || !templateData) return;

    const message = String(templateData.template_body ?? "").trim();
    if (!message) return;

    await supabase.from("notifications").insert([
      {
        user_id: requesterId,
        ticket_id: ticketId,
        type: "info",
        message,
      },
    ]);

    if (user?.id) {
      await supabase.from("ticket_events").insert([
        {
          ticket_id: ticketId,
          user_id: user.id,
          type: "auto_reply",
          description: "Inviata risposta automatica fuori orario",
        },
      ]);
    }
  }

  async function loadOperatorPerformance() {
    if (role !== "team_leader") return;

    const start = toDateOrNull(`${kpiStartDate}T00:00:00`);
    const end = toDateOrNull(`${kpiEndDate}T23:59:59`);
    const slaThreshold = Number(slaHours);

    if (!start || !end || start > end || Number.isNaN(slaThreshold)) {
      setOperatorPerformance([]);
      return;
    }

    setKpiLoading(true);

    const ticketIds = tickets.map((ticket) => ticket.id);
    let events: any[] = [];

    if (ticketIds.length > 0) {
      const { data: eventsData, error: eventsError } = await supabase
        .from("ticket_events")
        .select("ticket_id, type, created_at")
        .in("ticket_id", ticketIds);

      if (eventsError) {
        alert(eventsError.message);
      } else {
        events = eventsData ?? [];
      }
    }

    const eventsByTicketId = new Map<string, any[]>();
    for (const event of events) {
      const list = eventsByTicketId.get(event.ticket_id) ?? [];
      list.push(event);
      eventsByTicketId.set(event.ticket_id, list);
    }

    const operators = assignableUsers.filter((person) => person.role === "operator");
    const perOperator = new Map(
      operators.map((operator) => [
        operator.id,
        {
          operatorId: operator.id,
          operatorName: getProfileDisplayName(operator),
          closedCount: 0,
          inProgressCount: 0,
          firstTakeSamples: [] as number[],
          resolutionSamples: [] as number[],
          slaBreaches: 0,
        },
      ])
    );

    for (const ticket of tickets) {
      const assigneeId = ticket.assigned_to;
      if (!assigneeId || !perOperator.has(assigneeId)) continue;

      const bucket = perOperator.get(assigneeId);
      if (!bucket) continue;

      if (ticket.status === "in_progress") {
        bucket.inProgressCount += 1;
      }

      const createdAt = toDateOrNull(ticket.created_at);
      if (!createdAt) continue;

      const ticketEvents = (eventsByTicketId.get(ticket.id) ?? [])
        .map((event) => ({ ...event, parsedAt: toDateOrNull(event.created_at) }))
        .filter((event) => event.parsedAt !== null);

      const inProgressEvents = ticketEvents
        .filter((event) => event.type === "in_progress")
        .sort((a, b) => a.parsedAt.getTime() - b.parsedAt.getTime());
      const firstInProgress = inProgressEvents[0]?.parsedAt ?? null;

      if (
        firstInProgress &&
        firstInProgress >= start &&
        firstInProgress <= end
      ) {
        const firstTakeHours = hoursBetween(createdAt, firstInProgress);
        if (firstTakeHours >= 0) {
          bucket.firstTakeSamples.push(firstTakeHours);
        }
      }

      const closedEvents = ticketEvents
        .filter((event) => event.type === "closed")
        .sort((a, b) => b.parsedAt.getTime() - a.parsedAt.getTime());

      const closedAt = closedEvents[0]?.parsedAt ?? toDateOrNull(ticket.closed_at);
      if (!closedAt) continue;
      if (closedAt < start || closedAt > end) continue;

      bucket.closedCount += 1;

      const resolutionHours = hoursBetween(createdAt, closedAt);
      if (resolutionHours >= 0) {
        bucket.resolutionSamples.push(resolutionHours);
        if (resolutionHours > slaThreshold) {
          bucket.slaBreaches += 1;
        }
      }
    }

    const performanceRows = Array.from(perOperator.values()).map((item) => {
      const avgResolution =
        item.resolutionSamples.length > 0
          ? item.resolutionSamples.reduce((acc, value) => acc + value, 0) /
            item.resolutionSamples.length
          : null;

      const avgFirstTake =
        item.firstTakeSamples.length > 0
          ? item.firstTakeSamples.reduce((acc, value) => acc + value, 0) /
            item.firstTakeSamples.length
          : null;

      return {
        ...item,
        avgResolution,
        avgFirstTake,
        breachRate:
          item.closedCount > 0 ? item.slaBreaches / item.closedCount : 0,
      };
    });

    setOperatorPerformance(
      performanceRows.sort((a, b) => b.closedCount - a.closedCount)
    );
    setKpiLoading(false);
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
  
  const closedTickets = filteredTickets.filter(
    (t) => t.status === "closed"
  );

  const nowMs = Date.now();
  const globalSlaHours = Number(slaHours);
  const atRiskTicketsCount = filteredTickets.filter((ticket) => {
    if (ticket.status === "closed") return false;
    const createdAtMs = new Date(ticket.created_at ?? "").getTime();
    if (Number.isNaN(createdAtMs) || Number.isNaN(globalSlaHours)) return false;
    return (nowMs - createdAtMs) / 3600000 >= globalSlaHours;
  }).length;

  const avgResolutionTeam =
    operatorPerformance.length > 0
      ? operatorPerformance
          .filter((row) => row.avgResolution !== null)
          .reduce((acc, row) => acc + row.avgResolution, 0) /
        Math.max(
          operatorPerformance.filter((row) => row.avgResolution !== null).length,
          1
        )
      : null;

  const highRiskOperators = operatorPerformance.filter(
    (row) => getSlaRiskLabel(row.breachRate ?? 0) === "Alto"
  ).length;
  const urgentTickets = filteredTickets
    .filter((ticket) => ticket.status !== "closed")
    .map((ticket) => {
      const createdAtMs = new Date(ticket.created_at ?? "").getTime();
      const ageHours = Number.isNaN(createdAtMs) ? 0 : (nowMs - createdAtMs) / 3600000;
      const slaProgress =
        Number.isNaN(globalSlaHours) || globalSlaHours <= 0 ? 0 : ageHours / globalSlaHours;

      return {
        ...ticket,
        ageHours,
        slaProgress,
      };
    })
    .sort((a, b) => {
      const slaRankA = a.slaProgress >= 1 ? 2 : a.slaProgress >= 0.8 ? 1 : 0;
      const slaRankB = b.slaProgress >= 1 ? 2 : b.slaProgress >= 0.8 ? 1 : 0;
      if (slaRankA !== slaRankB) return slaRankB - slaRankA;

      const priorityWeight: Record<string, number> = {
        urgent: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      const priorityA = priorityWeight[a.priority ?? "low"] ?? 0;
      const priorityB = priorityWeight[b.priority ?? "low"] ?? 0;
      if (priorityA !== priorityB) return priorityB - priorityA;

      return b.slaProgress - a.slaProgress;
    })
    .slice(0, 5);
  const urgentTicketsToShow = showOnlyCriticalUrgent
    ? urgentTickets.filter((ticket) => ticket.slaProgress >= 0.8)
    : urgentTickets;

  function toggleSection(sectionKey: string) {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }

  function getOpenedByName(ticket: any) {
    return (
      profileNameById[ticket.requester_id] ||
      profileNameById[ticket.created_by] ||
      "N/D"
    );
  }

  const assigneeNameById = new Map(
    assignableUsers.map((person) => [person.id, getProfileDisplayName(person)])
  );

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-600">Caricamento sessione...</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow">
        <div className="sticky top-0 z-20 mb-6 rounded border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">Dashboard Ticketing</h1>
              <p className="text-black">Benvenuto {getProfileDisplayName(currentProfile)}</p>
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
            {role === "team_leader" && (
              <button
                onClick={() => setShowTemplateManager(!showTemplateManager)}
                className="ml-3 rounded border border-black bg-white px-4 py-2 text-black"
              >
                {showTemplateManager ? "Chiudi template" : "Gestione template"}
              </button>
            )}
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

          {role === "team_leader" && showTemplateManager && (
            <div className="mb-6 rounded border bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-black">Gestione template fuori orario</h2>
                <button
                  onClick={createNewTemplateDraft}
                  className="rounded border border-black bg-white px-3 py-1 text-sm text-black"
                >
                  + Nuovo template
                </button>
              </div>
              <p className="mb-3 text-xs text-gray-600">
                Qui puoi creare e aggiornare piu template. In automatico viene usato l'ultimo template attivo aggiornato.
              </p>

              {autoReplyTemplateLoading ? (
                <p className="text-sm text-gray-600">Caricamento template...</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded border bg-white p-2">
                    <p className="mb-2 text-xs font-bold text-gray-700">Template disponibili</p>
                    {autoReplyTemplates.length === 0 && (
                      <p className="text-xs text-gray-500">Nessun template salvato.</p>
                    )}
                    <div className="space-y-1">
                      {autoReplyTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => selectTemplateForEditing(template.id)}
                          className={`w-full rounded border px-2 py-1 text-left text-xs ${
                            selectedTemplateId === template.id
                              ? "border-black bg-gray-100 text-black"
                              : "border-gray-200 bg-white text-gray-700"
                          }`}
                        >
                          {(template.title || `Template #${template.id}`)}{" "}
                          {template.is_enabled ? "(attivo)" : "(disattivo)"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <p className="mb-2 text-xs text-gray-700">Modifica template</p>
                    <input
                      className="mb-2 w-full rounded border p-2 text-black"
                      placeholder="Titolo template (es. Weekend)"
                      value={templateEditorTitle}
                      onChange={(e) => setTemplateEditorTitle(e.target.value)}
                    />
                    <label className="mb-2 flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        checked={templateEditorEnabled}
                        onChange={(e) => setTemplateEditorEnabled(e.target.checked)}
                      />
                      Template attivo
                    </label>

                    <textarea
                      className="mb-3 w-full rounded border p-2 text-black"
                      rows={6}
                      value={templateEditorBody}
                      onChange={(e) => setTemplateEditorBody(e.target.value)}
                      placeholder="Inserisci il template della risposta automatica..."
                    />

                    <button
                      onClick={saveAutoReplyTemplate}
                    disabled={autoReplyTemplateSaving}
                      className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
                    >
                      {autoReplyTemplateSaving ? "Salvataggio..." : "Salva template"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {role === "team_leader" && (
            <div className="mb-6 rounded border bg-gray-50 p-4">
              <h2 className="mb-3 text-lg font-bold text-black">
                Dashboard performance operatori
              </h2>

              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                <div className="rounded border bg-white p-3">
                  <p className="text-xs text-gray-500">Backlog aperto</p>
                  <p className="text-xl font-bold text-black">
                    {assignedTickets.length + inProgressTickets.length + waitingTickets.length}
                  </p>
                </div>
                <div className="rounded border bg-white p-3">
                  <p className="text-xs text-gray-500">Ticket fuori soglia SLA</p>
                  <p className="text-xl font-bold text-red-700">{atRiskTicketsCount}</p>
                </div>
                <div className="rounded border bg-white p-3">
                  <p className="text-xs text-gray-500">Tempo medio risoluzione team</p>
                  <p className="text-xl font-bold text-black">{formatHours(avgResolutionTeam)}</p>
                </div>
                <div className="rounded border bg-white p-3">
                  <p className="text-xs text-gray-500">Ticket chiusi (filtro attivo)</p>
                  <p className="text-xl font-bold text-black">{closedTickets.length}</p>
                </div>
                <div className="rounded border bg-white p-3">
                  <p className="text-xs text-gray-500">Operatori a rischio alto</p>
                  <p className="text-xl font-bold text-orange-700">{highRiskOperators}</p>
                </div>
              </div>

              <div className="mb-4 rounded border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-black">Interventi urgenti</h3>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={showOnlyCriticalUrgent}
                      onChange={(e) => setShowOnlyCriticalUrgent(e.target.checked)}
                    />
                    Solo sopra 80% SLA
                  </label>
                </div>
                {urgentTicketsToShow.length === 0 ? (
                  <p className="text-xs text-gray-500">Nessun ticket urgente nel filtro attivo.</p>
                ) : (
                  <div className="space-y-2">
                    {urgentTicketsToShow.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between rounded border p-2 text-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-semibold text-black">{ticket.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${getUrgentRiskClass(
                                ticket.slaProgress
                              )}`}
                            >
                              {getUrgentRiskLabel(ticket.slaProgress)}
                            </span>
                            <p className="text-xs text-gray-600">
                              {ticket.status} - ETA SLA: {(globalSlaHours - ticket.ageHours).toFixed(1)}h
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => (window.location.href = `/ticket/${ticket.id}`)}
                          className="rounded bg-black px-3 py-1 text-xs text-white"
                        >
                          Apri
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="text-sm text-black">
                  Data inizio
                  <input
                    type="date"
                    className="mt-1 w-full rounded border p-2 text-black"
                    value={kpiStartDate}
                    onChange={(e) => setKpiStartDate(e.target.value)}
                  />
                </label>

                <label className="text-sm text-black">
                  Data fine
                  <input
                    type="date"
                    className="mt-1 w-full rounded border p-2 text-black"
                    value={kpiEndDate}
                    onChange={(e) => setKpiEndDate(e.target.value)}
                  />
                </label>

                <label className="text-sm text-black">
                  SLA globale (ore)
                  <input
                    type="number"
                    min="1"
                    className="mt-1 w-full rounded border p-2 text-black"
                    value={slaHours}
                    onChange={(e) => setSlaHours(e.target.value)}
                  />
                </label>
              </div>

              {kpiLoading && (
                <p className="mb-2 text-sm text-gray-600">Calcolo KPI in corso...</p>
              )}

              {!kpiLoading && operatorPerformance.length === 0 && (
                <p className="mb-2 text-sm text-gray-600">
                  Nessun dato disponibile per il periodo selezionato.
                </p>
              )}

              {!kpiLoading && operatorPerformance.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border text-sm text-black">
                    <thead className="bg-white">
                      <tr>
                        <th className="border px-2 py-2 text-left">Operatore</th>
                        <th className="border px-2 py-2 text-left">Chiusi</th>
                        <th className="border px-2 py-2 text-left">In lavorazione</th>
                        <th className="border px-2 py-2 text-left">Tempo medio risoluzione</th>
                        <th className="border px-2 py-2 text-left">Tempo medio presa in carico</th>
                        <th className="border px-2 py-2 text-left">Fuori SLA</th>
                        <th className="border px-2 py-2 text-left">Rischio SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operatorPerformance.map((row) => (
                        <tr key={row.operatorId} className="bg-white">
                          <td className="border px-2 py-2">{row.operatorName}</td>
                          <td className="border px-2 py-2">{row.closedCount}</td>
                          <td className="border px-2 py-2">{row.inProgressCount}</td>
                          <td className="border px-2 py-2">{formatHours(row.avgResolution)}</td>
                          <td className="border px-2 py-2">{formatHours(row.avgFirstTake)}</td>
                          <td className="border px-2 py-2">{row.slaBreaches}</td>
                          <td className="border px-2 py-2">
                            <span
                              className={`rounded px-2 py-1 text-xs font-bold ${getSlaRiskClass(
                                getSlaRiskLabel(row.breachRate ?? 0)
                              )}`}
                            >
                              {getSlaRiskLabel(row.breachRate ?? 0)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
            <button
              onClick={() => toggleSection("in_progress")}
              className="mb-2 flex w-full items-center justify-between text-left font-bold text-black"
            >
              <span>🟩 In lavorazione ({inProgressTickets.length})</span>
              <span>{collapsedSections.in_progress ? "Apri" : "Chiudi"}</span>
            </button>
              {!collapsedSections.in_progress && (
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
                        ? assigneeNameById.get(ticket.assigned_to)
                        : null
                    }
                    openedByName={getOpenedByName(ticket)}
                    closedByName={closedInfoByTicketId[ticket.id]?.closedByName}
                    closedAt={closedInfoByTicketId[ticket.id]?.closedAt}
                  />
                ))}
              </div>
              )}
            </div>

            <div>
            <button
              onClick={() => toggleSection("assigned")}
              className="mb-2 flex w-full items-center justify-between text-left font-bold text-black"
            >
              <span>🟦 Da fare ({assignedTickets.length})</span>
              <span>{collapsedSections.assigned ? "Apri" : "Chiudi"}</span>
            </button>
              {!collapsedSections.assigned && (
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
                        ? assigneeNameById.get(ticket.assigned_to)
                        : null
                    }
                    openedByName={getOpenedByName(ticket)}
                    closedByName={closedInfoByTicketId[ticket.id]?.closedByName}
                    closedAt={closedInfoByTicketId[ticket.id]?.closedAt}
                  />
                ))}
              </div>
              )}
            </div>

            <div>
            <button
              onClick={() => toggleSection("waiting")}
              className="mb-2 flex w-full items-center justify-between text-left font-bold text-black"
            >
              <span>🟨 In attesa ({waitingTickets.length})</span>
              <span>{collapsedSections.waiting ? "Apri" : "Chiudi"}</span>
            </button>
              {!collapsedSections.waiting && (
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
                        ? assigneeNameById.get(ticket.assigned_to)
                        : null
                    }
                    openedByName={getOpenedByName(ticket)}
                    closedByName={closedInfoByTicketId[ticket.id]?.closedByName}
                    closedAt={closedInfoByTicketId[ticket.id]?.closedAt}
                  />
                ))}
              </div>
              )}
            </div>

            <div>
              <button
                onClick={() => toggleSection("unassigned")}
                className="mb-2 flex w-full items-center justify-between text-left font-bold text-black"
              >
                <span>⚪ Non assegnati ({unassignedTickets.length})</span>
                <span>{collapsedSections.unassigned ? "Apri" : "Chiudi"}</span>
              </button>
              {!collapsedSections.unassigned && (
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
                        ? assigneeNameById.get(ticket.assigned_to)
                        : null
                    }
                    openedByName={getOpenedByName(ticket)}
                    closedByName={closedInfoByTicketId[ticket.id]?.closedByName}
                    closedAt={closedInfoByTicketId[ticket.id]?.closedAt}
                  />
                ))}
              </div>
              )}
            </div>

            <div>
              <button
                onClick={() => toggleSection("closed")}
                className="mb-2 flex w-full items-center justify-between text-left font-bold text-black"
              >
                <span>⚫ Chiusi ({closedTickets.length})</span>
                <span>{collapsedSections.closed ? "Apri" : "Chiudi"}</span>
              </button>
              {!collapsedSections.closed && (
              <div className="space-y-2">
                {closedTickets.length === 0 && (
                  <p className="text-sm text-gray-500">Nessun ticket</p>
                )}

                {closedTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    showAssignee={role === "team_leader"}
                    assigneeEmail={
                      ticket.assigned_to
                        ? assigneeNameById.get(ticket.assigned_to)
                        : null
                    }
                    openedByName={getOpenedByName(ticket)}
                    closedByName={closedInfoByTicketId[ticket.id]?.closedByName}
                    closedAt={closedInfoByTicketId[ticket.id]?.closedAt}
                  />
                ))}
              </div>
              )}
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
        <h1 className="mb-4 text-2xl font-bold text-black">
          {authMode === "login" ? "Login Ticketing" : "Registrazione Ticketing"}
        </h1>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setAuthMode("login")}
            className={`w-1/2 rounded border p-2 text-sm ${
              authMode === "login"
                ? "border-black bg-black text-white"
                : "border-gray-300 bg-white text-black"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setAuthMode("signup")}
            className={`w-1/2 rounded border p-2 text-sm ${
              authMode === "signup"
                ? "border-black bg-black text-white"
                : "border-gray-300 bg-white text-black"
            }`}
          >
            Registrazione
          </button>
        </div>

        {authMode === "signup" && (
          <>
            <input
              className="mb-3 w-full rounded border p-2 text-black"
              placeholder="Nome"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />

            <input
              className="mb-3 w-full rounded border p-2 text-black"
              placeholder="Cognome"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </>
        )}

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

        {authMode === "login" && (
          <button onClick={signIn} className="mb-3 w-full rounded bg-black p-2 text-white">
            Accedi
          </button>
        )}

        {authMode === "signup" && (
          <button onClick={signUp} className="w-full rounded border p-2 text-black">
            Registrati
          </button>
        )}
      </div>
    </main>
  );
}

function TicketCard({
  ticket,
  showAssignee,
  assigneeEmail,
  openedByName,
  closedByName,
  closedAt,
}: any) {
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

      <p className="mt-1 text-xs text-gray-600">Aperto da: {openedByName || "N/D"}</p>
      <p className="mt-1 text-xs text-gray-600">
        Aperto il: {ticket.created_at ? new Date(ticket.created_at).toLocaleString("it-IT") : "N/D"}
      </p>
      {ticket.status === "closed" && (
        <>
          <p className="mt-1 text-xs text-gray-600">Chiuso da: {closedByName || "N/D"}</p>
          <p className="mt-1 text-xs text-gray-600">
            Chiuso il: {closedAt ? new Date(closedAt).toLocaleString("it-IT") : "N/D"}
          </p>
        </>
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