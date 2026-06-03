import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import { Academy } from "@/dashboard/_shared/academy/Academy";

export function AcademyPage() {
  const navigate = useNavigate();
  const { collaboratorProfile } = useCollaboratorProfile();
  const firstName = collaboratorProfile.name.split(" ")[0];

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 lg:px-8 pt-6">
        <button
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/collaborator/dashboard");
          }}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
      <div className="flex-1">
        {/* Collaborator role only ever sees the collaborator track */}
        <Academy role="collaborator" userName={firstName} />
      </div>
    </div>
  );
}
