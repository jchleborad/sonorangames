(() => {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbw9dkf50_ofoiG4K00IYWNn_Tf61cBOst67vw26h7ZhSajNHbyT3H5oNqV_va31GpKzuw/exec';
  const SESSION_KEY = 'sonoran-games:commissioner-session';

  const loginView = document.querySelector('[data-login-view]');
  const dashboardView = document.querySelector('[data-dashboard-view]');
  const errorView = document.querySelector('[data-error-view]');
  const loginForm = document.querySelector('[data-login-form]');
  const passwordInput = document.querySelector('[data-password]');
  const loginMessage = document.querySelector('[data-login-message]');
  const loginButton = document.querySelector('[data-login-button]');
  const refreshButton = document.querySelector('[data-refresh-dashboard]');
  const logoutButton = document.querySelector('[data-logout]');
  const returnLoginButton = document.querySelector('[data-return-login]');

  const overrideForm = document.querySelector('[data-override-form]');
  const overridePlayer = document.querySelector('[data-override-player]');
  const overrideGame = document.querySelector('[data-override-game]');
  const overrideReason = document.querySelector('[data-override-reason]');
  const overrideMessage = document.querySelector('[data-override-message]');
  const overrideSuccess = document.querySelector('[data-override-success]');
  const overrideGameReference = document.querySelector('[data-override-game-reference]');
  const overrideGameId = document.querySelector('[data-override-game-id]');
  const copyOverrideGameId = document.querySelector('[data-copy-override-game-id]');
  const overridePickFieldset = document.querySelector('[data-override-pick-fieldset]');
  const overridePickOptions = document.querySelector('[data-override-pick-options]');
  const previewOverrideButton = document.querySelector('[data-preview-override]');
  const overrideDialog = document.querySelector('[data-override-dialog]');
  const overridePreview = document.querySelector('[data-override-preview]');
  const cancelOverrideButton = document.querySelector('[data-cancel-override]');
  const confirmOverrideButton = document.querySelector('[data-confirm-override]');

  let dashboardData = null;
  let pendingOverride = null;
  let lastOverrideResult = null;
  let lastDashboardResponseMs = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

  function getSessionToken(){try{return sessionStorage.getItem(SESSION_KEY)||'';}catch(e){return '';}}
  function saveSessionToken(token){try{sessionStorage.setItem(SESSION_KEY,token);}catch(e){}}
  function clearSessionToken(){try{sessionStorage.removeItem(SESSION_KEY);}catch(e){}}

  async function postJson(payload){
    const response=await fetch(API_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    if(!response.ok) throw new Error(`Sonoran Games server returned HTTP ${response.status}.`);
    const result=await response.json();
    if(!result||result.ok!==true){
      const error=new Error(result&&result.message?result.message:'Sonoran Games could not complete the request.');
      error.code=result&&result.code?result.code:'SERVER_ERROR';
      throw error;
    }
    return result;
  }

  function showLogin(){loginView.hidden=false;dashboardView.hidden=true;errorView.hidden=true;setTimeout(()=>passwordInput&&passwordInput.focus(),50);}
  function showDashboard(){loginView.hidden=true;dashboardView.hidden=false;errorView.hidden=true;}
  function showFatal(message){loginView.hidden=true;dashboardView.hidden=true;errorView.hidden=false;const n=document.querySelector('[data-fatal-message]');if(n)n.textContent=message;}

  function formatLocal(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d);}
  function formatAZ(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',hour:'numeric',minute:'2-digit'}).format(d);}
  const score=value=>Number(value||0).toFixed(2);

  function renderAlerts(p){
    const gameTarget=document.querySelector('[data-game-alerts]');
    const playerTarget=document.querySelector('[data-player-alerts]');
    const systemTarget=document.querySelector('[data-system-alerts]');
    if(!gameTarget||!playerTarget||!systemTarget)return;

    const alerts=Array.isArray(p.alerts)?p.alerts:[];
    const playerOrder={ZERO_PICK_PLAYERS:0,INCOMPLETE_PLAYERS:1};

    const playerAlerts=alerts
      .filter(a=>['ZERO_PICK_PLAYERS','INCOMPLETE_PLAYERS'].includes(String(a.code||'')))
      .sort((a,b)=>(playerOrder[String(a.code||'')]??99)-(playerOrder[String(b.code||'')]??99));

    const gameAlerts=alerts.filter(a=>String(a.code||'')==='UNUSUAL_KICKOFF');

    const byeTeams=Array.isArray(p.schedule?.bye_teams)
      ? p.schedule.bye_teams.filter(Boolean)
      : [];

    const systemAlerts=alerts.filter(a=>![
      'ZERO_PICK_PLAYERS',
      'INCOMPLETE_PLAYERS',
      'UNUSUAL_KICKOFF'
    ].includes(String(a.code||'')));

    const alertHtml=a=>{
      const l=String(a.level||'').toUpperCase();
      const cls=l==='OK'?'is-ok':l==='ERROR'?'is-error':'is-attention';
      const s=l==='OK'?'✓':l==='ERROR'?'✕':'⚠';
      return `<div class="commissioner-alert ${cls}"><span class="commissioner-alert-symbol">${s}</span><span>${escapeHtml(a.message)}</span></div>`;
    };

    const byeHtml=byeTeams.length
      ? `<div class="commissioner-alert commissioner-alert-byes">
          <span class="commissioner-alert-symbol">•</span>
          <span><strong>BYE TEAMS</strong> · ${escapeHtml(byeTeams.join(' · '))}</span>
        </div>`
      : '';

    gameTarget.innerHTML=gameAlerts.map(alertHtml).join('')+byeHtml;
    playerTarget.innerHTML=playerAlerts.map(alertHtml).join('');
    systemTarget.innerHTML=systemAlerts.map(alertHtml).join('');
    systemTarget.hidden=systemAlerts.length===0;
  }

  function renderWeek(p){
    const w=p.week_status||{};
    const cw=document.querySelector('[data-current-week]'); if(cw)cw.textContent=`Week ${p.week}`;
    const lr=document.querySelector('[data-last-refresh]'); if(lr)lr.textContent=`Loaded ${formatLocal(p.server_time_utc)}`;
    const ws=document.querySelector('[data-week-state]'); if(ws){ws.textContent=w.state||'Current';ws.className='status '+(w.state==='WEEK COMPLETE'?'status-final':w.state==='GAMES IN PROGRESS'?'status-live':'status-upcoming');}
    const m=document.querySelector('[data-week-metrics]'); if(m)m.innerHTML=[['Games',w.game_count],['Final',w.final_games],['Live',w.live_games],['Upcoming',w.upcoming_games]].map(x=>`<div class="commissioner-metric"><strong>${Number(x[1]||0)}</strong><span>${x[0]}</span></div>`).join('');
    const n=document.querySelector('[data-next-kickoff]'); if(n){const g=w.next_kickoff;n.innerHTML=g?`<p class="eyebrow">Next kickoff</p><strong>${escapeHtml(g.away_abbr)} @ ${escapeHtml(g.home_abbr)}</strong><br><span class="commissioner-muted">${escapeHtml(g.kickoff_arizona)}</span>`:'<p class="eyebrow">Next kickoff</p><span class="commissioner-muted">No upcoming games.</span>';}
  }

  function renderParticipation(p){
    const x=p.participation||{};
    const t=document.querySelector('[data-incomplete-players]');
    const playerCount=document.querySelector('[data-participation-player-count]');
    const completeCount=document.querySelector('[data-participation-complete-count]');
    const progress=document.querySelector('[data-participation-progress]');
    const progressTrack=document.querySelector('[data-participation-progress-track]');
    const progressFill=document.querySelector('[data-participation-progress-fill]');
    const progressPercent=document.querySelector('[data-participation-progress-percent]');

    const activePlayers=Math.max(0,Number(x.active_player_count||0));
    const completedPlayers=Math.max(0,Math.min(Number(x.complete_player_count||0),activePlayers));
    const percent=activePlayers?Math.round((completedPlayers/activePlayers)*100):0;

    if(playerCount){
      playerCount.textContent=`${activePlayers} Player${activePlayers===1?'':'s'}`;
    }

    if(completeCount){
      completeCount.textContent=String(completedPlayers);
    }

    if(progress){
      progress.style.setProperty('--participation-progress',`${percent}%`);
    }

    if(progressTrack){
      progressTrack.setAttribute('aria-valuenow',String(percent));
      progressTrack.setAttribute(
        'aria-valuetext',
        `${completedPlayers} of ${activePlayers} player cards complete`
      );
    }

    if(progressFill){
      progressFill.style.width=`${percent}%`;
    }

    if(progressPercent){
      progressPercent.textContent=`${percent}%`;
      progressPercent.hidden=percent===0;
    }

    if(!t)return;
    const rows=x.incomplete_players||[];
    t.innerHTML=rows.length?`<div class="commissioner-list">${rows.map(r=>`<div class="commissioner-list-row ${r.no_picks?'commissioner-zero-picks':''}"><div><strong>${escapeHtml(r.player_name)}</strong></div><span>${Number(r.completed_picks||0)}/${Number(r.total_games||0)} · ${Number(r.picks_remaining||0)} left</span></div>`).join('')}</div>`:'<div class="commissioner-empty">All active players have complete cards.</div>';
  }

  function renderSchedule(p){
    const x=p.schedule||{},sum=document.querySelector('[data-schedule-summary]'),bt=document.querySelector('[data-byes]'),t=document.querySelector('[data-schedule]');
    if(sum)sum.textContent=`${Number(x.game_count||0)} games · ${Number(x.bye_count||0)} BYE teams`;
    const byes=x.bye_teams||[]; if(bt)bt.innerHTML=byes.length?`<p class="eyebrow">BYE teams</p>${byes.map(v=>`<span class="commissioner-bye-chip">${escapeHtml(v)}</span>`).join('')}`:'<p class="commissioner-muted">No teams on BYE this week.</p>';
    if(!t)return; const games=x.games||[]; if(!games.length){t.innerHTML='<div class="commissioner-empty">No current-week games were found.</div>';return;}
    const groups=new Map();games.forEach(g=>{const d=g.game_day_arizona||'Schedule';if(!groups.has(d))groups.set(d,[]);groups.get(d).push(g);});
    t.innerHTML=Array.from(groups.entries()).map(([day,rows])=>`<section class="commissioner-day-group"><h3>${escapeHtml(day)}</h3>${rows.map(g=>`<div class="commissioner-game-row"><div class="commissioner-game-time">${escapeHtml(formatAZ(g.kickoff_utc))}</div><div class="commissioner-game-matchup"><strong>${escapeHtml(g.away_abbr)} @ ${escapeHtml(g.home_abbr)}</strong>${g.unusual_kickoff?`<div class="commissioner-unusual">⚠ ${escapeHtml(g.unusual_reason)}</div>`:''}</div><div class="commissioner-game-id"><span>Game ID ${escapeHtml(g.game_id)}</span></div></div>`).join('')}</section>`).join('');
  }

  function renderRank(selector,rows,value){
    const t=document.querySelector(selector); if(!t)return;
    t.innerHTML=rows.length?`<div class="commissioner-rank-list">${rows.map(r=>`<div class="commissioner-rank-row"><span class="commissioner-rank">${Number(r.rank||0)}</span><strong>${escapeHtml(r.player_name)}</strong><span class="commissioner-rank-value">${value(r)}</span></div>`).join('')}</div>`:'<div class="commissioner-empty">No data available yet.</div>';
  }

  function renderCompetition(p){
    renderRank('[data-live-top-five]',p.live_competition?.top_5||[],r=>`${Number(r.correct||0)}-${Number(r.incorrect||0)}${Number(r.pending||0)?` · ${Number(r.pending)} pending`:''}`);
    renderRank('[data-season-top-five]',p.season_snapshot?.top_5||[],r=>`${Number(r.weeks_won||0)} win${Number(r.weeks_won||0)===1?'':'s'} · ${Number(r.total_pick_points||0)} pts · ${score(r.season_score)}`);
  }

  function renderAround(p){
    const d=p.around_the_pool||{},t=document.querySelector('[data-around-pool]');if(!t)return;
    const b=d.best_weekly_score||[],w=d.most_weekly_wins||[],mp=d.most_pick_points||[],c=d.closest_tiebreaker||[];
    t.innerHTML=`<div class="commissioner-stat"><strong>${b[0]?`${Number(b[0].correct||0)}-${Number(b[0].incorrect||0)}`:'—'}</strong><span>Best Weekly Score</span><span>${b.length?escapeHtml(b.map(i=>`${i.player_name} · Week ${i.week}`).join(', ')):'No completed week yet'}</span></div><div class="commissioner-stat"><strong>${w[0]?Number(w[0].weeks_won||0):'—'}</strong><span>Most Weekly Wins</span><span>${w.length?escapeHtml(w.map(i=>i.player_name).join(', ')):'—'}</span></div><div class="commissioner-stat"><strong>${mp[0]?Number(mp[0].pick_points||0):'—'}</strong><span>Most Pick Points</span><span>${mp.length?escapeHtml(mp.map(i=>i.player_name).join(', ')):'—'}</span></div><div class="commissioner-stat"><strong>${c[0]?Number(c[0].difference||0):'—'}</strong><span>Closest Tiebreaker</span><span>${c[0]?escapeHtml(`${c[0].player_name} · Week ${c[0].week}`):'—'}</span></div>`;
  }

  function renderWinners(p){
    const t=document.querySelector('[data-weekly-winners]');if(!t)return;
    const rows=(p.weekly_winners||[])
      .slice()
      .sort((a,b)=>Number(a.week||0)-Number(b.week||0))
      .slice(-5);
    t.innerHTML=rows.length?`<div class="commissioner-list">${rows.map(r=>`<div class="commissioner-list-row"><div><strong>Week ${Number(r.week)} — ${escapeHtml(r.player_name)}</strong></div><span>${Number(r.correct||0)}-${Number(r.incorrect||0)}</span></div>`).join('')}</div>`:'<div class="commissioner-empty">No weekly winners have been graded yet.</div>';
  }

  function renderHealth(p){
    const t=document.querySelector('[data-system-health]');if(!t)return;

    const h=p.system_health||{};
    const w=p.week_status||{};
    const schedule=p.schedule||{};
    const games=Array.isArray(schedule.games)?schedule.games:[];
    const controllerInstalled=!!h.automation_controller_installed;
    const legacyAbsent=!h.legacy_score_sync_trigger_present;

    const validGameCount=games.filter(game=>String(game.game_id||'').trim()).length;
    const scheduleHealthy=Number(schedule.game_count||0)>0 &&
      validGameCount===Number(schedule.game_count||0);

    const relativeMinutes=value=>{
      if(!value)return null;
      const d=new Date(value);
      if(Number.isNaN(d.getTime()))return null;
      return Math.max(0,Math.round((Date.now()-d.getTime())/60000));
    };

    const ageLabel=minutes=>{
      if(minutes===null)return '';
      if(minutes<1)return 'just now';
      if(minutes===1)return '1 min ago';
      if(minutes<60)return `${minutes} min ago`;
      const hours=Math.round(minutes/60);
      return `${hours} hr${hours===1?'':'s'} ago`;
    };

    let controllerText=controllerInstalled?'✓ Trigger installed':'✕ Missing';
    let controllerClass=controllerInstalled?'commissioner-health-ok':'commissioner-health-warning';
    const controllerAge=relativeMinutes(h.automation_controller_last_run_utc);

    if(controllerInstalled && controllerAge!==null){
      if(controllerAge<=30){
        controllerText=`✓ Healthy · ${ageLabel(controllerAge)}`;
        controllerClass='commissioner-health-ok';
      }else{
        controllerText=`⚠ Last check ${ageLabel(controllerAge)}`;
        controllerClass='commissioner-health-warning';
      }
    }else if(controllerInstalled){
      controllerText='Trigger installed · heartbeat pending';
      controllerClass='';
    }

    let feedText='Awaiting first instrumented sync';
    let feedClass='';
    const feed=h.nfl_data_feed||{};

    if(feed.last_error_utc){
      const errorAge=relativeMinutes(feed.last_error_utc);
      const statusMatch=String(feed.last_error_message||'').match(/Status:\s*(\d{3})/i);
      const statusText=statusMatch?` · HTTP ${statusMatch[1]}`:'';
      feedText=`⚠ Failed ${ageLabel(errorAge)}${statusText}`;
      feedClass='commissioner-health-warning';
    }else if(feed.last_success_utc){
      const successAge=relativeMinutes(feed.last_success_utc);
      feedText=`✓ Last sync successful · ${ageLabel(successAge)}`;
      feedClass='commissioner-health-ok';
    }

    let freshnessText='Not available';
    let freshnessClass='';
    if(h.last_score_sync_utc){
      const lastUpdate=new Date(h.last_score_sync_utc);
      const ageMinutes=(Date.now()-lastUpdate.getTime())/60000;

      if(Number(w.live_games||0)>0){
        if(ageMinutes<=5){
          freshnessText=`✓ Current · ${formatLocal(h.last_score_sync_utc)}`;
          freshnessClass='commissioner-health-ok';
        }else{
          freshnessText=`⚠ Stale · ${formatLocal(h.last_score_sync_utc)}`;
          freshnessClass='commissioner-health-warning';
        }
      }else{
        freshnessText=`Idle · Last update ${formatLocal(h.last_score_sync_utc)}`;
      }
    }

    let rolloverText='Not available';
    let rolloverClass='';
    if(h.last_rollover?.timestamp_utc){
      const priorWeek=Math.max(1,Number(p.week||0)-1);
      rolloverText=`✓ Week ${priorWeek} → Week ${Number(p.week||0)} · ${formatLocal(h.last_rollover.timestamp_utc)}`;
      rolloverClass='commissioner-health-ok';
    }

    let responseText='Not measured';
    let responseClass='';
    if(Number.isFinite(lastDashboardResponseMs)){
      const seconds=lastDashboardResponseMs/1000;
      if(seconds<3){
        responseText=`✓ ${seconds.toFixed(1)} sec`;
        responseClass='commissioner-health-ok';
      }else if(seconds<=6){
        responseText=`${seconds.toFixed(1)} sec`;
      }else{
        responseText=`⚠ ${seconds.toFixed(1)} sec`;
        responseClass='commissioner-health-warning';
      }
    }

    t.innerHTML=`
      <div class="commissioner-health-row">
        <div><strong>Automation Controller</strong></div>
        <span class="${controllerClass}">${escapeHtml(controllerText)}</span>
      </div>
      <div class="commissioner-health-row">
        <div><strong>Live Score Sync</strong></div>
        <span>${h.live_score_sync_active?'Active':'Idle'}</span>
      </div>
      <div class="commissioner-health-row commissioner-health-row-feed">
        <div><strong>NFL Data Feed</strong></div>
        <span class="${feedClass}">${escapeHtml(feedText)}</span>
        ${feed.last_error_message?`
          <details class="commissioner-health-details">
            <summary>Details</summary>
            <div>${escapeHtml(feed.last_error_message)}</div>
          </details>
        `:''}
      </div>
      <div class="commissioner-health-row">
        <div><strong>Score Data Freshness</strong></div>
        <span class="${freshnessClass}">${escapeHtml(freshnessText)}</span>
      </div>
      <div class="commissioner-health-row">
        <div><strong>Current Week Schedule</strong></div>
        <span class="${scheduleHealthy?'commissioner-health-ok':'commissioner-health-warning'}">${scheduleHealthy?`✓ ${validGameCount}/${Number(schedule.game_count||0)} games valid`:`⚠ ${validGameCount}/${Number(schedule.game_count||0)} games valid`}</span>
      </div>
      <div class="commissioner-health-row">
        <div><strong>Last Weekly Rollover</strong></div>
        <span class="${rolloverClass}">${escapeHtml(rolloverText)}</span>
      </div>
      <div class="commissioner-health-row">
        <div><strong>Admin API Response</strong></div>
        <span class="${responseClass}">${escapeHtml(responseText)}</span>
      </div>
      <div class="commissioner-health-row">
        <div><strong>Legacy 5-Min Sync Trigger</strong></div>
        <span class="${legacyAbsent?'commissioner-health-ok':'commissioner-health-warning'}">${legacyAbsent?'✓ Not present':'⚠ Present'}</span>
      </div>
    `;
  }

  function renderActivity(p){
    const t=document.querySelector('[data-recent-activity]');if(!t)return;const rows=p.recent_commissioner_activity||[];
    t.innerHTML=rows.length?rows.map(r=>`<div class="commissioner-activity-row"><div><strong>${escapeHtml(String(r.action||'').replaceAll('_',' '))}</strong><small>${escapeHtml(r.details||r.entity_id||'')}</small></div><small>${r.timestamp_utc?escapeHtml(formatLocal(r.timestamp_utc)):''}</small></div>`).join(''):'<div class="commissioner-empty">No recent Commissioner activity.</div>';
  }

  function selectedOverrideGame(){
    if(!dashboardData||!overrideGame)return null;
    const games=dashboardData.schedule?.games||[];
    return games.find(game=>String(game.game_id)===String(overrideGame.value))||null;
  }

  function selectedOverridePlayer(){
    if(!dashboardData||!overridePlayer)return null;
    const players=dashboardData.participation?.players||[];
    return players.find(player=>String(player.player_id)===String(overridePlayer.value))||null;
  }

  function selectedOverridePick(){
    const checked=document.querySelector('input[name="commissioner-override-pick"]:checked');
    return checked?checked.value:'';
  }

  function updateOverrideButtonState(){
    if(!previewOverrideButton)return;
    previewOverrideButton.disabled=!(
      overridePlayer?.value &&
      overrideGame?.value &&
      selectedOverridePick() &&
      overrideReason?.value.trim()
    );
  }

  function renderOverrideGame(){
    const game=selectedOverrideGame();

    if(!game){
      if(overrideGameReference)overrideGameReference.hidden=true;
      if(overrideGameId)overrideGameId.textContent='—';
      if(overridePickFieldset)overridePickFieldset.disabled=true;
      if(overridePickOptions)overridePickOptions.innerHTML='<span class="commissioner-muted">Choose a game first.</span>';
      updateOverrideButtonState();
      return;
    }

    if(overrideGameReference)overrideGameReference.hidden=false;
    if(overrideGameId)overrideGameId.textContent=game.game_id;
    if(overridePickFieldset)overridePickFieldset.disabled=false;

    if(overridePickOptions){
      const teams=[
        {abbr:game.away_abbr,label:`${game.away_abbr} — ${game.away_team||game.away_abbr}`},
        {abbr:game.home_abbr,label:`${game.home_abbr} — ${game.home_team||game.home_abbr}`}
      ];

      overridePickOptions.innerHTML=teams.map((team,index)=>`
        <div class="commissioner-pick-choice">
          <input
            id="commissioner-pick-${index}"
            type="radio"
            name="commissioner-override-pick"
            value="${escapeHtml(team.abbr)}"
          >
          <label for="commissioner-pick-${index}">${escapeHtml(team.label)}</label>
        </div>
      `).join('');

      overridePickOptions.querySelectorAll('input').forEach(input=>{
        input.addEventListener('change',updateOverrideButtonState);
      });
    }

    updateOverrideButtonState();
  }

  function renderPickOverride(p){
    dashboardData=p;
    if(!overridePlayer||!overrideGame)return;

    const currentPlayer=overridePlayer.value;
    const currentGame=overrideGame.value;

    const players=(p.participation?.players||[])
      .slice()
      .sort((a,b)=>String(a.player_name||'').localeCompare(String(b.player_name||'')));

    overridePlayer.innerHTML='<option value="">Choose player…</option>'+
      players.map(player=>`<option value="${escapeHtml(player.player_id)}">${escapeHtml(player.player_name)}</option>`).join('');

    const games=(p.schedule?.games||[]).slice();
    overrideGame.innerHTML='<option value="">Choose game…</option>'+
      games.map(game=>`<option value="${escapeHtml(game.game_id)}">${escapeHtml(game.game_day_arizona)} · ${escapeHtml(formatAZ(game.kickoff_utc))} · ${escapeHtml(game.away_abbr)} @ ${escapeHtml(game.home_abbr)}</option>`).join('');

    if(players.some(player=>String(player.player_id)===currentPlayer))overridePlayer.value=currentPlayer;
    if(games.some(game=>String(game.game_id)===currentGame))overrideGame.value=currentGame;

    renderOverrideGame();

    if(lastOverrideResult&&overrideSuccess){
      overrideSuccess.hidden=false;
      overrideSuccess.innerHTML=`
        <strong>Override completed</strong>
        ${escapeHtml(lastOverrideResult.player_name)} ·
        ${escapeHtml(lastOverrideResult.away_team)} @ ${escapeHtml(lastOverrideResult.home_team)} ·
        Pick: ${escapeHtml(lastOverrideResult.pick_team)}
      `;
    }
  }

  function previewPickOverride(event){
    event.preventDefault();

    const player=selectedOverridePlayer();
    const game=selectedOverrideGame();
    const pick=selectedOverridePick();
    const reason=overrideReason?.value.trim()||'';

    if(!player||!game||!pick||!reason){
      if(overrideMessage)overrideMessage.textContent='Complete all Pick Override fields first.';
      updateOverrideButtonState();
      return;
    }

    pendingOverride={
      player_id:player.player_id,
      player_name:player.player_name,
      game_id:String(game.game_id),
      away_team:game.away_abbr,
      home_team:game.home_abbr,
      kickoff_arizona:game.kickoff_arizona,
      pick_team:pick,
      reason
    };

    if(overrideMessage)overrideMessage.textContent='';

    if(overridePreview){
      overridePreview.innerHTML=`
        <div class="commissioner-confirm-line"><span>Player</span><strong>${escapeHtml(player.player_name)}</strong></div>
        <div class="commissioner-confirm-line"><span>Week</span><strong>Week ${Number(dashboardData.week||0)}</strong></div>
        <div class="commissioner-confirm-line"><span>Game</span><strong>${escapeHtml(game.away_abbr)} @ ${escapeHtml(game.home_abbr)}</strong></div>
        <div class="commissioner-confirm-line"><span>Kickoff</span><strong>${escapeHtml(game.kickoff_arizona||'')}</strong></div>
        <div class="commissioner-confirm-line"><span>Game ID</span><strong>${escapeHtml(game.game_id)}</strong></div>
        <div class="commissioner-confirm-line"><span>Pick</span><strong>${escapeHtml(pick)}</strong></div>
        <div class="commissioner-confirm-line"><span>Reason</span><strong>${escapeHtml(reason)}</strong></div>
        <div class="commissioner-confirm-line"><span>Requested by</span><strong>JohnC</strong></div>
      `;
    }

    if(overrideDialog?.showModal)overrideDialog.showModal();
  }

  async function confirmPickOverride(){
    if(!pendingOverride)return;

    const token=getSessionToken();
    if(!token){showLogin();return;}

    if(confirmOverrideButton){
      confirmOverrideButton.disabled=true;
      confirmOverrideButton.textContent='Saving Override…';
    }

    try{
      const result=await postJson({
        action:'runCommissionerAction',
        action_type:'PICK_OVERRIDE',
        session_token:token,
        player_id:pendingOverride.player_id,
        game_id:pendingOverride.game_id,
        pick_team:pendingOverride.pick_team,
        reason:pendingOverride.reason
      });

      lastOverrideResult=result;
      pendingOverride=null;

      if(overrideDialog?.open)overrideDialog.close();
      if(overrideForm)overrideForm.reset();
      if(overrideGameReference)overrideGameReference.hidden=true;
      if(overridePickFieldset)overridePickFieldset.disabled=true;
      if(overridePickOptions)overridePickOptions.innerHTML='<span class="commissioner-muted">Choose a game first.</span>';

      await loadDashboard();
    }catch(error){
      if(overrideDialog?.open)overrideDialog.close();

      if(
        ['COMMISSIONER_SESSION_REQUIRED','INVALID_COMMISSIONER_SESSION','COMMISSIONER_SESSION_EXPIRED']
          .includes(error.code)
      ){
        clearSessionToken();
        showLogin();
        if(loginMessage)loginMessage.textContent=error.message;
      }else if(overrideMessage){
        overrideMessage.textContent=error.message;
      }
    }finally{
      if(confirmOverrideButton){
        confirmOverrideButton.disabled=false;
        confirmOverrideButton.textContent='Confirm Override';
      }
      updateOverrideButtonState();
    }
  }

  function renderDashboard(p){dashboardData=p;renderAlerts(p);renderWeek(p);renderParticipation(p);renderSchedule(p);renderCompetition(p);renderAround(p);renderWinners(p);renderHealth(p);renderActivity(p);renderPickOverride(p);showDashboard();}

  async function loadDashboard(){
    const token=getSessionToken();if(!token){showLogin();return;}
    if(refreshButton){refreshButton.disabled=true;refreshButton.textContent='Refreshing…';}
    const started=performance.now();
    try{
      const payload=await postJson({action:'getCommissionerDashboard',session_token:token});
      lastDashboardResponseMs=performance.now()-started;
      renderDashboard(payload);
    }
    catch(e){if(['COMMISSIONER_SESSION_REQUIRED','INVALID_COMMISSIONER_SESSION','COMMISSIONER_SESSION_EXPIRED'].includes(e.code)){clearSessionToken();showLogin();if(loginMessage)loginMessage.textContent=e.message;}else showFatal(e.message);}
    finally{if(refreshButton){refreshButton.disabled=false;refreshButton.textContent='Refresh Dashboard';}}
  }

  async function login(event){
    event.preventDefault();const password=passwordInput?passwordInput.value:'';
    if(!password){if(loginMessage)loginMessage.textContent='Enter the Commissioner password.';return;}
    if(loginButton){loginButton.disabled=true;loginButton.textContent='Signing In…';}if(loginMessage)loginMessage.textContent='';
    try{const r=await postJson({action:'commissionerLogin',password});saveSessionToken(r.session_token);if(passwordInput)passwordInput.value='';await loadDashboard();}
    catch(e){if(loginMessage)loginMessage.textContent=e.message;}
    finally{if(loginButton){loginButton.disabled=false;loginButton.textContent='Sign In';}}
  }

  async function logout(){const token=getSessionToken();clearSessionToken();if(token){try{await postJson({action:'commissionerLogout',session_token:token});}catch(e){}}showLogin();}

  if(loginForm)loginForm.addEventListener('submit',login);
  if(refreshButton)refreshButton.addEventListener('click',loadDashboard);
  if(logoutButton)logoutButton.addEventListener('click',logout);
  if(returnLoginButton)returnLoginButton.addEventListener('click',()=>{clearSessionToken();showLogin();});

  if(overrideForm)overrideForm.addEventListener('submit',previewPickOverride);
  if(overridePlayer)overridePlayer.addEventListener('change',updateOverrideButtonState);
  if(overrideGame)overrideGame.addEventListener('change',renderOverrideGame);
  if(overrideReason)overrideReason.addEventListener('input',updateOverrideButtonState);

  if(copyOverrideGameId){
    copyOverrideGameId.addEventListener('click',async()=>{
      const game=selectedOverrideGame();
      if(!game)return;
      try{
        await navigator.clipboard.writeText(String(game.game_id));
        const original=copyOverrideGameId.textContent;
        copyOverrideGameId.textContent='Copied';
        setTimeout(()=>copyOverrideGameId.textContent=original,1200);
      }catch(error){
        window.prompt('Copy Game ID:',String(game.game_id));
      }
    });
  }

  if(cancelOverrideButton){
    cancelOverrideButton.addEventListener('click',()=>{
      pendingOverride=null;
      if(overrideDialog?.open)overrideDialog.close();
    });
  }

  if(confirmOverrideButton)confirmOverrideButton.addEventListener('click',confirmPickOverride);

  if(overrideDialog){
    overrideDialog.addEventListener('cancel',()=>{pendingOverride=null;});
  }

  if(getSessionToken())loadDashboard();else showLogin();
})();
