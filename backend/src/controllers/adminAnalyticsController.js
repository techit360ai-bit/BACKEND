import {
  aiSystemHealthDashboard,
  geographyAlertsDashboard,
  missionControlDashboard,
  referralCollaborationDashboard,
  revenueRetentionDashboard,
  trustMilestoneReviewsDashboard,
  userAnalyticsDashboard,
} from '../services/adminAnalyticsService.js'

function analyticsResponse(loader) {
  return async (_req, res) => {
    try {
      return res.json(await loader())
    } catch (error) {
      console.error(JSON.stringify({
        event: 'admin_analytics_failed',
        error: error instanceof Error ? error.message : String(error),
      }))
      return res.status(503).json({ error: 'admin_analytics_unavailable' })
    }
  }
}

export const adminMissionControl = analyticsResponse(missionControlDashboard)
export const adminUserAnalytics = analyticsResponse(userAnalyticsDashboard)
export const adminReferralCollaboration = analyticsResponse(referralCollaborationDashboard)
export const adminRevenueRetention = analyticsResponse(revenueRetentionDashboard)
export const adminAiSystemHealth = analyticsResponse(aiSystemHealthDashboard)
export const adminGeographyAlerts = analyticsResponse(geographyAlertsDashboard)
export const adminTrustMilestoneReviews = analyticsResponse(trustMilestoneReviewsDashboard)
