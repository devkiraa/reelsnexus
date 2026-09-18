'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '../ProjectContext';
import { Loader2, Save, Settings, Globe, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthHeaders } from '../AuthContext';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

export default function SettingsPage() {
  const { activeChannel, fetchChannels } = useProject();
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Settings State
  const [timezone, setTimezone] = useState('UTC');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (activeChannel) {
      setTimezone(activeChannel.target_timezone || 'UTC');
      setEmail(activeChannel.contact_email || '');
    }
  }, [activeChannel]);

  const handleSave = async () => {
    if (!activeChannel) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/channels/${activeChannel.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          target_timezone: timezone,
          contact_email: email
        })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      toast.success('Channel settings saved successfully!');
      await fetchChannels();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeChannel) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-blue-50 p-5 sm:p-6 rounded-full mb-6">
          <Settings className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Select a Project</h1>
        <p className="text-gray-500 max-w-md mx-auto mb-8 text-sm sm:text-base">
          You must select a project from the sidebar to configure its settings.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] flex flex-col pb-24 sm:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
            <Settings className="w-7 h-7 sm:w-8 sm:h-8 mr-3 text-blue-600 shrink-0" />
            <span>Channel Settings</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2">Configure core project parameters for <strong className="text-gray-900">{activeChannel.channel_name}</strong>.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center transition-colors shadow-xs shrink-0"
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center">
            <Globe className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-gray-500 shrink-0" />
            <span>Scheduling & Compliance</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">These settings affect when your videos are published and how DMCA notices are handled.</p>
        </div>
        
        <div className="p-8 space-y-8">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Target Timezone</label>
            <p className="text-sm text-gray-500 mb-4">The algorithmic scheduler will compute peak-engagement upload slots relative to this timezone.</p>
            <select 
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full max-w-md bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3"
            >
              <option value="UTC">UTC (Default)</option>
              <option value="America/New_York">Eastern Time (America/New_York)</option>
              <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
              <option value="Europe/London">London (Europe/London)</option>
              <option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option>
              <option value="Australia/Sydney">Sydney (Australia/Sydney)</option>
            </select>
          </div>

          <hr className="border-gray-100" />

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-gray-500" />
              DMCA Contact Email
            </label>
            <p className="text-sm text-gray-500 mb-4">This email will be dynamically appended to your YouTube Short descriptions inside the automated Copyright Removal notice.</p>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="legal@yourdomain.com"
              className="w-full max-w-md bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
