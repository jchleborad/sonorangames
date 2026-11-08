(() => {
  'use strict';
  function rankCounts(players) {
    const counts = new Map();
    players.forEach(player => {
      const rank = Number(player.rank);
      if (Number.isInteger(rank) && rank > 0) counts.set(rank, (counts.get(rank) || 0) + 1);
    });
    return counts;
  }
  function rankMarkup(value, counts) {
    const rank = Number(value);
    if (!Number.isInteger(rank) || rank < 1) return '—';
    return counts.get(rank) > 1
      ? `<span aria-label="Tied for rank ${rank}">T${rank}</span>`
      : String(rank);
  }
  window.SGLeaderboardRanks = Object.freeze({ rankCounts, rankMarkup });
})();
