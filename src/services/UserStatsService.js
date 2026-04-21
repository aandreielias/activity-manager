import { SupabaseClient } from './SupabaseClient.js';

/**
 * UserStatsService — CRUD against the relational `user_stats` and `user_category_hits` tables.
 */
export class UserStatsService {

    /**
     * Get stats for a single user by their user ID (UUID).
     */
    static async getStatsByUserId(userId) {
        if (!userId) return null;
        try {
            // Fetch core stats first
            const res = await SupabaseClient.get('user_stats', `?user_id=eq.${userId}&select=*`);
            if (!res.ok) return null;
            const stats = (await res.json())[0];
            if (!stats) return null;

            // Fetch inventory items separately to avoid join errors (400)
            const invRes = await SupabaseClient.get('user_inventory_items', `?user_id=eq.${userId}&select=*`);
            stats.user_inventory_items = invRes.ok ? await invRes.json() : [];

            return stats;
        } catch (e) {
            console.error('[UserStatsService] getStatsByUserId failed:', e);
            return null;
        }
    }

    /**
     * Get stats for ALL users. Returns a map of username → stats object.
     */
    static async getStats() {
        try {
            const res = await SupabaseClient.get('user_stats', '?select=*,users(username)');
            if (!res.ok) return {};
            const rows = await res.json();

            // Fetch all inventory items in bulk or per user
            // For now, per user is safer for smaller datasets
            for (const row of rows) {
                const invRes = await SupabaseClient.get('user_inventory_items', `?user_id=eq.${row.user_id}&select=*`);
                row.user_inventory_items = invRes.ok ? await invRes.json() : [];
            }

            const map = {};
            for (const row of rows) {
                const username = row.users?.username || 'unknown';

                let categoryHits = {};
                try {
                    const chRes = await SupabaseClient.get(
                        'user_category_hits',
                        `?user_id=eq.${row.user_id}&select=*`
                    );
                    if (chRes.ok) {
                        const chRows = await chRes.json();
                        chRows.forEach(ch => { categoryHits[ch.category] = ch.hit_count; });
                    }
                } catch (_) { /* best effort */ }

                map[username] = this.formatUserStats(row, categoryHits);
            }
            return map;
        } catch (e) {
            console.error('[UserStatsService] getStats failed:', e);
            return {};
        }
    }

    /**
     * Formats raw user stats and calculates derived metrics.
     * Note: 'blackjack_pushes' is omitted as it does not exist in the current DB schema.
     */
    static formatUserStats(row, categoryHits = {}) {
        const inventoryItems = row.user_inventory_items || [];
        const chips = { 1: 0, 5: 0, 10: 0, 20: 0, 25: 0, 100: 0, 500: 0, 1000: 0 };
        
        inventoryItems.forEach(item => {
            if (item.item_type.startsWith('chip_')) {
                const val = item.item_type.split('_')[1];
                chips[val] = item.quantity;
            }
        });

        const stats = {
            userId: row.user_id,
            lastLogin: row.last_login,
            entryCount: row.entry_count || 0,
            lastEntryDate: row.last_entry_date,
            favoritesCount: row.favorites_count || 0,
            chips: chips,
            categoryHits
        };

        // Derived Metrics
        stats.topCategory = this.getTopCategory(categoryHits);
        stats.activityLevel = this.getActivityLevel(stats.lastLogin);

        return stats;
    }



    static getTopCategory(hits) {
        if (!hits || Object.keys(hits).length === 0) return 'N/A';
        let top = 'N/A', max = 0;
        Object.entries(hits).forEach(([cat, val]) => {
            if (val > max) {
                max = val;
                top = cat.charAt(0).toUpperCase() + cat.slice(1);
            }
        });
        return top;
    }

    static getActivityLevel(lastLogin) {
        if (!lastLogin) return 'Idle';
        const diffDays = (new Date() - new Date(lastLogin)) / (1000 * 60 * 60 * 24);
        return diffDays < 2 ? 'Aktiv' : (diffDays < 7 ? 'Kürzlich' : 'Idle');
    }

    /**
     * Ensure a user_stats row exists.
     */
    static async _ensureStats(userId) {
        if (!userId) return null;
        
        // 1. Check if it exists (using a simple select without joins)
        const checkRes = await SupabaseClient.get('user_stats', `?user_id=eq.${userId}&select=user_id`);
        const existing = checkRes.ok ? await checkRes.json() : [];
        
        if (existing.length > 0) {
            return this.getStatsByUserId(userId);
        }

        // 2. Try to create it
        const res = await SupabaseClient.post('user_stats', { user_id: userId }, { 'Prefer': 'return=representation' });
        if (res.ok) {
            const rows = await res.json();
            return rows[0];
        } else if (res.status === 409) {
            // Race condition: someone created it between check and post
            return this.getStatsByUserId(userId);
        }
        
        return null;
    }

