'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../ProjectContext';
import { Loader2, Save, Settings, Globe, Mail, HardDrive, RefreshCw, Key, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import { getAuthHeaders } from '../AuthContext';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

export default function SettingsPage() {
  return (
    <React.Suspense fallback={<div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <SettingsPageContent />
    </React.Suspense>
  );
}

function SettingsPageContent() {
  const { activeChannel, fetchChannels } = useProject();
  const searchParams = useSearchParams();
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Settings State
  const [timezone, setTimezone] = useState('UTC');
  const [email, setEmail] = useState('');

  // Master Drive State
  const [driveStatus, setDriveStatus] = useState<{
    loading: boolean;
    has_master_drive: boolean;
    is_configured: boolean;
    token_valid: boolean;
  }>({
    loading: true,
    has_master_drive: false,
    is_configured: false,
    token_valid: false
  });

  const fetchDriveStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setDriveStatus({
          loading: false,
          has_master_drive: !!data.has_master_drive,
          is_configured: !!data.is_configured,
          token_valid: !!data.token_valid
        });
      } else {
        setDriveStatus(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setDriveStatus(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchDriveStatus();
  }, [fetchDriveStatus]);

  useEffect(() => {
    if (searchParams.get('success') === 'drive_connected') {
      toast.success('Master Google Drive connected successfully!');
      fetchDriveStatus();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (searchParams.get('error')) {
      const err = searchParams.get('error');
      toast.error(`Drive connection error: ${err}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams, fetchDriveStatus]);

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto min-h-[calc(100vh-2rem)] flex flex-col pb-24 sm:pb-12 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
            <Settings className="w-7 h-7 sm:w-8 sm:h-8 mr-3 text-blue-600 shrink-0" />
            <span>Settings</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2">
            Manage global storage connections and channel configurations.
          </p>
        </div>
        {activeChannel && (
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center transition-colors shadow-xs shrink-0"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isSaving ? 'Saving...' : 'Save Channel Settings'}
          </button>
        )}
      </div>

      {/* Section 1: Global Storage & Cloud Integration (Master Google Drive) */}
      <div className="bg-white rounded-lg shadow-xs border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center">
              <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 shrink-0" />
              <span>Master Google Drive Connection</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Provides raw video access for ingestion and powers cloud rendering in the Colab worker.
            </p>
          </div>
          <div>
            {driveStatus.loading ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Checking...
              </span>
            ) : driveStatus.has_master_drive && driveStatus.token_valid ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Active & Connected
              </span>
            ) : driveStatus.is_configured ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Expired (Needs Reconnect)
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                <Key className="w-3.5 h-3.5 mr-1.5 text-gray-500" /> Not Connected
              </span>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            {driveStatus.has_master_drive && driveStatus.token_valid ? (
              <p>
                Google Drive OAuth token is active. 
                <span className="block mt-1 text-gray-500">
                  Google Cloud projects in &ldquo;Testing&rdquo; mode expire authorization refresh tokens every <strong>7 days</strong>. If Colab worker logs report expired Drive credentials, click below to re-authorize.
                </span>
              </p>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 text-amber-900 text-xs sm:text-sm flex items-start space-x-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Master Drive Connection Expired or Missing</p>
                  <p className="text-amber-800 mt-1">
                    Your Colab GPU worker cannot download source videos or upload exports without an active connection. Click &ldquo;Reconnect Master Drive&rdquo; to refresh your Google OAuth grant.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <a
              href={`${API_BASE}/api/auth/drive/connect?return_to=/settings`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md text-xs sm:text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              <span>{driveStatus.has_master_drive && driveStatus.token_valid ? 'Reconnect Master Drive' : 'Connect Master Drive'}</span>
            </a>
            
            <button
              type="button"
              onClick={() => {
                setDriveStatus(prev => ({ ...prev, loading: true }));
                fetchDriveStatus();
              }}
              className="inline-flex items-center justify-center px-3 py-2 rounded-md text-xs sm:text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${driveStatus.loading ? 'animate-spin' : ''}`} />
              <span>Test Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Channel-Specific Settings */}
      {activeChannel ? (
        <div className="bg-white rounded-lg shadow-xs border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-gray-500 shrink-0" />
              <span>Scheduling & Compliance ({activeChannel.channel_name})</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Parameters affecting automated publish slots and DMCA notices for this channel.
            </p>
          </div>
          
          <div className="p-4 sm:p-6 space-y-6">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">Target Timezone</label>
              <p className="text-xs sm:text-sm text-gray-500 mb-3">
                Peak-engagement upload slots are calculated relative to this timezone.
              </p>
              <select 
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full max-w-md bg-white border border-gray-300 text-gray-900 text-xs sm:text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-2.5 sm:p-3"
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
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 flex items-center">
                <Mail className="w-4 h-4 mr-2 text-gray-500" />
                DMCA Contact Email
              </label>
              <p className="text-xs sm:text-sm text-gray-500 mb-3">
                Appended to YouTube Short descriptions in automated copyright notices.
              </p>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="legal@yourdomain.com"
                className="w-full max-w-md bg-white border border-gray-300 text-gray-900 text-xs sm:text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-2.5 sm:p-3"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6 text-center">
          <p className="text-gray-500 text-xs sm:text-sm">
            Select a channel from the sidebar to configure channel-specific scheduling and compliance settings.
          </p>
        </div>
      )}
    </div>
  );
}
