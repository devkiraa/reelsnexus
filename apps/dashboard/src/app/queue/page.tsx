import React from 'react';

export default function QueuePage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Render Queue</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* PENDING */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Pending (0)</h2>
          <div className="text-sm text-gray-500 p-4 text-center">No pending jobs.</div>
        </div>

        {/* READY TO POST */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-800 mb-4">Ready to Post (0)</h2>
          <div className="text-sm text-blue-600/70 p-4 text-center">No videos ready.</div>
        </div>

        {/* PUBLISHED */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h2 className="text-lg font-semibold text-green-800 mb-4">Published (0)</h2>
          <div className="text-sm text-green-600/70 p-4 text-center">No videos published recently.</div>
        </div>

      </div>
    </div>
  );
}
