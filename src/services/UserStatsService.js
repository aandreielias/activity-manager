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
            const res = await SupabaseClient.get('user_stats', `?user_id=eq.${userId}&select=*`);
            if (!res.ok) return null;
            const rows = await res.json();
            return rows[0] || null;
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
        const chips = {
            1: row.chip_1 || 0,
            5: row.chip_5 || 0,
            10: row.chip_10 || 0,
            20: row.chip_20 || 0,
            25: row.chip_25 || 0,
            100: row.chip_100 || 0,
            500: row.chip_500 || 0,
            1000: row.chip_1000 || 0
        };

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
        let stats = await this.getStatsByUserId(userId);
        if (!stats) {
            const res = await SupabaseClient.post('user_stats', { user_id: userId }, { 'Prefer': 'return=representation' });
            if (res.ok) {
                const rows = await res.json();
                stats = rows[0];
            }
        }
        return stats;
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
        const stats = await this._ensureStats(userId);
        if (!stats) return;
        
        const updates = {};
        for (const [val, diff] of Object.entries(chipsDiff)) {
            const col = `chip_${val}`;
            const current = stats[col] || 0;
            updates[col] = Math.max(0, current + diff); // prevent negative
        }
        
        await this._updateStats(userId, updates);
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
            last_entry_date: null,
            chip_1: 0,
            chip_5: 0,
            chip_10: 0,
            chip_20: 0,
            chip_25: 0,
            chip_100: 0,
            chip_500: 0,
            chip_1000: 0
        });

        // 2. Clear category hits
        try {
            await SupabaseClient.delete('user_category_hits', `?user_id=eq.${userId}`);
        } catch (e) {
            console.error('[UserStatsService] Failed to clear category hits:', e);
        }
    }
}
