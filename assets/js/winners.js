(() => {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbw9dkf50_ofoiG4K00IYWNn_Tf61cBOst67vw26h7ZhSajNHbyT3H5oNqV_va31GpKzuw/exec';
  const API_VERSION = 'v1';
  const COMPETITION_ID = 'official_2026';
  const SEASON = 2026;

  const winnerEyebrow = document.querySelector('[data-winner-eyebrow]');
  const winnerTitle = document.querySelector('[data-winner-title]');
  const winnerLead = document.querySelector('[data-winner-lead]');
  const winnerCopy = document.querySelector('[data-winner-copy]');

  const wallCopy = document.querySelector('[data-wall-copy]');
  const wallStatus = document.querySelector('[data-wall-status]');
  const championsGrid = document.querySelector('[data-champions-grid]');
  const featuredChampion = document.querySelector('[data-featured-champion]');
  const pastChampionsWrap = document.querySelector('[data-past-champions-wrap]');

  const raceTitle = document.querySelector('[data-race-title]');
  const raceCopy = document.querySelector('[data-race-copy]');

  const recordsGrid = document.querySelector('[data-records-grid]');
  const recordsCopy = document.querySelector('[data-records-copy]');

  const archiveTitle = document.querySelector('[data-archive-title]');
  const archiveCopy = document.querySelector('[data-archive-copy]');

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  function buildApiUrl(action, extra = {}) {
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('api_version', API_VERSION);
    url.searchParams.set('competition_id', COMPETITION_ID);
    url.searchParams.set('season', String(SEASON));

    Object.entries(extra).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  async function fetchJson(action, extra = {}) {
    const response = await fetch(buildApiUrl(action, extra), {
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

  function formatSeasonScore(value) {
    return Number(value || 0).toFixed(2);
  }

  function formatWinnerNames(winners) {
    return winners.map(player => player.player_name).join(', ');
  }

  function renderLatestChampion(latest) {
    const winners = Array.isArray(latest.winners) ? latest.winners : [];
    const week = Number(latest.week || 0);

    if (!winners.length) {
      winnerTitle.textContent = `Week ${week} champion pending`;
      winnerLead.textContent = 'The latest week has not produced a winner yet.';
      winnerCopy.textContent = '';
      return;
    }

    winnerEyebrow.textContent = `Week ${week} champion`;

    if (winners.length === 1) {
      const winner = winners[0];
      winnerTitle.textContent = winner.player_name;
      winnerLead.textContent = `${winner.correct} correct · ${winner.incorrect} incorrect`;

      if (winner.tiebreaker_diff === 0) {
        winnerCopy.textContent = `Tiebreaker bullseye: ${winner.tiebreaker_guess} matched the actual ${winner.tiebreaker_actual}.`;
      } else {
        winnerCopy.textContent = `Tiebreaker: ${winner.tiebreaker_guess} vs. ${winner.tiebreaker_actual} actual (${winner.tiebreaker_diff} away).`;
      }
      return;
    }

    winnerTitle.textContent = `${winners.length} co-champions`;
    winnerLead.textContent = formatWinnerNames(winners);
    winnerCopy.textContent = `Week ${week} finished with a shared weekly win.`;
  }

  function renderChampionsWall(history) {
    const ordered = history
      .slice()
      .sort((a, b) => Number(a.week || 0) - Number(b.week || 0));

    wallCopy.textContent = `${ordered.length} completed week${ordered.length === 1 ? '' : 's'} on the wall.`;
    wallStatus.textContent = `${ordered.length} champion week${ordered.length === 1 ? '' : 's'}`;
    wallStatus.className = 'status status-final';

    const latest = ordered[ordered.length - 1] || null;

    if (!latest) {
      featuredChampion.innerHTML = `
        <span class="champion-week">2026</span>
        <div class="champion-medal">★</div>
        <h3>No champion yet</h3>
        <p>The first completed week will take this spot.</p>
      `;
      pastChampionsWrap.hidden = true;
      return;
    }

    const latestWinners = Array.isArray(latest.winners) ? latest.winners : [];
    const latestFirst = latestWinners[0] || null;
    const latestTitle = latestWinners.length === 1
      ? latestFirst.player_name
      : `${latestWinners.length} co-champions`;
    const latestRecord = latestFirst
      ? `${latestFirst.correct}-${latestFirst.incorrect}`
      : 'Final';
    const latestNames = latestWinners.length > 1
      ? `<small>${escapeHtml(formatWinnerNames(latestWinners))}</small>`
      : '';

    featuredChampion.innerHTML = `
      <span class="champion-week">Week ${Number(latest.week || 0)}</span>
      <div class="champion-medal">★</div>
      <h3>${escapeHtml(latestTitle)}</h3>
      <p>${escapeHtml(latestRecord)} · Latest weekly champion</p>
      ${latestNames}
    `;

    const past = ordered.slice(0, -1);

    if (!past.length) {
      pastChampionsWrap.hidden = true;
      championsGrid.innerHTML = '';
      return;
    }

    pastChampionsWrap.hidden = false;

    championsGrid.innerHTML = past.map(weekResult => {
      const winners = Array.isArray(weekResult.winners) ? weekResult.winners : [];
      const first = winners[0] || null;
      const title = winners.length === 1
        ? first.player_name
        : `${winners.length} co-champions`;
      const record = first
        ? `${first.correct}-${first.incorrect}`
        : 'Final';
      const names = winners.length > 1
        ? `<small>${escapeHtml(formatWinnerNames(winners))}</small>`
        : '';

      return `
        <article class="card champion-tile">
          <span class="champion-week">Week ${Number(weekResult.week || 0)}</span>
          <div class="champion-medal">★</div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(record)} · Weekly champion</p>
          ${names}
        </article>
      `;
    }).join('');
  }


  function renderTitleRace(season) {
    const leaders = Array.isArray(season.leaders) ? season.leaders : [];

    if (!leaders.length) {
      raceTitle.textContent = 'The crown is still wide open.';
      raceCopy.textContent = 'Current season leaders will appear here as standings are graded.';
      return;
    }

    if (leaders.length === 1) {
      const leader = leaders[0];
      raceTitle.textContent = `${leader.player_name} currently holds the crown.`;
      raceCopy.textContent =
        `${leader.weeks_won} weekly win${leader.weeks_won === 1 ? '' : 's'} · ` +
        `${leader.total_correct} correct picks · Season Score ${formatSeasonScore(leader.cumulative_points)}.`;
      return;
    }

    raceTitle.textContent = `${leaders.length} players share the season lead.`;
    raceCopy.textContent = `${formatWinnerNames(leaders)} · Season Score ${formatSeasonScore(leaders[0].cumulative_points)}.`;
  }

  function getAllWeekRows(history) {
    return history.flatMap(weekResult =>
      (weekResult.players || []).map(player => ({
        ...player,
        week: Number(weekResult.week || 0)
      }))
    );
  }

  function getWeekWinners(history) {
    return history.flatMap(weekResult =>
      (weekResult.winners || []).map(player => ({
        ...player,
        week: Number(weekResult.week || 0)
      }))
    );
  }

  function ordinal(number) {
    const value = Number(number || 0);
    const mod100 = value % 100;

    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;

    switch (value % 10) {
      case 1: return `${value}st`;
      case 2: return `${value}nd`;
      case 3: return `${value}rd`;
      default: return `${value}th`;
    }
  }

  function plural(value, singular, pluralForm = `${singular}s`) {
    return Number(value) === 1 ? singular : pluralForm;
  }

  function reconstructSeasonSnapshots(history) {
    const cumulative = {};
    const snapshots = [];

    history
      .slice()
      .sort((a, b) => Number(a.week || 0) - Number(b.week || 0))
      .forEach(weekResult => {
        (weekResult.players || []).forEach(player => {
          const id = player.player_id;
          if (!cumulative[id]) {
            cumulative[id] = {
              player_id: id,
              player_name: player.player_name,
              weeks_won: 0,
              total_correct: 0,
              total_incorrect: 0
            };
          }

          cumulative[id].total_correct += Number(player.correct || 0);
          cumulative[id].total_incorrect += Number(player.incorrect || 0);

          if (player.week_win) {
            cumulative[id].weeks_won += 1;
          }
        });

        const rows = Object.values(cumulative).map(player => ({ ...player }));
        const maxWins = Math.max(0, ...rows.map(player => player.weeks_won));
        const maxCorrect = Math.max(0, ...rows.map(player => player.total_correct));

        rows.forEach(player => {
          const winsPoints = maxWins > 0 ? (player.weeks_won / maxWins) * 60 : 0;
          const correctPoints = maxCorrect > 0 ? (player.total_correct / maxCorrect) * 40 : 0;
          player.score = winsPoints + correctPoints;
        });

        rows.sort((a, b) =>
          b.score - a.score ||
          b.weeks_won - a.weeks_won ||
          b.total_correct - a.total_correct ||
          a.player_name.localeCompare(b.player_name)
        );

        let priorScore = null;
        let priorRank = 0;

        rows.forEach((player, index) => {
          if (priorScore === null || Math.abs(player.score - priorScore) > 0.0001) {
            priorRank = index + 1;
            priorScore = player.score;
          }

          player.rank = priorRank;
        });

        snapshots.push({
          week: Number(weekResult.week || 0),
          players: rows
        });
      });

    return snapshots;
  }

  function makeFact(id, priority, category, text) {
    return { id, priority, category, text };
  }

  function buildFactCandidates(history, latest, season) {
    const facts = [];
    const rows = getAllWeekRows(history);
    const winners = getWeekWinners(history);
    const latestPlayers = Array.isArray(latest.players) ? latest.players : [];
    const latestWeek = Number(latest.week || 0);

    if (!rows.length || !latestPlayers.length) return facts;

    // 1. Exact tiebreaker hit
    const exactTb = rows.filter(row => Number(row.tiebreaker_diff) === 0);
    if (exactTb.length) {
      const mostRecent = exactTb.slice().sort((a, b) => b.week - a.week)[0];
      facts.push(makeFact(
        'exact-tiebreaker',
        100,
        'tiebreaker',
        `${mostRecent.player_name} hit the Week ${mostRecent.week} tiebreaker exactly at ${mostRecent.tiebreaker_actual}.`
      ));
    }

    // 2. Multiple exact tiebreakers
    const exactByWeek = history
      .map(weekResult => ({
        week: Number(weekResult.week || 0),
        players: (weekResult.players || []).filter(player => Number(player.tiebreaker_diff) === 0)
      }))
      .filter(item => item.players.length > 1);

    if (exactByWeek.length) {
      const item = exactByWeek.slice().sort((a, b) => b.week - a.week)[0];
      facts.push(makeFact(
        'multiple-exact-tiebreakers',
        91,
        'tiebreaker',
        `Week ${item.week} had ${item.players.length} tiebreaker bullseyes: ${item.players.map(player => player.player_name).join(', ')}.`
      ));
    }

    // 3. One-point tiebreaker miss
    const oneAway = rows.filter(row => Number(row.tiebreaker_diff) === 1);
    if (oneAway.length) {
      const mostRecent = oneAway.slice().sort((a, b) => b.week - a.week)[0];
      facts.push(makeFact(
        'one-away-tiebreaker',
        82,
        'tiebreaker',
        `${mostRecent.player_name} missed the Week ${mostRecent.week} tiebreaker by just 1 point.`
      ));
    }

    // 4. Closest tiebreaker of the season
    const validTbs = rows
      .filter(row => row.tiebreaker_diff !== '' && row.tiebreaker_diff !== null && row.tiebreaker_diff !== undefined)
      .filter(row => Number.isFinite(Number(row.tiebreaker_diff)));

    if (validTbs.length) {
      const closest = validTbs.slice().sort((a, b) =>
        Number(a.tiebreaker_diff) - Number(b.tiebreaker_diff) ||
        b.week - a.week
      )[0];

      facts.push(makeFact(
        'closest-tiebreaker-season',
        Number(closest.tiebreaker_diff) === 0 ? 88 : 74,
        'tiebreaker',
        `${closest.player_name} owns the closest tiebreaker of the season at ${closest.tiebreaker_diff} ${plural(closest.tiebreaker_diff, 'point')} away in Week ${closest.week}.`
      ));
    }

    // 5. New high weekly score
    const maxCorrect = Math.max(...rows.map(row => Number(row.correct || 0)));
    const highScorers = rows.filter(row => Number(row.correct || 0) === maxCorrect);
    if (highScorers.length) {
      const latestHigh = highScorers.slice().sort((a, b) => b.week - a.week)[0];
      facts.push(makeFact(
        'highest-weekly-score',
        90,
        'weekly-score',
        `${latestHigh.player_name} owns the season's best weekly score so far with ${maxCorrect} correct in Week ${latestHigh.week}.`
      ));
    }

    // 6. Lowest winning score so far
    if (winners.length) {
      const lowestWinning = winners.slice().sort((a, b) =>
        Number(a.correct || 0) - Number(b.correct || 0) ||
        a.week - b.week
      )[0];

      facts.push(makeFact(
        'lowest-winning-score',
        52,
        'weekly-score',
        `The lowest winning score so far is ${lowestWinning.correct} correct, posted by ${lowestWinning.player_name} in Week ${lowestWinning.week}.`
      ));
    }

    // 7. Photo finish: one-pick margin
    const rankedLatest = latestPlayers.slice().sort((a, b) =>
      Number(a.rank || 999) - Number(b.rank || 999) ||
      Number(b.correct || 0) - Number(a.correct || 0)
    );

    const latestWinner = rankedLatest.find(player => Number(player.rank) === 1);
    const latestRunner = rankedLatest.find(player => Number(player.rank) === 2);

    if (latestWinner && latestRunner) {
      const margin = Number(latestWinner.correct || 0) - Number(latestRunner.correct || 0);

      if (margin === 1) {
        facts.push(makeFact(
          'photo-finish',
          86,
          'finish',
          `Week ${latestWeek} was a photo finish: ${latestWinner.player_name} won by just 1 pick.`
        ));
      }

      // 8. Dominant weekly win
      if (margin >= 2) {
        facts.push(makeFact(
          'dominant-win',
          84,
          'finish',
          `${latestWinner.player_name} controlled Week ${latestWeek}, finishing ${margin} picks clear of second place.`
        ));
      }
    }

    // 9. Crowded second place
    const secondPlace = latestPlayers.filter(player => Number(player.rank) === 2);
    if (secondPlace.length >= 4) {
      facts.push(makeFact(
        'second-place-logjam',
        96,
        'finish',
        `Week ${latestWeek} had a crowd behind the winner: ${secondPlace.length} players tied for second at ${secondPlace[0].correct}-${secondPlace[0].incorrect}.`
      ));
    }

    // 10. Large record cluster anywhere in the latest week
    const recordGroups = new Map();
    latestPlayers.forEach(player => {
      const key = `${player.correct}-${player.incorrect}`;
      if (!recordGroups.has(key)) recordGroups.set(key, []);
      recordGroups.get(key).push(player);
    });

    const largestCluster = [...recordGroups.entries()]
      .map(([record, players]) => ({ record, players }))
      .sort((a, b) => b.players.length - a.players.length)[0];

    if (largestCluster && largestCluster.players.length >= 6) {
      facts.push(makeFact(
        'record-cluster',
        70,
        'field',
        `${largestCluster.players.length} players finished Week ${latestWeek} at exactly ${largestCluster.record}.`
      ));
    }

    // 11. First repeat winner
    const winCounts = {};
    winners.forEach(winner => {
      winCounts[winner.player_id] = (winCounts[winner.player_id] || 0) + 1;
    });

    const repeatWinners = Object.entries(winCounts)
      .filter(([, count]) => count >= 2)
      .map(([playerId, count]) => {
        const winner = winners.find(item => item.player_id === playerId);
        return { ...winner, count };
      })
      .sort((a, b) => b.count - a.count || b.week - a.week);

    if (repeatWinners.length) {
      const repeat = repeatWinners[0];
      facts.push(makeFact(
        'repeat-winner',
        94,
        'wins',
        `${repeat.player_name} is the first repeat weekly winner with ${repeat.count} wins.`
      ));
    }

    // 12. Three-or-more weekly wins
    const threePlus = repeatWinners.find(player => player.count >= 3);
    if (threePlus) {
      facts.push(makeFact(
        'three-plus-wins',
        98,
        'wins',
        `${threePlus.player_name} has reached ${threePlus.count} weekly wins — the first major trophy-room milestone of the season.`
      ));
    }

    // 13. Consecutive weekly wins
    const winsByPlayer = {};
    winners.forEach(winner => {
      if (!winsByPlayer[winner.player_id]) winsByPlayer[winner.player_id] = [];
      winsByPlayer[winner.player_id].push(winner.week);
    });

    Object.entries(winsByPlayer).forEach(([playerId, weeks]) => {
      const ordered = weeks.slice().sort((a, b) => a - b);
      let streak = 1;
      let best = 1;

      for (let i = 1; i < ordered.length; i += 1) {
        streak = ordered[i] === ordered[i - 1] + 1 ? streak + 1 : 1;
        best = Math.max(best, streak);
      }

      if (best >= 2) {
        const player = winners.find(item => item.player_id === playerId);
        facts.push(makeFact(
          `win-streak-${playerId}`,
          95 + Math.min(best, 4),
          'wins',
          `${player.player_name} has won ${best} straight weeks.`
        ));
      }
    });

    // 14. Weekly-win leader
    const maxWeeksWon = Number(season.max_weeks_won || 0);
    const seasonWinLeaders = (season.players || []).filter(player =>
      Number(player.weeks_won || 0) === maxWeeksWon && maxWeeksWon > 0
    );

    if (seasonWinLeaders.length === 1) {
      facts.push(makeFact(
        'weekly-win-leader',
        68,
        'wins',
        `${seasonWinLeaders[0].player_name} leads the pool with ${maxWeeksWon} weekly ${plural(maxWeeksWon, 'win')}.`
      ));
    }

    // 15. Season lead change
    const snapshots = reconstructSeasonSnapshots(history);
    if (snapshots.length >= 2) {
      const previous = snapshots[snapshots.length - 2];
      const current = snapshots[snapshots.length - 1];

      const previousLeaders = previous.players.filter(player => player.rank === 1).map(player => player.player_id);
      const currentLeaders = current.players.filter(player => player.rank === 1);

      const newLeader = currentLeaders.find(player => !previousLeaders.includes(player.player_id));

      if (newLeader) {
        facts.push(makeFact(
          'season-lead-change',
          99,
          'season-race',
          `${newLeader.player_name} took over the season lead after Week ${current.week}.`
        ));
      }
    }

    // 16. Biggest season rank jump
    if (snapshots.length >= 2) {
      const previous = snapshots[snapshots.length - 2];
      const current = snapshots[snapshots.length - 1];
      const previousRanks = Object.fromEntries(previous.players.map(player => [player.player_id, player.rank]));

      const jumps = current.players
        .filter(player => previousRanks[player.player_id])
        .map(player => ({
          player,
          jump: previousRanks[player.player_id] - player.rank
        }))
        .filter(item => item.jump >= 3)
        .sort((a, b) => b.jump - a.jump);

      if (jumps.length) {
        const jump = jumps[0];
        facts.push(makeFact(
          'biggest-rank-jump',
          89,
          'season-race',
          `${jump.player.player_name} made the week's biggest standings move, jumping ${jump.jump} spots to ${ordinal(jump.player.rank)}.`
        ));
      }
    }

    // 17. Milestone in total correct picks
    const milestones = [25, 50, 75, 100, 150, 200];
    const seasonPlayers = Array.isArray(season.players) ? season.players : [];

    const milestoneHits = [];
    seasonPlayers.forEach(player => {
      const total = Number(player.total_correct || 0);
      const milestone = milestones.slice().reverse().find(value => total >= value);
      if (milestone) {
        milestoneHits.push({ player, milestone });
      }
    });

    if (milestoneHits.length) {
      const highest = milestoneHits.sort((a, b) =>
        b.milestone - a.milestone ||
        Number(b.player.total_correct || 0) - Number(a.player.total_correct || 0)
      )[0];

      facts.push(makeFact(
        'correct-picks-milestone',
        80,
        'milestone',
        `${highest.player.player_name} has crossed ${highest.milestone} correct picks for the season.`
      ));
    }

    // 18. Longest 10+ correct streak
    const streakMap = {};
    history
      .slice()
      .sort((a, b) => Number(a.week || 0) - Number(b.week || 0))
      .forEach(weekResult => {
        (weekResult.players || []).forEach(player => {
          if (!streakMap[player.player_id]) {
            streakMap[player.player_id] = {
              player_name: player.player_name,
              current: 0,
              best: 0
            };
          }

          if (Number(player.correct || 0) >= 10) {
            streakMap[player.player_id].current += 1;
            streakMap[player.player_id].best = Math.max(
              streakMap[player.player_id].best,
              streakMap[player.player_id].current
            );
          } else {
            streakMap[player.player_id].current = 0;
          }
        });
      });

    const bestTenPlus = Object.values(streakMap)
      .filter(item => item.best >= 3)
      .sort((a, b) => b.best - a.best)[0];

    if (bestTenPlus) {
      facts.push(makeFact(
        'ten-plus-streak',
        83,
        'streak',
        `${bestTenPlus.player_name} owns the longest 10+ correct streak at ${bestTenPlus.best} straight weeks.`
      ));
    }

    // 19. Latest week top-score exclusivity
    const latestMaxCorrect = Math.max(...latestPlayers.map(player => Number(player.correct || 0)));
    const latestTopScorers = latestPlayers.filter(player => Number(player.correct || 0) === latestMaxCorrect);

    if (latestTopScorers.length === 1) {
      facts.push(makeFact(
        'lone-top-scorer',
        78,
        'weekly-score',
        `${latestTopScorers[0].player_name} was the only player to reach ${latestMaxCorrect} correct picks in Week ${latestWeek}.`
      ));
    }

    // 20. Tight field at the top: many within one pick of winner
    if (latestWinner) {
      const winnerCorrect = Number(latestWinner.correct || 0);
      const withinOne = latestPlayers.filter(player =>
        Number(player.correct || 0) >= winnerCorrect - 1
      );

      if (withinOne.length >= 5) {
        facts.push(makeFact(
          'tight-top-field',
          76,
          'field',
          `Week ${latestWeek} stayed tight: ${withinOne.length} players finished within one pick of the winning score.`
        ));
      }
    }

    return facts;
  }

  function selectFacts(candidates, maxFacts = 3) {
    if (!candidates.length) return [];

    const seenIds = new Set();
    const unique = candidates.filter(fact => {
      if (seenIds.has(fact.id)) return false;
      seenIds.add(fact.id);
      return true;
    });

    unique.sort((a, b) =>
      b.priority - a.priority ||
      a.id.localeCompare(b.id)
    );

    const selected = [];
    const usedCategories = new Set();

    // First pass: favor variety.
    unique.forEach(fact => {
      if (selected.length >= maxFacts) return;
      if (usedCategories.has(fact.category)) return;

      selected.push(fact);
      usedCategories.add(fact.category);
    });

    // Second pass: fill any remaining slots with the next-best facts.
    unique.forEach(fact => {
      if (selected.length >= maxFacts) return;
      if (selected.includes(fact)) return;
      selected.push(fact);
    });

    return selected;
  }

  function renderRecords(history, latest, season) {
    const rows = getAllWeekRows(history);
    const validTbs = rows
      .filter(row => row.tiebreaker_diff !== '' && row.tiebreaker_diff !== null && row.tiebreaker_diff !== undefined)
      .filter(row => Number.isFinite(Number(row.tiebreaker_diff)));

    const best = rows.length
      ? rows.slice().sort((a, b) =>
          Number(b.correct || 0) - Number(a.correct || 0) ||
          b.week - a.week
        )[0]
      : null;

    const closest = validTbs.length
      ? validTbs.slice().sort((a, b) =>
          Number(a.tiebreaker_diff) - Number(b.tiebreaker_diff) ||
          b.week - a.week
        )[0]
      : null;

    const maxWeeksWon = Number(season.max_weeks_won || 0);
    const winLeaders = (season.players || []).filter(player =>
      Number(player.weeks_won || 0) === maxWeeksWon && maxWeeksWon > 0
    );

    const winLeaderNames = winLeaders.length
      ? winLeaders.map(player => player.player_name).join(', ')
      : '—';

    recordsGrid.innerHTML = `
      <div class="stat">
        <strong>${best ? best.correct : '—'}</strong>
        <span>Best Weekly Score</span>
        <small>${best ? `${escapeHtml(best.player_name)} · Wk ${best.week}` : '—'}</small>
      </div>
      <div class="stat">
        <strong>${closest ? closest.tiebreaker_diff : '—'}</strong>
        <span>Closest Tiebreaker</span>
        <small>${closest ? `${escapeHtml(closest.player_name)} · Wk ${closest.week}` : '—'}</small>
      </div>
      <div class="stat">
        <strong>${maxWeeksWon || '—'}</strong>
        <span>Weekly Win Leader</span>
        <small>${escapeHtml(winLeaderNames)}</small>
      </div>
    `;

    const candidates = buildFactCandidates(history, latest, season);
    const selected = selectFacts(candidates, 3);

    recordsCopy.textContent = selected.length
      ? selected.map(fact => fact.text).join(' ')
      : 'The record book is waiting for its next great story.';
  }

  function renderArchive(history, season) {
    const completedWeeks = history.length;
    archiveTitle.textContent = 'Championship in progress';
    archiveCopy.textContent = `${completedWeeks} week${completedWeeks === 1 ? '' : 's'} complete · current leader: ${season.leaders && season.leaders[0] ? season.leaders[0].player_name : 'TBD'}`;
  }

  function renderError(message) {
    winnerTitle.textContent = 'Trophy room unavailable';
    winnerLead.textContent = 'The winners data could not be loaded.';
    winnerCopy.textContent = message;

    wallCopy.textContent = 'Champions Wall could not be loaded.';
    wallStatus.textContent = 'Unavailable';
    wallStatus.className = 'status status-upcoming';

    featuredChampion.innerHTML = `
      <span class="champion-week">2026</span>
      <div class="champion-medal">★</div>
      <h3>Try again shortly</h3>
      <p>The graded data is still safe in Sonoran Games.</p>
    `;
    pastChampionsWrap.hidden = true;
    championsGrid.innerHTML = '';

    raceTitle.textContent = 'Season race unavailable';
    raceCopy.textContent = 'Open Standings for the current leaderboard.';
    recordsCopy.textContent = 'The record book could not be loaded.';
  }

  async function initializeWinners() {
    try {
      const [latest, season] = await Promise.all([
        fetchJson('getWeeklyResults'),
        fetchJson('getSeasonStandings')
      ]);

      const latestWeek = Number(latest.week || 0);

      const historyResults = await Promise.all(
        Array.from({ length: latestWeek }, (_, index) =>
          fetchJson('getWeeklyResults', { week: index + 1 })
        )
      );

      renderLatestChampion(latest);
      renderChampionsWall(historyResults);
      renderTitleRace(season);
      renderRecords(historyResults, latest, season);
      renderArchive(historyResults, season);
    } catch (error) {
      renderError(error.message || 'Winners data could not be loaded.');
    }
  }

  initializeWinners();
})();
