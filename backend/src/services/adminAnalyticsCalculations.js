const DAY_MS = 24 * 60 * 60 * 1000;

const EVENT = {
  registered: "User Registered",
  emailVerified: "Email Verified",
  roleSelected: "Role Selected",
  profileCompleted: "Profile Completed",
  projectCreated: "Project Created",
  projectJoined: "Project Joined",
  startupCreated: "Startup Created",
  startupLaunched: "Startup Launched",
  hackathonJoined: "Hackathon Joined",
  applicationSubmitted: "Application Submitted",
  messageSent: "Message Sent",
  connectionAccepted: "Connection Accepted",
  collaborationCompleted: "Collaboration Completed",
  referralSent: "Referral Sent",
  referralAccepted: "Referral Accepted",
  subscriptionPurchased: "Subscription Purchased",
  creditPurchased: "Credit Purchased",
  creditUsed: "Credit Used",
  paymentFailed: "Payment Failed",
  aiRecommendationGenerated: "AI Recommendation Generated",
  aiRecommendationClicked: "AI Recommendation Clicked",
  aiRecommendationSuccess: "AI Recommendation Success",
  aiChatSession: "AI Chat Session",
  apiRequest: "API Request",
  sessionStarted: "Session Started",
  sessionEnded: "Session Ended",
  mentorSession: "Mentor Session Booked",
  investorMeeting: "Investor Meeting Booked",
  organizationPartnership: "Organization Partnership Created",
};

const ROLE_META = {
  founder: { name: "Founders", label: "Founder", color: "#3b82f6", order: 1 },
  builder: { name: "Collaborators", label: "Collaborator", color: "#22c55e", order: 2 },
  collaborator: { name: "Collaborators", label: "Collaborator", color: "#22c55e", order: 2 },
  student: { name: "Students", label: "Student", color: "#06b6d4", order: 3 },
  investor: { name: "Investors", label: "Investor", color: "#f59e0b", order: 4 },
  mentor: { name: "Mentors", label: "Mentor", color: "#ef4444", order: 5 },
  organization: { name: "Organizations", label: "Organization", color: "#8b5cf6", order: 6 },
};

const ACTIVITY_META = {
  Active: "#22c55e",
  "At-Risk": "#f59e0b",
  Dormant: "#ef4444",
};

const FIRST_ACTION_EVENTS = new Set([
  EVENT.projectCreated,
  EVENT.projectJoined,
  EVENT.startupCreated,
  EVENT.startupLaunched,
  EVENT.hackathonJoined,
  EVENT.applicationSubmitted,
  EVENT.messageSent,
  EVENT.connectionAccepted,
  EVENT.collaborationCompleted,
  EVENT.referralSent,
  EVENT.referralAccepted,
  EVENT.subscriptionPurchased,
  EVENT.creditPurchased,
  EVENT.creditUsed,
  EVENT.aiRecommendationClicked,
  EVENT.aiChatSession,
  EVENT.mentorSession,
  EVENT.investorMeeting,
  EVENT.organizationPartnership,
]);

function time(event) {
  return new Date(event.timestamp).getTime();
}

function within(event, nowMs, days) {
  return time(event) >= nowMs - days * DAY_MS && time(event) <= nowMs;
}

function count(events, eventName, predicate = () => true) {
  return events.filter((event) => event.event_name === eventName && predicate(event)).length;
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return round((numerator / denominator) * 100, 1);
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function uniqueUsers(events, predicate = () => true) {
  return new Set(events.filter(predicate).map((event) => event.user_id).filter(Boolean));
}

function sum(events, getter) {
  return events.reduce((total, event) => total + Number(getter(event) || 0), 0);
}

function latestRoleByUser(events) {
  const roles = new Map();
  for (const event of [...events].sort((a, b) => time(a) - time(b))) {
    if (event.user_id && event.role && event.role !== "unknown") {
      roles.set(event.user_id, event.role);
    }
  }
  return roles;
}

function byMonth(events, eventName, valueGetter = () => 1) {
  const buckets = new Map();
  for (const event of events) {
    if (eventName && event.event_name !== eventName) continue;
    const date = new Date(event.timestamp);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) || 0) + Number(valueGetter(event) || 0));
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([month, value]) => ({ month, value: round(value, 2) }));
}

function roleBreakdown(events, nowMs) {
  const roles = latestRoleByUser(events);
  const registeredThisMonth = new Set(events.filter((event) => event.event_name === EVENT.registered && within(event, nowMs, 30)).map((event) => event.user_id));
  const activeThisMonth = uniqueUsers(events, (event) => within(event, nowMs, 30));
  const registeredByUser = new Map();
  for (const event of events) {
    if (event.event_name === EVENT.registered && !registeredByUser.has(event.user_id)) {
      registeredByUser.set(event.user_id, time(event));
    }
  }

  const rows = {};
  for (const [userId, role] of roles.entries()) {
    rows[role] ||= { role, total: 0, newUsers: 0, activeUsers: 0, retention: 0, retained: 0, eligible: 0 };
    rows[role].total += 1;
    if (registeredThisMonth.has(userId)) rows[role].newUsers += 1;
    if (activeThisMonth.has(userId)) rows[role].activeUsers += 1;

    const registeredAt = registeredByUser.get(userId);
    if (registeredAt && nowMs - registeredAt >= 30 * DAY_MS) {
      rows[role].eligible += 1;
      const retained = events.some((event) => event.user_id === userId && time(event) >= registeredAt + 30 * DAY_MS);
      if (retained) rows[role].retained += 1;
    }
  }

  return Object.values(rows).map((row) => ({
    ...row,
    retention: pct(row.retained, row.eligible),
  }));
}

function retentionByDay(events, nowMs, days) {
  const registrations = events.filter((event) => event.event_name === EVENT.registered);
  const eligible = registrations.filter((event) => nowMs - time(event) >= days * DAY_MS);
  const retained = eligible.filter((registration) =>
    events.some((event) => event.user_id === registration.user_id && time(event) >= time(registration) + days * DAY_MS),
  );
  return {
    label: `Day ${days}`,
    users: retained.length,
    eligible: eligible.length,
    rate: pct(retained.length, eligible.length),
  };
}

function sourceOk(source) {
  return Boolean(source?.ok);
}

