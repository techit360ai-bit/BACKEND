import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Switch } from './ui/switch';
import { Card } from './ui/card';
import { Bell, Settings, Video, Flag, Calendar, Clock, Bot, Sparkles } from 'lucide-react';

/**
 * Component Library - TechIT Platform Design System
 * 
 * This page showcases all reusable UI components with their variants
 * Use this as a reference for maintaining design consistency
 */

export function ComponentLibrary() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Component Library
          </h1>
          <p className="text-gray-600">TechIT Platform Design System</p>
        </div>

        {/* Color Palette */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Color Palette
          </h2>
          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <div className="h-20 bg-[#0A1929] rounded-lg" />
              <div className="text-sm font-mono">#0A1929</div>
              <div className="text-xs text-gray-600">Navy (Primary)</div>
            </div>
            <div className="space-y-2">
              <div className="h-20 bg-[#2196F3] rounded-lg" />
              <div className="text-sm font-mono">#2196F3</div>
              <div className="text-xs text-gray-600">Electric Blue</div>
            </div>
            <div className="space-y-2">
              <div className="h-20 bg-[#10B981] rounded-lg" />
              <div className="text-sm font-mono">#10B981</div>
              <div className="text-xs text-gray-600">Success Green</div>
            </div>
            <div className="space-y-2">
              <div className="h-20 bg-[#F59E0B] rounded-lg" />
              <div className="text-sm font-mono">#F59E0B</div>
              <div className="text-xs text-gray-600">Warning Amber</div>
            </div>
            <div className="space-y-2">
              <div className="h-20 bg-[#FFD700] rounded-lg" />
              <div className="text-sm font-mono">#FFD700</div>
              <div className="text-xs text-gray-600">Gold (Premium)</div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Typography
          </h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <div>
              <h1 style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Heading 1 - Space Grotesk</h1>
              <p className="text-sm text-gray-600 mt-1">32px / 48px line height</p>
            </div>
            <div>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Heading 2 - Space Grotesk</h2>
              <p className="text-sm text-gray-600 mt-1">24px / 36px line height</p>
            </div>
            <div>
              <p>Body text - Inter Regular</p>
              <p className="text-sm text-gray-600 mt-1">16px / 24px line height</p>
            </div>
            <div>
              <p className="text-sm">Small text - Inter Regular</p>
              <p className="text-xs text-gray-600 mt-1">14px / 20px line height</p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Buttons
          </h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <Button className="bg-[#2196F3] hover:bg-[#2196F3]/90">
                Primary Button
              </Button>
              <Button variant="outline">
                Secondary Button
              </Button>
              <Button variant="destructive">
                Destructive Button
              </Button>
              <Button variant="ghost">
                Ghost Button
              </Button>
              <Button size="sm">Small Button</Button>
              <Button size="lg">Large Button</Button>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Badges
          </h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-[#10B981] text-white">Active</Badge>
              <Badge className="bg-[#2196F3] text-white">In Progress</Badge>
              <Badge className="bg-[#F59E0B] text-white">Warning</Badge>
              <Badge className="bg-gradient-to-r from-[#FFD700] to-amber-400 text-black">
                <Sparkles className="w-3 h-3 mr-1" />
                Premium
              </Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </div>
        </section>

        {/* Avatars */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Avatars
          </h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-4">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-500 text-white text-xs">SC</AvatarFallback>
              </Avatar>
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-green-500 text-white">MJ</AvatarFallback>
              </Avatar>
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-purple-500 text-white">AK</AvatarFallback>
              </Avatar>
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-pink-500 text-white text-lg">EW</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </section>

        {/* Icons */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Icons
          </h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="grid grid-cols-8 gap-6">
              <div className="flex flex-col items-center gap-2">
                <Bell className="w-6 h-6 text-gray-700" />
                <span className="text-xs">Bell</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Settings className="w-6 h-6 text-gray-700" />
                <span className="text-xs">Settings</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Video className="w-6 h-6 text-gray-700" />
                <span className="text-xs">Video</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Flag className="w-6 h-6 text-gray-700" />
                <span className="text-xs">Flag</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Calendar className="w-6 h-6 text-gray-700" />
                <span className="text-xs">Calendar</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Clock className="w-6 h-6 text-gray-700" />
                <span className="text-xs">Clock</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Bot className="w-6 h-6 text-gray-700" />
                <span className="text-xs">Bot</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Sparkles className="w-6 h-6 text-gray-700" />
                <span className="text-xs">Sparkles</span>
              </div>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Cards
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Standard Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold mb-2">Standard Card</h3>
              <p className="text-sm text-gray-600">
                Basic card with subtle shadow and border. Border radius: 8px
              </p>
            </div>

            {/* Task Card */}
            <div className="bg-white rounded-lg shadow-sm border-l-4 border-[#2196F3] p-4">
              <h4 className="font-medium mb-2">Task Card</h4>
              <p className="text-sm text-gray-600 mb-3">With colored left border for priority</p>
              <div className="flex items-center justify-between">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="bg-blue-500 text-white text-xs">SC</AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  <span>Feb 20</span>
                </div>
              </div>
            </div>

            {/* Premium Card */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-5 border-2 border-[#FFD700]/30 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFD700]/10 to-transparent animate-shimmer" />
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                Premium Card
                <Sparkles className="w-4 h-4 text-[#FFD700]" />
              </h3>
              <p className="text-sm text-gray-600">
                With gold shimmer effect and gradient background
              </p>
            </div>

            {/* Metric Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-[#2196F3]/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-[#2196F3]" />
                </div>
                <Badge className="bg-[#10B981] text-white">+12%</Badge>
              </div>
              <div className="text-3xl font-bold mb-1">347</div>
              <div className="text-sm text-gray-600">Metric Card</div>
            </div>
          </div>
        </section>

        {/* Form Elements */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Form Elements
          </h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Text Input</label>
              <input
                type="text"
                placeholder="Enter text..."
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3] outline-none"
              />
            </div>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <Switch />
                <label className="text-sm">Toggle Switch</label>
              </div>
              <div className="flex items-center gap-3">
                <Switch defaultChecked />
                <label className="text-sm">Enabled Switch</label>
              </div>
            </div>
          </div>
        </section>

        {/* Border Radius Guide */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Border Radius
          </h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="grid grid-cols-4 gap-6">
              <div className="text-center">
                <div className="h-20 bg-[#2196F3] rounded" />
                <p className="text-sm mt-2">4px (Buttons)</p>
              </div>
              <div className="text-center">
                <div className="h-20 bg-[#2196F3] rounded-lg" />
                <p className="text-sm mt-2">8px (Cards)</p>
              </div>
              <div className="text-center">
                <div className="h-20 bg-[#2196F3] rounded-xl" />
                <p className="text-sm mt-2">12px (Modals)</p>
              </div>
              <div className="text-center">
                <div className="h-20 bg-[#2196F3] rounded-full" />
                <p className="text-sm mt-2">Full (Avatars)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Spacing Guide */}
        <section>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Spacing System (8px Grid)
          </h2>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 text-sm font-mono">8px</div>
                <div className="h-2 w-[8px] bg-[#2196F3]" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 text-sm font-mono">16px</div>
                <div className="h-2 w-[16px] bg-[#2196F3]" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 text-sm font-mono">24px</div>
                <div className="h-2 w-[24px] bg-[#2196F3]" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 text-sm font-mono">32px</div>
                <div className="h-2 w-[32px] bg-[#2196F3]" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 text-sm font-mono">48px</div>
                <div className="h-2 w-[48px] bg-[#2196F3]" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
