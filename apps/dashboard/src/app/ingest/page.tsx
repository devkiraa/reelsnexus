import React from 'react';

export default function IngestPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Drive Ingestion</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <form className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Target Channel</label>
            <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border">
              <option>Tech Shorts</option>
              <option>Fitness Daily</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Google Drive Folder URL</label>
            <div className="mt-1">
              <input type="url" required className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md border p-2" placeholder="https://drive.google.com/drive/folders/..." />
            </div>
            <p className="mt-2 text-sm text-gray-500">Paste the public or authorized link to the Google Drive folder containing raw videos.</p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button type="submit" className="w-full bg-blue-600 border border-transparent rounded-md shadow-sm py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
              Scan & Ingest Videos
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
