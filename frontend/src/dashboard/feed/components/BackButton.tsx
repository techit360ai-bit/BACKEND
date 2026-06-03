import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Returns to the previous page in history. Falls back to /feed when there is
 * no in-app history to go back to (e.g. the page was opened via direct link).
 */
export function BackButton({
  label = 'Back',
  fallback = '/feed',
  className = '',
}: {
  label?: string;
  fallback?: string;
  className?: string;
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
