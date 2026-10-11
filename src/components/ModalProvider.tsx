'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

type ModalContextType = {
  showError: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, isDanger?: boolean) => void;
  showSuccess: (title: string, message: string) => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<{ 
    type: 'error' | 'confirm' | 'success', 
    title: string, 
    message: string, 
    onConfirm?: () => void,
    isDanger?: boolean 
  } | null>(null);

  const showError = (title: string, message: string) => setModal({ type: 'error', title, message });
  const showConfirm = (title: string, message: string, onConfirm: () => void, isDanger?: boolean) => setModal({ type: 'confirm', title, message, onConfirm, isDanger });
  const showSuccess = (title: string, message: string) => setModal({ type: 'success', title, message });

  const close = () => setModal(null);

  const isDanger = modal?.type === 'error' || (modal?.type === 'confirm' && modal.isDanger);
  const borderColor = isDanger ? '#f21818' : modal?.type === 'success' ? '#00ff88' : 'var(--accent-secondary)';
  const shadowColor = isDanger ? 'rgba(242,24,24,0.3)' : modal?.type === 'success' ? 'rgba(0,255,136,0.2)' : 'rgba(255,179,0,0.2)';
  const titleColor = isDanger ? '#f21818' : modal?.type === 'success' ? '#00ff88' : 'var(--accent-secondary)';

  return (
    <ModalContext.Provider value={{ showError, showConfirm, showSuccess }}>
      {children}
      
      {modal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div className="glass-panel animate-in" style={{ padding: '2rem', maxWidth: '420px', width: '90%', border: `1px solid ${borderColor}`, boxShadow: `0 0 25px ${shadowColor}` }}>
            <h3 className="text-mono" style={{ 
              color: titleColor, 
              marginBottom: '1rem', 
              fontSize: '1.25rem',
              textTransform: 'uppercase',
              fontWeight: 'bold',
              letterSpacing: '1px'
            }}>
              {modal.title}
            </h3>
            <p className="text-mono" style={{ color: '#fff', marginBottom: '2rem', lineHeight: 1.5, fontSize: '0.9rem' }}>
              {modal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              {modal.type === 'confirm' ? (
                <>
                  <button onClick={close} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1.5rem', cursor: 'pointer', fontFamily: 'monospace', borderRadius: '4px' }}>CANCEL</button>
                  <button onClick={() => { modal.onConfirm?.(); close(); }} style={{ background: modal.isDanger ? '#f21818' : 'var(--accent-secondary)', color: modal.isDanger ? '#fff' : '#000', border: 'none', padding: '0.5rem 1.5rem', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'monospace', borderRadius: '4px' }}>CONFIRM</button>
                </>
              ) : (
                <button onClick={close} style={{ background: modal.type === 'error' ? '#f21818' : '#00ff88', color: '#000', border: 'none', padding: '0.5rem 1.5rem', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'monospace', borderRadius: '4px' }}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within ModalProvider');
  return context;
};
