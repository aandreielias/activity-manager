import { SUPABASE_CONFIG } from '../config.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

/**
 * TooltipGenerator - Centralized utility for generating rich, premium tooltips.
 * Standardizes the layout for people and inventory tooltips across the app.
 */
export class TooltipGenerator {
    
    /**
     * Generates HTML for a person tooltip.
     * @param {Object} data - The person data object (fromDb format)
     * @returns {string} HTML string
     */
    static generatePersonTooltip(data) {
        if (!data) return '';

        const imgPath = data.image_url || data.photo || data.image;
        const bucket = 'user_picture_bucket';
        const isFull = imgPath?.includes('://') || imgPath?.startsWith('data:');
        const imgUrl = imgPath ? (isFull ? imgPath : `${SUPABASE_CONFIG.URL}/storage/v1/object/public/${bucket}/${imgPath}`) : null;

        const name = `${data.vorname || ''} ${data.nachname || ''}`.trim() || 'Unbekannt';
        const team = data.Team || data.Teams || '-';
        const role = data.role || data.Rolle || 'User';
        const email = data.email || data.Email || '-';
        const phone = data['Tel.'] || data.Telefon || data.telefon || '-';

        return `
            <div style="width: 220px; display: flex; flex-direction: column; gap: 6px; color: var(--text-primary); font-family: inherit;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <!-- Avatar (Round) -->
                    <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-tertiary); flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative;">
                        ${imgUrl ? `
                            <div class="tooltip-loader" style="position: absolute; width: 14px; height: 14px; border-width: 1px; z-index: 1;"></div>
                            <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.2s ease; z-index: 2;" onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';" onerror="this.previousElementSibling.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size: 18px; opacity: 0.3;\\'>👤</span>';">
                        ` : '<span style="font-size: 18px; opacity: 0.3;">👤</span>'}
                    </div>
                    
                    <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-weight: 700; color: var(--accent); font-size: 14px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${name}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">
                            ${role}
                        </div>
                    </div>
                </div>

                <div style="height: 1px; background: var(--border-light); opacity: 0.4;"></div>

                <div style="display: grid; grid-template-columns: 55px 1fr; gap: 2px 8px; font-size: 10px; line-height: 1.2;">
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Team</div>
                    <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${team}</div>
                    
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">E-Mail</div>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.8;">${email}</div>
                    
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Telefon</div>
                    <div style="opacity: 0.8;">${phone}</div>
                </div>
            </div>`.trim();
    }

    /**
     * Generates HTML for an inventory tooltip.
     * @param {Object} data - The inventory data object (fromDb format)
     * @returns {string} HTML string
     */
    static generateInventoryTooltip(data) {
        if (!data) return '';

        const imgPath = data.photo || data.image_url || data.image;
        const bucket = 'inventory_picture_bucket';
        const isFull = imgPath?.includes('://') || imgPath?.startsWith('data:');
        const imgUrl = imgPath ? (isFull ? imgPath : `${SUPABASE_CONFIG.URL}/storage/v1/object/public/${bucket}/${imgPath}`) : null;

        const name = data.in_name || data.name || 'Unbekannt';
        const category = data.in_kategorie || data.kategorie || data.item_category || data.category || '-';
        const quantity = data.in_menge ?? data.quantity ?? '-';
        const location = data.in_lagerort || data.storage_location || data.lagerort || '-';
        const condition = data.in_zustand || data.condition || data.zustand || '-';

        return `
            <div style="width: 220px; display: flex; flex-direction: column; gap: 6px; color: var(--text-primary); font-family: inherit;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <!-- Product Image (Square with rounded corners) -->
                    <div style="width: 48px; height: 48px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-tertiary); flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative;">
                        ${imgUrl ? `
                            <div class="tooltip-loader" style="position: absolute; width: 14px; height: 14px; border-width: 1px; z-index: 1;"></div>
                            <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.2s ease; z-index: 2;" onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';" onerror="this.previousElementSibling.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size: 18px; opacity: 0.3;\\'>📦</span>';">
                        ` : '<span style="font-size: 18px; opacity: 0.3;">📦</span>'}
                    </div>
                    
                    <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-weight: 700; color: var(--accent); font-size: 14px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${name}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">
                            ${category}
                        </div>
                    </div>
                </div>

                <div style="height: 1px; background: var(--border-light); opacity: 0.4;"></div>

                <div style="display: grid; grid-template-columns: 55px 1fr; gap: 2px 8px; font-size: 10px; line-height: 1.2;">
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Bestand</div>
                    <div style="font-weight: 500;">${quantity}</div>
                    
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Ort</div>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.8;">${location}</div>
                    
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Zustand</div>
                    <div style="opacity: 0.8;">${condition}</div>
                </div>
            </div>`.trim();
    }

