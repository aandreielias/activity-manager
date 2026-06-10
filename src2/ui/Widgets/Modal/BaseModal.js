

export class BaseModal {
    constructor(title = "Fenster") {
        this.title = title;
        this.modalElement = null;
        this.bodyElement = null;

        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    handleKeyDown(e) {
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal-overlay');
            const topModal = openModals[openModals.length - 1];

            if (topModal === this.modalElement) this.close();
        }
    }

    open() {
        this.buildModal();
        document.body.appendChild(this.modalElement);

        document.addEventListener('keydown', this.handleKeyDown);

        requestAnimationFrame(() => {
            this.modalElement.classList.add('is-open');
        });
    }

    close() {
        if (!this.modalElement) return;

        this.modalElement.classList.remove('is-open');

        document.removeEventListener('keydown', this.handleKeyDown);

        setTimeout(() => {
            this.modalElement.remove();
            this.modalElement = null;
        }, 200);
    }

    buildModal() {
        this.modalElement = document.createElement('div');
        this.modalElement.className = 'modal-overlay';

        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) this.close();
        });

        const windowEl = document.createElement('div');
        windowEl.className = 'modal-window';

        const header = document.createElement('div');

        header.className = 'modal-header';
        header.innerHTML = `
            <h3>${this.title}</h3>
            <button class="modal-close-btn">×</button>
        `;

        header.querySelector('.modal-close-btn').addEventListener('click', () => this.close());

        this.bodyElement = document.createElement('div');
        this.bodyElement.className = 'modal-body';

        this.renderBody(this.bodyElement);

        windowEl.appendChild(header);
        windowEl.appendChild(this.bodyElement);

        this.modalElement.appendChild(windowEl);
    }

    renderBody(container) {
        container.innerHTML = '<p>Kein Fensterinhalt festgelegt</p>';
    }
}