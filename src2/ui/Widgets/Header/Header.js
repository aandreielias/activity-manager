import { eventBus } from "../../../events/EventBus";
import { SearchBar } from "../SearchBar.js";


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
        this.element.className = 'app-header';

        this.element.innerHTML = `
            <!-- Mobile Left Toggle (Explorer) -->
            <button class="mobile-toggle-left header-mobile-toggle">☰</button>

            <div class="header-section-1">

            </div>

            <nav class="header-section-2"></nav>

            <div class="header-section-3"></div>

            <div class="header-section-4"></div>

            <div class="header-section-5"></div>

            <button class="mobile-toggle-right header-mobile-toggle">⋮</button>
        `;

        const searchSection = this.element.querySelector('.header-section-3');
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