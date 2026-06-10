import { Connector } from "../../../core/Database/Connector";
import { eventBus } from "../../../events/EventBus";
import { TableModal } from "../../Widgets/Modal/TableModal.js";
import { METATABLES } from "../../../core/Constants.js";

export class TableManager {

    static attachTo(th, tr, table, field) {
        this.makeResizable(th, tr);

        this.makeDraggable(th, tr, table, field);

        th.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            eventBus.emit('UI', 'SHOW_CONTEXT_MENU', {

                x: e.clientX,
                y: e.clientY,

                title: `Spalte: ${field.titel || field.name}`,
                items: [
                    {
                        label: 'Spalte bearbeiten',
                        action: () => {
                            const felderTable = table.dataLoader?.getTable(METATABLES.FIELDS);

                            if (!felderTable) return;
                            const modal = new TableModal(felderTable, {
                                filters: [{ field: 'f_t_id', operator: 'equals', value: table.id }],
                                groupBy: ''
                            });

                            modal.open();
                            setTimeout(() => {
                                eventBus.emit('UI', 'NAVIGATE_TO_ROW', {
                                    rowId: field.id
                                });
                            }, 100);
                        }
                    },
                    {
                        label: 'Tabelle bearbeiten',
                        action: () => {
                            const tabellenTable = table.dataLoader?.getTable(METATABLES.TABLES);
                            if (!tabellenTable) return;

                            const modal = new TableModal(tabellenTable, {
                                filters: [{ field: 't_id', operator: 'equals', value: table.id }],
                                groupBy: ''
                            });

                            modal.open();

                            setTimeout(() => {
                                eventBus.emit('UI', 'NAVIGATE_TO_ROW', {
                                    rowId: table.id
                                });
                            }, 100);
                        }
                    }
                ]
            });
        });
    }

    static makeResizable(th, tr) {
        const resizer = document.createElement('div');
        resizer.classList.add('resizer');

        th.appendChild(resizer);

        let startX, startWidth, nextTh, nextStartWidth;

        const onMouseMove = (e) => {

            let delta = e.pageX - startX;
            if (startWidth + delta < 30) delta = 30 - startWidth;
            if (nextTh && nextStartWidth - delta < 30) delta = nextStartWidth - 30;

            const newWidthA = startWidth + delta;

            th.style.width = `${newWidthA}px`;
            th.style.minWidth = `${newWidthA}px`;
            th.style.maxWidth = `${newWidthA}px`;

            const indexA = Array.from(tr.children).indexOf(th);
            const tableEl = th.closest('table');

            if (tableEl) {
                tableEl.querySelectorAll(`tbody tr td:nth-child(${indexA + 1})`).forEach(td => {
                    td.style.width = `${newWidthA}px`;
                    td.style.minWidth = `${newWidthA}px`;
                    td.style.maxWidth = `${newWidthA}px`;
                });

                if (nextTh) {
                    const newWidthB = nextStartWidth - delta;
                    nextTh.style.width = `${newWidthB}px`;
                    nextTh.style.minWidth = `${newWidthB}px`;
                    nextTh.style.maxWidth = `${newWidthB}px`;

                    const indexB = indexA + 1;
                    tableEl.querySelectorAll(`tbody tr td:nth-child(${indexB + 1})`).forEach(td => {
                        td.style.width = `${newWidthB}px`;
                        td.style.minWidth = `${newWidthB}px`;
                        td.style.maxWidth = `${newWidthB}px`;
                    });
                }
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            resizer.classList.remove('resizing');
            document.body.style.cursor = 'default';
        };

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            startX = e.pageX;
            startWidth = th.offsetWidth;

            nextTh = th.nextElementSibling;
            if (nextTh) nextStartWidth = nextTh.offsetWidth;

            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        resizer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            th.style.width = '';
            th.style.minWidth = '';
            th.style.maxWidth = '';

            const indexA = Array.from(tr.children).indexOf(th);
            const tableEl = th.closest('table');

            if (tableEl) {
                tableEl.querySelectorAll(`tbody tr td:nth-child(${indexA + 1})`).forEach(td => {
                    td.style.width = '';
                    td.style.minWidth = '';
                    td.style.maxWidth = 'unset';
                });

                const nextThSibling = th.nextElementSibling;

                if (nextThSibling) {

                    nextThSibling.style.width = '';
                    nextThSibling.style.minWidth = '';
                    nextThSibling.style.maxWidth = '';

                    const indexB = indexA + 1;
                    tableEl.querySelectorAll(`tbody tr td:nth-child(${indexB + 1})`).forEach(td => {

                        td.style.width = '';
                        td.style.minWidth = '';
                        td.style.maxWidth = 'unset';
                    });
                }
            }
        });
    }

    static makeDraggable(th, tr, table, field) {
        th.draggable = true;

        th.addEventListener('dragstart', (e) => {

            const index = Array.from(tr.children).indexOf(th);
            e.dataTransfer.setData('text/plain', index);
            th.style.opacity = '0.4';
        });

        th.addEventListener('dragend', () => {

            th.style.opacity = '1';
            tr.querySelectorAll('th').forEach(cell => {

                cell.style.borderLeft = '';
                cell.style.borderRight = '';
            });
        });

        th.addEventListener('dragover', (e) => {
            e.preventDefault();
            const bounding = th.getBoundingClientRect();
            const offset = bounding.x + (bounding.width / 2);

            if (e.clientX - offset > 0) {
                th.style.borderRight = '2px solid var(--accent)';
                th.style.borderLeft = '';
            } else {
                th.style.borderLeft = '2px solid var(--accent)';
                th.style.borderRight = '';
            }
        });

        th.addEventListener('dragleave', () => {
            th.style.borderLeft = '';
            th.style.borderRight = '';
        });

        th.addEventListener('drop', (e) => {
            e.preventDefault();
            th.style.borderLeft = '';
            th.style.borderRight = '';

            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const targetIndex = Array.from(tr.children).indexOf(th);

            if (draggedIndex === targetIndex || isNaN(draggedIndex)) return;

            const tableEl = th.closest('table');
            if (!tableEl) return;

            const allThs = Array.from(tr.children);
            const draggedTh = allThs[draggedIndex];

            const bounding = th.getBoundingClientRect();
            const insertAfter = (e.clientX - (bounding.x + (bounding.width / 2))) > 0;

            if (insertAfter) {
                th.after(draggedTh);
            } else {
                th.before(draggedTh);
            }

            const newTargetIndex = Array.from(tr.children).indexOf(draggedTh);

            const tbody = tableEl.querySelector('tbody');
            if (tbody) {
                tbody.querySelectorAll('tr').forEach(row => {
                    const allTds = Array.from(row.children);
                    const draggedTd = allTds[draggedIndex];
                    const referenceTd = allTds[targetIndex];

                    if (draggedTd && referenceTd) {
                        if (insertAfter) {
                            referenceTd.after(draggedTd);
                        } else {
                            referenceTd.before(draggedTd);
                        }
                    }
                });
            }

            const hasCheckbox = tr.querySelector('.select-all-checkbox') !== null;
            const offset = hasCheckbox ? 1 : 0;

            const fieldDragIndex = draggedIndex - offset;
            const fieldTargetIndex = newTargetIndex - offset;

            if (fieldDragIndex >= 0 && fieldTargetIndex >= 0) {

                const [movedField] = table.fields.splice(fieldDragIndex, 1);
                table.fields.splice(fieldTargetIndex, 0, movedField);

                table.fields.forEach(async (f, idx) => {
                    f.weight = (idx + 1) * 10;

                    await Connector.patch('f_felder', `f_id=eq.${f.id}`, { f_weight: f.weight });
                });
            }
        });
    }
}
