import { BaseDialog } from './BaseDialog.js';
import { SupabaseClient } from '../services/SupabaseClient.js';

export class AuditLogsDialog extends BaseDialog {
    static async show() {
        return super.show({
            dialogClassName: 'audit-logs-dialog',
            closeOnEscape: true,
            closeOnOutsideClick: true,
            render: async (dialog, overlay, resolve, cleanup) => {
                dialog.style.width = '800px';
                dialog.style.maxWidth = '90vw';
                dialog.style.maxHeight = '90vh';
                dialog.style.display = 'flex';
                dialog.style.flexDirection = 'column';
                dialog.style.background = 'var(--bg)';
                dialog.style.borderRadius = 'var(--radius)';
                dialog.style.overflow = 'hidden';

                const header = document.createElement('div');
                header.className = 'user-info-header';
                header.innerHTML = `
                    <div class="user-info-title-area">
                        <h2>Audit Logs</h2>
                        <p>Letzte 100 System-Ereignisse</p>
                    </div>
                    <div class="user-info-header-actions">
                        <button class="close-info-btn" aria-label="Schließen">✕</button>
                    </div>
                `;
                dialog.appendChild(header);

                const content = document.createElement('div');
                content.style.flex = '1';
                content.style.overflowY = 'auto';
                content.style.padding = '24px';
                content.style.fontSize = '12px';
                content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">Lade Audit-Logs...</div>';
                dialog.appendChild(content);

                header.querySelector('.close-info-btn').onclick = () => resolve(null);

                try {
                    const res = await SupabaseClient.get('audit_logs', '?order=created_at.desc&limit=100');
                    if (res.ok) {
                        const logs = await res.json();
                        if (logs.length === 0) {
                            content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">Keine Audit-Logs gefunden.</div>';
                        } else {
                            const table = document.createElement('table');
                            table.style.width = '100%';
                            table.style.borderCollapse = 'collapse';
                            table.style.textAlign = 'left';
                            
                            table.innerHTML = `
                                <thead style="background:var(--bg-tertiary); position:sticky; top:0;">
                                    <tr>
                                        <th style="padding:8px; border-bottom:1px solid var(--border-light)">Zeitpunkt</th>
                                        <th style="padding:8px; border-bottom:1px solid var(--border-light)">User</th>
                                        <th style="padding:8px; border-bottom:1px solid var(--border-light)">Action</th>
                                        <th style="padding:8px; border-bottom:1px solid var(--border-light)">Tabelle</th>
                                        <th style="padding:8px; border-bottom:1px solid var(--border-light)">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${logs.map(log => `
                                        <tr style="border-bottom:1px solid var(--border-light)">
                                            <td style="padding:8px; white-space:nowrap">${new Date(log.created_at).toLocaleString('de-DE')}</td>
                                            <td style="padding:8px;"><strong>${log.user_name || 'System'}</strong></td>
                                            <td style="padding:8px;">${log.action}</td>
                                            <td style="padding:8px;">${log.table_name}</td>
                                            <td style="padding:8px; color:var(--text-muted); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title='${JSON.stringify(log.details)}'>${log.details ? JSON.stringify(log.details) : ''}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            `;
                            content.innerHTML = '';
                            content.appendChild(table);
                        }
                    } else {
                        content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--error)">Fehler beim Laden (Ist die Tabelle audit_logs angelegt?)</div>';
                    }
                } catch (e) {
                     content.innerHTML = `<div style="padding:40px;text-align:center;color:var(--error)">Fehler: ${e.message}</div>`;
                }
            }
        });
    }
}
