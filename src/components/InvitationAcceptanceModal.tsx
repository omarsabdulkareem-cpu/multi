import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertTriangle, X, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';

interface InvitationAcceptanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InvitationAcceptanceModal: React.FC<InvitationAcceptanceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isRTL } = useLanguage();
  const { acceptInvitation } = useTenant();
  const { currentUser } = useFactory();

  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await acceptInvitation(token.trim(), {
        id: currentUser?.id || 'usr_invited_user',
        name: currentUser?.name || 'Invited User',
        email: currentUser?.email || 'user@company.com',
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invitation token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 text-white shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <Mail className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'قبول دعوة الانضمام لمنشأة' : 'Accept Organization Invitation'}</span>
          </h4>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="font-bold text-white text-base">
              {isRTL ? 'تم قبول الدعوة بنجاح!' : 'Invitation Accepted!'}
            </h4>
            <p className="text-xs text-slate-400">
              {isRTL ? 'أنت الآن عضو نشط في المنشأة' : 'You are now an active organization member.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleAccept} className="space-y-4 text-xs">
            <p className="text-slate-300">
              {isRTL
                ? 'أدخل رمز الدعوة (Token) الذي استلمته من مسؤول المستودع للانضمام للشركة:'
                : 'Enter the invitation token received from your warehouse administrator to join the company:'}
            </p>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'رمز الدعوة (Invitation Token)' : 'Invitation Token'}</label>
              <input
                type="text"
                required
                placeholder="inv_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !token.trim()}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isSubmitting ? (isRTL ? 'جاري التحقق...' : 'Verifying...') : (isRTL ? 'تأكيد وقبول' : 'Accept')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