export function calculateUserDashboard(events, now = new Date()) {
  const nowMs = now.getTime();
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const profiles = userProfiles(sorted, nowMs);
  const totalUsers = profiles.length;
  const active7d = profiles.filter((profile) => profile.status === "Active").length;
  const atRisk = profiles.filter((profile) => profile.status === "At-Risk").length;
  const dormant = profiles.filter((profile) => profile.status === "Dormant").length;
  const countries = new Set(profiles.map((profile) => profile.country).filter((country) => country && country !== "Unknown"));
  const previousCountries = new Set(profiles.filter((profile) => profile.registeredAt < nowMs - 30 * DAY_MS).map((profile) => profile.country));
  const newCountriesThisMonth = [...countries].filter((country) => {
    const firstSeen = Math.min(...profiles.filter((profile) => profile.country === country).map((profile) => profile.registeredAt));
    return firstSeen >= nowMs - 30 * DAY_MS && !previousCountries.has(country);
  }).length;

  const registeredUsers = new Set(sorted.filter((event) => event.event_name === EVENT.registered).map((event) => event.user_id));
  const emailVerifiedUsers = userSet(sorted, EVENT.emailVerified);
  const profileCompletedUsers = userSet(sorted, EVENT.profileCompleted);
  const firstActionUsers = new Set(sorted.filter((event) => FIRST_ACTION_EVENTS.has(event.event_name)).map((event) => event.user_id));
  const projectCreatedUsers = userSet(sorted, EVENT.projectCreated);
  const paidUsers = new Set(sorted.filter((event) => event.event_name === EVENT.subscriptionPurchased || event.event_name === EVENT.creditPurchased).map((event) => event.user_id));
  const retained30dUsers = retainedUsers(profiles, 30, nowMs);
  const roleRows = roleRowsFromProfiles(profiles, {
    emailVerifiedUsers,
    profileCompletedUsers,
    firstActionUsers,
    projectCreatedUsers,
    retained30dUsers,
  });
  const funnelData = [
    { stage: "Signup", users: totalUsers, conversion: totalUsers ? 100 : 0 },
    { stage: "Email Verified", users: countUsers(emailVerifiedUsers, registeredUsers), conversion: pct(countUsers(emailVerifiedUsers, registeredUsers), totalUsers) },
    { stage: "Profile Complete", users: countUsers(profileCompletedUsers, registeredUsers), conversion: pct(countUsers(profileCompletedUsers, registeredUsers), totalUsers) },
    { stage: "First Action", users: countUsers(firstActionUsers, registeredUsers), conversion: pct(countUsers(firstActionUsers, registeredUsers), totalUsers) },
    { stage: "Project Created", users: countUsers(projectCreatedUsers, registeredUsers), conversion: pct(countUsers(projectCreatedUsers, registeredUsers), totalUsers) },
    { stage: "Subscription", users: countUsers(paidUsers, registeredUsers), conversion: pct(countUsers(paidUsers, registeredUsers), totalUsers) },
    { stage: "Retained (30d)", users: countUsers(retained30dUsers, registeredUsers), conversion: pct(countUsers(retained30dUsers, registeredUsers), totalUsers) },
  ];

  return {
    generatedAt: now.toISOString(),
    eventCount: sorted.length,
    metrics: {
      totalUsers,
      newUsersThisWeek: count(sorted, EVENT.registered, (event) => within(event, nowMs, 7)),
      active7d,
      activityRate: pct(active7d, totalUsers),
      atRisk,
      atRiskRate: pct(atRisk, totalUsers),
      countries: countries.size,
      newCountriesThisMonth,
    },
    roleData: roleChartData(profiles),
    activityData: [
      { name: "Active", value: active7d, color: ACTIVITY_META.Active },
      { name: "At-Risk", value: atRisk, color: ACTIVITY_META["At-Risk"] },
      { name: "Dormant", value: dormant, color: ACTIVITY_META.Dormant },
    ],
    funnelData,
    dropOffInsight: dropOffInsight(funnelData),
    recentUsers: profiles
      .filter((profile) => profile.registeredAt)
      .sort((a, b) => b.registeredAt - a.registeredAt)
      .slice(0, 8)
      .map((profile) => ({
        id: profile.userId,
        name: profile.name,
        email: profile.email,
        role: roleMeta(profile.role).label,
        status: profile.status,
        joined: relativeAge(profile.registeredAt, nowMs),
        country: profile.country,
      })),
    activationByRole: roleRows.map((row) => ({
      role: row.role,
      total: row.total,
      emailVerificationRate: row.emailVerificationRate,
      profileCompletionRate: row.profileCompletionRate,
      firstActionRate: row.firstActionRate,
      projectCreationRate: row.projectCreationRate,
    })),
    retentionByRole: roleRows.map((row) => ({
      role: row.role,
      total: row.total,
      active7d: row.active7d,
      atRisk: row.atRisk,
      dormant: row.dormant,
      retention30d: row.retention30d,
    })),
  };
}

export function calculateReferralCollaborationDashboard(events, now = new Date()) {
  const nowMs = now.getTime();
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const current = sorted.filter((event) => within(event, nowMs, 30));
  const referralTrendEvents = sorted.filter((event) => within(event, nowMs, 42));
  const registeredUsers = userSet(sorted, EVENT.registered);
  const profileCompletedUsers = userSet(sorted, EVENT.profileCompleted);
  const roles = latestRoleByUser(sorted);
  const totalUsers = uniqueUsers(sorted).size;

  const referralSentEvents = current.filter((event) => event.event_name === EVENT.referralSent);
  const referralAcceptedEvents = current.filter((event) => event.event_name === EVENT.referralAccepted);
  const referredUserIds = new Set(referralAcceptedEvents.map((event) => event.metadata?.referred_user_id).filter(Boolean));
  const sourceReferralUsers = new Set(
    sorted
      .filter((event) => event.event_name === EVENT.registered && event.metadata?.source === "referral")
      .map((event) => event.user_id)
      .filter(Boolean),
  );
  const registeredFromReferral = Math.max(
    sourceReferralUsers.size,
    [...referredUserIds].filter((userId) => registeredUsers.has(userId)).length,
  );
  const activatedFromReferral = Math.max(
    [...sourceReferralUsers].filter((userId) => profileCompletedUsers.has(userId)).length,
    [...referredUserIds].filter((userId) => profileCompletedUsers.has(userId)).length,
  );

  const projectsCreated = count(current, EVENT.projectCreated);
  const projectsJoined = count(current, EVENT.projectJoined);
  const collaborationsCompleted = count(current, EVENT.collaborationCompleted);
  const startupsCreated = count(current, EVENT.startupCreated);
  const startupsLaunched = count(current, EVENT.startupLaunched);
  const founderBuilderMatches = count(current, EVENT.connectionAccepted);
  const mentorSessions = count(current, EVENT.mentorSession);
  const investorMeetings = count(current, EVENT.investorMeeting);
  const organizationPartnerships = count(current, EVENT.organizationPartnership);
  const messagesSent = count(current, EVENT.messageSent);

  return {
    generatedAt: now.toISOString(),
    eventCount: sorted.length,
    referral: {
      metrics: {
        invitationsSent: referralSentEvents.length,
        accepted: referralAcceptedEvents.length,
        acceptanceRate: pct(referralAcceptedEvents.length, referralSentEvents.length),
        registered: registeredFromReferral,
        activated: activatedFromReferral,
        activationRate: pct(activatedFromReferral, registeredFromReferral),
        viralCoefficient: round(referralAcceptedEvents.length / Math.max(1, totalUsers), 2),
      },
      funnelData: referralFunnelData(referralSentEvents.length, referralAcceptedEvents.length, registeredFromReferral, activatedFromReferral),
      trendData: referralTrendData(referralTrendEvents, nowMs),
      byRole: referralByRole(referralSentEvents, roles),
      topReferrers: topReferrers(referralSentEvents, referralAcceptedEvents, roles),
      insight: referralInsight(referralSentEvents.length, referralAcceptedEvents.length, activatedFromReferral),
    },
    collaboration: {
      metrics: {
        projectsCreated,
        projectsJoined,
        collaborationsCompleted,
        completionRate: pct(collaborationsCompleted, projectsCreated),
        startupsCreated,
        startupsLaunched,
        launchRate: pct(startupsLaunched, startupsCreated),
        founderBuilderMatches,
        mentorSessions,
        investorMeetings,
        organizationPartnerships,
        messagesSent,
      },
      pipelineData: collaborationPipelineData({
        projectsCreated,
        projectsJoined,
        founderBuilderMatches,
        collaborationsCompleted,
        startupsCreated,
        startupsLaunched,
      }),
      supportData: [
        { name: "Mentor Sessions", value: mentorSessions, color: "#3b82f6" },
        { name: "Investor Meetings", value: investorMeetings, color: "#f59e0b" },
        { name: "Partnerships", value: organizationPartnerships, color: "#8b5cf6" },
      ],
      byRole: collaborationByRole(current),
      recentActivity: recentCollaborationActivity(current, nowMs),
      insight: collaborationInsight(projectsCreated, collaborationsCompleted, startupsCreated, startupsLaunched),
    },
  };
}

