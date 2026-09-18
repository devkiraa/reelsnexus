'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '../ProjectContext';
import { 
  PlaySquare, Loader2, Clock, CheckCircle2, AlertTriangle, 
  Send, Calendar, ExternalLink, RefreshCw, Trash2, Eye, 
  Sparkles, Check, ChevronRight, Video, FileVideo
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

export default function ReviewPage() {
  const { activeChannel } = useProject();
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playerMode, setPlayerMode] = useState<'html5' | 'youtube'>('youtube');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'READY_FOR_REVIEW' | 'SCHEDULED'>('READY_FOR_REVIEW');

  // Metadata form state
  const [aiTitle, setAiTitle] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [aiTags, setAiTags] = useState('');

  const fetchJobs = async (targetJobId?: string) => {
    if (!activeChannel) return;
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        channel_id: activeChannel.id.toString(),
        status: activeTab,
        limit: '50',
        sort_by: 'name_asc'
      });
      const res = await fetch(`${API_BASE}/api/jobs?${q.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      const list = data.data || [];
      setJobs(list);

      // Select target job if specified, or first job in list, or retain selected if still in list
      if (targetJobId) {
        const found = list.find((j: any) => j.id === targetJobId);
        if (found) selectJob(found);
        else if (list.length > 0) selectJob(list[0]);
      } else if (list.length > 0) {
        if (!selectedJob || !list.some((j: any) => j.id === selectedJob.id)) {
          selectJob(list[0]);
        }
      } else {
        setSelectedJob(null);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load review queue');
    } finally {
      setIsLoading(false);
    }
  };

  const selectJob = (job: any) => {
    setSelectedJob(job);
    setAiTitle(job.ai_title || '');
    setAiDescription(job.ai_description || '');
    setAiTags(job.ai_tags || '');
    // Default to YouTube if available, else HTML5
    if (job.youtube_video_id) {
      setPlayerMode('youtube');
    } else {
      setPlayerMode('html5');
    }
  };

  useEffect(() => {
    // Read query parameter if specified (e.g. ?job_id=xxx)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const targetJobId = urlParams.get('job_id') || undefined;
      fetchJobs(targetJobId);
    } else {
      fetchJobs();
    }
  }, [activeChannel, activeTab]);

  const handleApprove = async (publishNow: boolean) => {
    if (!selectedJob) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${selectedJob.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_title: aiTitle,
          ai_description: aiDescription,
          ai_tags: aiTags,
          publish_now: publishNow
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve video');

      if (publishNow) {
        toast.success('Video Published Publicly to YouTube!');
      } else {
        toast.success(`Video Scheduled for ${new Date(data.scheduled_slot).toLocaleString()}`);
      }

      await fetchJobs();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedJob) return;
    if (!confirm(`Are you sure you want to delete ${selectedJob.file_name}?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${selectedJob.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete job');
      toast.success('Job removed');
      await fetchJobs();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    } finally {
      setSubmitting(false);
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
          Please select a project from the sidebar to review its rendered clips.
        </p>
      </div>
    );
  }

  const driveVideoUrl = selectedJob 
    ? `${API_BASE}/api/drive/proxy-video?fileId=${selectedJob.source_file_id || selectedJob.raw_drive_id}`
    : '';

  return (
    <div className="p-8 max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Eye className="w-8 h-8 text-orange-600" />
            Review & Schedule Studio
          </h1>
          <p className="text-gray-500 mt-2">
            Inspect rendered videos, fine-tune titles & descriptions, and schedule for peak YouTube Shorts viewership.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('READY_FOR_REVIEW')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'READY_FOR_REVIEW'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Needs Review ({activeTab === 'READY_FOR_REVIEW' ? jobs.length : '...'})
          </button>
          <button
            onClick={() => setActiveTab('SCHEDULED')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'SCHEDULED'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Scheduled Queue
          </button>
        </div>
      </div>

      {isLoading && jobs.length === 0 ? (
        <div className="p-16 flex flex-col justify-center items-center bg-white rounded-2xl border border-gray-200">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500 font-medium">Loading clips for review...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-gray-200 shadow-sm">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {activeTab === 'READY_FOR_REVIEW' ? 'All Caught Up!' : 'No Scheduled Videos'}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            {activeTab === 'READY_FOR_REVIEW'
              ? 'There are no rendered videos currently awaiting review. New videos rendered by the Colab worker will appear here automatically.'
              : 'There are currently no videos scheduled to publish in this channel.'}
          </p>
          <button 
            onClick={() => fetchJobs()}
            className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Clips List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {jobs.length} {jobs.length === 1 ? 'Clip' : 'Clips'} Available
              </span>
              <button 
                onClick={() => fetchJobs()} 
                className="text-gray-400 hover:text-gray-600 transition-colors" 
                title="Refresh List"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {jobs.map(job => {
                const isSelected = selectedJob?.id === job.id;
                const createdDate = new Date(job.created_at);
                return (
                  <div
                    key={job.id}
                    onClick={() => selectJob(job)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected 
                        ? 'bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500' 
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <FileVideo className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{job.file_name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {job.youtube_video_id && (
                            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                              Uploaded Unlisted
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-blue-600 translate-x-0.5' : 'text-gray-400'}`} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Clip Player & Metadata Editor */}
          {selectedJob ? (
            <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              {/* Card Header */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedJob.file_name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Source: {selectedJob.source_type?.toUpperCase()} | Size: {(selectedJob.file_size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>

                {/* Player Mode Switcher */}
                <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 text-xs shadow-xs">
                  {selectedJob.youtube_video_id && (
                    <button
                      onClick={() => setPlayerMode('youtube')}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                        playerMode === 'youtube'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      YouTube Player
                    </button>
                  )}
                  <button
                    onClick={() => setPlayerMode('html5')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      playerMode === 'html5'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    HTML5 Video (Play/Pause/Seek)
                  </button>
                </div>
              </div>

              {/* Player Area */}
              <div className="bg-gray-950 p-6 flex flex-col items-center justify-center relative">
                {playerMode === 'youtube' && selectedJob.youtube_video_id ? (
                  <div className="w-full aspect-[9/16] max-h-[440px] max-w-[280px] bg-black rounded-xl overflow-hidden shadow-2xl relative ring-1 ring-gray-800">
                    <iframe
                      src={`https://www.youtube.com/embed/${selectedJob.youtube_video_id}?autoplay=1&controls=1&mute=0&rel=0`}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  <div className="w-full aspect-[9/16] max-h-[440px] max-w-[280px] bg-black rounded-xl overflow-hidden shadow-2xl relative ring-1 ring-gray-800 flex items-center justify-center">
                    <video
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                      src={driveVideoUrl}
                    >
                      Your browser does not support HTML5 video tag.
                    </video>
                  </div>
                )}

                {/* Sub-player Links */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {selectedJob.youtube_video_id && (
                    <a
                      href={`https://youtu.be/${selectedJob.youtube_video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-gray-300 hover:text-white bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                      Open on YouTube
                    </a>
                  )}
                  {driveVideoUrl && (
                    <a
                      href={driveVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-gray-300 hover:text-white bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Video className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                      Stream Raw File
                    </a>
                  )}
                </div>
              </div>

              {/* Metadata Form */}
              <div className="p-6 space-y-6 flex-1 bg-white">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-bold text-gray-900">
                      YouTube Shorts Title
                    </label>
                    <span className={`text-xs ${aiTitle.length > 90 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                      {aiTitle.length} / 100
                    </span>
                  </div>
                  <input
                    type="text"
                    value={aiTitle}
                    onChange={e => setAiTitle(e.target.value)}
                    placeholder="Enter engaging curiosity-driven title ending with #Shorts"
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm py-2.5 px-3"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Hook titles with emojis and high-density keywords rank faster on the Shorts shelf.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-bold text-gray-900">
                      Description (with Fair Use / DMCA notice)
                    </label>
                    <span className="text-xs text-gray-400">
                      {aiDescription.split('\n').length} lines
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={aiDescription}
                    onChange={e => setAiDescription(e.target.value)}
                    placeholder="Shorts description..."
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm py-2.5 px-3 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1.5">
                    Keywords & Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={aiTags}
                    onChange={e => setAiTags(e.target.value)}
                    placeholder="shorts, luxury, motivation, wealth"
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm py-2.5 px-3"
                  />
                </div>
              </div>

              {/* Action Bar Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="inline-flex items-center px-3 py-2 border border-red-200 text-xs font-semibold rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Reject / Delete
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleApprove(false)}
                    disabled={submitting}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-sm flex items-center transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Calendar className="w-4 h-4 mr-2 text-blue-400" />
                    )}
                    Approve & Schedule (Peak Hour)
                  </button>

                  <button
                    onClick={() => handleApprove(true)}
                    disabled={submitting}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Publish Publicly Now
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl p-16 text-center text-gray-500">
              Select a clip from the left list to review.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
