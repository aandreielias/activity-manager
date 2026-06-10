export class TableNavigator {

    static navigateFrom(currentTd, key, shiftKey) {
        const tr = currentTd.parentElement;
        const tbody = tr.parentElement;
        const table = tbody.parentElement;
        const tableContainer = table.closest('.table-container');

        const allTds = Array.from(tr.children);
        const colIndex = allTds.indexOf(currentTd);

        const allTrs = Array.from(tbody.children);
        const rowIndex = allTrs.indexOf(tr);

        let targetTd = null;

        if (key === 'Tab') {
            if (shiftKey) {
                if (colIndex > 0) targetTd = allTds[colIndex - 1];
                else if (rowIndex > 0) {
                    const prevTds = Array.from(allTrs[rowIndex - 1].children);
                    targetTd = prevTds[prevTds.length - 1];
                }
            } else {
                if (colIndex < allTds.length - 1) targetTd = allTds[colIndex + 1];
                else if (rowIndex < allTrs.length - 1) targetTd = allTrs[rowIndex + 1].children[0];
            }
        }
        else if (key === 'ArrowRight') {
            if (colIndex < allTds.length - 1) targetTd = allTds[colIndex + 1];
        }
        else if (key === 'ArrowLeft') {
            if (colIndex > 0) targetTd = allTds[colIndex - 1];
        }
        else if (key === 'ArrowDown') {
            if (rowIndex < allTrs.length - 1) targetTd = allTrs[rowIndex + 1].children[colIndex];
        }
        else if (key === 'ArrowUp') {
            if (rowIndex > 0) targetTd = allTrs[rowIndex - 1].children[colIndex];
        }
        else if (key === 'PageDown') {

            let nextContainer = tableContainer.nextElementSibling;

            while (nextContainer && !nextContainer.classList.contains('table-container')) {
                nextContainer = nextContainer.nextElementSibling;
            }
            if (nextContainer) {
                targetTd = nextContainer.querySelector('tbody tr td.table-field');
            }
        }
        else if (key === 'PageUp') {

            let prevContainer = tableContainer.previousElementSibling;

            while (prevContainer && !prevContainer.classList.contains('table-container')) {
                prevContainer = prevContainer.previousElementSibling;
            }
            if (prevContainer) {
                targetTd = prevContainer.querySelector('tbody tr td.table-field');
            }
        }
        if (targetTd && targetTd.classList.contains('table-field')) {
            targetTd.click();
        }
    }
}
