import { useState } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ShareModalProps {
  postId: string;
  postTitle: string;
  postType: string;
  onClose: () => void;
}

export function ShareModal({ postId, postTitle, postType, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const postUrl = `${window.location.origin}/post/${postId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = postUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: postTitle,
          text: `Check out this ${postType} on TechIT Hangout`,
          url: postUrl,
        });
      } catch {}
    }
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(`${postTitle} — via TechIT Hangout`);
    const url = encodeURIComponent(postUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const shareToLinkedIn = () => {
    const url = encodeURIComponent(postUrl);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`${postTitle}\n${postUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareToFacebook = () => {
    const url = encodeURIComponent(postUrl);
    const quote = encodeURIComponent(postTitle);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank');
  };

  const shareToTelegram = () => {
    const url = encodeURIComponent(postUrl);
    const text = encodeURIComponent(`${postTitle} — via TechIT Hangout`);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  };

  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="bg-bg-surface border border-border-default rounded-2xl w-full max-w-md animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-default">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-accent-primary" />
            <h3 className="text-sm font-semibold text-text-primary">Share Post</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Post preview */}
          <div className="bg-bg-elevated rounded-xl p-3 mb-5 border border-border-default">
            <div
              className="text-[10px] font-medium uppercase tracking-wider mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {postType}
            </div>
            <p className="text-sm text-text-primary leading-snug line-clamp-2">{postTitle}</p>
          </div>

          {/* Copy link row */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex-1 bg-bg-elevated border border-border-default rounded-lg px-3 py-2.5 text-[11px] text-text-muted font-mono truncate">
              {postUrl}
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 border"
              style={{
                backgroundColor: copied ? 'rgba(34,197,94,0.12)' : 'rgba(79,110,247,0.12)',
                color: copied ? 'var(--score-green)' : 'var(--accent-primary)',
                borderColor: copied ? 'var(--score-green)' : 'var(--accent-primary)',
              }}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Share to */}
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-3">
            Share to
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* Twitter / X */}
            <button
              onClick={shareToTwitter}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-bg-elevated hover:bg-bg-overlay border border-border-default transition-all group"
            >
              <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">X (Twitter)</span>
            </button>

            {/* LinkedIn */}
            <button
              onClick={shareToLinkedIn}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-bg-elevated hover:bg-bg-overlay border border-border-default transition-all group"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ backgroundColor: '#0A66C2' }}
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </div>
              <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">LinkedIn</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={shareToWhatsApp}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-bg-elevated hover:bg-bg-overlay border border-border-default transition-all group"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ backgroundColor: '#25D366' }}
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">WhatsApp</span>
            </button>

            {/* Facebook */}
            <button
              onClick={shareToFacebook}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-bg-elevated hover:bg-bg-overlay border border-border-default transition-all group"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ backgroundColor: '#1877F2' }}
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">Facebook</span>
            </button>

            {/* Telegram */}
            <button
              onClick={shareToTelegram}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-bg-elevated hover:bg-bg-overlay border border-border-default transition-all group"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ backgroundColor: '#229ED9' }}
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
              <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">Telegram</span>
            </button>
          </div>

          {/* Native share fallback */}
          {hasNativeShare && (
            <button
              onClick={handleNativeShare}
              className="w-full py-2.5 rounded-xl border border-border-default text-xs text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-all"
            >
              More sharing options…
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
