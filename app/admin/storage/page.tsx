'use client';

import { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Image as ImageIcon, Loader2 } from 'lucide-react';

const STORAGE_BUCKETS = [
  { id: 'profile-pictures', name: 'Profile Pictures', icon: '👤' },
  { id: 'business-logos', name: 'Business Logos', icon: '🏢' },
  { id: 'business-backgrounds', name: 'Business Backgrounds', icon: '🖼️' },
  { id: 'estimate-images', name: 'Estimate Images', icon: '📋' },
];

interface StorageFile {
  name: string;
  path: string;
  publicUrl: string;
  size: number;
  mimeType: string;
  created_at: string;
  id: string;
}

export default function StorageManagementPage() {
  const [selectedBucket, setSelectedBucket] = useState<string>(STORAGE_BUCKETS[0].id);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async (bucket: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/storage/list?bucket=${bucket}`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(selectedBucket);
  }, [selectedBucket]);

  const handleDelete = async (file: StorageFile) => {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
      return;
    }

    setDeleting(file.id);
    try {
      const response = await fetch(
        `/api/storage/delete?bucket=${selectedBucket}&path=${encodeURIComponent(file.path)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      // Remove file from local state
      setFiles(files.filter(f => f.id !== file.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-black mb-2">
          Storage Management
        </h1>
        <p className="text-gray-600">
          View and manage files in your Supabase storage buckets.
        </p>
      </div>

      {/* Bucket Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-black mb-2">
          Select Bucket
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STORAGE_BUCKETS.map((bucket) => (
            <button
              key={bucket.id}
              onClick={() => setSelectedBucket(bucket.id)}
              className={`
                p-4 border-2 rounded-lg transition-all duration-200 text-left
                ${selectedBucket === bucket.id
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 bg-white text-black hover:border-gray-500'
                }
              `}
            >
              <div className="text-2xl mb-1">{bucket.icon}</div>
              <div className="font-medium text-sm">{bucket.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {files.length} file{files.length !== 1 ? 's' : ''} in{' '}
          {STORAGE_BUCKETS.find(b => b.id === selectedBucket)?.name}
        </div>
        <button
          onClick={() => fetchFiles(selectedBucket)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border-2 border-black rounded-lg bg-white text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Files Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : files.length === 0 ? (
        <div className="p-12 text-center border-2 border-gray-200 rounded-lg bg-gray-50">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">No files found in this bucket.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden hover:border-gray-500 transition-colors"
            >
              {/* Image Preview */}
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                {file.mimeType.startsWith('image/') ? (
                  <img
                    src={file.publicUrl}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="p-4">
                <div className="mb-2">
                  <div className="font-medium text-sm text-black truncate" title={file.name}>
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatFileSize(file.size)} • {file.mimeType}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatDate(file.created_at)}
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleDelete(file)}
                  disabled={deleting === file.id}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 border-2 border-red-200 text-red-700 rounded-lg hover:bg-red-100 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting === file.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