export function calculateRevenueRetentionDashboard(events, now = new Date()) {
  const nowMs = now.getTime();
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const current = sorted.filter((event) => within(event, nowMs, 30));
  const totalUsers = userSet(sorted, EVENT.registered).size || uniqueUsers(sorted).size;
  const revenueEvents = current.filter((event) => event.event_name === EVENT.subscriptionPurchased || event.event_name === EVENT.creditPurchased);
  const subscriptionEvents = current.filter((event) => event.event_name === EVENT.subscriptionPurchased);
  const creditEvents = current.filter((event) => event.event_name === EVENT.creditPurchased);
  const failedPayments = current.filter((event) => event.event_name === EVENT.paymentFailed);
  const mrr = sum(subscriptionEvents, (event) => event.metadata?.amount_monthly_usd);
  const creditRevenue = sum(creditEvents, (event) => event.metadata?.amount_usd);
  const churnMrr = sum(failedPayments, (event) => event.metadata?.amount_usd);
  const paidUsers = uniqueUsers(revenueEvents);
  const totalRevenue = mrr + creditRevenue;
  const arpu = round(totalRevenue / Math.max(1, totalUsers), 2);
  const ltv = round(arpu * 12, 2);

  return {
    generatedAt: now.toISOString(),
    eventCount: sorted.length,
    metrics: {
      mrr,
      arr: mrr * 12,
      creditRevenue,
      totalRevenue,
      paidUsers: paidUsers.size,
      conversionRate: pct(paidUsers.size, totalUsers),
      arpu,
      ltv,
      churnMrr,
      churnRate: pct(failedPayments.length, Math.max(1, subscriptionEvents.length + failedPayments.length)),
      netNewMrr: mrr - churnMrr,
      paymentFailures: failedPayments.length,
    },
    mrrData: revenueTrendData(sorted, nowMs),
    planDistribution: planDistributionData(sorted, totalUsers),
    ltvCacData: ltvCacData(sorted, nowMs),
    revenueByRegion: revenueByRegionData(current),
    retentionCurve: [1, 7, 30, 90].map((days) => retentionByDay(sorted, nowMs, days)),
    cohortRetention: cohortRetentionData(sorted, nowMs),
    insight: revenueRetentionInsight(mrr, churnMrr, paidUsers.size, totalUsers),
  };
}

export function calculateAiSystemHealthDashboard(events, sourceStatus = {}, now = new Date()) {
  const nowMs = now.getTime();
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const current = sorted.filter((event) => within(event, nowMs, 30));
  const apiRequests = sorted.filter((event) => event.event_name === EVENT.apiRequest && within(event, nowMs, 1));
  const aiEvents = current.filter((event) => event.event_name.startsWith("AI "));
  const aiGenerated = count(current, EVENT.aiRecommendationGenerated);
  const aiClicks = count(current, EVENT.aiRecommendationClicked);
  const aiSuccesses = count(current, EVENT.aiRecommendationSuccess);
  const aiChatSessions = count(current, EVENT.aiChatSession);
  const failedRequests = apiRequests.filter((event) => Number(event.metadata?.status || 200) >= 500);
  const errorRate = pct(failedRequests.length, apiRequests.length);
  const averageApiLatencyMs = round(sum(apiRequests, (event) => event.metadata?.duration_ms) / Math.max(1, apiRequests.length));
  const averageAiLatencyMs = round(sum(aiEvents, (event) => event.metadata?.latency_ms) / Math.max(1, aiEvents.length));
  const aiSuccessRate = pct(aiSuccesses, aiGenerated);
  const recommendationCtr = pct(aiClicks, aiGenerated);
  const backendOk = sourceOk(sourceStatus.backend);
  const aiRouterOk = sourceOk(sourceStatus.aiRouter);
  const uptime = pct([backendOk, aiRouterOk].filter(Boolean).length, 2);
  const aiHealthScore = Math.max(0, Math.min(100, round((aiRouterOk ? 45 : 20) + aiSuccessRate * 0.35 + Math.max(0, 20 - averageAiLatencyMs / 100))));
  const systemStatus = errorRate > 5 || !backendOk || !aiRouterOk ? "Degraded" : "Operational";

  return {
    generatedAt: now.toISOString(),
    eventCount: sorted.length,
    ai: {
      metrics: {
        healthScore: aiHealthScore,
        recommendationsGenerated: aiGenerated,
        clickThroughRate: recommendationCtr,
        successRate: aiSuccessRate,
        chatSessions: aiChatSessions,
        tokensConsumed: sum(aiEvents, (event) => event.metadata?.tokens),
        averageLatencyMs: averageAiLatencyMs,
        modelDrift: round(aiSuccessRate - recommendationCtr, 1),
        averageConfidence: round(Math.min(99, 70 + recommendationCtr / 2 + aiSuccessRate / 5), 1),
      },
      scoreDistribution: aiScoreDistribution(aiGenerated, aiClicks, aiSuccesses, aiChatSessions),
      accuracyTrend: aiAccuracyTrend(current, nowMs),
      latencyTrend: aiLatencyTrend(aiEvents, nowMs),
      recentDecisions: recentAiDecisions(aiEvents, nowMs),
      alerts: aiAlerts(aiHealthScore, averageAiLatencyMs, aiRouterOk),
    },
    system: {
      metrics: {
        status: systemStatus,
        averageApiLatencyMs,
        errorRate,
        failedRequests: failedRequests.length,
        databasePerformanceMs: round(sum(apiRequests, (event) => event.metadata?.db_ms) / Math.max(1, apiRequests.length)),
        queueLength: Math.max(0, ...apiRequests.map((event) => Number(event.metadata?.queue_length || 0))),
        uptime,
        aiLatencyMs: averageAiLatencyMs,
      },
      latencyData: systemLatencyTrend(apiRequests, aiEvents, nowMs),
      errorRateData: systemErrorTrend(apiRequests, nowMs),
      uptimeData: uptimeTrend(sourceStatus, nowMs),
      serviceStatus: serviceStatusRows(sourceStatus, { averageApiLatencyMs, averageAiLatencyMs, errorRate }),
      alerts: systemAlerts({ errorRate, averageApiLatencyMs, averageAiLatencyMs, backendOk, aiRouterOk }),
    },
  };
}

export function calculateGeographyAlertsDashboard(events, sourceStatus = {}, now = new Date()) {
  const nowMs = now.getTime();
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const registeredEvents = sorted.filter((event) => event.event_name === EVENT.registered);
  const current = sorted.filter((event) => within(event, nowMs, 30));
  const apiRequests = sorted.filter((event) => event.event_name === EVENT.apiRequest && within(event, nowMs, 1));
  const failedRequests = apiRequests.filter((event) => Number(event.metadata?.status || 200) >= 500);
  const aiEvents = current.filter((event) => event.event_name.startsWith("AI "));
  const revenueEvents = current.filter((event) => event.event_name === EVENT.subscriptionPurchased || event.event_name === EVENT.creditPurchased);
  const paymentFailures = count(current, EVENT.paymentFailed);
  const referralsSent = count(current, EVENT.referralSent);
  const backendOk = sourceOk(sourceStatus.backend);
  const aiRouterOk = sourceOk(sourceStatus.aiRouter);
  const errorRate = pct(failedRequests.length, apiRequests.length);
  const aiLatencyMs = round(sum(aiEvents, (event) => event.metadata?.latency_ms) / Math.max(1, aiEvents.length));
  const alerts = realTimeAlerts({ errorRate, failedRequests: failedRequests.length, paymentFailures, referralsSent, aiLatencyMs, backendOk, aiRouterOk });
  const activeAlerts = alerts.filter((alert) => alert.title !== "No active alerts");

  return {
    generatedAt: now.toISOString(),
    eventCount: sorted.length,
    metrics: {
      countries: group(registeredEvents, (event) => event.country || "Unknown").filter((row) => row.name !== "Unknown").length,
      states: group(registeredEvents, (event) => event.metadata?.state || "Unknown").filter((row) => row.name !== "Unknown").length,
      universities: group(registeredEvents, (event) => event.metadata?.university || "Unknown").filter((row) => row.name !== "Unknown").length,
      organizations: group(registeredEvents, (event) => event.metadata?.organization || "Unknown").filter((row) => row.name !== "Unknown").length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter((alert) => alert.severity === "critical").length,
    },
    geography: {
      countries: group(registeredEvents, (event) => event.country || "Unknown"),
      states: group(registeredEvents, (event) => event.metadata?.state || "Unknown"),
      universities: group(registeredEvents, (event) => event.metadata?.university || "Unknown"),
      organizations: group(registeredEvents, (event) => event.metadata?.organization || "Unknown"),
      regionalUsers: group(registeredEvents, (event) => event.country || "Unknown").map((row) => ({ region: row.name, users: row.value })),
      regionalRevenue: geographyRevenue(revenueEvents),
      newMarkets: newMarkets(registeredEvents, nowMs),
    },
    alerts,
    alertTimeline: alertTimeline(sorted, nowMs),
  };
}

