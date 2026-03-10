import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useChatThreadQuery, useSendChatMessageMutation } from '../queries/chat.js';

const CHAT_EMOJIS = ['😀', '😂', '😍', '👏', '🔥', '🎉', '✅', '👍', '🙏', '💡', '📸', '🎥', '📦', '🚀', '❤️', '🙌'];
const CHAT_ATTACHMENT_ACCEPT =
  'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';
const MAX_CHAT_ATTACHMENTS = 10;

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const formatMessageRole = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'admin') return 'Admin';
  if (normalized === 'employee') return 'Team';
  if (normalized === 'brand') return 'Brand';
  return 'Member';
};

const formatFileSize = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const resolveMediaUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/objects/')) return raw;
  return raw;
};

const getAttachmentKind = (attachment) => {
  const contentType = String(attachment?.contentType || '').toLowerCase();
  const fileName = String(attachment?.fileName || '').toLowerCase();
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(fileName)) return 'image';
  if (/\.(mp4|mov|m4v|webm|ogv|ogg)$/i.test(fileName)) return 'video';
  if (/\.(mp3|wav|m4a|aac|flac|oga)$/i.test(fileName)) return 'audio';
  return 'file';
};

const getRouteCampaignId = (pathname) => {
  const match = String(pathname || '').match(/^\/app\/[^/]+\/campaigns\/([0-9a-fA-F-]+)\/?$/);
  return match?.[1] || null;
};

const requestUploadUrl = async (file) => {
  const signedUrlRes = await fetch('/api/uploads/request-url', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type,
    }),
  });
  const signedUrlData = await signedUrlRes.json();
  if (!signedUrlRes.ok || !signedUrlData.ok || !signedUrlData.uploadURL || !signedUrlData.objectPath) {
    throw new Error(signedUrlData?.error || 'Failed to generate upload URL');
  }
  return signedUrlData;
};

