(() => {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbw9dkf50_ofoiG4K00IYWNn_Tf61cBOst67vw26h7ZhSajNHbyT3H5oNqV_va31GpKzuw/exec';
  const API_VERSION = 'v1';
  const COMPETITION_ID = 'official_2026';
  const SEASON = 2026;

  const weekLabel = document.querySelector('[data-home-week]');
  const kickoffLabel = document.querySelector('[data-home-kickoff]');
  const picksTitle = document.querySelector('[data-home-picks-title]');

  const gameStatus = document.querySelector('[data-home-game-status]');
  const gameHeading = document.querySelector('[data-home-game-heading]');
  const gameCopy = document.querySelector('[data-home-game-copy]');

  const winnerEyebrow = document.querySelector('[data-home-winner-eyebrow]');
  const winnerName = document.querySelector('[data-home-winner-name]');
  const winnerCopy = document.querySelector('[data-home-winner-copy]');

  const seasonHeading = document.querySelector('[data-home-season-heading]');
  const seasonCopy = document.querySelector('[data-home-season-copy]');

  const statPlayers = document.querySelector('[data-home-stat-players]');
  const statWeeks = document.querySelector('[data-home-stat-weeks]');
  const statBest = document.querySelector('[data-home-stat-best]');
  const statBestDetail = document.querySelector('[data-home-stat-best-detail]');

  function buildApiUrl(action, week = null) {
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('api_version', API_VERSION);
    url.searchParams.set('competition_id', COMPETITION_ID);
    url.searchParams.set('season', String(SEASON));
    if (week !== null) url.searchParams.set('week', String(week));
    return url.toString();
  }

  async function fetchJson(action, week = null) {
    const response = await fetch(buildApiUrl(action, week), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`${action} request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json();

    if (!payload || payload.ok !== true) {
      throw new Error(
        payload && payload.message
          ? payload.message
          : `${action} returned an invalid response.`
      );
    }

    return payload;
  }

  function formatKickoff(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function formatSeasonScore(value) {
    return Number(value || 0).toFixed(2);
  }

  function renderScoreboard(payload) {
    const week = Number(payload.week || 0);
    const games = Array.isArray(payload.games) ? payload.games : [];
    const summary = payload.summary || {};

    const live = Number(summary.live || 0);
    const upcoming = Number(summary.upcoming || 0);
    const final = Number(summary.final || 0);

    if (weekLabel) weekLabel.textContent = `Week ${week}`;
    if (picksTitle) picksTitle.textContent = `Make or update your Week ${week} picks`;
    if (gameStatus) gameStatus.textContent = `Week ${week}`;

    const firstKickoff = games
      .map(game => new Date(game.kickoff_utc))
      .filter(date => !Number.isNaN(date.getTime()))
      .sort((a, b) => a - b)[0];

    if (kickoffLabel) {
      kickoffLabel.textContent = firstKickoff
        ? `First kickoff ${formatKickoff(firstKickoff)}`
        : 'Schedule loaded';
    }

    if (!games.length) {
      if (gameHeading) gameHeading.textContent = `Week ${week} schedule unavailable`;
      if (gameCopy) gameCopy.textContent = 'Open the scoreboard for the latest game information.';
      return;
    }

    if (live > 0) {
      if (gameStatus) {
        gameStatus.textContent = 'Live';
        gameStatus.className = 'status status-live';
      }

      if (gameHeading) {
        gameHeading.textContent = `${live} game${live === 1 ? '' : 's'} live now`;
      }

      if (gameCopy) {
        gameCopy.textContent =
          `${final} final · ${upcoming} upcoming. Follow scores and Player Scoreboard updates live.`;
      }

      return;
    }

    if (final === games.length) {
      if (gameStatus) {
        gameStatus.textContent = 'Final';
        gameStatus.className = 'status status-final';
      }

      if (gameHeading) gameHeading.textContent = `Week ${week} is complete`;
      if (gameCopy) gameCopy.textContent = `All ${final} games are final. See the complete results on the scoreboard.`;
      return;
    }

    if (final > 0) {
      if (gameHeading) {
        gameHeading.textContent = `${final} final · ${upcoming} still to play`;
      }

      if (gameCopy) {
        gameCopy.textContent = 'Week action continues. Open the scoreboard for results and upcoming games.';
      }

      return;
    }

    if (gameHeading) gameHeading.textContent = `Week ${week} is set`;
    if (gameCopy) {
      gameCopy.textContent =
        `${games.length} games scheduled. First kickoff ${firstKickoff ? formatKickoff(firstKickoff) : 'coming up'}.`;
    }
  }

  function renderWeeklyResults(payload) {
    const week = Number(payload.week || 0);
    const winners = Array.isArray(payload.winners) ? payload.winners : [];
    const winner = winners[0] || null;
    const players = Array.isArray(payload.players) ? payload.players : [];

    if (winnerEyebrow) {
      winnerEyebrow.textContent = week ? `Week ${week} champion` : 'Weekly champion';
    }

    if (!winner) {
      if (winnerName) winnerName.textContent = 'Champion pending';
      if (winnerCopy) winnerCopy.textContent = 'The latest completed week is still being graded.';
    } else if (winners.length === 1) {
      if (winnerName) winnerName.textContent = winner.player_name;
      if (winnerCopy) {
        winnerCopy.textContent =
          `Week ${week} winner · ${winner.correct} correct · ${winner.incorrect} incorrect` +
          (Number(winner.ties) > 0 ? ` · ${winner.ties} tie${Number(winner.ties) === 1 ? '' : 's'}` : '');
      }
    } else {
      if (winnerName) winnerName.textContent = `${winners.length} co-champions`;
      if (winnerCopy) {
        winnerCopy.textContent =
          `Week ${week}: ${winners.map(player => player.player_name).join(', ')}`;
      }
    }

    if (statPlayers) statPlayers.textContent = String(payload.player_count || players.length || 0);
    if (statWeeks) statWeeks.textContent = String(week || 0);

  }

  async function renderSeasonBest(latest) {
    if (statBest) statBest.textContent = '—';
    if (statBestDetail) statBestDetail.textContent = '';
    try {
      const latestWeek = Number(latest.week);
      if (!Number.isInteger(latestWeek) || latestWeek < 1 || latestWeek > 18) return;
      const history = [];
      for (let week = 1; week <= latestWeek; week += 1) {
        const result = week === latestWeek ? latest : await fetchJson('getWeeklyResults', week);
        if (Number(result.week) !== week || !Array.isArray(result.players) || !result.players.length) {
          throw new Error('Completed season history is unavailable.');
        }
        if (result.players.every(player => Number(player.pending || 0) === 0)) history.push(result);
      }
      const rows = history.flatMap(result => result.players.map(player => ({ ...player, week: result.week })));
      if (statWeeks) statWeeks.textContent = String(history.length);
      if (!rows.length) return;
      const best = rows.slice().sort((a, b) => Number(b.correct || 0) - Number(a.correct || 0) || b.week - a.week)[0];
      if (statBest) statBest.textContent = String(best.correct);
      if (statBestDetail) statBestDetail.textContent = `${best.player_name} · Wk ${best.week}`;
    } catch (error) {
      if (statBestDetail) statBestDetail.textContent = 'Season record unavailable';
    }
  }

  function renderSeasonStandings(payload) {
    const leaders = Array.isArray(payload.leaders) ? payload.leaders : [];
    const leader = leaders[0] || null;

    if (!leader) {
      if (seasonHeading) seasonHeading.textContent = 'Season race underway';
      if (seasonCopy) seasonCopy.textContent = 'Open Standings for the latest rankings.';
      return;
    }

    if (leaders.length === 1) {
      if (seasonHeading) seasonHeading.textContent = `${leader.player_name} leads the season`;
      if (seasonCopy) {
        seasonCopy.textContent =
          `${leader.weeks_won} weekly win${leader.weeks_won === 1 ? '' : 's'} · ` +
          `${leader.total_pick_points} pick points · Season Score ${formatSeasonScore(leader.cumulative_points)}`;
      }
      return;
    }

    if (seasonHeading) seasonHeading.textContent = `${leaders.length} players share the lead`;
    if (seasonCopy) {
      seasonCopy.textContent =
        `${leaders.map(player => player.player_name).join(', ')} · ` +
        `Season Score ${formatSeasonScore(leaders[0].cumulative_points)}`;
    }
  }

  function renderScoreboardFallback() {
    if (kickoffLabel) kickoffLabel.textContent = 'Schedule unavailable';
    if (gameHeading) gameHeading.textContent = 'Current week is underway';
    if (gameCopy) gameCopy.textContent = 'Open the scoreboard for the latest game information.';
  }

  function renderWeeklyFallback() {
    if (winnerName) winnerName.textContent = 'Latest champion';
    if (winnerCopy) winnerCopy.textContent = 'Open Standings for the latest weekly results.';
  }

  function renderSeasonFallback() {
    if (seasonHeading) seasonHeading.textContent = 'Season standings';
    if (seasonCopy) seasonCopy.textContent = 'Open Standings for the current season race.';
  }

  async function initializeHome() {
    const [scoreboardResult, weeklyResult, seasonResult] = await Promise.allSettled([
      fetchJson('getScoreboard'),
      fetchJson('getWeeklyResults'),
      fetchJson('getSeasonStandings')
    ]);

    if (scoreboardResult.status === 'fulfilled') {
      renderScoreboard(scoreboardResult.value);
    } else {
      renderScoreboardFallback();
    }

    if (weeklyResult.status === 'fulfilled') {
      renderWeeklyResults(weeklyResult.value);
    } else {
      renderWeeklyFallback();
    }

    if (seasonResult.status === 'fulfilled') {
      renderSeasonStandings(seasonResult.value);
    } else {
      renderSeasonFallback();
    }

    if (weeklyResult.status === 'fulfilled') await renderSeasonBest(weeklyResult.value);
  }

  initializeHome();
})();
