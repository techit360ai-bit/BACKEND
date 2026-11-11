# Workspace Conversational AI & Idea Analysis Improvement Plan

**Objective:** Extend TechIT Network's Workspace and Incubation FastTrack to provide a seamless conversational software creation and autonomous engineering experience (DISCUSS, PLAN, BUILD modes) while reusing existing components and backend agent routing.

---

## 1. Audit Findings: What Exists vs. What is Deficient

| Feature Area | Existing Implementation | Identified Gaps / Deficiencies | Enhancement Strategy |
|---|---|---|---|
| **Idea Analysis & FastTrack** | Structured multi-step form (`FastTrackPanel.tsx`) and evaluation runner. | Lacks iterative conversational follow-up where the AI asks adaptive questions and refines venture assumptions dynamically. | Add a conversational follow-up pane in FastTrack / Incubation view allowing founders to refine ideas interactively before/during generation. |
| **Workspace Operating Modes** | Separate chat/copilot (`Copilot.tsx`) and code editor views (`Code.tsx`). | Explicit DISCUSS, PLAN, and BUILD operational switching with context preservation is implicit. | Expose clear mode toggle (DISCUSS / PLAN / BUILD) in Workspace chat / copilot composer (`Composer.tsx`). |
| **Agent Prompt & Routing** | 34 specialist agents and AI Router core (`ai_router_core.py`). | Prompt templates need explicit alignment with conversational software creation principles ( Lovable/Rork-inspired). | Extend agent system prompts in `ai-router` for autonomous execution and conversational planning. |

---

## 2. Proposed Implementation Steps

1. **FastTrack Conversational Refinement**:
   - Add a conversational refinement assistant to `FastTrackPanel.tsx` enabling real-time dialogue on venture assumptions.
2. **Workspace DISCUSS / PLAN / BUILD Mode Selector**:
   - Update Workspace Copilot / Chat header / composer to let users toggle operating modes (`Discuss`, `Plan`, `Build`) with tailored system instructions.
3. **Local Commit & Demo Preparation**:
   - Document and commit implementation locally without forbidden author attributions.
   - Prepare a local demo verification script.
