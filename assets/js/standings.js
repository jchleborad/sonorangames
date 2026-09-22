(() => {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbw9dkf50_ofoiG4K00IYWNn_Tf61cBOst67vw26h7ZhSajNHbyT3H5oNqV_va31GpKzuw/exec';
  const API_VERSION = 'v1';
  const COMPETITION_ID = 'official_2026';
  const SEASON = 2026;

  const standingsTabs = [...document.querySelectorAll('[data-standings-tab]')];
  const standingsPanels = [...document.querySelectorAll('[data-standings-panel]')];

  const weeklyEyebrow = document.querySelector('[data-weekly-eyebrow]');
  const weeklyHeading = document.querySelector('[data-weekly-heading]');
  const weeklyToolbarCopy = document.querySelector('[data-weekly-toolbar-copy]');
  const weeklyStatus = document.querySelector('[data-weekly-status]');
  const weeklyTitle = document.querySelector('[data-weekly-title]');
  const weeklyLead = document.querySelector('[data-weekly-lead]');
  const weeklyCopy = document.querySelector('[data-weekly-copy]');
  const weeklyTableEyebrow = document.querySelector('[data-weekly-table-eyebrow]');
  const weeklyTableStatus = document.querySelector('[data-weekly-table-status]');
  const weeklyTableState = document.querySelector('[data-weekly-table-state]');
  const weeklyTableScroll = document.querySelector('[data-weekly-table-scroll]');
  const weeklyTableBody = document.querySelector('[data-weekly-table-body]');

  const seasonEyebrow = document.querySelector('[data-season-eyebrow]');
  const seasonToolbarCopy = document.querySelector('[data-season-toolbar-copy]');
  const seasonStatus = document.querySelector('[data-season-status]');
  const seasonTitle = document.querySelector('[data-season-title]');
  const seasonLead = document.querySelector('[data-season-lead]');
  const seasonCopy = document.querySelector('[data-season-copy]');
  const seasonTableStatus = document.querySelector('[data-season-table-status]');
  const seasonTableState = document.querySelector('[data-season-table-state]');
  const seasonTableScroll = document.querySelector('[data-season-table-scroll]');
  const seasonTableBody = document.querySelector('[data-season-table-body]');
  const snapshotTitle = document.querySelector('[data-snapshot-title]');
  const snapshotCopy = document.querySelector('[data-snapshot-copy]');

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  function showStandingsView(view) {
    standingsTabs.forEach((tab) => {
      const active = tab.dataset.standingsTab === view;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    standingsPanels.forEach((panel) => {
      panel.hidden = panel.dataset.standingsPanel !== view;
    });
  }

  standingsTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => showStandingsView(tab.dataset.standingsTab));

    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;

      event.preventDefault();

      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + direction + standingsTabs.length) % standingsTabs.length;

      standingsTabs[nextIndex].focus();
      showStandingsView(standingsTabs[nextIndex].dataset.standingsTab);
    });
  });

  function buildWeeklyResultsUrl() {
    const url = new URL(API_URL);
    url.searchParams.set('action', 'getWeeklyResults');
    url.searchParams.set('api_version', API_VERSION);
    url.searchParams.set('competition_id', COMPETITION_ID);
    url.searchParams.set('season', String(SEASON));
    return url.toString();
  }

  async function fetchWeeklyResults() {
    const response = await fetch(buildWeeklyResultsUrl(), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Weekly results request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json();

    if (!payload || payload.ok !== true || !Array.isArray(payload.players)) {
      throw new Error(
        payload && payload.message
          ? payload.message
          : 'Weekly results returned an invalid response.'
      );
    }

    return payload;
  }

  function formatTiebreakerSummary(winner) {
    if (!winner) return '';

    const guess = winner.tiebreaker_guess;
    const actual = winner.tiebreaker_actual;
    const diff = winner.tiebreaker_diff;

    if (guess === '' || guess === null || guess === undefined) {
      return 'No tiebreaker was needed.';
    }

    if (Number(diff) === 0) {
      return `Tiebreaker: ${guess} — exactly right.`;
    }

    return `Tiebreaker: ${guess} vs. ${actual} actual (${diff} away).`;
  }

  function renderWeeklyWinner(payload) {
    const week = Number(payload.week || 0);
    const winners = Array.isArray(payload.winners) ? payload.winners : [];
    const winner = winners[0] || null;

    weeklyEyebrow.textContent = `Week ${week}`;
    weeklyHeading.textContent = `Week ${week} Results`;
    weeklyToolbarCopy.textContent = `${payload.player_count} players · final graded results`;
    weeklyStatus.textContent = 'Final';
    weeklyStatus.className = 'status status-final';

    weeklyTableEyebrow.textContent = `Week ${week} leaderboard`;
    weeklyTableStatus.textContent = 'Final';
    weeklyTableStatus.className = 'status status-final';

    if (!winner) {
      weeklyTitle.textContent = `Week ${week} is complete.`;
      weeklyLead.textContent = 'No weekly winner was identified.';
      weeklyCopy.textContent = '';
      return;
    }

    if (winners.length === 1) {
      weeklyTitle.textContent = `${winner.player_name} wins Week ${week}!`;

      const ties = Number(winner.ties || 0);
      const pickPoints = Number(
        winner.pick_points !== undefined
          ? winner.pick_points
          : Number(winner.correct || 0) + 0.5 * ties
      );

      weeklyLead.textContent =
        `${winner.correct} correct · ${winner.incorrect} incorrect · ` +
        `${ties} ${ties === 1 ? 'tie' : 'ties'} · ${pickPoints} pick points`;

      weeklyCopy.textContent = formatTiebreakerSummary(winner);
      return;
    }

    weeklyTitle.textContent = `${winners.length} players share Week ${week}.`;
    weeklyLead.textContent = winners.map(player => player.player_name).join(' · ');
    weeklyCopy.textContent = 'The weekly win is shared after the approved tiebreaker rules.';
  }

  function renderWeeklyTable(payload) {
    weeklyTableBody.innerHTML = payload.players.map(player => {
      const rank = Number(player.rank || 0);
      const winnerLabel = player.week_win
        ? '<span class="status status-final" style="margin-left:8px;vertical-align:middle;">Winner</span>'
        : '';

      const guess = player.tiebreaker_guess === '' ? '—' : player.tiebreaker_guess;
      const diff = player.tiebreaker_diff === '' ? '—' : player.tiebreaker_diff;

      return `
        <tr${player.week_win ? ' class="is-winner"' : ''}>
          <td>${rank}</td>
          <td><strong>${escapeHtml(player.player_name)}</strong>${winnerLabel}</td>
          <td>${Number(player.correct || 0)}</td>
          <td>${Number(player.incorrect || 0)}</td>
          <td>${Number(player.ties || 0)}</td>
          <td>${Number(
            player.pick_points !== undefined
              ? player.pick_points
              : Number(player.correct || 0) + 0.5 * Number(player.ties || 0)
          )}</td>
          <td>${escapeHtml(guess)}</td>
          <td>${escapeHtml(diff)}</td>
        </tr>
      `;
    }).join('');

    weeklyTableState.hidden = true;
    weeklyTableScroll.hidden = false;
  }

  function renderWeeklyError(message) {
    weeklyEyebrow.textContent = 'Weekly results';
    weeklyHeading.textContent = 'Results unavailable';
    weeklyToolbarCopy.textContent = message;
    weeklyStatus.textContent = 'Unavailable';
    weeklyStatus.className = 'status status-upcoming';

    weeklyTitle.textContent = 'We couldn’t load the weekly winner.';
    weeklyLead.textContent = 'The graded results are still safe in Sonoran Games.';
    weeklyCopy.textContent = 'Refresh the page in a moment. If the problem continues, contact the administrator.';

    weeklyTableStatus.textContent = 'Unavailable';
    weeklyTableStatus.className = 'status status-upcoming';

    weeklyTableState.hidden = false;
    weeklyTableState.innerHTML = `
      <div class="week-story" style="margin-top:0">
        <div>
          <p class="eyebrow">Weekly results</p>
          <h2 class="display">Leaderboard unavailable</h2>
          <p>${escapeHtml(message)}</p>
        </div>
      </div>
    `;

    weeklyTableScroll.hidden = true;
  }

  function buildSeasonStandingsUrl() {
    const url = new URL(API_URL);
    url.searchParams.set('action', 'getSeasonStandings');
    url.searchParams.set('api_version', API_VERSION);
    url.searchParams.set('competition_id', COMPETITION_ID);
    url.searchParams.set('season', String(SEASON));
    return url.toString();
  }

  async function fetchSeasonStandings() {
    const response = await fetch(buildSeasonStandingsUrl(), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Season standings request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json();

    if (!payload || payload.ok !== true || !Array.isArray(payload.players)) {
      throw new Error(
        payload && payload.message
          ? payload.message
          : 'Season standings returned an invalid response.'
      );
    }

    return payload;
  }

  function formatSeasonScore(value) {
    return Number(value || 0).toFixed(2);
  }

  function renderSeasonLeader(payload) {
    const leaders = Array.isArray(payload.leaders) ? payload.leaders : [];
    const leader = leaders[0] || null;

    seasonEyebrow.textContent = `${payload.season} season`;
    seasonToolbarCopy.textContent = `${payload.player_count} players · standings through the latest graded week`;
    seasonStatus.textContent = 'In progress';
    seasonStatus.className = 'status status-upcoming';

    seasonTableStatus.textContent = 'In progress';
    seasonTableStatus.className = 'status status-upcoming';

    if (!leader) {
      seasonTitle.textContent = 'The season race is underway.';
      seasonLead.textContent = 'No season leader is available yet.';
      seasonCopy.textContent = '';
      return;
    }

    if (leaders.length === 1) {
      seasonTitle.textContent = `${leader.player_name} leads the ${payload.season} season`;
      seasonLead.textContent =
        `${leader.weeks_won} weekly win${leader.weeks_won === 1 ? '' : 's'} · ` +
        `${leader.total_pick_points} pick points · ` +
        `Season Score ${formatSeasonScore(leader.cumulative_points)}`;

      seasonCopy.textContent =
        `The season score combines 60% weekly wins and 40% total pick points.`;
      return;
    }

    seasonTitle.textContent = `${leaders.length} players share the season lead`;
    seasonLead.textContent = leaders.map(player => player.player_name).join(' · ');
    seasonCopy.textContent =
      `They are tied at Season Score ${formatSeasonScore(leaders[0].cumulative_points)}.`;
  }

  function renderSeasonTable(payload) {
    seasonTableBody.innerHTML = payload.players.map(player => {
      const leaderLabel = Number(player.rank) === 1
        ? '<span class="status status-final" style="margin-left:8px;vertical-align:middle;">Leader</span>'
        : '';

      return `
        <tr${Number(player.rank) === 1 ? ' class="is-winner"' : ''}>
          <td>${Number(player.rank || 0)}</td>
          <td><strong>${escapeHtml(player.player_name)}</strong>${leaderLabel}</td>
          <td>${Number(player.weeks_won || 0)}</td>
          <td>${Number(player.total_correct || 0)}</td>
          <td>${Number(player.total_incorrect || 0)}</td>
          <td>${Number(player.total_ties || 0)}</td>
          <td>${Number(
            player.total_pick_points !== undefined
              ? player.total_pick_points
              : Number(player.total_correct || 0) +
                0.5 * Number(player.total_ties || 0)
          )}</td>
          <td>${escapeHtml(formatSeasonScore(player.cumulative_points))}</td>
        </tr>
      `;
    }).join('');

    seasonTableState.hidden = true;
    seasonTableScroll.hidden = false;

    const leader = Array.isArray(payload.leaders) && payload.leaders.length
      ? payload.leaders[0]
      : null;

    if (leader) {
      snapshotTitle.textContent =
        `${leader.player_name} leads through the latest graded week`;

      snapshotCopy.textContent =
        `${leader.weeks_won} weekly win${leader.weeks_won === 1 ? '' : 's'} · ` +
        `${leader.total_correct} correct · ` +
        `${leader.total_incorrect} incorrect · ` +
        `${leader.total_ties} ${Number(leader.total_ties) === 1 ? 'tie' : 'ties'} · ` +
        `${leader.total_pick_points} pick points · ` +
        `Season Score ${formatSeasonScore(leader.cumulative_points)}.`;
    } else {
      snapshotTitle.textContent = 'Season snapshot unavailable';
      snapshotCopy.textContent = 'No season leader is available yet.';
    }
  }

  function renderSeasonError(message) {
    seasonEyebrow.textContent = '2026 season';
    seasonToolbarCopy.textContent = message;
    seasonStatus.textContent = 'Unavailable';
    seasonStatus.className = 'status status-upcoming';

    seasonTitle.textContent = 'We couldn’t load the season standings.';
    seasonLead.textContent = 'The graded results are still safe in Sonoran Games.';
    seasonCopy.textContent =
      'Refresh the page in a moment. If the problem continues, contact the administrator.';

    seasonTableStatus.textContent = 'Unavailable';
    seasonTableStatus.className = 'status status-upcoming';

    seasonTableState.hidden = false;
    seasonTableState.innerHTML = `
      <div class="week-story" style="margin-top:0">
        <div>
          <p class="eyebrow">Season standings</p>
          <h2 class="display">Leaderboard unavailable</h2>
          <p>${escapeHtml(message)}</p>
        </div>
      </div>
    `;

    seasonTableScroll.hidden = true;

    snapshotTitle.textContent = 'Season snapshot unavailable';
    snapshotCopy.textContent = 'The current standings could not be loaded.';
  }

  async function initializeSeasonStandings() {
    try {
      const payload = await fetchSeasonStandings();
      renderSeasonLeader(payload);
      renderSeasonTable(payload);
    } catch (error) {
      renderSeasonError(error.message || 'Season standings could not be loaded.');
    }
  }

  async function initializeWeeklyResults() {
    try {
      const payload = await fetchWeeklyResults();
      renderWeeklyWinner(payload);
      renderWeeklyTable(payload);
    } catch (error) {
      renderWeeklyError(error.message || 'Weekly results could not be loaded.');
    }
  }

  if (standingsTabs.length && standingsPanels.length) {
    showStandingsView('weekly');
  }

  initializeWeeklyResults();
  initializeSeasonStandings();
})();
