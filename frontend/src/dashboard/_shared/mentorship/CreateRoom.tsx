import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/dashboard/investors/section/components/ui/card";
import { Label } from "@/dashboard/investors/section/components/ui/label";
import { Input } from "@/dashboard/investors/section/components/ui/input";
import { Textarea } from "@/dashboard/investors/section/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/dashboard/investors/section/components/ui/select";
import { Switch } from "@/dashboard/investors/section/components/ui/switch";
import { ACCENT_SOLID, ACCENT_SOFT, NEUTRAL_BTN } from "./theme";
import { toast } from "sonner";

const BASE = "/investor/mentorship";

export function CreateRoom() {
  const navigate = useNavigate();
  const [paymentModel, setPaymentModel] = useState<string>("");
  const [isAdvancedHub, setIsAdvancedHub] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo: in a real app this would persist the room.
    toast.success("Mentorship room created successfully!");
    setTimeout(() => navigate(BASE), 1000);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(BASE)}
          className="rounded-lg p-2 transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="mb-1 text-3xl">Create Mentorship Room</h1>
          <p className="text-muted-foreground">
            Set up a new space to mentor and guide aspiring entrepreneurs
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="room-name">Room Name *</Label>
              <Input id="room-name" placeholder="e.g., SaaS Development Mastery" required />
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe what mentees will learn and achieve in this room..."
                rows={4}
                required
              />
            </div>
            <div>
              <Label htmlFor="expertise">Your Expertise (comma separated)</Label>
              <Input id="expertise" placeholder="e.g., SaaS, Product Management, Go-to-Market" />
            </div>
          </CardContent>
        </Card>

        {/* Capacity Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Capacity &amp; Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="capacity">Maximum Mentees *</Label>
              <Input id="capacity" type="number" min="1" max="50" placeholder="e.g., 5" required />
              <p className="mt-1 text-sm text-muted-foreground">
                How many mentees can you effectively mentor at once?
              </p>
            </div>

            <div className={`flex items-center justify-between rounded-lg p-4 ${ACCENT_SOFT}`}>
              <div>
                <Label htmlFor="advanced-hub" className="cursor-pointer">
                  Create as Advanced Mentorship Hub
                </Label>
                <p className="mt-1 text-sm opacity-80">
                  Enable multi-mentor coordination and advanced features
                </p>
              </div>
              <Switch id="advanced-hub" checked={isAdvancedHub} onCheckedChange={setIsAdvancedHub} />
            </div>
          </CardContent>
        </Card>

        {/* Payment Model */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Model *</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="payment-model">Select Payment Structure</Label>
              <Select value={paymentModel} onValueChange={setPaymentModel} required>
                <SelectTrigger id="payment-model">
                  <SelectValue placeholder="Choose payment model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly Rate</SelectItem>
                  <SelectItem value="monthly">Monthly Subscription</SelectItem>
                  <SelectItem value="equity">Equity-Based</SelectItem>
                  <SelectItem value="hybrid">Hybrid (Cash + Equity)</SelectItem>
                  <SelectItem value="free">Free (Pro Bono)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentModel === "hourly" && (
              <div>
                <Label htmlFor="hourly-rate">Hourly Rate (USD)</Label>
                <Input id="hourly-rate" type="number" placeholder="e.g., 150" required />
              </div>
            )}

            {paymentModel === "monthly" && (
              <div>
                <Label htmlFor="monthly-rate">Monthly Rate (USD)</Label>
                <Input id="monthly-rate" type="number" placeholder="e.g., 2000" required />
              </div>
            )}

            {paymentModel === "equity" && (
              <div>
                <Label htmlFor="equity-percentage">Equity Percentage</Label>
                <Input
                  id="equity-percentage"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  placeholder="e.g., 5"
                  required
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Typical range: 2-10% for comprehensive mentorship
                </p>
              </div>
            )}

            {paymentModel === "hybrid" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hybrid-cash">Monthly Cash (USD)</Label>
                  <Input id="hybrid-cash" type="number" placeholder="e.g., 1000" required />
                </div>
                <div>
                  <Label htmlFor="hybrid-equity">Equity Percentage</Label>
                  <Input
                    id="hybrid-equity"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    placeholder="e.g., 2.5"
                    required
                  />
                </div>
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Note:</strong> All payments and equity agreements must be formalized with
                proper legal documentation. TECHIT provides templates but consult with legal counsel.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Mentee Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>Mentee Requirements (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="required-skills">Required Skills</Label>
              <Input
                id="required-skills"
                placeholder="e.g., Basic coding knowledge, Business fundamentals"
              />
            </div>
            <div>
              <Label htmlFor="application-questions">Custom Application Questions</Label>
              <Textarea
                id="application-questions"
                placeholder="Enter custom questions for applicants (one per line)"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(BASE)}
            className={`flex-1 rounded-lg px-6 py-3 ${NEUTRAL_BTN}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`flex-1 rounded-lg px-6 py-3 transition-colors ${ACCENT_SOLID}`}
          >
            Create Mentorship Room
          </button>
        </div>
      </form>
    </div>
  );
}
