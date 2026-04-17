export class PokerEvaluator {
    static evaluate(cards) {
        if (!cards || cards.length === 0) return { score: 0, text: 'High Card' };
        
        let values = [];
        let suits = { '♠':0, '♥':0, '♦':0, '♣':0, '♤':0, '♡':0, '♢':0, '♧':0 }; // handle different possible suit symbols
        cards.forEach(c => {
            let v = c.getRank().defaultValue;
            if (v === 1) v = 14; // Ace is 14
            values.push(v);
            let s = c.getSuit().symbol;
            if (!suits[s]) suits[s] = 0;
            suits[s]++;
        });
        
        values.sort((a,b) => b - a); // descending
        
        let isFlush = false;
        let flushValues = [];
        for (let s in suits) {
            if (suits[s] >= 5) {
                isFlush = true;
                flushValues = cards.filter(c => c.getSuit().symbol === s).map(c => {
                    let v = c.getRank().defaultValue;
                    return v === 1 ? 14 : v;
                }).sort((a,b) => b-a);
            }
        }
        
        // Find straight
        const findStraight = (vals) => {
            let uniqueVals = [...new Set(vals)];
            if (uniqueVals[0] === 14) uniqueVals.push(1); // Ace can be low
            for (let i=0; i <= uniqueVals.length - 5; i++) {
                if (uniqueVals[i] - uniqueVals[i+4] === 4) {
                    return uniqueVals[i]; // Top of straight
                }
            }
            return 0;
        };
        
        let straightHigh = findStraight(values);
        let straightFlushHigh = isFlush ? findStraight(flushValues) : 0;
        
        let counts = {};
        values.forEach(v => counts[v] = (counts[v] || 0) + 1);
        
        let pairs = [];
        let threes = [];
        let fours = [];
        
        for (let v in counts) {
            if (counts[v] === 2) pairs.push(parseInt(v));
            if (counts[v] === 3) threes.push(parseInt(v));
            if (counts[v] === 4) fours.push(parseInt(v));
        }
        pairs.sort((a,b) => b-a);
        threes.sort((a,b) => b-a);
        fours.sort((a,b) => b-a);
        
        // Helper to get remaining kickers
        const getKickers = (exclude, num) => {
            return values.filter(v => !exclude.includes(v)).slice(0, num);
        };
        
        // Calculate score based on hex string to make comparison easy
        // Format: HandType (1 hex) + Card1 (1 hex) + Card2 (1 hex) + etc
        const makeScore = (type, mainCards, kickers = []) => {
            let s = type.toString(16);
            for (let v of mainCards) s += v.toString(16).padStart(2,'0');
            for (let v of kickers) s += v.toString(16).padStart(2,'0');
            return parseInt(s.padEnd(11, '0'), 16); // up to 5 cards: 1 + 5*2 = 11 hex chars
        };
        
        if (straightFlushHigh > 0) return { score: makeScore(8, [straightFlushHigh]), text: 'Straight Flush' };
        if (fours.length > 0) return { score: makeScore(7, [fours[0]], getKickers([fours[0]], 1)), text: 'Four of a Kind' };
        if (threes.length > 0 && pairs.length > 0) return { score: makeScore(6, [threes[0], pairs[0]]), text: 'Full House' };
        if (threes.length > 1) return { score: makeScore(6, [threes[0], threes[1]]), text: 'Full House' };
        if (isFlush) return { score: makeScore(5, flushValues.slice(0,5)), text: 'Flush' };
        if (straightHigh > 0) return { score: makeScore(4, [straightHigh]), text: 'Straight' };
        if (threes.length > 0) return { score: makeScore(3, [threes[0]], getKickers([threes[0]], 2)), text: 'Three of a Kind' };
        if (pairs.length >= 2) return { score: makeScore(2, [pairs[0], pairs[1]], getKickers([pairs[0], pairs[1]], 1)), text: 'Two Pair' };
        if (pairs.length === 1) return { score: makeScore(1, [pairs[0]], getKickers([pairs[0]], 3)), text: 'Pair' };
        return { score: makeScore(0, values.slice(0,5)), text: 'High Card' };
    }
}
