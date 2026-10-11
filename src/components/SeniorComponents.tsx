import React from 'react';

// ---------------------------------------------------------
// 1. Accessible Button (Large Touch Target)
// ---------------------------------------------------------
export const AccessibleButton = ({ 
  onClick, 
  children, 
  variant = 'primary', 
  icon = null,
  ariaLabel = undefined,
  style = {},
  className = '',
  disabled = false,
  ...props
}: any) => {
  const baseStyles: React.CSSProperties = {
    minHeight: '48px', // Minimum touch target size
    minWidth: '48px',
    padding: '12px 24px',
    fontSize: '18px', // High legibility
    fontWeight: '600',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    transition: 'background-color 0.2s ease',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  };

  const variants = {
    primary: { background: 'var(--accent-primary)', color: '#fff', border: '2px solid transparent' },
    secondary: { background: 'transparent', color: 'var(--text-main)', border: '2px solid var(--text-main)' },
    danger: { background: '#ff2a2a', color: '#fff', border: '2px solid transparent' }
  };

  return (
    <button 
      onClick={onClick} 
      className={className}
      style={{ ...baseStyles, ...(variants as any)[variant], ...style }}
      aria-label={ariaLabel}
      disabled={disabled}
      {...props}
    >
      {icon && <span aria-hidden="true" style={{ fontSize: '24px' }}>{icon}</span>}
      {children}
    </button>
  );
};

// ---------------------------------------------------------
// 2. Clear Input Field with Error Handling
// ---------------------------------------------------------
export const AccessibleInput = ({ 
  label, 
  id, 
  type = 'text', 
  error, 
  helperText, 
  ...props 
}: any) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', width: '100%' }}>
      <label htmlFor={id} style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        className="input-base"
        style={{
          minHeight: '48px',
          padding: '12px 16px',
          fontSize: '18px',
          borderRadius: '8px',
          border: error ? `3px solid #ff2a2a` : `2px solid rgba(255,255,255,0.2)`,
          background: 'rgba(0,0,0,0.5)',
          color: 'var(--text-main)',
          outline: 'none',
          width: '100%'
        }}
        {...props}
      />
      {error && (
        <span id={`${id}-error`} style={{ color: '#ff2a2a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span aria-hidden="true">⚠️</span> {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${id}-helper`} style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
          {helperText}
        </span>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// 3. Clear Select Dropdown with Error Handling
// ---------------------------------------------------------
export const AccessibleSelect = ({ 
  label, 
  id, 
  error, 
  helperText, 
  children,
  ...props 
}: any) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', width: '100%' }}>
      {label && (
        <label htmlFor={id} style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      <select
        id={id}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        className="input-base"
        style={{
          minHeight: '48px',
          padding: '12px 16px',
          fontSize: '18px',
          borderRadius: '8px',
          border: error ? `3px solid #ff2a2a` : `2px solid rgba(255,255,255,0.2)`,
          background: 'rgba(20,20,20,0.95)',
          color: 'var(--text-main)',
          outline: 'none',
          width: '100%',
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2300ff88%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 16px top 50%',
          backgroundSize: '12px auto'
        }}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span id={`${id}-error`} style={{ color: '#ff2a2a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span aria-hidden="true">⚠️</span> {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${id}-helper`} style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
          {helperText}
        </span>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// 3. Simple Information Card
// ---------------------------------------------------------
export const InfoCard = ({ title, children, action, style = {} }: any) => {
  return (
    <div className="glass-panel" style={{
      borderRadius: '12px',
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      ...style
    }}>
      <h2 style={{ margin: 0, fontSize: '24px', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</h2>
      <div style={{ color: 'var(--text-muted)', fontSize: '18px', lineHeight: '1.6' }}>
        {children}
      </div>
      {action && (
        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          {action}
        </div>
      )}
    </div>
  );
};
