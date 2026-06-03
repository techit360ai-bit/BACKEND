import { useState } from "react";
import {
  BookOpen, CheckCircle2, Clock, Lightbulb, ListChecks, MessageCircle,
  Download, ArrowLeft,
} from "lucide-react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { Card } from "@/dashboard/collaborators/section/components/ui/card";
import { Button } from "@/dashboard/collaborators/section/components/ui/button";
import { Checkbox } from "@/dashboard/collaborators/section/components/ui/checkbox";
import { AudioPlayer } from "./AudioPlayer";
import type { Lesson } from "./curriculum";

interface LessonViewProps {
  lesson: Lesson;
  totalWeeks: number;
  onComplete?: () => void;
  onBack?: () => void;
}

export function LessonView({ lesson, totalWeeks, onComplete, onBack }: LessonViewProps) {
  const [taskCompletion, setTaskCompletion] = useState<Record<number, boolean>>({});
  const [reflectionText, setReflectionText] = useState("");

  const allTasksComplete = lesson.task.items.every((_, index) => taskCompletion[index]);

  const handleTaskToggle = (index: number) => {
    setTaskCompletion((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleMarkComplete = () => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    onComplete?.();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="size-4" />
        Back to Academy
      </Button>

      {/* Lesson Header */}
      <Card className="p-8 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-indigo-600">
            <BookOpen className="size-4" />
            <span>Week {lesson.week} of {totalWeeks}</span>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">{lesson.title}</h1>
            <p className="text-xl text-gray-700 mt-2">{lesson.subtitle}</p>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="size-4" />
              <span>{lesson.duration}</span>
            </div>
            <div className="flex items-center gap-2">
              <ListChecks className="size-4" />
              <span>{lesson.task.items.length} tasks</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Audio Player (with future video option) */}
      <AudioPlayer title={lesson.title} duration={lesson.duration} />

      {/* Key Insight */}
      <Card className="p-6 border-l-4 border-l-yellow-400 bg-yellow-50">
        <div className="flex gap-3">
          <Lightbulb className="size-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Key Insight</h3>
            <p className="text-gray-700 leading-relaxed">{lesson.keyInsight}</p>
          </div>
        </div>
      </Card>

      {/* What You'll Learn */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">What You'll Learn</h3>
        <ul className="space-y-3">
          {lesson.learnings.map((learning, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-3"
            >
              <CheckCircle2 className="size-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{learning}</span>
            </motion.li>
          ))}
        </ul>
      </Card>

      {/* Tasks */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks className="size-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">{lesson.task.title}</h3>
          </div>

          <div className="space-y-3">
            {lesson.task.items.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-white rounded-lg border border-blue-200"
              >
                <Checkbox
                  id={`task-${index}`}
                  checked={taskCompletion[index] || false}
                  onCheckedChange={() => handleTaskToggle(index)}
                  className="mt-0.5"
                />
                <label
                  htmlFor={`task-${index}`}
                  className={`flex-1 cursor-pointer ${
                    taskCompletion[index] ? "line-through text-gray-500" : "text-gray-700"
                  }`}
                >
                  {item}
                </label>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Reflection Question */}
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Reflection Question</h3>
          </div>

          <p className="text-gray-700 italic">{lesson.reflectionQuestion}</p>

          <textarea
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
            placeholder="Write your reflection here..."
            className="w-full min-h-[120px] p-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>
      </Card>

      {/* Action Buttons */}
      <Card className="p-6">
        <div className="flex flex-wrap gap-3">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 min-w-[200px]"
          >
            <Button
              onClick={handleMarkComplete}
              disabled={!allTasksComplete}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white disabled:opacity-50"
            >
              <CheckCircle2 className="size-4 mr-2" />
              Mark Complete
            </Button>
          </motion.div>

          <Button variant="outline" className="gap-2">
            <Download className="size-4" />
            Download Notes
          </Button>
        </div>

        {!allTasksComplete && (
          <p className="text-sm text-gray-600 mt-3 text-center">
            Complete all tasks to mark this lesson as done
          </p>
        )}
      </Card>
    </div>
  );
}