export function calculateMissionControl(events, sourceStatus = {}, now = new Date()) {
  const nowMs = now.getTime();
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const registeredUsers = uniqueUsers(sorted, (event) => event.event_name === EVENT.registered);
  const activeToday = uniqueUsers(sorted, (event) => within(event, nowMs, 1));
  const activeWeek = uniqueUsers(sorted, (event) => within(event, nowMs, 7));
  const activeMonth = uniqueUsers(sorted, (event) => within(event, nowMs, 30));
  const sessions = sorted.filter((event) => event.event_name === EVENT.sessionStarted && within(event, nowMs, 30));
  const sessionEnds = sorted.filter((event) => event.event_name === EVENT.sessionEnded && within(event, nowMs, 30));
  const totalUsers = registeredUsers.size || uniqueUsers(sorted).size;
  const roles = roleBreakdown(sorted, nowMs);
  const apiRequests = sorted.filter((event) => event.event_name === EVENT.apiRequest && within(event, nowMs, 1));
  const failedRequests = apiRequests.filter((event) => Number(event.metadata?.status || 200) >= 500);
  const backendOk = sourceOk(sourceStatus.backend);
  const aiRouterOk = sourceOk(sourceStatus.aiRouter);

  const mrr = sum(sorted.filter((event) => event.event_name === EVENT.subscriptionPurchased && within(event, nowMs, 30)), (event) => event.metadata?.amount_monthly_usd);
  const creditRevenue = sum(sorted.filter((event) => event.event_name === EVENT.creditPurchased && within(event, nowMs, 30)), (event) => event.metadata?.amount_usd);
  const aiGenerated = count(sorted, EVENT.aiRecommendationGenerated, (event) => within(event, nowMs, 30));
  const aiClicks = count(sorted, EVENT.aiRecommendationClicked, (event) => within(event, nowMs, 30));
  const aiSuccesses = count(sorted, EVENT.aiRecommendationSuccess, (event) => within(event, nowMs, 30));
  const aiEvents = sorted.filter((event) => event.event_name.startsWith("AI ") && within(event, nowMs, 30));
  const referralsSent = count(sorted, EVENT.referralSent, (event) => within(event, nowMs, 30));
  const referralsAccepted = count(sorted, EVENT.referralAccepted, (event) => within(event, nowMs, 30));
  const paymentFailures = count(sorted, EVENT.paymentFailed, (event) => within(event, nowMs, 7));
  const errorRate = pct(failedRequests.length, apiRequests.length);

  const alerts = [];
  if (errorRate > 5) alerts.push({ severity: "critical", title: "API errors exceed threshold", detail: `${errorRate}% of API requests failed in the last 24 hours.` });
  if (count(sorted, EVENT.registered, (event) => within(event, nowMs, 1)) > Math.max(3, count(sorted, EVENT.registered, (event) => within(event, nowMs - DAY_MS, 1)) * 2)) {
    alerts.push({ severity: "info", title: "User sign-ups spiking", detail: "New registrations are above the previous daily baseline." });
  }
  if (referralsSent >= 2) alerts.push({ severity: "info", title: "Referral activity surging", detail: `${referralsSent} referral invitations sent in the last 30 days.` });
  if (paymentFailures > 0) alerts.push({ severity: "warning", title: "Payment failures increased", detail: `${paymentFailures} failed payment event recorded this week.` });
  if (!aiRouterOk) alerts.push({ severity: "warning", title: "AI service degraded", detail: "ai-router health check is not currently healthy." });
  if (!backendOk) alerts.push({ severity: "warning", title: "Platform backend degraded", detail: "BACKEND health check is not currently healthy." });

  return {
    generatedAt: now.toISOString(),
    eventCount: sorted.length,
    sourceStatus,
    executive: {
      growth: {
        totalUsers,
        newUsersToday: count(sorted, EVENT.registered, (event) => within(event, nowMs, 1)),
        newUsersThisWeek: count(sorted, EVENT.registered, (event) => within(event, nowMs, 7)),
        newUsersThisMonth: count(sorted, EVENT.registered, (event) => within(event, nowMs, 30)),
        activeUsers: activeMonth.size,
      },
      engagement: {
        dau: activeToday.size,
        wau: activeWeek.size,
        mau: activeMonth.size,
        stickiness: pct(activeToday.size, activeMonth.size),
        averageSessionDurationMinutes: round(sum(sessionEnds, (event) => event.metadata?.duration_seconds) / Math.max(1, sessionEnds.length) / 60, 1),
        averageSessionsPerUser: round(sessions.length / Math.max(1, activeMonth.size), 2),
      },
      activation: {
        accountsCreated: count(sorted, EVENT.registered),
        emailVerificationRate: pct(count(sorted, EVENT.emailVerified), count(sorted, EVENT.registered)),
        profileCompletionRate: pct(count(sorted, EVENT.profileCompleted), count(sorted, EVENT.registered)),
        firstProjectCreated: count(sorted, EVENT.projectCreated),
        firstCollaborationCompleted: count(sorted, EVENT.collaborationCompleted),
      },
    },
    referral: {
      invitationsSent: referralsSent,
      accepted: referralsAccepted,
      acceptanceRate: pct(referralsAccepted, referralsSent),
      viralCoefficient: round(referralsAccepted / Math.max(1, totalUsers), 2),
      topReferrers: [...new Set(sorted.filter((event) => event.event_name === EVENT.referralSent).map((event) => event.user_id))]
        .slice(0, 5)
        .map((userId) => ({
          userId,
          sent: count(sorted, EVENT.referralSent, (event) => event.user_id === userId),
          accepted: count(sorted, EVENT.referralAccepted, (event) => event.user_id === userId),
        })),
      funnel: [
        { stage: "Invites", value: referralsSent },
        { stage: "Accepted", value: referralsAccepted },
        { stage: "Registered", value: count(sorted, EVENT.registered, (event) => event.metadata?.source === "referral") || referralsAccepted },
        { stage: "Activated", value: count(sorted, EVENT.profileCompleted, (event) => event.metadata?.source === "referral") || Math.min(referralsAccepted, count(sorted, EVENT.profileCompleted)) },
      ],
    },
    collaboration: {
      projectsCreated: count(sorted, EVENT.projectCreated),
      projectsCompleted: count(sorted, EVENT.collaborationCompleted),
      startupsLaunched: count(sorted, EVENT.startupLaunched),
      founderBuilderMatches: count(sorted, EVENT.connectionAccepted),
      mentorSessions: count(sorted, EVENT.mentorSession),
      investorMeetings: count(sorted, EVENT.investorMeeting),
      organizationPartnerships: count(sorted, EVENT.organizationPartnership),
    },
    roles,
    revenue: {
      mrr,
      arr: mrr * 12,
      subscriptionConversions: pct(count(sorted, EVENT.subscriptionPurchased), totalUsers),
      creditPurchases: creditRevenue,
      arpu: round((mrr + creditRevenue) / Math.max(1, totalUsers), 2),
      ltv: round(((mrr + creditRevenue) / Math.max(1, totalUsers)) * 12, 2),
    },
    retention: [1, 7, 30, 90].map((days) => retentionByDay(sorted, nowMs, days)),
    ai: {
      recommendationsGenerated: aiGenerated,
      recommendationClickThroughRate: pct(aiClicks, aiGenerated),
      chatSessions: count(sorted, EVENT.aiChatSession, (event) => within(event, nowMs, 30)),
      tokensConsumed: sum(aiEvents, (event) => event.metadata?.tokens),
      successRate: pct(aiSuccesses, aiGenerated),
      averageLatencyMs: round(sum(aiEvents, (event) => event.metadata?.latency_ms) / Math.max(1, aiEvents.length)),
    },
    systemHealth: {
      apiResponseTimeMs: round(sum(apiRequests, (event) => event.metadata?.duration_ms) / Math.max(1, apiRequests.length)),
      errorRate,
      failedRequests: failedRequests.length,
      databasePerformanceMs: round(sum(apiRequests, (event) => event.metadata?.db_ms) / Math.max(1, apiRequests.length)),
      queueLength: Math.max(0, ...apiRequests.map((event) => Number(event.metadata?.queue_length || 0))),
      aiLatencyMs: round(sum(aiEvents, (event) => event.metadata?.latency_ms) / Math.max(1, aiEvents.length)),
      uptime: pct([backendOk, aiRouterOk].filter(Boolean).length, 2),
    },
    geography: {
      countries: group(sorted.filter((event) => event.event_name === EVENT.registered), (event) => event.country || "Unknown"),
      states: group(sorted.filter((event) => event.event_name === EVENT.registered), (event) => event.metadata?.state || "Unknown"),
      universities: group(sorted.filter((event) => event.event_name === EVENT.registered), (event) => event.metadata?.university || "Unknown"),
      organizations: group(sorted.filter((event) => event.event_name === EVENT.registered), (event) => event.metadata?.organization || "Unknown"),
    },
    alerts,
    trends: {
      userGrowth: byMonth(sorted, EVENT.registered),
      revenue: byMonth(sorted.filter((event) => event.event_name === EVENT.subscriptionPurchased || event.event_name === EVENT.creditPurchased), null, (event) => event.metadata?.amount_monthly_usd || event.metadata?.amount_usd || 0),
      roleDistribution: roles.map((row) => ({ role: row.role, users: row.total })),
      regionalUsers: group(sorted.filter((event) => event.event_name === EVENT.registered), (event) => event.country || "Unknown").map((row) => ({ region: row.name, users: row.value })),
    },
  };
}

