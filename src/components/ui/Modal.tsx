import {
  forwardRef,
  useEffect,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ className, open, onClose, title, children, footer, size = 'md', ...props }, ref) => {
    useEffect(() => {
      if (!open) return;
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [open, onClose]);

    useEffect(() => {
      if (!open) return;
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }, [open]);

    if (!open) return null;

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    };

    return (
      <div
        ref={ref}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
        role="presentation"
        onClick={handleBackdropClick}
        {...props}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          className={cn(
            'relative my-8 w-full rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900',
            sizeClasses[size],
            className,
          )}
        >
          {title && (
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h2>
            </div>
          )}
          <div className="px-6 py-4">{children}</div>
          {footer && (
            <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  },
);

Modal.displayName = 'Modal';
