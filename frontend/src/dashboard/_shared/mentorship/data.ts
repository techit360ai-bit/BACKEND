// Mock data for the Mentorship Hub, ported from the prototype
// (~/Downloads/Mentorship Room Prototype/src/app/data/mockData.ts).
//
// This is demo data so the hub renders end-to-end before a backend exists.
// The `mentorshipRoomsAsOpportunities` helper at the bottom bridges this data
// into the cross-section Opportunity Hub so open rooms surface as announcements.

import type { Program } from "../opportunities/types";

export interface Mentee {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status: "active" | "pending" | "completed";
  progress: number;
  joinedDate: string;
  skills: string[];
  goals: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  status: "pending" | "in-progress" | "completed" | "overdue";
  priority: "low" | "medium" | "high";
  reward?: string;
}

export interface MentorshipRoom {
  id: string;
  name: string;
  description: string;
  mentor: {
    name: string;
    avatar: string;
    expertise: string[];
  };
  menteeCount: number;
  paymentModel: "hourly" | "monthly" | "equity" | "hybrid";
  rate?: string;
  equityPercentage?: number;
  capacity: number;
  createdDate: string;
}

export interface Application {
  id: string;
  applicantName: string;
  email: string;
  avatar: string;
  appliedDate: string;
  roomId: string;
  roomName: string;
  coverLetter: string;
  skills: string[];
  experience: string;
  status: "pending" | "accepted" | "rejected";
}

export const mockMentees: Mentee[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    status: "active",
    progress: 65,
    joinedDate: "2026-01-15",
    skills: ["React", "TypeScript", "Node.js"],
    goals: "Build a full-stack SaaS product and launch it within 6 months",
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "michael.c@email.com",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    status: "active",
    progress: 42,
    joinedDate: "2026-02-20",
    skills: ["Python", "ML", "Data Science"],
    goals: "Develop AI-powered analytics platform for startups",
  },
  {
    id: "3",
    name: "Emma Williams",
    email: "emma.w@email.com",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
    status: "active",
    progress: 78,
    joinedDate: "2025-12-01",
    skills: ["UI/UX", "Figma", "Product Design"],
    goals: "Create a design system and monetize it",
  },
];

export const mockTasks: Task[] = [
  {
    id: "1",
    title: "Complete MVP Design",
    description: "Create wireframes and high-fidelity mockups for the core features",
    assignedTo: "1",
    dueDate: "2026-04-20",
    status: "in-progress",
    priority: "high",
    reward: "2% equity",
  },
  {
    id: "2",
    title: "Backend API Development",
    description: "Build REST API endpoints for user authentication and data management",
    assignedTo: "2",
    dueDate: "2026-04-25",
    status: "pending",
    priority: "high",
    reward: "$500",
  },
  {
    id: "3",
    title: "Market Research Report",
    description: "Analyze competitor landscape and identify unique value propositions",
    assignedTo: "1",
    dueDate: "2026-04-18",
    status: "completed",
    priority: "medium",
    reward: "$300",
  },
  {
    id: "4",
    title: "Database Schema Design",
    description: "Design scalable database architecture for the platform",
    assignedTo: "3",
    dueDate: "2026-04-15",
    status: "overdue",
    priority: "high",
    reward: "1.5% equity",
  },
];

export const mockRooms: MentorshipRoom[] = [
  {
    id: "1",
    name: "SaaS Development Mastery",
    description: "Learn to build, launch, and scale SaaS products from scratch",
    mentor: {
      name: "Alex Thompson",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
      expertise: ["SaaS", "Product Management", "Go-to-Market"],
    },
    menteeCount: 3,
    paymentModel: "equity",
    equityPercentage: 5,
    capacity: 5,
    createdDate: "2025-11-01",
  },
  {
    id: "2",
    name: "Startup Fundraising Strategy",
    description: "Master the art of pitching and raising capital from investors",
    mentor: {
      name: "Alex Thompson",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
      expertise: ["Fundraising", "Investor Relations", "Pitch Deck"],
    },
    menteeCount: 2,
    paymentModel: "monthly",
    rate: "$2,000/month",
    capacity: 4,
    createdDate: "2026-01-15",
  },
];

