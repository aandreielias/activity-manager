/**
 * ColourFactory - Centralized management of application colors and themes.
 */
export class ColourFactory {
    static BRAND_BLUE = '#0084ff';
    static BRAND_BLUE_RGB = [0, 132, 255];

    static getBrandBlue() {
        return this.BRAND_BLUE;
    }

    static getBrandBlueRGB() {
        return this.BRAND_BLUE_RGB;
    }

    /**
     * Returns a curated list of vibrant colors for tags and categories.
     */
    static getPremiumPalette() {
        return [
            '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', 
            '#F43F5E', '#F59E0B', '#D97706', '#7C3AED', '#06B6D4',
            '#2DD4BF', '#F472B6', '#A78BFA', '#fbbf24', '#4ade80'
        ];
    }

    static getRandomPremiumColor() {
        const palette = this.getPremiumPalette();
        return palette[Math.floor(Math.random() * palette.length)];
    }

    /**
     * Returns a deterministic color from the premium palette for a given string.
     */
    static getColorForString(str) {
        if (!str || str === '—') return '#94a3b8'; // Slate-400 for empty
        const palette = this.getPremiumPalette();
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return palette[Math.abs(hash) % palette.length];
    }
}
