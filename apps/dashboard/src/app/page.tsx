'use client';

import React from 'react';
import { useProject } from './ProjectContext';
import { PlaySquare, Users, Video, Clock, AlertCircle } from 'lucide-react';

export default function DashboardHome() {
  const { activeChannel, channels, loading, setActiveChannelId } = useProject();

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="bg-gray-100 h-32 rounded-lg"></div>)}
        </div>
      </div>
    );
  }

  if (!activeChannel) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">All Projects Overview</h1>
          <p className="text-gray-500 mt-1">Manage and monitor all your automated YouTube channels</p>
        </div>

        {channels.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-blue-50 p-4 rounded-full mb-4">
              <PlaySquare className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
            <p className="text-gray-500 mt-1 mb-6 max-w-sm">Import your first YouTube channel using the sidebar to begin your automated short video pipeline.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map(channel => (
              <div 
                key={channel.id}
                onClick={() => setActiveChannelId(channel.id)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all group"
              >
                <div className="flex items-center space-x-4 mb-4">
                  {channel.avatar_url ? (
                    <img src={channel.avatar_url} alt="" className="w-12 h-12 rounded-full border border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-xl flex items-center justify-center">
                      {channel.channel_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 truncate">
                    <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{channel.channel_name}</h3>
                    <p className="text-sm text-gray-500 truncate">{channel.channel_handle || `@${channel.channel_name.replace(/\\s+/g, '')}`}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Niche</p>
                    <span className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
                      {channel.niche}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Subscribers</p>
                    <p className="font-bold text-gray-900">{channel.subscriber_count.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Active Channel Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-5">
          {activeChannel.avatar_url ? (
            <img src={activeChannel.avatar_url} alt="" className="w-16 h-16 rounded-full border border-gray-200" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 font-bold text-2xl flex items-center justify-center">
              {activeChannel.channel_name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{activeChannel.channel_name}</h1>
            <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
              <span>{activeChannel.channel_handle || `@${activeChannel.channel_name.replace(/\\s+/g, '')}`}</span>
              <span>&bull;</span>
              <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium text-xs">
                {activeChannel.niche}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-gray-500 font-medium">Subscribers</p>
          <p className="text-2xl font-bold text-gray-900">{activeChannel.subscriber_count.toLocaleString()}</p>
        </div>
      </div>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-start justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium">Total Channels</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">{channels.length}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg"><Users className="text-gray-400 w-6 h-6" /></div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-start justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium">Videos Processing</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg"><Video className="text-blue-500 w-6 h-6" /></div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-start justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium">Ready to Post</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">0</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg"><Clock className="text-green-500 w-6 h-6" /></div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-start justify-between">
          <div>
            <h3 className="text-gray-500 text-sm font-medium">Failed Jobs</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">0</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg"><AlertCircle className="text-red-500 w-6 h-6" /></div>
        </div>
      </div>
      
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500">No recent activity for this project yet. Try adding some videos to the queue!</p>
        </div>
      </div>
    </div>
  );
}