export const mockApplications: Application[] = [
  {
    id: "1",
    applicantName: "David Park",
    email: "david.park@email.com",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    appliedDate: "2026-04-10",
    roomId: "1",
    roomName: "SaaS Development Mastery",
    coverLetter:
      "I am passionate about building SaaS products and have experience with React and Node.js. I am looking to take my skills to the next level and launch my own product.",
    skills: ["JavaScript", "React", "AWS"],
    experience: "3 years as frontend developer",
    status: "pending",
  },
  {
    id: "2",
    applicantName: "Lisa Anderson",
    email: "lisa.a@email.com",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150",
    appliedDate: "2026-04-12",
    roomId: "1",
    roomName: "SaaS Development Mastery",
    coverLetter:
      "I have been working on my startup idea for 6 months and need guidance on product strategy and technical architecture.",
    skills: ["Python", "Django", "PostgreSQL"],
    experience: "5 years as backend engineer",
    status: "pending",
  },
  {
    id: "3",
    applicantName: "James Wilson",
    email: "james.w@email.com",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150",
    appliedDate: "2026-04-08",
    roomId: "2",
    roomName: "Startup Fundraising Strategy",
    coverLetter:
      "I am preparing to raise a seed round for my fintech startup and would love mentorship on pitch strategy.",
    skills: ["Business Development", "Financial Modeling"],
    experience: "Serial entrepreneur, 2 exits",
    status: "pending",
  },
];

export const analyticsData = {
  totalMentees: 12,
  activeMentees: 8,
  completedMentees: 3,
  totalRevenue: 24500,
  equityDistributed: 12.5,
  averageProgress: 62,
  tasksCompleted: 47,
  totalTasks: 68,
  monthlyGrowth: [
    { month: "Nov", mentees: 2, revenue: 4000 },
    { month: "Dec", mentees: 4, revenue: 8000 },
    { month: "Jan", mentees: 6, revenue: 12000 },
    { month: "Feb", mentees: 8, revenue: 16500 },
    { month: "Mar", mentees: 10, revenue: 20000 },
    { month: "Apr", mentees: 12, revenue: 24500 },
  ],
};

/** The investor presenting these rooms — shown as the organizer of announcements. */
const MENTORSHIP_ORGANIZER = {
  id: "investor_mentorship",
  name: "Investor Mentorship",
  logoEmoji: "🎓",
};

/**
 * Bridge mentorship rooms into the cross-section Opportunity Hub.
 *
 * Each open room becomes a `Program` opportunity (format "mentorship") so that
 * founders and collaborators browsing the Opportunity Hub see investor-run
 * mentorship rooms as announcements they can apply to. Keeping this derived
 * from `mockRooms` means there is a single source of truth — add a room and it
 * automatically appears as an announcement.
 */
export function mentorshipRoomsAsOpportunities(): Program[] {
  return mockRooms.map((room) => {
    const priceLabel =
      room.paymentModel === "equity"
        ? `${room.equityPercentage}% equity`
        : room.rate ?? room.paymentModel;
    return {
      id: `mentorship-room-${room.id}`,
      type: "program",
      title: room.name,
      organizer: MENTORSHIP_ORGANIZER,
      poster: "🎓",
      summary: `${room.description}. Mentored by ${room.mentor.name} — ${priceLabel}.`,
      status: room.menteeCount >= room.capacity ? "closed" : "open",
      applyDeadline: "2026-12-31",
      publishedAt: room.createdDate,
      tags: ["Mentorship", ...room.mentor.expertise],
      format: "mentorship",
      durationWeeks: 12,
      cohortSize: room.capacity,
      perks: [
        `1:1 mentorship with ${room.mentor.name}`,
        `${room.capacity - room.menteeCount} seats remaining`,
        priceLabel,
      ],
      startDate: room.createdDate,
    };
  });
}
