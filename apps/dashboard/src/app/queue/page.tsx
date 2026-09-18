'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '../ProjectContext';
import { PlaySquare, Loader2, Clock, CheckCircle2, Sparkles, AlertTriangle, Trash2, Send, HardDrive, FileVideo, Calendar, ChevronLeft, ChevronRight, Search, ListFilter, Pause, Trash } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

export default function QueuePage() {
  const { activeChannel } = useProject();
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [limit, setLimit] = useState(25);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalJob, setModalJob] = useState<any | null>(null);

  const fetchJobs = async () => {
    if (!activeChannel) return;
    try {
      const q = new URLSearchParams({
        channel_id: activeChannel.id.toString(),
        status: statusFilter,
        page: currentPage.toString(),
        limit: limit.toString(),
        search: searchQuery,
        sort_by: sortBy
      });
      const res = await fetch(`${API_BASE}/api/jobs?${q.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data.data || []);
      setTotalJobs(data.total || 0);
      setTotalPages(data.totalPages || 1);
      
      // Keep only selected IDs that still exist in the current view (or keep them across pages if preferred. Let's keep them across pages).
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchJobs();
  }, [activeChannel, statusFilter, currentPage, limit, sortBy, searchQuery]);

  // Polling logic: if ANY job is processing in the current view, poll every 5 seconds.
  useEffect(() => {
    const hasProcessing = jobs.some(j => j.status === 'PROCESSING');
    if (!hasProcessing) return;

    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [jobs, activeChannel, statusFilter]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSet = new Set(selectedIds);
      jobs.forEach(j => newSet.add(j.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      jobs.forEach(j => newSet.delete(j.id));
      setSelectedIds(newSet);
    }
  };

  const selectNext = (count: number) => {
    const newSet = new Set(selectedIds);
    let added = 0;
    for (const job of jobs) {
      if (!newSet.has(job.id)) {
        newSet.add(job.id);
        added++;
        if (added >= count) break;
      }
    }
    setSelectedIds(newSet);
  };

  const handleBatchStatus = async (new_status: string) => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/jobs/batch-status`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_ids: Array.from(selectedIds), new_status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Successfully updated ${selectedIds.size} clips`);
      setSelectedIds(new Set());
      fetchJobs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.size} selected clips?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/jobs/batch-delete`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_ids: Array.from(selectedIds) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Successfully deleted ${selectedIds.size} clips`);
      setSelectedIds(new Set());
      fetchJobs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handlePublishNow = async (jobId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}/publish-now`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Clip successfully published!');
      fetchJobs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!activeChannel) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-blue-50 p-6 rounded-full mb-6">
          <PlaySquare className="w-12 h-12 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Select a Project</h1>
        <p className="text-gray-500 max-w-md mx-auto mb-8">
          You must select a project from the sidebar to view its render queue.
        </p>
      </div>
    );
  }

  const TABS = [
    { id: 'ALL', label: 'All Jobs' },
    { id: 'IDLE', label: 'Idle / Staged' },
    { id: 'QUEUED_FOR_RENDER', label: 'Queued for Render' },
    { id: 'PROCESSING', label: 'Processing' },
    { id: 'READY_FOR_REVIEW', label: 'Review Required' },
    { id: 'SCHEDULED', label: 'Scheduled' },
    { id: 'PUBLISHED', label: 'Published' },
    { id: 'FAILED', label: 'Failed' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IDLE': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 flex items-center w-max"><HardDrive className="w-3 h-3 mr-1" /> Idle / Staged</span>;
      case 'QUEUED_FOR_RENDER': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 flex items-center w-max"><Clock className="w-3 h-3 mr-1" /> Queued for GPU</span>;
      case 'PROCESSING': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 flex items-center w-max"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</span>;
      case 'READY_FOR_REVIEW': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center w-max"><AlertTriangle className="w-3 h-3 mr-1" /> Needs Review</span>;
      case 'SCHEDULED': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200 flex items-center w-max"><Calendar className="w-3 h-3 mr-1" /> Scheduled</span>;
      case 'PUBLISHED': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200 flex items-center w-max"><CheckCircle2 className="w-3 h-3 mr-1" /> Published</span>;
      case 'FAILED': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 flex items-center w-max"><AlertTriangle className="w-3 h-3 mr-1" /> Failed</span>;
      default: return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">{status}</span>;
    }
  };

  const visibleSelectedCount = jobs.filter(j => selectedIds.has(j.id)).length;
  const allVisibleSelected = jobs.length > 0 && visibleSelectedCount === jobs.length;

  return (
    <div className="p-8 max-w-7xl mx-auto pb-32">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Render Queue</h1>
          <p className="text-gray-500 mt-2">Selectively dispatch and manage clips for <strong className="text-gray-900">{activeChannel.channel_name}</strong>.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); setSelectedIds(new Set()); }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors
                ${statusFilter === tab.id 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.label}
              {statusFilter === tab.id && (
                <span className="ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                  {totalJobs}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters & Sorting */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white shadow-sm"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="flex items-center space-x-2">
            <ListFilter className="w-5 h-5 text-gray-400" />
            <select 
              value={sortBy} 
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 py-2 pl-3 pr-8 shadow-sm bg-white"
            >
              <option value="name_asc">Filename (Low to High)</option>
              <option value="name_desc">Filename (High to Low)</option>
              <option value="date_desc">Date Added (Newest First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Select Toolbar */}
      <div className="flex items-center space-x-2 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">Quick Select:</span>
        <button onClick={() => selectNext(5)} className="px-3 py-1.5 text-xs font-medium rounded bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 shadow-sm transition-colors whitespace-nowrap">Next 5</button>
        <button onClick={() => selectNext(10)} className="px-3 py-1.5 text-xs font-medium rounded bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 shadow-sm transition-colors whitespace-nowrap">Next 10</button>
        <button onClick={() => handleSelectAll({ target: { checked: true } } as any)} className="px-3 py-1.5 text-xs font-medium rounded bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 shadow-sm transition-colors whitespace-nowrap">Select Visible</button>
        <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs font-medium rounded bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 shadow-sm transition-colors whitespace-nowrap">Deselect All</button>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden mb-6 relative">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center absolute inset-0 bg-white/50 backdrop-blur-sm z-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : null}

        {jobs.length === 0 && !isLoading ? (
          <div className="p-16 text-center">
            <FileVideo className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No clips found</h3>
            <p className="text-gray-500">There are no clips in this queue matching your current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      checked={allVisibleSelected}
                      ref={input => { if (input) input.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < jobs.length; }}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clip & Date</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="relative px-6 py-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map(job => {
                  const scheduleDate = new Date(job.scheduled_slot || job.scheduled_at || job.created_at);
                  const isScheduled = !!(job.scheduled_slot || job.scheduled_at) && job.status === 'SCHEDULED';
                  const isSelected = selectedIds.has(job.id);
                  return (
                  <tr key={job.id} className={`transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap w-12">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => {
                          const newSet = new Set(selectedIds);
                          if (e.target.checked) newSet.add(job.id);
                          else newSet.delete(job.id);
                          setSelectedIds(newSet);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 w-12 h-14 rounded-lg flex flex-col items-center justify-center border ${isScheduled ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'} mr-4 shadow-sm`}>
                          <span className="text-xs font-bold uppercase">{scheduleDate.toLocaleString('default', { month: 'short' })}</span>
                          <span className="text-lg font-black leading-none my-0.5">{scheduleDate.getDate()}</span>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{job.file_name}</div>
                          <div className="text-xs text-gray-500 mt-1 uppercase font-medium tracking-wider flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            {isScheduled ? 'Scheduled:' : 'Added:'} {scheduleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (IST)
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      {job.status === 'READY_FOR_REVIEW' && (
                        <a 
                          href={`/review?job_id=${job.id}`} 
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 transition-colors"
                        >
                          Review & Schedule
                        </a>
                      )}
                      {job.status === 'SCHEDULED' && (
                        <div className="flex space-x-2 justify-end">
                          <a 
                            href={`/review?job_id=${job.id}`} 
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-xs"
                          >
                            Review Video
                          </a>
                          <button onClick={() => handlePublishNow(job.id)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                            <Send className="w-3 h-3 mr-1.5" /> Publish Now
                          </button>
                        </div>
                      )}
                      {job.status === 'PUBLISHED' && (
                        <a 
                          href={`/review?job_id=${job.id}`} 
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 hover:bg-gray-200"
                        >
                          View Details
                        </a>
                      )}
                      {(job.status === 'IDLE' || job.status === 'FAILED') && (
                        <button onClick={() => {
                          setSelectedIds(new Set([job.id]));
                          handleBatchDelete();
                        }} className="text-red-500 hover:text-red-700 inline-flex items-center p-2 rounded-md hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination Footer */}
        {jobs.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 sm:px-6 flex items-center justify-between">
            <div className="flex items-center text-sm text-gray-700">
              <span className="mr-3">Rows per page:</span>
              <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setCurrentPage(1); }} className="border-gray-300 rounded text-sm bg-white py-1 pl-2 pr-6 shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-end space-x-6">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{(currentPage - 1) * limit + 1}</span>-
                <span className="font-medium">{Math.min(currentPage * limit, totalJobs)}</span> of <span className="font-medium">{totalJobs}</span>
              </p>
              <div className="flex space-x-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1.5 rounded bg-white border border-gray-300 disabled:opacity-50 hover:bg-gray-50 shadow-sm transition-colors text-gray-600"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1.5 rounded bg-white border border-gray-300 disabled:opacity-50 hover:bg-gray-50 shadow-sm transition-colors text-gray-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Batch Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 rounded-full shadow-2xl px-6 py-4 flex items-center space-x-6 z-50 border border-gray-700 animate-in slide-in-from-bottom-8">
          <div className="flex items-center space-x-2 text-white">
            <span className="bg-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">{selectedIds.size}</span>
            <span className="text-sm font-medium">clips selected</span>
          </div>
          <div className="w-px h-6 bg-gray-700"></div>
          <div className="flex space-x-3">
            <button 
              onClick={() => handleBatchStatus('QUEUED_FOR_RENDER')}
              className="flex items-center text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full transition-colors shadow-lg"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Send to Processing
            </button>
            <button 
              onClick={() => handleBatchStatus('IDLE')}
              className="flex items-center text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-600 px-4 py-2 rounded-full transition-colors"
            >
              <Pause className="w-4 h-4 mr-2" /> Hold / Set Idle
            </button>
            <button 
              onClick={handleBatchDelete}
              className="flex items-center justify-center text-red-400 hover:text-red-300 bg-gray-800 hover:bg-gray-700 border border-gray-600 w-10 h-10 rounded-full transition-colors"
              title="Delete Selected"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Review & Approve Modal */}
      {modalJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/70 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
                Review Video & Metadata
              </h2>
              <button onClick={() => setModalJob(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Left Column: Preview */}
              <div className="w-full md:w-5/12 bg-gray-900 flex flex-col justify-center items-center p-6 relative">
                {modalJob.youtube_video_id ? (
                  <div className="w-full aspect-[9/16] max-h-full max-w-[320px] bg-black rounded-xl overflow-hidden shadow-2xl relative ring-1 ring-gray-700">
                    <iframe 
                      src={`https://www.youtube.com/embed/${modalJob.youtube_video_id}?autoplay=1&controls=1&mute=0&loop=1&playlist=${modalJob.youtube_video_id}`}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 p-8">
                    <FileVideo className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No preview available for this clip.</p>
                  </div>
                )}
                
                <div className="mt-6 flex items-center space-x-2 text-sm text-gray-300 bg-gray-800/80 px-4 py-2 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span>Unlisted on YouTube</span>
                </div>
              </div>

              {/* Right Column: Metadata Form */}
              <div className="w-full md:w-7/12 p-8 overflow-y-auto bg-white">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">YouTube Title</label>
                    <input 
                      type="text" 
                      value={modalJob.ai_title || ''}
                      onChange={e => setModalJob({ ...modalJob, ai_title: e.target.value })}
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm py-2.5 px-3"
                    />
                    <p className="mt-1 text-xs text-gray-500">Keep it punchy. Hashtags in title boost Shorts visibility.</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Description (with DMCA footer)</label>
                    <textarea 
                      rows={6}
                      value={modalJob.ai_description || ''}
                      onChange={e => setModalJob({ ...modalJob, ai_description: e.target.value })}
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm py-2.5 px-3"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Tags (comma separated)</label>
                    <input 
                      type="text" 
                      value={modalJob.ai_tags || ''}
                      onChange={e => setModalJob({ ...modalJob, ai_tags: e.target.value })}
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm py-2.5 px-3"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between mt-auto">
              <div>
                {modalJob.status === 'SCHEDULED' && (
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Currently Scheduled to post at {new Date(modalJob.scheduled_at || '').toLocaleString()}</span>
                )}
                {modalJob.status === 'PUBLISHED' && (
                  <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">Published on {new Date(modalJob.published_at || '').toLocaleString()}</span>
                )}
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setModalJob(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
                >
                  Cancel
                </button>
                {modalJob.status !== 'PUBLISHED' && (
                  <>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_BASE}/api/jobs/${modalJob.id}/approve`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...modalJob, publish_now: false })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error);
                          toast.success('Video Scheduled!');
                          setModalJob(null);
                          fetchJobs();
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      className="px-5 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-sm flex items-center"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Approve & Schedule
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_BASE}/api/jobs/${modalJob.id}/approve`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...modalJob, publish_now: true })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error);
                          toast.success('Video Published to YouTube!');
                          setModalJob(null);
                          fetchJobs();
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Publish Publicly Now
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
