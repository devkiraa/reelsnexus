'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '../ProjectContext';
import { 
  PlaySquare, Loader2, Clock, CheckCircle2, AlertTriangle, 
  Send, Calendar, ExternalLink, RefreshCw, Trash2, Eye, 
  Sparkles, Check, ChevronRight, FileVideo
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthHeaders } from '../AuthContext';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787' 
  : 'https://reelnexus-worker.devkiraa.workers.dev';

export default function ReviewPage() {
  const { activeChannel } = useProject();
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'READY_FOR_REVIEW' | 'SCHEDULED' | 'PUBLISHED'>('READY_FOR_REVIEW');
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const [reauthNeeded, setReauthNeeded] = useState(false);

  // Metadata form state
  const [aiTitle, setAiTitle] = useState('');
  const [aiTitleVariants, setAiTitleVariants] = useState<string[]>([]);
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

  const handleGenerateMetadata = async (jobId: string) => {
    setIsGeneratingMetadata(true);
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}/generate-metadata`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate AI metadata');

      setAiTitle(data.ai_title || data.title || '');
      setAiTitleVariants(data.ai_title_variants || []);
      setAiDescription(data.ai_description || data.description || '');
      setAiTags(data.ai_tags || data.tags || '');
      toast.success('Generated viral title & description!');
    } catch (e: any) {
      console.error(e);
      toast.error('AI generation failed: ' + e.message);
    } finally {
      setIsGeneratingMetadata(false);
    }
  };

  const selectJob = (job: any) => {
    setSelectedJob(job);
    setAiTitle(job.ai_title || '');
    setAiDescription(job.ai_description || '');
    setAiTags(job.ai_tags || '');

    let parsedVariants: string[] = [];
    try {
      if (job.ai_title_variants) {
        parsedVariants = typeof job.ai_title_variants === 'string' 
          ? JSON.parse(job.ai_title_variants) 
          : job.ai_title_variants;
      }
    } catch (e) {}
    setAiTitleVariants(parsedVariants);

    // Auto-generate if job still has placeholder title or empty
    if (!job.ai_title || job.ai_title === 'Generated Hook Title 🔥') {
      handleGenerateMetadata(job.id);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('youtube_reconnected') === 'true') {
        toast.success('YouTube channel permissions updated successfully! You can now publish.');
        setReauthNeeded(false);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('youtube_reconnected');
        window.history.replaceState({}, '', newUrl.toString());
      }
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
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ai_title: aiTitle,
          ai_description: aiDescription,
          ai_tags: aiTags,
          publish_now: publishNow
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 || data.error === 'YOUTUBE_REAUTH_REQUIRED' || String(data.details).includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || String(data.details).includes('insufficientPermissions')) {
          setReauthNeeded(true);
          throw new Error('YouTube requires updated channel permissions to edit/publish videos. Click "Reconnect YouTube Channel" below.');
        }
        throw new Error(data.error || 'Failed to approve video');
      }

      if (publishNow) {
        toast.success('Video Published Publicly to YouTube!');
      } else {
        const slot = new Date(data.scheduled_slot);
        toast.success(`Scheduled for ${slot.toLocaleString()} (US Peak Window)`);
      }

      await fetchJobs();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAll = async () => {
    if (jobs.length === 0) return;
    if (!confirm(`Are you sure you want to schedule all ${jobs.length} videos for peak slots?`)) return;

    setIsBatchApproving(true);
    setBatchProgress(0);
    let successCount = 0;
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${job.id}/approve`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            ai_title: job.ai_title || "Shorts Video",
            ai_description: job.ai_description || "",
            ai_tags: job.ai_tags || "",
            publish_now: false
          })
        });
        const data = await res.json();
        if (!res.ok) {
           if (res.status === 403 || data.error === 'YOUTUBE_REAUTH_REQUIRED') {
             setReauthNeeded(true);
             toast.error('YouTube reauth needed during batch process!');
             break;
           }
           console.error(`Failed job ${job.id}:`, data.error);
        } else {
           successCount++;
        }
      } catch (e) {
        console.error(`Error on job ${job.id}:`, e);
      }
      setBatchProgress(i + 1);
    }
    
    setIsBatchApproving(false);
    toast.success(`Batch completed: Scheduled ${successCount} out of ${jobs.length} videos!`);
    await fetchJobs();
  };

  const handleDelete = async () => {
    if (!selectedJob) return;
    if (!confirm(`Are you sure you want to delete ${selectedJob.file_name}?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${selectedJob.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-36">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5 sm:gap-3">
            <Eye className="w-7 h-7 sm:w-8 sm:h-8 text-orange-600 shrink-0" />
            <span>Review & Schedule Studio</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2">
            Inspect rendered videos, edit titles & descriptions, and schedule for peak YouTube Shorts viewership.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            onClick={() => {
              if (activeChannel) {
                window.location.href = `${API_BASE}/api/auth/youtube/connect?channel_id=${activeChannel.id}&return_to=/review${selectedJob ? `?job_id=${selectedJob.id}` : ''}`;
              }
            }}
            title="Update or fix YouTube video publishing permissions"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl shadow-xs transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            <span>Reconnect Permissions</span>
          </button>

          {activeTab === 'READY_FOR_REVIEW' && jobs.length > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={isBatchApproving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors shrink-0 disabled:opacity-50"
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${isBatchApproving ? 'animate-spin' : ''}`} />
              <span>{isBatchApproving ? `Approving ${batchProgress}/${jobs.length}...` : 'Approve All'}</span>
            </button>
          )}

          {/* Tab Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto scrollbar-none max-w-full">
            <button
              onClick={() => setActiveTab('READY_FOR_REVIEW')}
              className={`whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'READY_FOR_REVIEW'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Needs Review ({activeTab === 'READY_FOR_REVIEW' ? jobs.length : '...'})
            </button>
            <button
              onClick={() => setActiveTab('SCHEDULED')}
              className={`whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'SCHEDULED'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Scheduled ({activeTab === 'SCHEDULED' ? jobs.length : '...'})
            </button>
            <button
              onClick={() => setActiveTab('PUBLISHED')}
              className={`whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'PUBLISHED'
                  ? 'bg-white text-purple-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Published ({activeTab === 'PUBLISHED' ? jobs.length : '...'})
            </button>
          </div>
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
            {activeTab === 'READY_FOR_REVIEW' ? 'All Caught Up!' : activeTab === 'SCHEDULED' ? 'No Scheduled Videos' : 'No Published Videos Yet'}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            {activeTab === 'READY_FOR_REVIEW'
              ? 'There are no rendered videos currently awaiting review. New videos rendered by the Colab worker will appear here automatically.'
              : activeTab === 'SCHEDULED'
              ? 'There are currently no videos scheduled to publish in this channel.'
              : 'No videos have been published yet for this project.'}
          </p>
          <button 
            onClick={() => fetchJobs()}
            className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
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

            <div className="space-y-2 sm:space-y-2.5 max-h-[300px] sm:max-h-[360px] lg:max-h-[750px] overflow-y-auto pr-1">
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
                          {job.status === 'PUBLISHED' ? (
                            <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                              Published
                            </span>
                          ) : job.youtube_video_id ? (
                            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                              Uploaded
                            </span>
                          ) : null}
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

                {selectedJob.youtube_video_id && (
                  <a
                    href={`https://youtu.be/${selectedJob.youtube_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-blue-600 bg-white border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                    Open on YouTube
                  </a>
                )}
              </div>

              {/* Clean YouTube Video Player (No dark background) */}
              <div className="p-6 flex flex-col items-center justify-center bg-white border-b border-gray-100">
                {selectedJob.youtube_video_id ? (
                  <div className="w-full aspect-[9/16] max-h-[500px] max-w-[280px] bg-black rounded-2xl overflow-hidden shadow-xl border border-gray-200 relative">
                    <iframe
                      src={`https://www.youtube.com/embed/${selectedJob.youtube_video_id}?autoplay=1&controls=1&mute=0&rel=0`}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  <div className="w-full aspect-[9/16] max-h-[440px] max-w-[280px] bg-gray-50 rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <FileVideo className="w-12 h-12 mb-2 text-gray-300" />
                    <p className="text-xs font-medium">YouTube unlisted upload pending...</p>
                  </div>
                )}
              </div>

              {/* Metadata Form with Skeleton Loading */}
              <div className="p-6 space-y-6 flex-1 bg-white">
                {isGeneratingMetadata ? (
                  /* Skeleton Animation */
                  <div className="space-y-6 animate-pulse">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg w-max">
                      <Sparkles className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Generating viral title, SEO description & hashtags with AI...</span>
                    </div>

                    <div>
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-10 bg-gray-100 rounded-lg w-full border border-gray-200 animate-pulse"></div>
                    </div>

                    <div>
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-32 bg-gray-100 rounded-lg w-full border border-gray-200 animate-pulse"></div>
                    </div>

                    <div>
                      <div className="h-4 bg-gray-200 rounded w-1/5 mb-2"></div>
                      <div className="h-10 bg-gray-100 rounded-lg w-full border border-gray-200 animate-pulse"></div>
                    </div>
                  </div>
                ) : (
                  /* Real Inputs */
                  <>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <label className="block text-sm font-bold text-gray-900">
                          YouTube Shorts Title
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleGenerateMetadata(selectedJob.id)}
                            disabled={isGeneratingMetadata}
                            className="inline-flex items-center text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 px-3 py-1.5 rounded-lg border border-blue-200/60 shadow-2xs transition-colors min-h-[36px]"
                            title="Regenerate title and description using AI"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-500" />
                            Regenerate with AI
                          </button>
                          <span className={`text-xs ${aiTitle.length > 90 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                            {aiTitle.length} / 100
                          </span>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={aiTitle}
                        onChange={e => setAiTitle(e.target.value)}
                        placeholder="Enter engaging curiosity-driven title ending with #Shorts"
                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm py-2.5 px-3"
                      />
                      {aiTitleVariants && aiTitleVariants.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Variants (Click to select)</span>
                          {aiTitleVariants.map((variant, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setAiTitle(variant)}
                              className={`text-left text-sm py-1.5 px-3 rounded-md border transition-colors ${aiTitle === variant ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                              {variant}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="mt-1.5 text-xs text-gray-500">
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
                  </>
                )}
              </div>

              {/* Reauth Warning Alert Banner */}
              {reauthNeeded && (
                <div className="mx-4 sm:mx-6 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-amber-900">YouTube Re-authorization Needed</p>
                      <p className="text-amber-700">Google requires video edit permissions to update privacy and titles. Click below to reconnect.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      window.location.href = `${API_BASE}/api/auth/youtube/connect?channel_id=${activeChannel?.id}&return_to=/review${selectedJob ? `?job_id=${selectedJob.id}` : ''}`;
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-sm sm:text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center justify-center gap-1.5 shadow-xs min-h-[44px]"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reconnect YouTube Channel
                  </button>
                </div>
              )}

              {/* Action Bar Footer */}
              <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-3 sm:py-2 border border-red-200 text-sm sm:text-xs font-semibold rounded-xl sm:rounded-lg text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 transition-colors disabled:opacity-50 min-h-[48px] sm:min-h-0"
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                  {selectedJob.status === 'PUBLISHED' ? 'Remove from List' : 'Reject / Delete'}
                </button>

                {selectedJob.status === 'PUBLISHED' ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:space-x-3 justify-end">
                    <span className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl sm:rounded-lg text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 min-h-[44px] sm:min-h-0">
                      <CheckCircle2 className="w-4 h-4 mr-1.5 text-purple-600" />
                      Live on YouTube
                    </span>
                    {selectedJob.youtube_video_id && (
                      <a
                        href={`https://www.youtube.com/shorts/${selectedJob.youtube_video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-5 py-3.5 sm:py-2.5 text-sm sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl sm:rounded-lg shadow-xs flex items-center justify-center transition-colors min-h-[48px] sm:min-h-0"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Watch on YouTube
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:space-x-3">
                    <button
                      onClick={() => handleApprove(false)}
                      disabled={submitting || isGeneratingMetadata}
                      className="w-full sm:w-auto px-7 py-4 sm:py-3.5 text-base sm:text-sm font-extrabold text-white bg-gray-950 hover:bg-gray-800 active:bg-black rounded-xl sm:rounded-lg shadow-md flex items-center justify-center transition-all disabled:opacity-50 min-h-[56px] border border-gray-800"
                    >
                      {submitting ? (
                        <Loader2 className="w-5 h-5 mr-2.5 animate-spin" />
                      ) : (
                        <Calendar className="w-5 h-5 mr-2.5 text-blue-400" />
                      )}
                      Schedule (US Peak)
                    </button>

                    <button
                      onClick={() => handleApprove(true)}
                      disabled={submitting || isGeneratingMetadata}
                      className="w-full sm:w-auto px-6 py-3.5 sm:py-3 text-base sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl sm:rounded-lg shadow-xs flex items-center justify-center transition-colors disabled:opacity-50 min-h-[50px]"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Publish Publicly Now
                    </button>
                  </div>
                )}
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