    /**
     * Generates a simple image-only tooltip for the inventory table.
     * @param {Object} data - The inventory data object
     * @returns {string} HTML string
     */
    static generateInventoryImageTooltip(data) {
        if (!data) return '';

        const imgPath = data.photo || data.image_url || data.image;
        const bucket = 'inventory_picture_bucket';
        const isFull = imgPath?.includes('://') || imgPath?.startsWith('data:');
        const imgUrl = imgPath ? (isFull ? imgPath : `${SUPABASE_CONFIG.URL}/storage/v1/object/public/${bucket}/${imgPath}`) : null;

        if (!imgUrl) return '';

        return `
            <div style="display: flex; align-items: center; justify-content: center; width: 220px; height: 220px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-secondary); position: relative;">
                <div class="tooltip-loader" style="position: absolute; z-index: 1;"></div>
                <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.2s ease; z-index: 2;" 
                     onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';" 
                     onerror="this.previousElementSibling.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size: 48px; opacity: 0.1;\\'>📦</span>';">
            </div>`.trim();
    }

    /**
     * Generates HTML for a location tooltip.
     * @param {Object} data - The location data object
     * @returns {string} HTML string
     */
    static generateLocationTooltip(data) {
        if (!data) return '';

        const title = data.st_titel || data.title || 'Unbekannter Ort';
        const street = data.st_strasse || data.street || '';
        const zip = data.st_plz || data.zip_code || '';
        const city = data.st_stadt || data.city || '';
        const addressExtra = data.st_adresszusatz || data.address_extra || '';
        const notes = data.st_notizen || data.notes || data.notizen || '-';
        const link = data.st_link || data.link || '-';

        const address = [street, addressExtra, `${zip} ${city}`.trim()].filter(x => x).join('<br>') || '-';

        return `
            <div style="width: 220px; display: flex; flex-direction: column; gap: 6px; color: var(--text-primary); font-family: inherit;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <!-- Location Icon (Square with rounded corners) -->
                    <div style="width: 48px; height: 48px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-tertiary); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 24px; opacity: 0.5;">📍</span>
                    </div>
                    
                    <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-weight: 700; color: var(--accent); font-size: 14px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${title}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">
                            Standort
                        </div>
                    </div>
                </div>

                <div style="height: 1px; background: var(--border-light); opacity: 0.4;"></div>

                <div style="display: grid; grid-template-columns: 55px 1fr; gap: 2px 8px; font-size: 10px; line-height: 1.2;">
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Adresse</div>
                    <div style="font-weight: 500;">${address}</div>
                    
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Link</div>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.8;">${link}</div>
                    
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Notiz</div>
                    <div style="opacity: 0.8; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${notes}</div>
                </div>
            </div>`.trim();
    }

    /**
     * Generates HTML for a game/activity tooltip.
     * @param {Object} data - The game data object
     * @param {string} categoryTitle - Optional title of the category/table
     * @returns {string} HTML string
     */
    static generateGameTooltip(data, categoryTitle = 'Aktivität') {
        if (!data) return '';

        const name = data.name || 'Unbekanntes Spiel';
        
        // Determine the specific category title if "Alle Spiele" or "Alle Sportarten" is passed
        let displayCategory = categoryTitle;
        if (categoryTitle === 'Alle Spiele' || categoryTitle === 'Alle Sportarten' || !categoryTitle) {
            const gs = GlobalStateManager.getInstance();
            const configs = gs.getAllTableConfigs();
            const specificConfig = configs.find(c => c.id === `tbl_activities_${data.category}` || c.id === `tbl_sport_${data.category}`);
            if (specificConfig) displayCategory = specificConfig.title;
        }

        const duration = data.duration_minutes ? `${data.duration_minutes} Min.` : (data.duration || '-');
        
        // Handle Location (Örtlichkeit)
        let location = '-';
        if (data.location) {
            location = typeof data.location === 'object' ? data.location.title : data.location;
        } else if (data.type || data.indoor_outdoor) {
            // For sports
            location = [data.type, data.indoor_outdoor].filter(Boolean).join(' / ');
        }

        const minPlayers = data.min_players || '-';

        return `
            <div style="width: 220px; display: flex; flex-direction: column; gap: 6px; color: var(--text-primary); font-family: inherit;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <!-- Game Icon (Square with rounded corners) -->
                    <div style="width: 48px; height: 48px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-tertiary); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 24px; opacity: 0.5;">🎮</span>
                    </div>
                    
                    <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-weight: 700; color: var(--accent); font-size: 14px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${name}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">
                            ${displayCategory}
                        </div>
                    </div>
                </div>

                <div style="height: 1px; background: var(--border-light); opacity: 0.4;"></div>

                <div style="display: grid; grid-template-columns: 75px 1fr; gap: 2px 8px; font-size: 10px; line-height: 1.2;">
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Dauer</div>
                    <div style="font-weight: 500;">${duration}</div>
                    
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Örtlichkeit</div>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.8;">${location}</div>
                    
                    <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Min. Personen</div>
                    <div style="opacity: 0.8;">${minPlayers}</div>
                </div>
            </div>`.trim();
    }
}
