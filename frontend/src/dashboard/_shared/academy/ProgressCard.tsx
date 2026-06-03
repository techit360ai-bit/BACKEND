import { ArrowRight, Award, Target } from "lucide-react";
import { motion } from "motion/react";
import { Card } from "@/dashboard/collaborators/section/components/ui/card";
import { Progress } from "@/dashboard/collaborators/section/components/ui/progress";
import { Button } from "@/dashboard/collaborators/section/components/ui/button";

interface ProgressCardProps {
  currentWeek: number;
  totalWeeks: number;
  progressPercent: number;
  nextLessonTitle: string;
  completedTasks: number;
  totalTasks: number;
  onContinue?: () => void;
}

export function ProgressCard({
  currentWeek,
  totalWeeks,
  progressPercent,
  nextLessonTitle,
  completedTasks,
  totalTasks,
  onContinue,
}: ProgressCardProps) {
  return (
    <Card className="p-6 bg-gradient-to-br from-purple-50 via-white to-blue-50 border-purple-200">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Your Journey</h3>
            <p className="text-sm text-gray-600 mt-1">
              Week {currentWeek} of {totalWeeks}
            </p>
          </div>
          <div className="bg-purple-100 p-2 rounded-lg">
            <Target className="size-5 text-purple-600" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Overall Progress</span>
            <span className="font-semibold text-purple-700">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-2xl font-semibold text-gray-900">{completedTasks}</div>
            <div className="text-xs text-gray-600 mt-1">Tasks Completed</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-2xl font-semibold text-gray-900">{totalTasks - completedTasks}</div>
            <div className="text-xs text-gray-600 mt-1">Tasks Remaining</div>
          </div>
        </div>

        {/* Next Lesson */}
        <div className="bg-white p-4 rounded-lg border border-purple-200 space-y-3">
          <div className="flex items-start gap-2">
            <Award className="size-4 text-purple-600 mt-0.5" />
            <div>
              <p className="text-xs text-gray-600">Next Lesson</p>
              <p className="font-medium text-gray-900 text-sm mt-1">{nextLessonTitle}</p>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={onContinue}>
              Continue Lesson
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </div>
    </Card>
  );
}
