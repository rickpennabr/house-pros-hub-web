'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, User, Reply } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { feedbackStorage, Comment } from '@/lib/storage/feedbackStorage';
import { businessStorage } from '@/lib/storage/businessStorage';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  contractorType: string;
  logo?: string;
  businessId: string;
  onCommentsChange?: () => void;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(word => word.length > 0);
  
  if (words.length === 0) return '';
  
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  } else {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
}

export default function FeedbackModal({
  isOpen,
  onClose,
  businessName,
  contractorType,
  logo,
  businessId,
  onCommentsChange,
}: FeedbackModalProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(businessName);
  const MAX_COMMENT_LENGTH = 500;
  
  const userInitials = user ? getInitials(`${user.firstName} ${user.lastName}`) : 'U';
  const userName = user ? `${user.firstName} ${user.lastName}` : 'User';

  // Check if current user is the business owner
  const isBusinessOwner = (): boolean => {
    if (!user || !businessId) return false;
    const businesses = businessStorage.getAllBusinesses();
    const business = businesses.find((b: any) => b.id === businessId);
    return business?.userId === user.id;
  };

  const isOwner = isBusinessOwner();

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      // Use a small delay to prevent immediate propagation
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Load comments from storage when modal opens
  useEffect(() => {
    if (isOpen && businessId) {
      const storedComments = feedbackStorage.getFeedback(businessId);
      setComments(storedComments);
    }
  }, [isOpen, businessId]);

  if (!isOpen) return null;

  const handleSubmitComment = () => {
    if (!newComment.trim() || newComment.length > MAX_COMMENT_LENGTH || !user) return;

    const comment: Comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      author: userName,
      authorId: user.id,
      authorType: isOwner ? 'business' : 'homeowner',
      text: newComment,
      timestamp: new Date(),
      authorPicture: user?.userPicture,
      replies: [],
    };

    const updatedComments = [...comments, comment];
    setComments(updatedComments);
    feedbackStorage.addComment(businessId, comment);
    setNewComment('');
    
    // Notify parent component that comments changed
    if (onCommentsChange) {
      onCommentsChange();
    }
  };

  const handleStartReply = (commentId: string) => {
    setReplyingTo(commentId);
    if (!replyText[commentId]) {
      setReplyText({ ...replyText, [commentId]: '' });
    }
  };

  const handleCancelReply = (commentId: string) => {
    setReplyingTo(null);
    setReplyText({ ...replyText, [commentId]: '' });
  };

  const handleSubmitReply = (parentCommentId: string) => {
    const reply = replyText[parentCommentId];
    if (!reply?.trim() || reply.length > MAX_COMMENT_LENGTH || !user) return;

    const replyComment: Comment = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      author: userName,
      authorId: user.id,
      authorType: isOwner ? 'business' : 'homeowner',
      text: reply,
      timestamp: new Date(),
      authorPicture: user?.userPicture,
      parentId: parentCommentId,
    };

    // Update local state
    const updatedComments = comments.map(comment => {
      if (comment.id === parentCommentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), replyComment],
        };
      }
      return comment;
    });
    setComments(updatedComments);

    // Save to storage
    feedbackStorage.addReply(businessId, parentCommentId, replyComment);
    
    // Clear reply
    setReplyingTo(null);
    setReplyText({ ...replyText, [parentCommentId]: '' });
    
    // Note: We don't call onCommentsChange for replies since they don't affect the top-level comment count
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center md:p-4 bg-black/50"
      onClick={handleOverlayClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div 
        ref={modalRef} 
        className="bg-white md:rounded-lg border-2 border-black w-full h-full md:w-full md:h-auto md:max-w-md md:max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-black">
          <h2 className="text-xl font-bold text-black">Feedback & Comments</h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Business Info */}
        <div className="p-4 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
              {logo ? (
                <Image
                  src={logo}
                  alt={businessName}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <span className="text-lg font-bold text-white">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-black truncate">{businessName}</h3>
              <p className="text-sm text-gray-600 truncate">{contractorType}</p>
            </div>
          </div>
        </div>

        {/* Add Comment Section */}
        {user && (
          <div className="px-4 py-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-gray-500" />
              <h3 className="text-base font-semibold text-black">
                {isOwner ? 'Add Response' : 'Add Comment'}
              </h3>
            </div>
            <div className="bg-white border-2 border-black rounded-lg p-3">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
                  {user.userPicture ? (
                    <Image
                      src={user.userPicture}
                      alt={userName}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <span className="text-sm font-bold text-white">{userInitials}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">
                    {isOwner ? `Respond as ${businessName}` : `Add a comment as ${userName}`}
                  </p>
                  <div className="relative">
                    <textarea
                      value={newComment}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_COMMENT_LENGTH) {
                          setNewComment(e.target.value);
                        }
                      }}
                      placeholder={isOwner ? "Write a response..." : "Write a comment..."}
                      className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm min-h-[100px] resize-none focus:outline-none"
                      rows={4}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {newComment.length}/{MAX_COMMENT_LENGTH}
                      </span>
                      <button
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || newComment.length > MAX_COMMENT_LENGTH}
                        className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4 text-black" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="flex-1 px-4 py-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-black" />
            <h3 className="text-base font-semibold text-black">Comments</h3>
          </div>
          {comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No comments yet. Be the first to leave feedback!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const canReply = user && (
                  (comment.authorType === 'homeowner' && isOwner) ||
                  (comment.authorType === 'business' && !isOwner)
                );
                const isReplying = replyingTo === comment.id;

                return (
                  <div key={comment.id} className="space-y-3">
                    {/* Main Comment */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
                        {comment.authorPicture ? (
                          <Image
                            src={comment.authorPicture}
                            alt={comment.author}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <span className="text-sm font-bold text-white">
                            {getInitials(comment.author)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-black">{comment.author}</span>
                          {comment.authorType === 'business' && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-semibold">
                              Business
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{formatTime(comment.timestamp)}</span>
                        </div>
                        <p className="text-sm text-black mb-2">{comment.text}</p>
                        {canReply && !isReplying && (
                          <button
                            onClick={() => handleStartReply(comment.id)}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-black transition-colors"
                          >
                            <Reply className="w-3 h-3" />
                            Reply
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reply Input */}
                    {isReplying && user && (
                      <div className="ml-14 bg-gray-50 border-2 border-gray-300 rounded-lg p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
                            {user.userPicture ? (
                              <Image
                                src={user.userPicture}
                                alt={userName}
                                fill
                                className="object-cover"
                                sizes="32px"
                              />
                            ) : (
                              <span className="text-xs font-bold text-white">{userInitials}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <textarea
                              value={replyText[comment.id] || ''}
                              onChange={(e) => {
                                const text = e.target.value;
                                if (text.length <= MAX_COMMENT_LENGTH) {
                                  setReplyText({ ...replyText, [comment.id]: text });
                                }
                              }}
                              placeholder="Write a reply..."
                              className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm min-h-[80px] resize-none focus:outline-none"
                              rows={3}
                            />
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">
                                {(replyText[comment.id] || '').length}/{MAX_COMMENT_LENGTH}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleCancelReply(comment.id)}
                                  className="px-3 py-1 text-xs border-2 border-gray-400 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSubmitReply(comment.id)}
                                  disabled={!replyText[comment.id]?.trim() || (replyText[comment.id]?.length || 0) > MAX_COMMENT_LENGTH}
                                  className="px-3 py-1 text-xs bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  Reply
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="ml-14 space-y-3">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-300">
                            <div className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
                              {reply.authorPicture ? (
                                <Image
                                  src={reply.authorPicture}
                                  alt={reply.author}
                                  fill
                                  className="object-cover"
                                  sizes="32px"
                                />
                              ) : (
                                <span className="text-xs font-bold text-white">
                                  {getInitials(reply.author)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-black">{reply.author}</span>
                                {reply.authorType === 'business' && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-semibold">
                                    Business
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">{formatTime(reply.timestamp)}</span>
                              </div>
                              <p className="text-xs text-black">{reply.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

