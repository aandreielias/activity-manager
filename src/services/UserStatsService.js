import { SUPABASE_CONFIG } from '../config.js';

/**
 * UserStatsService - Manages user statistics in Supabase
 */
export class UserStatsService {
    static async getStats() {
        try {
            const response = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.user_stats&select=rows`, {
                headers: {
                    'apikey': SUPABASE_CONFIG.ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                }
            });

            if (!response.ok) return {};

            const data = await response.json();
            return (data && data[0] && data[0].rows) || {};
        } catch (error) {
            console.error('[UserStatsService] Failed to fetch stats:', error);
            return {};
        }
    }

    static async updateStat(username, statUpdate) {
        try {
            const currentStats = await this.getStats();
            const userStat = currentStats[username] || {
                lastLogin: null,
                entryCount: 0,
                lastEntryDate: null,
                blackjackWins: 0,
                blackjackLosses: 0,
                blackjackBlackjacks: 0,
                blackjackCurrentStreak: 0,
                blackjackHighestStreak: 0,
                categoryHits: {},
                passwordLastChanged: null,
                accountCreated: new Date().toISOString()
            };

            const updatedUserStat = { ...userStat, ...statUpdate };
            currentStats[username] = updatedUserStat;

            await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_CONFIG.ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    id: 'user_stats',
                    rows: currentStats
                })
            });
        } catch (error) {
            console.error(`[UserStatsService] Failed to update stat for ${username}:`, error);
        }
    }

    static async recordLogin(username) {
        await this.updateStat(username, { lastLogin: new Date().toISOString() });
    }

    static async recordEntry(username, category) {
        const currentStats = await this.getStats();
        const userStat = currentStats[username] || { entryCount: 0, categoryHits: {} };
        
        const updatedCategoryHits = { ...(userStat.categoryHits || {}) };
        if (category) {
            updatedCategoryHits[category] = (updatedCategoryHits[category] || 0) + 1;
        }

        await this.updateStat(username, {
            entryCount: (userStat.entryCount || 0) + 1,
            lastEntryDate: new Date().toISOString(),
            categoryHits: updatedCategoryHits
        });
    }

    static async recordBlackjackResult(username, result) { // result: 'WIN', 'BLACKJACK', 'LOSS', 'BUST', 'PUSH'
        const currentStats = await this.getStats();
        const userStat = currentStats[username] || { 
            blackjackWins: 0, 
            blackjackLosses: 0, 
            blackjackBlackjacks: 0,
            blackjackCurrentStreak: 0,
            blackjackHighestStreak: 0
        };

        const update = {};
        
        if (result === 'WIN' || result === 'BLACKJACK') {
            update.blackjackWins = (userStat.blackjackWins || 0) + 1;
            update.blackjackCurrentStreak = (userStat.blackjackCurrentStreak || 0) + 1;
            update.blackjackHighestStreak = Math.max(userStat.blackjackHighestStreak || 0, update.blackjackCurrentStreak);
            if (result === 'BLACKJACK') {
                update.blackjackBlackjacks = (userStat.blackjackBlackjacks || 0) + 1;
            }
        } else if (result === 'LOSS' || result === 'BUST') {
            update.blackjackLosses = (userStat.blackjackLosses || 0) + 1;
            update.blackjackCurrentStreak = 0;
        }

        await this.updateStat(username, update);
    }

    static async recordPasswordChange(username) {
        await this.updateStat(username, { passwordLastChanged: new Date().toISOString() });
    }

    static async recordFavoriteChange(username, count) {
        await this.updateStat(username, { favoritesCount: count });
    }
}