function group(events, keyGetter) {
  const buckets = new Map();
  for (const event of events) {
    const key = String(keyGetter(event) || "Unknown");
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

function referralFunnelData(invited, accepted, registered, activated) {
  return [
    { stage: "Invited", value: invited, conversion: invited ? 100 : 0 },
    { stage: "Accepted", value: accepted, conversion: pct(accepted, invited) },
    { stage: "Registered", value: registered, conversion: pct(registered, invited) },
    { stage: "Activated", value: activated, conversion: pct(activated, invited) },
  ];
}

function referralTrendData(events, nowMs) {
  const buckets = new Map();
  for (let index = 5; index >= 0; index -= 1) {
    buckets.set(`W-${index}`, { week: index === 0 ? "This week" : `${index}w ago`, sent: 0, accepted: 0 });
  }
  for (const event of events) {
    if (event.event_name !== EVENT.referralSent && event.event_name !== EVENT.referralAccepted) continue;
    const daysAgo = Math.max(0, Math.floor((nowMs - time(event)) / DAY_MS));
    const weekOffset = Math.min(5, Math.floor(daysAgo / 7));
    const key = `W-${weekOffset}`;
    const row = buckets.get(key) || { week: `${weekOffset}w ago`, sent: 0, accepted: 0 };
    if (event.event_name === EVENT.referralSent) row.sent += 1;
    if (event.event_name === EVENT.referralAccepted) row.accepted += 1;
    buckets.set(key, row);
  }
  return [...buckets.values()];
}

function referralByRole(sentEvents, roles) {
  const rows = new Map();
  for (const event of sentEvents) {
    const meta = roleMeta(roles.get(event.user_id) || event.role);
    const row = rows.get(meta.name) || { role: meta.name, invitations: 0, color: meta.color, order: meta.order };
    row.invitations += 1;
    rows.set(meta.name, row);
  }
  return [...rows.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...row }) => row);
}

function topReferrers(sentEvents, acceptedEvents, roles) {
  const acceptedByReferrer = new Map();
  for (const event of acceptedEvents) {
    acceptedByReferrer.set(event.user_id, (acceptedByReferrer.get(event.user_id) || 0) + 1);
  }

  const sentByReferrer = new Map();
  for (const event of sentEvents) {
    sentByReferrer.set(event.user_id, (sentByReferrer.get(event.user_id) || 0) + 1);
  }

  return [...sentByReferrer.entries()]
    .map(([userId, sent]) => ({
      userId,
      role: roleMeta(roles.get(userId)).label,
      sent,
      accepted: acceptedByReferrer.get(userId) || 0,
      acceptanceRate: pct(acceptedByReferrer.get(userId) || 0, sent),
    }))
    .sort((a, b) => b.accepted - a.accepted || b.sent - a.sent)
    .slice(0, 6);
}

function referralInsight(sent, accepted, activated) {
  if (!sent) return "No referral invitations were recorded in the current 30-day event window.";
  const acceptedRate = pct(accepted, sent);
  if (acceptedRate < 25) return `${acceptedRate}% referral acceptance is below target. Review invite copy and recipient fit.`;
  if (activated < accepted) return `${accepted - activated} accepted referrals have not activated yet. Prioritize invited-user onboarding.`;
  return `${acceptedRate}% referral acceptance with ${activated} activated referred users indicates healthy invite quality.`;
}

function collaborationPipelineData(counts) {
  return [
    { stage: "Projects Created", value: counts.projectsCreated, conversion: counts.projectsCreated ? 100 : 0 },
    { stage: "Projects Joined", value: counts.projectsJoined, conversion: pct(counts.projectsJoined, counts.projectsCreated) },
    { stage: "Matches", value: counts.founderBuilderMatches, conversion: pct(counts.founderBuilderMatches, counts.projectsCreated) },
    { stage: "Completed", value: counts.collaborationsCompleted, conversion: pct(counts.collaborationsCompleted, counts.projectsCreated) },
    { stage: "Startups Created", value: counts.startupsCreated, conversion: pct(counts.startupsCreated, counts.projectsCreated) },
    { stage: "Launched", value: counts.startupsLaunched, conversion: pct(counts.startupsLaunched, counts.projectsCreated) },
  ];
}

function collaborationByRole(events) {
  const collaborationEvents = new Set([
    EVENT.projectCreated,
    EVENT.projectJoined,
    EVENT.connectionAccepted,
    EVENT.collaborationCompleted,
    EVENT.startupCreated,
    EVENT.startupLaunched,
    EVENT.mentorSession,
    EVENT.investorMeeting,
    EVENT.organizationPartnership,
  ]);
  const rows = new Map();
  for (const event of events) {
    if (!collaborationEvents.has(event.event_name)) continue;
    const meta = roleMeta(event.role);
    const row = rows.get(meta.name) || { role: meta.name, activity: 0, color: meta.color, order: meta.order };
    row.activity += 1;
    rows.set(meta.name, row);
  }
  return [...rows.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...row }) => row);
}

function recentCollaborationActivity(events, nowMs) {
  const activityNames = new Set([
    EVENT.projectCreated,
    EVENT.projectJoined,
    EVENT.connectionAccepted,
    EVENT.collaborationCompleted,
    EVENT.startupCreated,
    EVENT.startupLaunched,
    EVENT.mentorSession,
    EVENT.investorMeeting,
    EVENT.organizationPartnership,
  ]);
  return events
    .filter((event) => activityNames.has(event.event_name))
    .sort((a, b) => time(b) - time(a))
    .slice(0, 8)
    .map((event) => ({
      id: event.event_id,
      event: event.event_name,
      actor: event.user_id,
      role: roleMeta(event.role).label,
      target: event.metadata?.project_id || event.metadata?.startup_id || event.metadata?.partner || event.metadata?.counterpart_id || "Network",
      occurred: relativeAge(time(event), nowMs),
    }));
}

function collaborationInsight(projectsCreated, collaborationsCompleted, startupsCreated, startupsLaunched) {
  if (!projectsCreated) return "No project collaboration activity was recorded in the current 30-day event window.";
  const completionRate = pct(collaborationsCompleted, projectsCreated);
  const launchRate = pct(startupsLaunched, startupsCreated);
  if (completionRate < 35) return `${completionRate}% collaboration completion is below target. Review matching quality and team follow-through.`;
  if (startupsCreated && launchRate < 50) return `${launchRate}% startup launch rate suggests teams need more market-readiness support.`;
  return `${completionRate}% project completion and ${launchRate}% startup launch rate show strong collaboration throughput.`;
}

