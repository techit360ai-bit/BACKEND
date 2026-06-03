import { Award, Lock, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { Card } from "@/dashboard/collaborators/section/components/ui/card";
import { Badge as BadgePrimitive } from "@/dashboard/collaborators/section/components/ui/badge";
import type { AcademyBadge } from "./curriculum";

interface BadgeDisplayProps {
  badges: AcademyBadge[];
  earnedBadgeIds: string[];
}

export function BadgeDisplay({ badges, earnedBadgeIds }: BadgeDisplayProps) {
  const isEarned = (badgeId: string) => earnedBadgeIds.includes(badgeId);

  const getBadgeColor = (category: string) => {
    switch (category) {
      case "founder":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "collaborator":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const earnedCount = badges.filter((b) => isEarned(b.id)).length;
  const totalCount = badges.length;
  const progressPercent = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Your Badges</h3>
            <p className="text-sm text-gray-600 mt-1">
              {earnedCount} of {totalCount} earned
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-gray-900">{Math.round(progressPercent)}%</div>
            <div className="text-xs text-gray-600">Complete</div>
          </div>
        </div>

        {/* Badge Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {badges.map((badge, index) => {
            const earned = isEarned(badge.id);
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div
                  className={`p-4 rounded-lg border-2 transition-all ${
                    earned
                      ? getBadgeColor(badge.category) + " shadow-sm"
                      : "bg-gray-50 border-gray-200 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${earned ? "bg-white/80" : "bg-gray-100"}`}>
                      {earned ? (
                        <CheckCircle2 className="size-5 text-current" />
                      ) : (
                        <Lock className="size-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm text-gray-900">{badge.name}</h4>
                        {badge.level && (
                          <BadgePrimitive variant="outline" className="h-5 px-1.5 text-xs">
                            L{badge.level}
                          </BadgePrimitive>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{badge.description}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          <Award className="size-4" />
          <span>Badges boost your credibility score and investor visibility</span>
        </div>
      </div>
    </Card>
  );
}