const uploadChatAttachment = async (file) => {
  const signedUrlData = await requestUploadUrl(file);
  const uploadRes = await fetch(signedUrlData.uploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!uploadRes.ok) {
    throw new Error(`Failed to upload ${file.name || 'attachment'}`);
  }
  return {
    objectPath: signedUrlData.objectPath,
    fileName: file.name || 'Attachment',
    contentType: file.type || 'application/octet-stream',
    fileSize: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
  };
};

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6.25 18.5 3.5 20l.72-3.1A7.77 7.77 0 0 1 2 11.5C2 7.36 5.81 4 10.5 4S19 7.36 19 11.5 15.19 19 10.5 19c-1.46 0-2.83-.32-4.02-.89Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 19.1c.78.25 1.62.4 2.5.4 1.54 0 2.98-.42 4.18-1.14L23 19.3l-.55-2.16c.67-.88 1.05-1.94 1.05-3.14 0-2.98-2.46-5.4-5.5-5.4-.42 0-.82.05-1.22.13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M8.5 12.5 15.74 5.3a3.5 3.5 0 1 1 4.95 4.95l-9.2 9.2a5.25 5.25 0 0 1-7.42-7.42l8.85-8.85a2.75 2.75 0 1 1 3.9 3.89l-8.14 8.14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 4.5v15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m6.5 10 5.5-5.5 5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ContextChatWidget() {
  const { role } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sendError, setSendError] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const inputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const threadBottomRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const routeCampaignId = useMemo(() => getRouteCampaignId(location.pathname), [location.pathname]);
  const routeOrganizationId = searchParams.get('organizationId') || null;
  const chatContext = useMemo(() => {
    if (routeCampaignId) {
      return { scope: 'campaign', campaignId: routeCampaignId };
    }
    if (role === 'brand') {
      return { scope: 'workspace', organizationId: routeOrganizationId || undefined };
    }
    if (routeOrganizationId) {
      return { scope: 'workspace', organizationId: routeOrganizationId };
    }
    return null;
  }, [role, routeCampaignId, routeOrganizationId]);

  const threadQuery = useChatThreadQuery(chatContext || {}, {
    enabled: open && Boolean(chatContext),
    refetchInterval: open && chatContext ? 15000 : false,
  });
  const sendMessageMutation = useSendChatMessageMutation();
  const thread = threadQuery.data?.data?.thread || null;
  const messages = Array.isArray(threadQuery.data?.data?.messages) ? threadQuery.data.data.messages : [];
  const hasUploadingAttachments = attachments.some((attachment) => attachment.status === 'uploading');
  const hasFailedAttachments = attachments.some((attachment) => attachment.status === 'error');
  const toggleLabel = routeCampaignId ? 'Campaign chat' : 'Workspace chat';

  useEffect(() => {
    const shouldOpen = searchParams.get('chat') === 'open';
    if (!shouldOpen) return;
    setOpen(true);
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('chat');
    navigate(
      {
        pathname: location.pathname,
        search: nextParams.toString() ? `?${nextParams.toString()}` : '',
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate, searchParams]);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
    setDraft('');
    setAttachments([]);
    setSendError('');
    setEmojiPickerOpen(false);
  }, [chatContext?.campaignId, chatContext?.organizationId, chatContext?.scope]);

  useEffect(() => {
    if (!open || !shouldStickToBottomRef.current) return;
    threadBottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, open]);

  const insertEmoji = (emoji) => {
    const value = String(emoji || '');
    if (!value) return;
    const input = inputRef.current;
    if (!input) {
      setDraft((prev) => `${prev}${value}`);
      setSendError('');
      setEmojiPickerOpen(false);
      return;
    }
    const start = input.selectionStart ?? draft.length;
    const end = input.selectionEnd ?? draft.length;
    const nextValue = `${draft.slice(0, start)}${value}${draft.slice(end)}`;
    const nextCaret = start + value.length;
    setDraft(nextValue);
    setSendError('');
    setEmojiPickerOpen(false);
    window.requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const removeAttachment = (attachmentId) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    if (sendError) {
      setSendError('');
    }
  };

  const handleAttachmentSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = MAX_CHAT_ATTACHMENTS - attachments.length;
    if (files.length > remainingSlots) {
      setSendError(`You can attach up to ${MAX_CHAT_ATTACHMENTS} files per message.`);
      return;
    }

    setSendError('');
    const queuedAttachments = files.map((file) => ({
      id: makeId('chat-attachment'),
      fileName: file.name || 'Attachment',
      contentType: file.type || 'application/octet-stream',
      fileSize: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
      objectPath: '',
      status: 'uploading',
      error: '',
    }));

    setAttachments((prev) => [...prev, ...queuedAttachments]);

    queuedAttachments.forEach(async (attachment, index) => {
      try {
        const uploaded = await uploadChatAttachment(files[index]);
        setAttachments((prev) =>
          prev.map((item) =>
            item.id === attachment.id
              ? {
                  ...item,
                  ...uploaded,
                  status: 'ready',
                  error: '',
                }
              : item
          )
        );
      } catch (error) {
        setAttachments((prev) =>
          prev.map((item) =>
            item.id === attachment.id
              ? {
                  ...item,
                  status: 'error',
                  error: error?.message || 'Failed to upload attachment.',
                }
              : item
          )
        );
      }
    });
  };

  const submitMessage = async () => {
    if (!chatContext) return;
    const body = String(draft || '').trim();
    const readyAttachments = attachments.filter((attachment) => attachment.status === 'ready');

    if (hasUploadingAttachments) {
      setSendError('Wait for attachments to finish uploading before sending.');
      return;
    }
    if (hasFailedAttachments) {
      setSendError('Remove failed attachments before sending.');
      return;
    }
    if (!body && readyAttachments.length === 0) {
      setSendError('Message or attachment is required.');
      return;
    }

    setSendError('');
    try {
      await sendMessageMutation.mutateAsync({
        campaignId: chatContext.campaignId,
        organizationId: chatContext.organizationId,
        payload: {
          body,
          attachments: readyAttachments.map((attachment) => ({
            objectPath: attachment.objectPath,
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            fileSize: attachment.fileSize,
          })),
        },
      });
      setDraft('');
      setAttachments([]);
      setEmojiPickerOpen(false);
      shouldStickToBottomRef.current = true;
      await threadQuery.refetch();
    } catch (error) {
      setSendError(error?.message || 'Failed to send message.');
    }
  };

  const renderEmptyState = () => {
    if (role !== 'brand' && !routeCampaignId && !routeOrganizationId) {
      return (
        <div className="context-chat-empty">
          <p>Open a campaign or workspace chat.</p>
        </div>
      );
    }

    if (threadQuery.isLoading) {
      return <p className="creator-social-empty">Loading messages...</p>;
    }

    if (threadQuery.error) {
      return <p className="error-text">{threadQuery.error.message || 'Failed to load chat.'}</p>;
    }

    return (
      <div className="context-chat-empty">
        <p>No messages yet.</p>
      </div>
    );
  };

  return (
    <div className={`context-chat-widget ${open ? 'is-open' : ''}`}>
      {open ? (
        <section className="context-chat-panel" aria-label={toggleLabel}>
          <header className="context-chat-header">
            <strong className="context-chat-title">{thread?.title || toggleLabel}</strong>
            <button
              type="button"
              className="context-chat-close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <div className="context-chat-body">
            <div
              className="campaign-messages-thread context-chat-thread"
              onScroll={(event) => {
                const element = event.currentTarget;
                const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
                shouldStickToBottomRef.current = distanceFromBottom < 72;
              }}
            >
              {messages.length === 0 ? (
                renderEmptyState()
              ) : (
                <ul className="campaign-message-list">
                  {messages.map((message) => {
                    const isOwnMessage = user?.id && user.id === message.senderUserId;
                    const messageAttachments = Array.isArray(message.attachments) ? message.attachments : [];
                    return (
                      <li
                        key={message.id}
                        className={['campaign-message-item', isOwnMessage ? 'is-own' : '']
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {!isOwnMessage ? (
                          <div className="campaign-message-sender">
                            <strong>{message.senderName || 'Workspace member'}</strong>
                            <span className="campaign-message-role">
                              {formatMessageRole(message.senderRole)}
                            </span>
                          </div>
                        ) : null}
                        <div className="campaign-message-bubble">
                          {messageAttachments.length > 0 ? (
                            <div className="campaign-message-attachments">
                              {messageAttachments.map((attachment, index) => {
                                const attachmentUrl = resolveMediaUrl(attachment.objectPath);
                                const attachmentKind = getAttachmentKind(attachment);
                                const attachmentLabel = attachment.fileName || `Attachment ${index + 1}`;
                                const attachmentMeta = formatFileSize(attachment.fileSize);

                                if (attachmentKind === 'image') {
                                  return (
                                    <a
                                      key={attachment.id || `${message.id}-attachment-${index}`}
                                      className="campaign-message-attachment campaign-message-attachment-image"
                                      href={attachmentUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <img src={attachmentUrl} alt={attachmentLabel} loading="lazy" />
                                      <span className="campaign-message-attachment-caption">
                                        <strong>{attachmentLabel}</strong>
                                        {attachmentMeta ? <span>{attachmentMeta}</span> : null}
                                      </span>
                                    </a>
                                  );
                                }

                                if (attachmentKind === 'video') {
                                  return (
                                    <div
                                      key={attachment.id || `${message.id}-attachment-${index}`}
                                      className="campaign-message-attachment campaign-message-attachment-video"
                                    >
                                      <video controls preload="metadata" src={attachmentUrl} />
                                      <a href={attachmentUrl} target="_blank" rel="noreferrer">
                                        <strong>{attachmentLabel}</strong>
                                        {attachmentMeta ? <span>{attachmentMeta}</span> : null}
                                      </a>
                                    </div>
                                  );
                                }

                                if (attachmentKind === 'audio') {
                                  return (
                                    <div
                                      key={attachment.id || `${message.id}-attachment-${index}`}
                                      className="campaign-message-attachment campaign-message-attachment-audio"
                                    >
                                      <audio controls preload="none" src={attachmentUrl} />
                                      <a href={attachmentUrl} target="_blank" rel="noreferrer">
                                        <strong>{attachmentLabel}</strong>
                                        {attachmentMeta ? <span>{attachmentMeta}</span> : null}
                                      </a>
                                    </div>
                                  );
                                }

                                return (
                                  <a
                                    key={attachment.id || `${message.id}-attachment-${index}`}
                                    className="campaign-message-attachment campaign-message-attachment-file"
                                    href={attachmentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <strong>{attachmentLabel}</strong>
                                    <span>{attachmentMeta || 'Open file'}</span>
                                  </a>
                                );
                              })}
                            </div>
                          ) : null}
                          {message.body ? <p className="campaign-message-bubble-copy">{message.body}</p> : null}
                          <div className="campaign-message-meta">
                            {isOwnMessage ? (
                              <span className="campaign-message-role">
                                {formatMessageRole(message.senderRole)}
                              </span>
                            ) : null}
                            <time>{formatDateTime(message.createdAt)}</time>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div ref={threadBottomRef} />
            </div>

            {chatContext ? (
              <form
                className="campaign-message-compose-card context-chat-compose"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitMessage();
                }}
              >
                <input
                  ref={attachmentInputRef}
                  type="file"
                  hidden
                  multiple
                  accept={CHAT_ATTACHMENT_ACCEPT}
                  onChange={handleAttachmentSelect}
                />
                <div className="context-chat-compose-tools">
                  <button
                    type="button"
                    className="context-chat-icon-button"
                    onClick={() => setEmojiPickerOpen((prev) => !prev)}
                    aria-label="Open emoji picker"
                    title="Emoji"
                  >
                    <span aria-hidden="true">🙂</span>
                  </button>
                  <button
                    type="button"
                    className="context-chat-icon-button"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={
                      sendMessageMutation.isPending || attachments.length >= MAX_CHAT_ATTACHMENTS
                    }
                    aria-label="Attach files"
                    title="Attach files"
                  >
                    <AttachIcon />
                  </button>
                </div>

                {emojiPickerOpen ? (
                  <div className="campaign-message-emoji-picker">
                    {CHAT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="campaign-message-emoji-button"
                        onClick={() => insertEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}

                {attachments.length > 0 ? (
                  <ul className="campaign-message-draft-attachments">
                    {attachments.map((attachment) => {
                      const attachmentKind = getAttachmentKind(attachment);
                      const attachmentUrl = attachment.objectPath ? resolveMediaUrl(attachment.objectPath) : '';
                      const statusLabel =
                        attachment.status === 'uploading'
                          ? 'Uploading...'
                          : attachment.status === 'error'
                            ? attachment.error || 'Upload failed'
                            : formatFileSize(attachment.fileSize) || 'Ready';

                      return (
                        <li
                          key={attachment.id}
                          className={[
                            'campaign-message-draft-attachment',
                            attachment.status === 'error' ? 'is-error' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div className="campaign-message-draft-attachment-main">
                            {attachmentKind === 'image' && attachmentUrl ? (
                              <img
                                className="campaign-message-draft-attachment-thumb"
                                src={attachmentUrl}
                                alt={attachment.fileName || 'Attachment'}
                              />
                            ) : (
                              <div className="campaign-message-draft-attachment-badge">
                                {attachmentKind === 'video'
                                  ? 'Video'
                                  : attachmentKind === 'audio'
                                    ? 'Audio'
                                    : 'File'}
                              </div>
                            )}
                            <div className="campaign-message-draft-attachment-copy">
                              <strong>{attachment.fileName || 'Attachment'}</strong>
                              <span>{statusLabel}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="campaign-message-draft-attachment-remove"
                            onClick={() => removeAttachment(attachment.id)}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                <div className="campaign-message-compose-row">
                  <textarea
                    ref={inputRef}
                    className="input"
                    rows={2}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (sendError) {
                        setSendError('');
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        submitMessage();
                      }
                    }}
                    placeholder="Message"
                  />
                  <button
                    type="submit"
                    className="context-chat-send-button"
                    disabled={sendMessageMutation.isPending || hasUploadingAttachments}
                    aria-label={sendMessageMutation.isPending ? 'Sending message' : 'Send message'}
                  >
                    <SendIcon />
                  </button>
                </div>

                {sendError ? <p className="field-error">{sendError}</p> : null}
              </form>
            ) : null}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="context-chat-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? 'Close chat' : 'Open chat'}
        title={toggleLabel}
      >
        <span className="context-chat-toggle-icon">
          <ChatIcon />
        </span>
      </button>
    </div>
  );
}