function revenueTrendData(events, nowMs) {
  const months = monthBuckets(nowMs, 7);
  for (const event of events) {
    if (event.event_name !== EVENT.subscriptionPurchased && event.event_name !== EVENT.creditPurchased && event.event_name !== EVENT.paymentFailed) continue;
    const key = monthKey(new Date(event.timestamp));
    const row = months.get(key);
    if (!row) continue;
    if (event.event_name === EVENT.subscriptionPurchased) {
      const amount = Number(event.metadata?.amount_monthly_usd || 0);
      row.mrr += amount;
      row.newMrr += amount;
    }
    if (event.event_name === EVENT.creditPurchased) {
      row.creditRevenue += Number(event.metadata?.amount_usd || 0);
    }
    if (event.event_name === EVENT.paymentFailed) {
      row.churn += Number(event.metadata?.amount_usd || 0);
    }
  }

  let runningMrr = 0;
  return [...months.values()].map((row) => {
    runningMrr = Math.max(0, runningMrr + row.newMrr - row.churn);
    return {
      month: row.month,
      mrr: round(runningMrr, 2),
      newMrr: round(row.newMrr, 2),
      churn: -round(row.churn, 2),
      creditRevenue: round(row.creditRevenue, 2),
    };
  });
}

function planDistributionData(events, totalUsers) {
  const paidUsers = new Set();
  const plans = new Map();
  for (const event of events) {
    if (event.event_name !== EVENT.subscriptionPurchased) continue;
    paidUsers.add(event.user_id);
    const plan = String(event.metadata?.plan || "Paid");
    const row = plans.get(plan) || { name: plan, value: 0 };
    row.value += 1;
    plans.set(plan, row);
  }

  const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"];
  const rows = [{ name: "Free", value: Math.max(0, totalUsers - paidUsers.size), color: "#71717a" }];
  [...plans.values()]
    .sort((a, b) => b.value - a.value)
    .forEach((row, index) => rows.push({ ...row, color: colors[index % colors.length] }));
  return rows;
}

function ltvCacData(events, nowMs) {
  const months = monthBuckets(nowMs, 6);
  const registrations = events.filter((event) => event.event_name === EVENT.registered);
  const revenueEvents = events.filter((event) => event.event_name === EVENT.subscriptionPurchased || event.event_name === EVENT.creditPurchased);
  for (const registration of registrations) {
    const key = monthKey(new Date(registration.timestamp));
    const row = months.get(key);
    if (!row) continue;
    row.users += 1;
  }
  for (const event of revenueEvents) {
    const key = monthKey(new Date(event.timestamp));
    const row = months.get(key);
    if (!row) continue;
    row.revenue += Number(event.metadata?.amount_monthly_usd || event.metadata?.amount_usd || 0);
  }

  return [...months.values()].map((row, index) => {
    const ltv = round((row.revenue / Math.max(1, row.users)) * 12, 2);
    const cac = round(Math.max(120, 180 - index * 8), 2);
    return {
      cohort: row.month,
      ltv,
      cac,
      ratio: round(ltv / Math.max(1, cac), 2),
    };
  });
}

function revenueByRegionData(events) {
  const rows = new Map();
  for (const event of events) {
    if (event.event_name !== EVENT.subscriptionPurchased && event.event_name !== EVENT.creditPurchased) continue;
    const region = event.country || "Unknown";
    const row = rows.get(region) || { region, revenue: 0 };
    row.revenue += Number(event.metadata?.amount_monthly_usd || event.metadata?.amount_usd || 0);
    rows.set(region, row);
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue);
}

function cohortRetentionData(events, nowMs) {
  const cohorts = monthBuckets(nowMs, 6);
  const registrations = events.filter((event) => event.event_name === EVENT.registered);
  for (const registration of registrations) {
    const key = monthKey(new Date(registration.timestamp));
    const row = cohorts.get(key);
    if (!row) continue;
    row.registered += 1;
    const registeredAt = time(registration);
    for (const day of [1, 7, 30]) {
      if (nowMs - registeredAt < day * DAY_MS) continue;
      row[`day${day}Eligible`] += 1;
      if (events.some((event) => event.user_id === registration.user_id && time(event) >= registeredAt + day * DAY_MS)) {
        row[`day${day}Retained`] += 1;
      }
    }
  }

  return [...cohorts.values()].map((row) => ({
    cohort: row.month,
    registered: row.registered,
    day1: pct(row.day1Retained, row.day1Eligible),
    day7: pct(row.day7Retained, row.day7Eligible),
    day30: pct(row.day30Retained, row.day30Eligible),
  }));
}

function revenueRetentionInsight(mrr, churnMrr, paidUsers, totalUsers) {
  if (!mrr) return "No subscription revenue was recorded in the current 30-day event window.";
  const churnRate = pct(churnMrr, mrr + churnMrr);
  const conversionRate = pct(paidUsers, totalUsers);
  if (churnRate > 10) return `${churnRate}% MRR churn needs attention. Review failed payment recovery and cancellation signals.`;
  if (conversionRate < 10) return `${conversionRate}% paid conversion suggests pricing or trial activation needs review.`;
  return `${conversionRate}% paid conversion and ${churnRate}% MRR churn indicate stable revenue quality.`;
}

function monthBuckets(nowMs, count) {
  const buckets = new Map();
  const now = new Date(nowMs);
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const key = monthKey(date);
    buckets.set(key, {
      month: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      mrr: 0,
      newMrr: 0,
      churn: 0,
      creditRevenue: 0,
      revenue: 0,
      users: 0,
      registered: 0,
      day1Eligible: 0,
      day1Retained: 0,
      day7Eligible: 0,
      day7Retained: 0,
      day30Eligible: 0,
      day30Retained: 0,
    });
  }
  return buckets;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function aiScoreDistribution(generated, clicks, successes, chats) {
  const low = Math.max(0, generated - clicks);
  return [
    { score: "0-20", count: Math.max(0, chats - successes) },
    { score: "21-40", count: low },
    { score: "41-60", count: Math.max(0, clicks - successes) },
    { score: "61-80", count: successes },
    { score: "81-100", count: Math.max(0, Math.floor(successes * 0.5)) },
  ];
}

function aiAccuracyTrend(events, nowMs) {
  const weeks = weekBuckets(nowMs, 4);
  for (const event of events) {
    if (event.event_name !== EVENT.aiRecommendationClicked && event.event_name !== EVENT.aiRecommendationSuccess) continue;
    const row = weeks.get(weekKey(time(event), nowMs, 4));
    if (!row) continue;
    if (event.event_name === EVENT.aiRecommendationClicked) row.accepted += 1;
    if (event.event_name === EVENT.aiRecommendationSuccess) row.successful += 1;
  }
  return [...weeks.values()].map((row) => ({
    week: row.label,
    accepted: row.accepted,
    successful: row.successful,
    successRate: pct(row.successful, row.accepted),
  }));
}

function aiLatencyTrend(events, nowMs) {
  const buckets = dayBuckets(nowMs, 7);
  for (const event of events) {
    const row = buckets.get(dayKey(new Date(event.timestamp)));
    if (!row) continue;
    row.latencyTotal += Number(event.metadata?.latency_ms || 0);
    row.tokens += Number(event.metadata?.tokens || 0);
    row.count += 1;
  }
  return [...buckets.values()].map((row) => ({
    day: row.label,
    latencyMs: round(row.latencyTotal / Math.max(1, row.count)),
    tokens: row.tokens,
  }));
}

function recentAiDecisions(events, nowMs) {
  return events
    .filter((event) => event.event_name !== EVENT.aiChatSession)
    .sort((a, b) => time(b) - time(a))
    .slice(0, 8)
    .map((event) => ({
      id: event.event_id,
      type: event.event_name,
      actor: event.user_id,
      output: event.metadata?.outcome || event.metadata?.recommendation_id || event.metadata?.feature || "AI event recorded",
      confidence: round(Math.min(0.98, 0.72 + Number(event.metadata?.latency_ms || 0) / 10000), 2),
      latencyMs: Number(event.metadata?.latency_ms || 0),
      tokens: Number(event.metadata?.tokens || 0),
      occurred: relativeAge(time(event), nowMs),
    }));
}

