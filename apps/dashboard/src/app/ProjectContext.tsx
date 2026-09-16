'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

export interface YouTubeChannel {
  id: string;
  snippet: {
    title: string;
    customUrl: string;
    thumbnails: {
      default: { url: string };
    };
  };
  statistics: {
    subscriberCount: string;
  };
}

export interface Project {
  id: string;
  channel_name: string;
  channel_handle: string;
  avatar_url: string;
  niche: string;
  subscriber_count: number;
  youtube_refresh_token: string;
  watermark_type?: string;
  watermark_text?: string;
  watermark_x?: number;
  watermark_y?: number;
  watermark_font_size?: number;
  watermark_font_color?: string;
  watermark_bg_enabled?: boolean | number;
  watermark_bg_color?: string;
  watermark_bg_opacity?: number;
  watermark_opacity?: number;
  watermark_font_family?: string;
  watermark_border_radius?: number;
  watermark_padding?: number;
  contact_email?: string;
  target_timezone?: string;
}

interface ProjectContextType {
  channels: Project[];
  activeChannel: Project | null;
  loading: boolean;
  setActiveChannelId: (id: string | null) => void;
  fetchChannels: () => Promise<void>;
  
  // Modal & OAuth State
  isImportModalOpen: boolean;
  setIsImportModalOpen: (open: boolean) => void;
  discovering: boolean;
  discoveredChannels: YouTubeChannel[];
  handleNewOAuth: () => void;
  discoverYouTubeChannels: (token: string) => Promise<void>;
  importProject: (channel: YouTubeChannel, niche: string, watermarkText: string, refreshToken: string | null) => Promise<boolean>;
  closeImportModal: () => void;
  refreshTokenString: string | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [channels, setChannels] = useState<Project[]>([]);
  const [activeChannelId, setActiveChannelIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredChannels, setDiscoveredChannels] = useState<YouTubeChannel[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshTokenString, setRefreshTokenString] = useState<string | null>(null);

  useEffect(() => {
    // Load active channel from localStorage
    const saved = localStorage.getItem('activeChannelId');
    if (saved) setActiveChannelIdState(saved);

    fetchChannels();
    
    // Parse URL for OAuth tokens
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('access_token');
    const rToken = urlParams.get('refresh_token');
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (error) {
      toast.error('OAuth connection failed or was denied.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (success && token) {
      setAccessToken(token);
      setRefreshTokenString(rToken);
      setIsImportModalOpen(true);
      discoverYouTubeChannels(token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/channels`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setChannels(data || []);
    } catch (e) {
      toast.error('Failed to load channels.');
    } finally {
      setLoading(false);
    }
  };

  const setActiveChannelId = (id: string | null) => {
    setActiveChannelIdState(id);
    if (id) {
      localStorage.setItem('activeChannelId', id);
    } else {
      localStorage.removeItem('activeChannelId');
    }
  };

  const activeChannel = channels.find(c => c.id === activeChannelId) || null;

  const handleNewOAuth = () => {
    const tempId = crypto.randomUUID();
    window.location.href = `${API_BASE}/api/auth/youtube/connect?channel_id=${tempId}`;
  };

  const discoverYouTubeChannels = async (token: string) => {
    setDiscovering(true);
    try {
      const res = await fetch(`${API_BASE}/api/youtube/discover-channels`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to discover');
      const data = await res.json();
      setDiscoveredChannels(data.items || []);
    } catch (e) {
      toast.error('Error fetching YouTube channels.');
    } finally {
      setDiscovering(false);
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setAccessToken(null);
    setRefreshTokenString(null);
    setDiscoveredChannels([]);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const importProject = async (channel: YouTubeChannel, niche: string, watermarkText: string, refreshToken: string | null) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: channel.id,
          channel_name: channel.snippet.title,
          channel_handle: channel.snippet.customUrl,
          avatar_url: channel.snippet.thumbnails?.default?.url,
          subscriber_count: parseInt(channel.statistics.subscriberCount || '0', 10),
          niche,
          watermark_text: watermarkText,
          refresh_token: refreshToken
        })
      });
      if (res.ok) {
        toast.success('Project imported successfully!');
        await fetchChannels();
        setActiveChannelId(channel.id);
        closeImportModal();
        return true;
      }
      toast.error('Server error importing project.');
      return false;
    } catch (e) {
      toast.error('Network error importing project.');
      return false;
    }
  };

  return (
    <ProjectContext.Provider value={{
      channels,
      activeChannel,
      loading,
      setActiveChannelId,
      fetchChannels,
      isImportModalOpen,
      setIsImportModalOpen,
      discovering,
      discoveredChannels,
      handleNewOAuth,
      discoverYouTubeChannels,
      importProject,
      closeImportModal,
      refreshTokenString
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
