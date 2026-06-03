import {
  Building2,
  Shield,
  Bell,
  Key,
  Globe,
  Save,
  Upload,
  Mail,
  MapPin,
  Phone,
  Crown,
  UserCog,
  Briefcase,
} from "lucide-react";

const roles = [
  {
    name: "Super Admin",
    icon: Crown,
    users: 2,
    permissions: "Full system access and control",
  },
  {
    name: "Admin",
    icon: Shield,
    users: 8,
    permissions: "Manage teams, projects, and settings",
  },
  {
    name: "Manager",
    icon: UserCog,
    users: 24,
    permissions: "Oversee assigned teams and projects",
  },
  {
    name: "Contributor",
    icon: Briefcase,
    users: 298,
    permissions: "Work on assigned projects",
  },
];

const teamMembers = [
  {
    name: "Sarah Chen",
    email: "sarah.chen@techit.io",
    role: "Super Admin",
    added: "Jan 2025",
  },
  {
    name: "Marcus Johnson",
    email: "marcus.j@techit.io",
    role: "Admin",
    added: "Jan 2025",
  },
  {
    name: "Elena Rodriguez",
    email: "elena.r@techit.io",
    role: "Admin",
    added: "Feb 2025",
  },
  {
    name: "David Kim",
    email: "david.kim@techit.io",
    role: "Manager",
    added: "Mar 2025",
  },
];

export function Settings() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage organization profile, permissions, and preferences
        </p>
      </div>

      {/* Organization Profile */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-6 h-6 text-indigo-600" />
          <h2 className="text-lg font-bold text-foreground">Organization Profile</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Organization Name
            </label>
            <input
              type="text"
              defaultValue="TechIT Enterprise"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Industry
            </label>
            <select className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option>Technology</option>
              <option>Finance</option>
              <option>Healthcare</option>
              <option>Education</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Contact Email
            </label>
            <input
              type="email"
              defaultValue="contact@techit-enterprise.com"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              Phone Number
            </label>
            <input
              type="tel"
              defaultValue="+1 (555) 123-4567"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Address
            </label>
            <input
              type="text"
              defaultValue="123 Innovation Drive, San Francisco, CA 94105"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-2">
              Organization Logo
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                TE
              </div>
              <button className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors text-sm font-medium">
                <Upload className="w-4 h-4" />
                Upload New Logo
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t border-border">
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            <Save className="w-5 h-5" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Permissions & Roles */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-bold text-foreground">Permissions & Roles</h2>
          </div>
          <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium">
            Manage Roles
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.name}
                className="border border-border rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-medium text-foreground">{role.name}</h3>
                </div>
                <p className="text-2xl font-bold text-foreground mb-1">
                  {role.users}
                </p>
                <p className="text-xs text-muted-foreground">{role.permissions}</p>
              </div>
            );
          })}
        </div>

        <div>
          <h3 className="font-medium text-foreground mb-3">Team Members</h3>
          <div className="space-y-3">
            {teamMembers.map((member, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-background rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                    {member.role}
                  </span>
                  <button className="text-sm text-muted-foreground hover:text-foreground">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Key className="w-6 h-6 text-indigo-600" />
          <h2 className="text-lg font-bold text-foreground">Security</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-foreground">
                Two-Factor Authentication
              </p>
              <p className="text-sm text-muted-foreground">
                Require 2FA for all admin users
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-foreground">Session Timeout</p>
              <p className="text-sm text-muted-foreground">
                Auto logout after inactivity
              </p>
            </div>
            <select className="px-3 py-2 border border-border rounded-lg text-sm">
              <option>30 minutes</option>
              <option>1 hour</option>
              <option>2 hours</option>
              <option>Never</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-foreground">IP Whitelist</p>
              <p className="text-sm text-muted-foreground">
                Restrict access to specific IPs
              </p>
            </div>
            <button className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-background transition-colors text-sm font-medium">
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-indigo-600" />
          <h2 className="text-lg font-bold text-foreground">Notifications</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-foreground">Project Updates</p>
              <p className="text-sm text-muted-foreground">
                Notifications about project progress
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-foreground">Team Activity</p>
              <p className="text-sm text-muted-foreground">
                Updates when team members join or leave
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-foreground">Billing Alerts</p>
              <p className="text-sm text-muted-foreground">
                Notifications about payments and usage
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Data Policy */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-6 h-6 text-indigo-600" />
          <h2 className="text-lg font-bold text-foreground">Data & Privacy</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-foreground">Data Retention</p>
              <p className="text-sm text-muted-foreground">
                How long to keep project data
              </p>
            </div>
            <select className="px-3 py-2 border border-border rounded-lg text-sm">
              <option>1 year</option>
              <option>2 years</option>
              <option>5 years</option>
              <option>Indefinitely</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-foreground">Data Export</p>
              <p className="text-sm text-muted-foreground">
                Download all organization data
              </p>
            </div>
            <button className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-background transition-colors text-sm font-medium">
              Export Data
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-foreground">Delete Organization</p>
              <p className="text-sm text-red-600">
                Permanently delete all data (irreversible)
              </p>
            </div>
            <button className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