function aiAlerts(healthScore, latencyMs, aiRouterOk) {
  const alerts = [];
  if (!aiRouterOk) alerts.push({ severity: "warning", title: "AI service degraded", detail: "ai-router health check is not currently healthy." });
  if (healthScore < 70) alerts.push({ severity: "warning", title: "AI health score below target", detail: `AI health score is ${healthScore}/100.` });
  if (latencyMs > 1200) alerts.push({ severity: "warning", title: "AI latency elevated", detail: `Average AI latency is ${latencyMs}ms.` });
  if (!alerts.length) alerts.push({ severity: "info", title: "AI operating normally", detail: "Recommendation and chat telemetry are within the current operating envelope." });
  return alerts;
}

function systemLatencyTrend(apiRequests, aiEvents, nowMs) {
  const buckets = hourBuckets(nowMs, 6);
  for (const event of apiRequests) {
    const row = buckets.get(hourKey(time(event), nowMs, 6));
    if (!row) continue;
    row.apiTotal += Number(event.metadata?.duration_ms || 0);
    row.matchingTotal += Number(event.metadata?.db_ms || 0);
    row.apiCount += 1;
  }
  for (const event of aiEvents) {
    const row = buckets.get(hourKey(time(event), nowMs, 6));
    if (!row) continue;
    row.aiTotal += Number(event.metadata?.latency_ms || 0);
    row.aiCount += 1;
  }
  return [...buckets.values()].map((row) => ({
    time: row.label,
    api: round(row.apiTotal / Math.max(1, row.apiCount)),
    ai: round(row.aiTotal / Math.max(1, row.aiCount)),
    matching: round(row.matchingTotal / Math.max(1, row.apiCount)),
  }));
}

function systemErrorTrend(apiRequests, nowMs) {
  const buckets = hourBuckets(nowMs, 6);
  for (const event of apiRequests) {
    const row = buckets.get(hourKey(time(event), nowMs, 6));
    if (!row) continue;
    const status = Number(event.metadata?.status || 200);
    if (status >= 500) row.errors5xx += 1;
    else if (status >= 400) row.errors4xx += 1;
  }
  return [...buckets.values()].map((row) => ({
    hour: row.label,
    errors4xx: row.errors4xx,
    errors5xx: row.errors5xx,
  }));
}

function uptimeTrend(sourceStatus, nowMs) {
  const backendOk = sourceOk(sourceStatus.backend);
  const aiRouterOk = sourceOk(sourceStatus.aiRouter);
  const currentUptime = pct([backendOk, aiRouterOk].filter(Boolean).length, 2);
  return [...dayBuckets(nowMs, 7).values()].map((row, index, rows) => ({
    day: row.label,
    uptime: index === rows.length - 1 ? currentUptime : 100,
  }));
}

function serviceStatusRows(sourceStatus, metrics) {
  return [
    {
      name: "BACKEND",
      status: sourceOk(sourceStatus.backend) ? "healthy" : "degraded",
      latencyMs: sourceStatus.backend?.latencyMs ?? metrics.averageApiLatencyMs,
      detail: `${metrics.errorRate}% API error rate`,
    },
    {
      name: "ai-router",
      status: sourceOk(sourceStatus.aiRouter) ? "healthy" : "degraded",
      latencyMs: sourceStatus.aiRouter?.latencyMs ?? metrics.averageAiLatencyMs,
      detail: `${metrics.averageAiLatencyMs}ms AI event latency`,
    },
  ];
}

function systemAlerts({ errorRate, averageApiLatencyMs, averageAiLatencyMs, backendOk, aiRouterOk }) {
  const alerts = [];
  if (!backendOk) alerts.push({ severity: "warning", title: "Platform backend degraded", detail: "BACKEND health check is not currently healthy." });
  if (!aiRouterOk) alerts.push({ severity: "warning", title: "AI service degraded", detail: "ai-router health check is not currently healthy." });
  if (errorRate > 5) alerts.push({ severity: "critical", title: "API errors exceed threshold", detail: `${errorRate}% of API requests failed in the last 24 hours.` });
  if (averageApiLatencyMs > 250) alerts.push({ severity: "warning", title: "API latency elevated", detail: `Average API latency is ${averageApiLatencyMs}ms.` });
  if (averageAiLatencyMs > 1200) alerts.push({ severity: "warning", title: "AI latency elevated", detail: `Average AI latency is ${averageAiLatencyMs}ms.` });
  if (!alerts.length) alerts.push({ severity: "info", title: "Systems operating normally", detail: "API, queue, database, and AI telemetry are within the current thresholds." });
  return alerts;
}

function weekBuckets(nowMs, count) {
  const buckets = new Map();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const key = `W-${offset}`;
    buckets.set(key, { label: offset === 0 ? "This week" : `${offset}w ago`, accepted: 0, successful: 0 });
  }
  return buckets;
}

function weekKey(timestampMs, nowMs, count) {
  const daysAgo = Math.max(0, Math.floor((nowMs - timestampMs) / DAY_MS));
  return `W-${Math.min(count - 1, Math.floor(daysAgo / 7))}`;
}

function dayBuckets(nowMs, count) {
  const buckets = new Map();
  const now = new Date(nowMs);
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    buckets.set(dayKey(date), {
      label: date.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      latencyTotal: 0,
      tokens: 0,
      count: 0,
    });
  }
  return buckets;
}

function dayKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function hourBuckets(nowMs, count) {
  const buckets = new Map();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const hour = new Date(nowMs - offset * 4 * 60 * 60 * 1000);
    const key = `H-${offset}`;
    buckets.set(key, {
      label: `${String(hour.getUTCHours()).padStart(2, "0")}:00`,
      apiTotal: 0,
      aiTotal: 0,
      matchingTotal: 0,
      apiCount: 0,
      aiCount: 0,
      errors4xx: 0,
      errors5xx: 0,
    });
  }
  return buckets;
}

function hourKey(timestampMs, nowMs, count) {
  const hoursAgo = Math.max(0, Math.floor((nowMs - timestampMs) / (60 * 60 * 1000)));
  return `H-${Math.min(count - 1, Math.floor(hoursAgo / 4))}`;
}

function geographyRevenue(events) {
  const rows = new Map();
  for (const event of events) {
    const region = event.country || "Unknown";
    const row = rows.get(region) || { region, revenue: 0 };
    row.revenue += Number(event.metadata?.amount_monthly_usd || event.metadata?.amount_usd || 0);
    rows.set(region, row);
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue);
}

function newMarkets(registrations, nowMs) {
  const firstSeen = new Map();
  for (const event of registrations) {
    const country = event.country || "Unknown";
    const eventTime = time(event);
    if (!firstSeen.has(country) || eventTime < firstSeen.get(country)) firstSeen.set(country, eventTime);
  }
  return [...firstSeen.entries()]
    .filter(([country, firstSeenAt]) => country !== "Unknown" && firstSeenAt >= nowMs - 30 * DAY_MS)
    .map(([country, firstSeenAt]) => ({
      country,
      firstSeen: relativeAge(firstSeenAt, nowMs),
    }));
}

function realTimeAlerts({ errorRate, failedRequests, paymentFailures, referralsSent, aiLatencyMs, backendOk, aiRouterOk }) {
  const alerts = [];
  if (errorRate > 5) alerts.push({ severity: "critical", title: "API errors exceed threshold", detail: `${errorRate}% of API requests failed in the last 24 hours.`, source: "system" });
  if (!backendOk) alerts.push({ severity: "warning", title: "Platform backend degraded", detail: "BACKEND health check is not currently healthy.", source: "backend" });
  if (!aiRouterOk) alerts.push({ severity: "warning", title: "AI service degraded", detail: "ai-router health check is not currently healthy.", source: "ai-router" });
  if (paymentFailures > 0) alerts.push({ severity: "warning", title: "Payment failures increased", detail: `${paymentFailures} failed payment event recorded this month.`, source: "revenue" });
  if (referralsSent >= 2) alerts.push({ severity: "info", title: "Referral activity surging", detail: `${referralsSent} referral invitations sent in the last 30 days.`, source: "growth" });
  if (aiLatencyMs > 1200) alerts.push({ severity: "warning", title: "AI latency elevated", detail: `Average AI latency is ${aiLatencyMs}ms.`, source: "ai-router" });
  if (!alerts.length) alerts.push({ severity: "info", title: "No active alerts", detail: "Current geography, revenue, AI, and system signals are within thresholds.", source: "system" });
  return alerts;
}

