import { SUPABASE_CONFIG } from '../config.js';

/**
 * UserStatsService — CRUD against the relational `user_stats` and `user_category_hits` tables.
 */
export class UserStatsService {

    static _headers(extra = {}) {
        return {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
            ...extra,
        };
    }

    /**
     * Get stats for a single user by their user ID (UUID).
     */
    static async getStatsByUserId(userId) {
        try {
            const res = await fetch(
                `${SUPABASE_CONFIG.URL}/rest/v1/user_stats?user_id=eq.${userId}&select=*`,
                { headers: this._headers() }
            );
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
     * (Used by the admin dashboard which displays stats by name.)
     */
    static async getStats() {
        try {
            // Join user_stats with users to get usernames
            const res = await fetch(
                `${SUPABASE_CONFIG.URL}/rest/v1/user_stats?select=*,users(username)`,
                { headers: this._headers() }
            );
            if (!res.ok) return {};
            const rows = await res.json();

            const map = {};
            for (const row of rows) {
                const username = row.users?.username || 'unknown';
                // Also load category hits for this user
                let categoryHits = {};
                try {
                    const chRes = await fetch(
                        `${SUPABASE_CONFIG.URL}/rest/v1/user_category_hits?user_id=eq.${row.user_id}&select=*`,
                        { headers: this._headers() }
                    );
                    if (chRes.ok) {
                        const chRows = await chRes.json();
                        chRows.forEach(ch => { categoryHits[ch.category] = ch.hit_count; });
                    }
                } catch (_) { /* ignore */ }

                map[username] = {
                    userId: row.user_id,
                    lastLogin: row.last_login,
                    entryCount: row.entry_count || 0,
                    lastEntryDate: row.last_entry_date,
                    blackjackWins: row.blackjack_wins || 0,
                    blackjackLosses: row.blackjack_losses || 0,
                    blackjackPushes: row.blackjack_pushes || 0,
                    blackjackBlackjacks: row.blackjack_blackjacks || 0,
                    blackjackCurrentStreak: row.blackjack_current_streak || 0,
                    blackjackHighestStreak: row.blackjack_highest_streak || 0,
                    favoritesCount: row.favorites_count || 0,
                    categoryHits,
                };
            }
            return map;
        } catch (e) {
            console.error('[UserStatsService] getStats failed:', e);
            return {};
        }
    }

    /**
     * Ensure a user_stats row exists for the given user, then return it.
     */
    static async _ensureStats(userId) {
        let stats = await this.getStatsByUserId(userId);
        if (!stats) {
            // Create a new stats row
            const res = await fetch(
                `${SUPABASE_CONFIG.URL}/rest/v1/user_stats`,
                {
                    method: 'POST',
                    headers: this._headers({ 'Prefer': 'return=representation' }),
                    body: JSON.stringify({ user_id: userId }),
                }
            );
            if (res.ok) {
                const rows = await res.json();
                stats = rows[0];
            }
        }
        return stats;
    }

    /**
     * Update specific fields in user_stats for a given userId.
     */
    static async _updateStats(userId, updates) {
        await this._ensureStats(userId);

        await fetch(
            `${SUPABASE_CONFIG.URL}/rest/v1/user_stats?user_id=eq.${userId}`,
            {
                method: 'PATCH',
                headers: this._headers(),
                body: JSON.stringify(updates),
            }
        );
    }

    // ── Records ───────────────────────────────────────────────

    static async recordLogin(userId, _username) {
        await this._updateStats(userId, { last_login: new Date().toISOString() });
    }

    static async recordEntry(userId, category) {
        // Increment entry_count
        const stats = await this._ensureStats(userId);
        const newCount = (stats?.entry_count || 0) + 1;

        await this._updateStats(userId, {
            entry_count: newCount,
            last_entry_date: new Date().toISOString(),
        });

        // Upsert category hit
        if (category) {
            // Try to load existing
            const chRes = await fetch(
                `${SUPABASE_CONFIG.URL}/rest/v1/user_category_hits?user_id=eq.${userId}&category=eq.${encodeURIComponent(category)}&select=*`,
                { headers: this._headers() }
            );
            const existing = chRes.ok ? await chRes.json() : [];

            if (existing.length > 0) {
                await fetch(
                    `${SUPABASE_CONFIG.URL}/rest/v1/user_category_hits?user_id=eq.${userId}&category=eq.${encodeURIComponent(category)}`,
                    {
                        method: 'PATCH',
                        headers: this._headers(),
                        body: JSON.stringify({ hit_count: (existing[0].hit_count || 0) + 1 }),
                    }
                );
            } else {
                await fetch(
                    `${SUPABASE_CONFIG.URL}/rest/v1/user_category_hits`,
                    {
                        method: 'POST',
                        headers: this._headers(),
                        body: JSON.stringify({ user_id: userId, category, hit_count: 1 }),
                    }
                );
            }
        }
    }

    static async recordBlackjackResult(userId, result) {
        const stats = await this._ensureStats(userId);
        if (!stats) return;

        const update = {};

        if (result === 'WIN' || result === 'BLACKJACK') {
            update.blackjack_wins = (stats.blackjack_wins || 0) + 1;
            update.blackjack_current_streak = (stats.blackjack_current_streak || 0) + 1;
            update.blackjack_highest_streak = Math.max(
                stats.blackjack_highest_streak || 0,
                update.blackjack_current_streak
            );
            if (result === 'BLACKJACK') {
                update.blackjack_blackjacks = (stats.blackjack_blackjacks || 0) + 1;
            }
        } else if (result === 'LOSS' || result === 'BUST') {
            update.blackjack_losses = (stats.blackjack_losses || 0) + 1;
            update.blackjack_current_streak = 0;
        } else if (result === 'PUSH') {
            update.blackjack_pushes = (stats.blackjack_pushes || 0) + 1;
        }

        await this._updateStats(userId, update);
    }

    static async recordPasswordChange(userId) {
        await this._updateStats(userId, {});
        // password_last_changed is on the users table, handled by AuthService
    }

    static async recordFavoriteChange(userId, count) {
        await this._updateStats(userId, { favorites_count: count });
    }

    /**
     * Resets the game-related stats (Blackjack) for the given user in Supabase.
     */
    static async resetGameStats(userId) {
        await this._updateStats(userId, {
            blackjack_wins: 0,
            blackjack_losses: 0,
            blackjack_pushes: 0,
            blackjack_blackjacks: 0,
            blackjack_current_streak: 0,
            blackjack_highest_streak: 0,
        });
    }
}
