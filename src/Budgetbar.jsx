// BudgetBar.jsx — единый компонент отображения бюджета
// Используй везде: ResearchPanel, ResultsOverlay, любые модалки
//
// Props:
//   budget  — текущий остаток (число)
//   spent   — потрачено за сессию / всего (число)
//   theme   — 'dark' (по умолчанию, для тёмного фона) | 'light' (для белого фона / модалок)

import React from 'react';

export default function BudgetBar({ budget = 0, spent = 0, theme = 'dark' }) {
    const isLow = budget < 1000;

    const dark = theme === 'dark';

    const wrap = {
        display: 'inline-flex',
        borderRadius: 10,
        overflow: 'hidden',
        border: isLow
            ? '1.5px solid rgba(239,68,68,0.45)'
            : dark
                ? '1.5px solid rgba(255,255,255,0.08)'
                : '1.5px solid #e5e7eb',
        boxShadow: isLow
            ? '0 2px 8px rgba(239,68,68,0.15)'
            : '0 2px 8px rgba(0,0,0,0.1)',
        background: dark ? '#1a2e42' : '#f8f9fa',
    };

    const divider = {
        borderRight: dark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid #e5e7eb',
    };

    const cell = {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 18px',
        background: dark ? '#1a2e42' : '#f8f9fa',
    };

    const label = {
        fontSize: '0.72rem',
        color: dark ? '#7aadcc' : '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 700,
    };

    const budgetColor = isLow ? '#ef4444' : dark ? '#4ade80' : '#16a34a';
    const spentColor = dark ? '#f97316' : '#ea580c';

    const val = {
        fontSize: '1.05rem',
        fontWeight: 800,
    };

    const fmt = (n) =>
        Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

    return (
        <div style={wrap}>
            <div style={{ ...cell, ...divider }}>
                <span style={label}>Бюджет</span>
                <span style={{ ...val, color: budgetColor }}>{fmt(budget)} млн</span>
            </div>
            <div style={cell}>
                <span style={label}>Потрачено</span>
                <span style={{ ...val, color: spentColor }}>{fmt(spent)} млн</span>
            </div>
        </div>
    );
}