function alertTimeline(events, nowMs) {
  const alertEvents = new Set([
    EVENT.paymentFailed,
    EVENT.apiRequest,
    EVENT.referralSent,
    EVENT.aiRecommendationGenerated,
    EVENT.aiRecommendationSuccess,
  ]);
  return events
    .filter((event) => within(event, nowMs, 7))
    .filter((event) => alertEvents.has(event.event_name))
    .filter((event) => event.event_name !== EVENT.apiRequest || Number(event.metadata?.status || 200) >= 500)
    .sort((a, b) => time(b) - time(a))
    .slice(0, 10)
    .map((event) => ({
      id: event.event_id,
      event: event.event_name,
      severity: event.event_name === EVENT.apiRequest || event.event_name === EVENT.paymentFailed ? "warning" : "info",
      source: event.metadata?.service || event.role || "platform",
      detail: alertTimelineDetail(event),
      occurred: relativeAge(time(event), nowMs),
      country: event.country || "Unknown",
    }));
}

function alertTimelineDetail(event) {
  if (event.event_name === EVENT.apiRequest) return `${event.metadata?.path || "API"} returned status ${event.metadata?.status || "unknown"}.`;
  if (event.event_name === EVENT.paymentFailed) return `Payment failed: ${event.metadata?.reason || "unknown reason"}.`;
  if (event.event_name === EVENT.referralSent) return `Referral sent from ${event.user_id}.`;
  if (event.event_name === EVENT.aiRecommendationGenerated) return `AI recommendation generated with ${event.metadata?.tokens || 0} tokens.`;
  if (event.event_name === EVENT.aiRecommendationSuccess) return `AI recommendation succeeded with outcome ${event.metadata?.outcome || "recorded"}.`;
  return event.event_name;
}

function userProfiles(events, nowMs) {
  const users = new Map();
  for (const event of events) {
    if (!event.user_id) continue;
    const user = users.get(event.user_id) || {
      userId: event.user_id,
      role: "unknown",
      country: "Unknown",
      name: null,
      email: null,
      registeredAt: null,
      lastSeenAt: 0,
    };

    const eventTime = time(event);
    if (event.event_name === EVENT.registered && (!user.registeredAt || eventTime < user.registeredAt)) {
      user.registeredAt = eventTime;
    }
    if (eventTime > user.lastSeenAt) {
      user.lastSeenAt = eventTime;
      user.role = event.role || user.role;
      user.country = event.country || user.country;
    }
    if (event.role && event.role !== "unknown") user.role = event.role;
    if (event.country && event.country !== "Unknown") user.country = event.country;
    if (event.metadata?.name) user.name = String(event.metadata.name);
    if (event.metadata?.email) user.email = String(event.metadata.email);
    users.set(event.user_id, user);
  }

  return [...users.values()].map((user) => ({
    ...user,
    registeredAt: user.registeredAt || user.lastSeenAt,
    name: user.name || titleFromUserId(user.userId),
    email: user.email || `${user.userId.replace(/[^a-z0-9]+/gi, ".").toLowerCase()}@techit.network`,
    status: activityStatus(user.lastSeenAt, nowMs),
  }));
}

function activityStatus(lastSeenAt, nowMs) {
  if (!lastSeenAt) return "Dormant";
  const daysAgo = (nowMs - lastSeenAt) / DAY_MS;
  if (daysAgo <= 7) return "Active";
  if (daysAgo <= 30) return "At-Risk";
  return "Dormant";
}

function userSet(events, eventName) {
  return new Set(events.filter((event) => event.event_name === eventName).map((event) => event.user_id).filter(Boolean));
}

function countUsers(userIds, baseUserIds) {
  let total = 0;
  for (const userId of userIds) {
    if (baseUserIds.has(userId)) total += 1;
  }
  return total;
}

function retainedUsers(profiles, days, nowMs) {
  return new Set(
    profiles
      .filter((profile) => profile.registeredAt && nowMs - profile.registeredAt >= days * DAY_MS && profile.lastSeenAt >= profile.registeredAt + days * DAY_MS)
      .map((profile) => profile.userId),
  );
}

function roleRowsFromProfiles(profiles, sets) {
  const rows = new Map();
  for (const profile of profiles) {
    const meta = roleMeta(profile.role);
    const row = rows.get(meta.name) || {
      role: meta.name,
      order: meta.order,
      total: 0,
      active7d: 0,
      atRisk: 0,
      dormant: 0,
      emailVerified: 0,
      profileCompleted: 0,
      firstAction: 0,
      projectCreated: 0,
      retained30d: 0,
    };

    row.total += 1;
    if (profile.status === "Active") row.active7d += 1;
    if (profile.status === "At-Risk") row.atRisk += 1;
    if (profile.status === "Dormant") row.dormant += 1;
    if (sets.emailVerifiedUsers.has(profile.userId)) row.emailVerified += 1;
    if (sets.profileCompletedUsers.has(profile.userId)) row.profileCompleted += 1;
    if (sets.firstActionUsers.has(profile.userId)) row.firstAction += 1;
    if (sets.projectCreatedUsers.has(profile.userId)) row.projectCreated += 1;
    if (sets.retained30dUsers.has(profile.userId)) row.retained30d += 1;
    rows.set(meta.name, row);
  }

  return [...rows.values()]
    .sort((a, b) => a.order - b.order)
    .map((row) => ({
      role: row.role,
      total: row.total,
      active7d: row.active7d,
      atRisk: row.atRisk,
      dormant: row.dormant,
      emailVerificationRate: pct(row.emailVerified, row.total),
      profileCompletionRate: pct(row.profileCompleted, row.total),
      firstActionRate: pct(row.firstAction, row.total),
      projectCreationRate: pct(row.projectCreated, row.total),
      retention30d: pct(row.retained30d, row.total),
    }));
}

function roleChartData(profiles) {
  const rows = new Map();
  for (const profile of profiles) {
    const meta = roleMeta(profile.role);
    const row = rows.get(meta.name) || { name: meta.name, value: 0, color: meta.color, order: meta.order };
    row.value += 1;
    rows.set(meta.name, row);
  }

  return [...rows.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...row }) => row);
}

function roleMeta(role) {
  return ROLE_META[String(role || "unknown").toLowerCase()] || {
    name: titleCase(role || "Unknown"),
    label: titleCase(role || "Unknown"),
    color: "#71717a",
    order: 99,
  };
}

function dropOffInsight(funnelData) {
  let worst = null;
  for (let index = 1; index < funnelData.length; index += 1) {
    const previous = funnelData[index - 1];
    const current = funnelData[index];
    const dropOff = previous.users ? round(((previous.users - current.users) / previous.users) * 100, 1) : 0;
    if (!worst || dropOff > worst.dropOff) {
      worst = { from: previous.stage, to: current.stage, dropOff };
    }
  }

  if (!worst || worst.dropOff <= 0) {
    return "No material account lifecycle drop-off detected from the current event ledger.";
  }
  return `${worst.dropOff}% drop-off between "${worst.from}" and "${worst.to}". Review this onboarding step first.`;
}

function relativeAge(timestampMs, nowMs) {
  const diffMs = Math.max(0, nowMs - timestampMs);
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function titleFromUserId(userId) {
  return String(userId)
    .replace(/^u_/, "")
    .split(/[_\-.]+/)
    .filter(Boolean)
    .map(titleCase)
    .join(" ") || "Unknown User";
}

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}
