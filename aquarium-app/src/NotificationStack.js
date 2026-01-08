import React, { useEffect, useState } from 'react';
import './NotificationStack.css';

/**
 * Notification Stack
 * Display notifications like MacOS Notification Center
 * Props:
 *  - notifications: Array of { id, title, message, type }
 *  - onDismiss: (id) => void
 */
export function NotificationStack({ notifications, onDismiss }) {
    return (
        <div className="notification-stack">
            {notifications.map((note) => (
                <div key={note.id} className={`notification-card ${note.type || 'info'}`}>
                    <div className="notification-icon">
                        {note.type === 'success' ? '✨' : '👋'}
                    </div>
                    <div className="notification-content">
                        <div className="notification-title">{note.title}</div>
                        <div className="notification-message">{note.message}</div>
                    </div>
                    {/* Auto-dismiss logic is handled by parent or CSS animation usage, 
              but manual dismiss is nice too */}
                </div>
            ))}
        </div>
    );
}
