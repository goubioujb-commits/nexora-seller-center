'use client';

import { ReactNode, useEffect, useState } from 'react';
import { STATUS, TX_LABELS, txStep } from '@/lib/util';

export function Pill({ status }: { status: string }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span className="pill" style={{ ['--c' as any]: `var(${s[1]})` }}>
      {s[0]}
    </span>
  );
}

export function Head({ title, text, actions }: { title: ReactNode; text?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="head">
      <div>
        <h1>{title}</h1>
        {text ? <p>{text}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{text}</p>
      {children ? <div className="actions">{children}</div> : null}
    </div>
  );
}

export function TxSteps({ tx }: { tx: any }) {
  const cur = txStep(tx.status);
  const cancelled = tx.status === 'cancelled';
  return (
    <ol className="steps">
      {TX_LABELS.map((label, i) => {
        let c = '';
        if (tx.status === 'completed') c = 'fin';
        else if (!cancelled && i < cur) c = 'done';
        else if (!cancelled && i === cur) c = 'now';
        return (
          <li key={label} className={c}>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function useToast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  return { msg, show: setMsg, node: msg ? <div className="toast" role="status">{msg}</div> : null };
}
