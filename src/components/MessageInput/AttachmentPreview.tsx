// src/components/MessageInput/AttachmentPreview.tsx
// Attachment Preview Component

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { AttachmentPreviewProps, AttachmentFile } from './types';

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments,
  onRemove,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
}) => {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    // Generate image previews
    attachments.forEach((attachment) => {
      if (attachment.type === 'image' && !previews[attachment.id]) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews((prev) => ({
            ...prev,
            [attachment.id]: reader.result as string,
          }));
        };
        reader.readAsDataURL(attachment.file);
      }
    });

    // Cleanup
    return () => {
      Object.values(previews).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [attachments]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type: AttachmentFile['type']): string => {
    switch (type) {
      case 'image':
        return 'fa-image';
      case 'video':
        return 'fa-video';
      case 'audio':
        return 'fa-music';
      case 'document':
        return 'fa-file-alt';
      default:
        return 'fa-file';
    }
  };

  const isFileTooLarge = (size: number): boolean => {
    return size > maxFileSize;
  };

  if (attachments.length === 0) return null;

  return (
    <div
      className="attachment-preview-container"
      style={{
        padding: 'var(--space-3, 0.75rem)',
        borderTop: '1px solid #27272A',
        display: 'flex',
        gap: 'var(--space-2, 0.5rem)',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      {attachments.map((attachment) => (
        <motion.div
          key={attachment.id}
          className="attachment-preview-item"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            borderRadius: 'var(--ai-radius-md, 0.5rem)',
            overflow: 'hidden',
            border: `1px solid ${
              isFileTooLarge(attachment.size) ? '#EF4444' : '#3F3F46'
            }`,
            background: '#18181B',
            flexShrink: 0,
          }}
        >
          {/* Preview Content */}
          {attachment.type === 'image' && previews[attachment.id] ? (
            <img
              src={previews[attachment.id]}
              alt={attachment.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2, 0.5rem)',
                padding: 'var(--space-2, 0.5rem)',
              }}
            >
              <i
                className={`fa-solid ${getFileIcon(attachment.type)}`}
                style={{
                  fontSize: '2rem',
                  color: '#A1A1AA',
                }}
                aria-hidden="true"
              />
              <span
                style={{
                  fontSize: 'var(--text-xs, 0.75rem)',
                  color: '#71717A',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  padding: '0 var(--space-2, 0.5rem)',
                }}
              >
                {attachment.name}
              </span>
            </div>
          )}

          {/* File Info Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: 'var(--space-2, 0.5rem)',
              background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs, 0.75rem)',
                color: '#E4E4E7',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={attachment.name}
            >
              {attachment.name}
            </span>
            <span
              style={{
                fontSize: '10px',
                color: isFileTooLarge(attachment.size) ? '#EF4444' : '#A1A1AA',
              }}
            >
              {formatFileSize(attachment.size)}
              {isFileTooLarge(attachment.size) && ' (Too large)'}
            </span>
          </div>

          {/* Remove Button */}
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            aria-label={`Remove ${attachment.name}`}
            style={{
              position: 'absolute',
              top: 'var(--space-1, 0.25rem)',
              right: 'var(--space-1, 0.25rem)',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EF4444';
              e.currentTarget.style.borderColor = '#EF4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
          </button>
        </motion.div>
      ))}
    </div>
  );
};

export default AttachmentPreview;
