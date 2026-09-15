'use client';

import React from 'react';

export default function ChannelsPage() {
  const handleConnect = () => {
    // In a real scenario, this ID would come from the specific row's data
    const dummyChannelId = "channel-123";
    window.location.href = `http://localhost:8787/api/auth/youtube/connect?channel_id=${dummyChannelId}`;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Channels</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 transition-colors font-medium">
          Add Channel
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Niche</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Watermark</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OAuth Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                No channels configured yet. Click "Add Channel" to get started.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