    /**
     * Update specific fields in user_stats.
     */
    static async _updateStats(userId, updates) {
        if (!userId) return;
        await this._ensureStats(userId);
        return SupabaseClient.patch('user_stats', `?user_id=eq.${userId}`, updates);
    }

    // ── Records ───────────────────────────────────────────────

    static async recordLogin(userId) {
        await this._updateStats(userId, { last_login: new Date().toISOString() });
    }

    static async recordEntry(userId, category) {
        const stats = await this._ensureStats(userId);
        const newCount = (stats?.entry_count || 0) + 1;

        await this._updateStats(userId, {
            entry_count: newCount,
            last_entry_date: new Date().toISOString(),
        });

        if (category) {
            const chRes = await SupabaseClient.get('user_category_hits', `?user_id=eq.${userId}&category=eq.${encodeURIComponent(category)}&select=*`);
            const existing = chRes.ok ? await chRes.json() : [];

            if (existing.length > 0) {
                await SupabaseClient.patch('user_category_hits', `?user_id=eq.${userId}&category=eq.${encodeURIComponent(category)}`, { hit_count: (existing[0].hit_count || 0) + 1 });
            } else {
                await SupabaseClient.post('user_category_hits', { user_id: userId, category, hit_count: 1 });
            }
        }
    }

    static async recordFavoriteChange(userId, count) {
        await this._updateStats(userId, { favorites_count: count });
    }

    static CHIP_VALUES = [1000, 500, 100, 25, 20, 10, 5, 1];

    static valueToChips(value) {
        let remaining = Math.max(0, Math.floor(value));
        const chipsObj = { 1: 0, 5: 0, 10: 0, 20: 0, 25: 0, 100: 0, 500: 0, 1000: 0 };
        for (const val of this.CHIP_VALUES) {
            const count = Math.floor(remaining / val);
            if (count > 0) {
                chipsObj[val] = count;
                remaining -= count * val;
            }
        }
        // If there's fraction, we ignore it or round down.
        return chipsObj;
    }

    static calculateTotalChipsValue(chipsObj) {
        if (!chipsObj) return 0;
        let total = 0;
        for (const [valStr, count] of Object.entries(chipsObj)) {
            total += parseInt(valStr, 10) * count;
        }
        return total;
    }

    static async updateChips(userId, chipsDiff) {
        const stats = await this.getStatsByUserId(userId);
        if (!stats) return;
        
        const currentItems = stats.user_inventory_items || [];
        
        for (const [val, diff] of Object.entries(chipsDiff)) {
            const type = `chip_${val}`;
            const existing = currentItems.find(i => i.item_type === type);
            const newQty = Math.max(0, (existing?.quantity || 0) + diff);
            
            if (existing) {
                await SupabaseClient.patch('user_inventory_items', `?id=eq.${existing.id}`, { quantity: newQty });
            } else {
                await SupabaseClient.post('user_inventory_items', { user_id: userId, item_type: type, quantity: newQty });
            }
        }
    }

    /**
     * Update chips by setting absolute values (overwrites existing).
     */
    static async updateChipsAbsolute(userId, chipsMap) {
        if (!userId) return;
        
        for (const [val, qty] of Object.entries(chipsMap)) {
            const type = `chip_${val}`;
            // Use UPSERT logic with ON CONFLICT (handled by Supabase 'resolution=merge-duplicates' or just individual checks)
            // For simplicity and to reuse our pattern:
            const res = await SupabaseClient.get('user_inventory_items', `?user_id=eq.${userId}&item_type=eq.${type}`);
            const existing = res.ok ? (await res.json())[0] : null;
            
            if (existing) {
                await SupabaseClient.patch('user_inventory_items', `?id=eq.${existing.id}`, { quantity: qty });
            } else {
                await SupabaseClient.post('user_inventory_items', { user_id: userId, item_type: type, quantity: qty });
            }
        }
    }

    /**
     * Resets ALL stats (Game and Activity) for the given user.
     */
    static async resetAllStats(userId) {
        if (!userId) return;

        // 1. Reset user_stats fields
        await this._updateStats(userId, {
            entry_count: 0,
            favorites_count: 0,
            last_entry_date: null
        });

        // 2. Clear inventory items (chips)
        await SupabaseClient.delete('user_inventory_items', `?user_id=eq.${userId}`);

        // 2. Clear category hits
        try {
            await SupabaseClient.delete('user_category_hits', `?user_id=eq.${userId}`);
        } catch (e) {
            console.error('[UserStatsService] Failed to clear category hits:', e);
        }
    }
}
