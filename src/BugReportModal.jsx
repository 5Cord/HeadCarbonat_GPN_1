import React, { useState } from 'react';
import './BugReportModal.css';

const LOCATIONS = [
  'Карта региона',
  'Научные исследования',
  'Зона событий',
  'Результат работы',
  'Полевые работы',
];

export default function BugReportModal({ onClose, sessionId, teamName }) {
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | success | error

  const handleSubmit = async () => {
    if (!location || description.trim().length < 5) return;
    setStatus('sending');
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const res = await fetch(`${API_BASE}/bug-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, description: description.trim(), sessionId, teamName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStatus('success');
      setTimeout(onClose, 1800);
    } catch (e) {
      console.error('bug report error:', e);
      setStatus('error');
    }
  };

  return (
    <div className="brm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="brm-card">
        <div className="brm-header">
          <span className="brm-title">Сообщить о баге</span>
          <button className="brm-close" onClick={onClose}>×</button>
        </div>

        {status === 'success' ? (
          <div className="brm-success">
            <div className="brm-success-icon">✓</div>
            <p>Баг-репорт отправлен!</p>
            <p className="brm-success-sub">Спасибо, мы разберёмся.</p>
          </div>
        ) : (
          <>
            <div className="brm-field">
              <label className="brm-label">Место бага</label>
              <select
                className="brm-select"
                value={location}
                onChange={e => setLocation(e.target.value)}
                disabled={status === 'sending'}
              >
                <option value="">— выберите раздел —</option>
                {LOCATIONS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="brm-field">
              <label className="brm-label">Описание бага</label>
              <textarea
                className="brm-textarea"
                placeholder="Опишите, что произошло и при каких условиях..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={status === 'sending'}
                rows={5}
                maxLength={2000}
              />
              <span className="brm-char-count">{description.length}/2000</span>
            </div>

            {status === 'error' && (
              <div className="brm-error">Ошибка отправки. Попробуйте ещё раз.</div>
            )}

            <div className="brm-footer">
              <button className="brm-cancel" onClick={onClose} disabled={status === 'sending'}>
                Отмена
              </button>
              <button
                className="brm-submit"
                onClick={handleSubmit}
                disabled={!location || description.trim().length < 5 || status === 'sending'}
              >
                {status === 'sending' ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
