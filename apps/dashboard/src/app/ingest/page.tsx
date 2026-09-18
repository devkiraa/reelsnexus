'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '../ProjectContext';
import { Loader2, FolderSearch, HardDrive, CheckSquare, Square, AlertCircle, CheckCircle2, PlaySquare, Key, FolderOpen, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import { getAuthHeaders } from '../AuthContext';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function IngestPage() {
  return (
    <React.Suspense fallback={<div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <IngestPageContent />
    </React.Suspense>
  );
}

function IngestPageContent() {
  const { activeChannel } = useProject();
  const searchParams = useSearchParams();
  
  const [hasMasterDrive, setHasMasterDrive] = useState<boolean | null>(null);
  
  const [folderUrl, setFolderUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  
  // Folder Browser State
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserFolders, setBrowserFolders] = useState<any[]>([]);
  const [browserPath, setBrowserPath] = useState<{id: string, name: string}[]>([{id: 'root', name: 'My Drive'}]);
  const [isFetchingFolders, setIsFetchingFolders] = useState(false);

  useEffect(() => {
    // Check if master drive is connected
    fetch(`${API_BASE}/api/settings`)
      .then(res => res.json())
      .then(data => setHasMasterDrive(data.has_master_drive))
      .catch(() => setHasMasterDrive(false));
      
    if (searchParams.get('success') === 'drive_connected') {
      toast.success('Master Google Drive connected successfully!');
      setHasMasterDrive(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  const loadFolders = async (parentId: string) => {
    setIsFetchingFolders(true);
    try {
      const res = await fetch(`${API_BASE}/api/drive/folders?parentId=${parentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch folders');
      setBrowserFolders(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsFetchingFolders(false);
    }
  };

  const handleOpenBrowser = () => {
    setShowBrowser(true);
    if (browserFolders.length === 0) {
      loadFolders('root');
    }
  };

  const navigateToFolder = (folder: any) => {
    setBrowserPath([...browserPath, {id: folder.id, name: folder.name}]);
    loadFolders(folder.id);
  };

  const navigateUpTo = (index: number) => {
    const newPath = browserPath.slice(0, index + 1);
    setBrowserPath(newPath);
    loadFolders(newPath[newPath.length - 1].id);
  };

  const selectFolderForScan = (folderId: string) => {
    const virtualUrl = `https://drive.google.com/drive/folders/${folderId}`;
    setFolderUrl(virtualUrl);
    setShowBrowser(false);
    // Optional: auto trigger scan here
  };

  if (!activeChannel) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-blue-50 p-6 rounded-full mb-6">
          <PlaySquare className="w-12 h-12 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Select a Project</h1>
        <p className="text-gray-500 max-w-md mx-auto mb-8">
          You must select a project from the sidebar before you can ingest raw clips.
        </p>
      </div>
    );
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderUrl) return;
    
    setIsScanning(true);
    setScanResult(null);
    setSelectedClips(new Set());
    
    try {
      const res = await fetch(`${API_BASE}/api/ingest/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ folder_url: folderUrl, channel_id: activeChannel.id })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to scan folder');
      
      setScanResult(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelection = (fileId: string) => {
    const next = new Set(selectedClips);
    if (next.has(fileId)) next.delete(fileId);
    else next.add(fileId);
    setSelectedClips(next);
  };

  const toggleAll = () => {
    if (!scanResult) return;
    const availableClips = scanResult.clips.filter((c: any) => !c.is_already_queued);
    if (selectedClips.size === availableClips.length) {
      setSelectedClips(new Set());
    } else {
      setSelectedClips(new Set(availableClips.map((c: any) => c.file_id)));
    }
  };

  const handleEnqueue = async () => {
    if (selectedClips.size === 0 || !scanResult) return;
    
    setIsEnqueuing(true);
    try {
      const itemsToEnqueue = scanResult.clips.filter((c: any) => selectedClips.has(c.file_id));
      
      const res = await fetch(`${API_BASE}/api/ingest/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          channel_id: activeChannel.id,
          source_type: scanResult.source_type,
          items: itemsToEnqueue
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enqueue items');
      
      toast.success(`Successfully queued ${data.enqueued} clips!`);
      
      setScanResult({
        ...scanResult,
        clips: scanResult.clips.map((c: any) => ({
          ...c,
          is_already_queued: c.is_already_queued || selectedClips.has(c.file_id)
        }))
      });
      setSelectedClips(new Set());
      
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsEnqueuing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative pb-32">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
            <HardDrive className="w-7 h-7 sm:w-8 sm:h-8 mr-3 text-blue-600 shrink-0" />
            <span>Ingest Raw Clips</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2">Scan a Google Drive or MEGA.nz folder to add raw clips to the <strong className="text-gray-900">{activeChannel.channel_name}</strong> pipeline.</p>
        </div>
        
        {hasMasterDrive === false && (
          <a 
            href={`${API_BASE}/api/auth/drive/connect`}
            className="flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-yellow-200 transition-colors w-max"
          >
            <Key className="w-4 h-4" />
            <span>Connect Master Drive</span>
          </a>
        )}
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xs border border-gray-200 mb-6 sm:mb-8">
        <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-start">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <input 
                type="url" 
                required 
                value={folderUrl}
                onChange={e => setFolderUrl(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs sm:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 sm:p-3 pr-24 sm:pr-28" 
                placeholder="Paste Google Drive or MEGA.nz folder URL..." 
              />
              {hasMasterDrive && (
                <button
                  type="button"
                  onClick={handleOpenBrowser}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-blue-100 text-blue-700 px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium hover:bg-blue-200 transition-colors flex items-center"
                >
                  <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                  <span>Browse</span>
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
              <span>For Google Drive, the folder must be accessible to your connected account.</span>
            </p>
          </div>
          <button 
            type="submit" 
            disabled={isScanning || !folderUrl}
            className="bg-blue-600 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 disabled:opacity-50 flex items-center justify-center transition-colors shrink-0"
          >
            {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderSearch className="w-4 h-4 mr-2" />}
            {isScanning ? 'Scanning...' : 'Scan Folder'}
          </button>
        </form>
      </div>

      {showBrowser && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <FolderOpen className="w-5 h-5 mr-2 text-blue-600" />
                Browse Master Drive
              </h2>
              <button onClick={() => setShowBrowser(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center text-sm overflow-x-auto whitespace-nowrap">
              {browserPath.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  <button 
                    onClick={() => navigateUpTo(idx)}
                    className="hover:text-blue-600 hover:underline font-medium text-gray-700"
                  >
                    {crumb.name}
                  </button>
                  {idx < browserPath.length - 1 && <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />}
                </React.Fragment>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isFetchingFolders ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : browserFolders.length === 0 ? (
                <div className="text-center p-8 text-gray-500">No subfolders found here.</div>
              ) : (
                <ul className="space-y-1">
                  {browserFolders.map(folder => (
                    <li key={folder.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg group">
                      <button 
                        onClick={() => navigateToFolder(folder)}
                        className="flex items-center text-gray-700 font-medium flex-1 text-left"
                      >
                        <FolderOpen className="w-5 h-5 mr-3 text-blue-400" />
                        {folder.name}
                      </button>
                      <button 
                        onClick={() => selectFolderForScan(folder.id)}
                        className="opacity-0 group-hover:opacity-100 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 transition-opacity"
                      >
                        Select
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {scanResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                {scanResult.source_type === 'gdrive' ? (
                  <span className="w-2 h-2 rounded-full bg-yellow-400 mr-2"></span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                )}
                {scanResult.folder_name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">Found {scanResult.total_found} valid video files</p>
            </div>
            
            {scanResult.clips.filter((c:any) => !c.is_already_queued).length > 0 && (
              <button 
                type="button"
                onClick={toggleAll}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
              >
                {selectedClips.size === scanResult.clips.filter((c:any) => !c.is_already_queued).length ? (
                  <><CheckSquare className="w-4 h-4 mr-1" /> Deselect All</>
                ) : (
                  <><Square className="w-4 h-4 mr-1" /> Select All Available</>
                )}
              </button>
            )}
          </div>

          <ul className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
            {scanResult.clips.length === 0 ? (
              <li className="p-12 text-center text-gray-500">No compatible video files found in this folder.</li>
            ) : (
              scanResult.clips.map((clip: any) => {
                const isSelected = selectedClips.has(clip.file_id);
                return (
                  <li 
                    key={clip.file_id} 
                    className={`flex items-center p-4 transition-colors ${clip.is_already_queued ? 'bg-gray-50 opacity-60' : 'hover:bg-blue-50 cursor-pointer'}`}
                    onClick={() => !clip.is_already_queued && toggleSelection(clip.file_id)}
                  >
                    <div className="mr-4">
                      {clip.is_already_queued ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    {clip.thumbnail && (
                      <img 
                        loading="lazy"
                        src={clip.thumbnail.startsWith('/api') ? `${API_BASE}${clip.thumbnail}` : clip.thumbnail} 
                        alt="" 
                        className="w-16 h-12 object-cover rounded border border-gray-200 mr-4 bg-gray-100" 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${clip.is_already_queued ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {clip.file_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {clip.is_already_queued ? 'Already in queue' : formatBytes(clip.file_size)}
                      </p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          
          {selectedClips.size > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {selectedClips.size} items selected
              </span>
              <button 
                onClick={handleEnqueue}
                disabled={isEnqueuing}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center transition-colors shadow-sm"
              >
                {isEnqueuing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlaySquare className="w-4 h-4 mr-2" />}
                {isEnqueuing ? 'Queueing...' : `Enqueue ${selectedClips.size} Clips`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
