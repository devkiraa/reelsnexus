'use client';

import React from 'react';
import { useProject } from './ProjectContext';
import { PlaySquare, Users, Video, Clock, AlertCircle } from 'lucide-react';

export default function DashboardHome() {
  const { activeChannel, channels, loading, setActiveChannelId } = useProject();

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6 sm:mb-8"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1,2,3,4].map(i => <div key={i} className="bg-gray-100 h-28 sm:h-32 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  if (!activeChannel) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">All Projects Overview</h1>
          <p className="text-gray-500 text-sm sm:text-base mt-1">Manage and monitor all your automated YouTube channels</p>
        </div>

        {channels.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center p-8 sm:py-16 text-center">
            <div className="bg-blue-50 p-4 rounded-full mb-4">
              <PlaySquare className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
            <p className="text-gray-500 mt-1 mb-6 max-w-sm text-sm">Import your first YouTube channel using the sidebar to begin your automated short video pipeline.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {channels.map(channel => (
              <div 
                key={channel.id}
                onClick={() => setActiveChannelId(channel.id)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all group"
              >
                <div className="flex items-center space-x-3 sm:space-x-4 mb-4">
                  {channel.avatar_url ? (
                    <img src={channel.avatar_url} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-gray-200 object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-lg sm:text-xl flex items-center justify-center shrink-0">
                      {channel.channel_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{channel.channel_name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{channel.channel_handle || `@${channel.channel_name.replace(/\s+/g, '')}`}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Niche</p>
                    <span className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium truncate max-w-[140px]">
                      {channel.niche}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Subscribers</p>
                    <p className="text-sm sm:text-base font-bold text-gray-900">{channel.subscriber_count.toLocaleString()}</p>
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Active Channel Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4 sm:space-x-5">
          {activeChannel.avatar_url ? (
            <img src={activeChannel.avatar_url} alt="" className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-gray-200 object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100 text-blue-600 font-bold text-xl sm:text-2xl flex items-center justify-center shrink-0">
              {activeChannel.channel_name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{activeChannel.channel_name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs sm:text-sm text-gray-500">
              <span className="truncate max-w-[150px] sm:max-w-none">{activeChannel.channel_handle || `@${activeChannel.channel_name.replace(/\s+/g, '')}`}</span>
              <span>&bull;</span>
              <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium text-xs">
                {activeChannel.niche}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100 flex sm:block justify-between items-center">
          <p className="text-xs sm:text-sm text-gray-500 font-medium">Subscribers</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{activeChannel.subscriber_count.toLocaleString()}</p>
        </div>
      </div>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex items-start justify-between">
          <div>
            <h3 className="text-gray-500 text-xs sm:text-sm font-medium">Total Channels</h3>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{channels.length}</p>
          </div>
          <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg"><Users className="text-gray-400 w-5 h-5 sm:w-6 sm:h-6" /></div>
        </div>
        
        <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex items-start justify-between">
          <div>
            <h3 className="text-gray-500 text-xs sm:text-sm font-medium">Videos Processing</h3>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1 sm:mt-2">0</p>
          </div>
          <div className="bg-blue-50 p-2.5 sm:p-3 rounded-lg"><Video className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" /></div>
        </div>
        
        <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex items-start justify-between">
          <div>
            <h3 className="text-gray-500 text-xs sm:text-sm font-medium">Ready to Post</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1 sm:mt-2">0</p>
          </div>
          <div className="bg-green-50 p-2.5 sm:p-3 rounded-lg"><Clock className="text-green-500 w-5 h-5 sm:w-6 sm:h-6" /></div>
        </div>
        
        <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex items-start justify-between">
          <div>
            <h3 className="text-gray-500 text-xs sm:text-sm font-medium">Failed Jobs</h3>
            <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-1 sm:mt-2">0</p>
          </div>
          <div className="bg-red-50 p-2.5 sm:p-3 rounded-lg"><AlertCircle className="text-red-500 w-5 h-5 sm:w-6 sm:h-6" /></div>
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
