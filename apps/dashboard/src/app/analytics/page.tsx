'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { BarChart3, TrendingUp, ThumbsUp, MessageCircle, AlertCircle, Video } from 'lucide-react';
import { useProject } from '../ProjectContext';
import { getAuthHeaders } from '../AuthContext';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

export default function AnalyticsPage() {
  const { activeChannel } = useProject();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAnalytics() {
      if (!activeChannel) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/analytics?channel_id=${activeChannel.id}`, {
          headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch analytics');
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [activeChannel]);

  if (!activeChannel) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Project Selected</h2>
        <p className="text-gray-500 max-w-md">Please select a channel from the top navigation to view its analytics.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics Error</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const timeline = data?.timeline || [];
  const topVideos = data?.topVideos || [];

  const totalViews = timeline.reduce((sum: number, day: any) => sum + day.total_views, 0);
  const totalLikes = timeline.reduce((sum: number, day: any) => sum + day.total_likes, 0);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Channel Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Track performance for {activeChannel.channel_name}</p>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Views (Tracked)</p>
            <p className="text-2xl font-bold text-gray-900">{totalViews.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
            <ThumbsUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Likes</p>
            <p className="text-2xl font-bold text-gray-900">{totalLikes.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Video className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Published Videos</p>
            <p className="text-2xl font-bold text-gray-900">{topVideos.length}</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Views Over Time</h3>
          {timeline.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ stroke: '#e5e7eb', strokeWidth: 2 }}
                  />
                  <Line type="monotone" dataKey="total_views" name="Views" stroke="#2563EB" strokeWidth={3} dot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] w-full flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-400 text-sm">Not enough data to display chart yet.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Top Performing Videos</h3>
          {topVideos.length > 0 ? (
            <div className="space-y-4">
              {topVideos.slice(0, 5).map((vid: any, i: number) => (
                <div key={i} className="flex flex-col gap-1 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2" title={vid.ai_title || vid.file_name}>
                    {vid.ai_title || vid.file_name}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-blue-500" /> {vid.views.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5 text-green-500" /> {vid.likes.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-gray-400" /> {vid.comments.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[250px] w-full flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-400 text-sm">No videos found.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
