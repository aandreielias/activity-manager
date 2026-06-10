import { eventBus } from "../../../events/EventBus";
import { SearchBar } from "../SearchBar.js";
import styles from './Header.module.css';

export class Header {
    constructor(container, teams = [], onSelection = null, dataTables = []) {
        this.container = container;
        this.teams = teams;
        this.onSelection = onSelection;
        this.dataTables = dataTables;
        this.element = null;
    }

    render() {
        this.element = document.createElement('header');
        this.element.className = styles['app-header'];

        this.element.innerHTML = `
            <!-- Mobile Left Toggle (Explorer) -->
            <button class="${styles['mobile-toggle-left']}" style="display: none;">☰</button>

            <div class="${styles['header-section-1']}">

            </div>

            <nav class="${styles['header-section-2']}"></nav>

            <div class="${styles['header-section-3']}"></div>

            <div class="${styles['header-section-4']}"></div>

            <div class="${styles['header-section-5']}"></div>

            <button class="${styles['mobile-toggle-right']}" style="display: none;">⋮</button>
        `;

        const searchSection = this.element.querySelector('.' + styles['header-section-3']);
        if (searchSection) {
            const searchBar = new SearchBar(() => this.dataTables);
            searchSection.appendChild(searchBar.build());
        }

        if (this.container) {
            this.container.appendChild(this.element);
        }

        return this.element;
    }
}