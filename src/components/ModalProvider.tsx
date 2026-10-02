'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

type ModalContextType = {
  showError: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showSuccess: (title: string, message: string) => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<{ type: 'error' | 'confirm' | 'success', title: string, message: string, onConfirm?: () => void } | null>(null);

  const showError = (title: string, message: string) => setModal({ type: 'error', title, message });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setModal({ type: 'confirm', title, message, onConfirm });
  const showSuccess = (title: string, message: string) => setModal({ type: 'success', title, message });

  const close = () => setModal(null);

  return (
    <ModalContext.Provider value={{ showError, showConfirm, showSuccess }}>
      {children}
      
      {modal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-in" style={{ padding: '2rem', maxWidth: '400px', width: '90%', border: `1px solid ${modal.type === 'error' ? '#f21818' : modal.type === 'success' ? '#00ff88' : 'var(--accent-secondary)'}`, boxShadow: `0 0 20px ${modal.type === 'error' ? 'rgba(242,24,24,0.2)' : modal.type === 'success' ? 'rgba(0,255,136,0.2)' : 'rgba(255,179,0,0.2)'}` }}>
            <h3 className="text-mono" style={{ 
              color: modal.type === 'error' ? '#f21818' : modal.type === 'success' ? '#00ff88' : 'var(--accent-secondary)', 
              marginBottom: '1rem', 
              fontSize: '1.25rem',
              textTransform: 'uppercase'
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
                  <button onClick={() => { modal.onConfirm?.(); close(); }} style={{ background: 'var(--accent-secondary)', color: '#000', border: 'none', padding: '0.5rem 1.5rem', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'monospace', borderRadius: '4px' }}>CONFIRM</button>
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
