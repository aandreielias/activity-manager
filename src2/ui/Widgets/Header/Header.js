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
            <!-- 1. Logo Bereich -->
            <div class="header-logo-section">
                <!-- Platz für [logo] -->
            </div>
            <!-- 2. Tabellenknöpfe -->
            <nav class="header-nav-section">
            </nav>
            <!-- 3. Suchleiste -->
            <div class="header-search-section">
                <!-- Platz für [suchleiste] -->
            </div>
            <!-- 4. Admin Knöpfe -->
            <div class="header-admin-section">
                <!-- Platz für [admin knöpfe] -->
            </div>
            <!-- 5. User Menu -->
            <div class="header-user-section">
                <!-- Platz für [user menu] -->
            </div>
        `;

        const searchSection = this.element.querySelector('.header-search-section');
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