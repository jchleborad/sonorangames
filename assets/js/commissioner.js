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
    const t=document.querySelector('[data-alerts]'); if(!t)return;
    t.innerHTML=(p.alerts||[]).map(a=>{const l=String(a.level||'').toUpperCase();const cls=l==='OK'?'is-ok':l==='ERROR'?'is-error':'is-attention';const s=l==='OK'?'✓':l==='ERROR'?'✕':'⚠';return `<div class="commissioner-alert ${cls}"><span class="commissioner-alert-symbol">${s}</span><span>${escapeHtml(a.message)}</span></div>`;}).join('');
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
    const x=p.participation||{},s=document.querySelector('[data-participation-summary]'),t=document.querySelector('[data-incomplete-players]');
    if(s)s.textContent=`${Number(x.complete_player_count||0)}/${Number(x.active_player_count||0)}`;
    if(!t)return; const rows=x.incomplete_players||[];
    t.innerHTML=rows.length?`<div class="commissioner-list">${rows.map(r=>`<div class="commissioner-list-row ${r.no_picks?'commissioner-zero-picks':''}"><div><strong>${escapeHtml(r.player_name)}</strong></div><span>${Number(r.completed_picks||0)}/${Number(r.total_games||0)} · ${Number(r.picks_remaining||0)} left</span></div>`).join('')}</div>`:'<div class="commissioner-empty">All active players have complete cards.</div>';
  }

  function renderSchedule(p){
    const x=p.schedule||{},sum=document.querySelector('[data-schedule-summary]'),bt=document.querySelector('[data-byes]'),t=document.querySelector('[data-schedule]');
    if(sum)sum.textContent=`${Number(x.game_count||0)} games · ${Number(x.bye_count||0)} BYE teams`;
    const byes=x.bye_teams||[]; if(bt)bt.innerHTML=byes.length?`<p class="eyebrow">BYE teams</p>${byes.map(v=>`<span class="commissioner-bye-chip">${escapeHtml(v)}</span>`).join('')}`:'<p class="commissioner-muted">No teams on BYE this week.</p>';
    if(!t)return; const games=x.games||[]; if(!games.length){t.innerHTML='<div class="commissioner-empty">No current-week games were found.</div>';return;}
    const groups=new Map();games.forEach(g=>{const d=g.game_day_arizona||'Schedule';if(!groups.has(d))groups.set(d,[]);groups.get(d).push(g);});
    t.innerHTML=Array.from(groups.entries()).map(([day,rows])=>`<section class="commissioner-day-group"><h3>${escapeHtml(day)}</h3>${rows.map(g=>`<div class="commissioner-game-row"><div class="commissioner-game-time">${escapeHtml(formatAZ(g.kickoff_utc))}</div><div class="commissioner-game-matchup"><strong>${escapeHtml(g.away_abbr)} @ ${escapeHtml(g.home_abbr)}</strong>${g.unusual_kickoff?`<div class="commissioner-unusual">⚠ ${escapeHtml(g.unusual_reason)}</div>`:''}</div><div class="commissioner-game-id"><span>${escapeHtml(g.game_id)}</span><button class="commissioner-copy-button" type="button" data-copy-game-id="${escapeHtml(g.game_id)}">Copy</button></div></div>`).join('')}</section>`).join('');
    t.querySelectorAll('[data-copy-game-id]').forEach(b=>b.addEventListener('click',async()=>{const v=b.dataset.copyGameId||'';try{await navigator.clipboard.writeText(v);const o=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=o,1200);}catch(e){prompt('Copy Game ID:',v);}}));
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
    t.innerHTML=`<div class="commissioner-stat"><strong>${b[0]?`${Number(b[0].correct||0)}-${Number(b[0].incorrect||0)}`:'—'}</strong><span>Best Weekly Score</span><span>${b.length?escapeHtml(b.map(i=>`${i.player_name} · W${i.week}`).join(', ')):'No completed week yet'}</span></div><div class="commissioner-stat"><strong>${w[0]?Number(w[0].weeks_won||0):'—'}</strong><span>Most Weekly Wins</span><span>${w.length?escapeHtml(w.map(i=>i.player_name).join(', ')):'—'}</span></div><div class="commissioner-stat"><strong>${mp[0]?Number(mp[0].pick_points||0):'—'}</strong><span>Most Pick Points</span><span>${mp.length?escapeHtml(mp.map(i=>i.player_name).join(', ')):'—'}</span></div><div class="commissioner-stat"><strong>${c[0]?Number(c[0].difference||0):'—'}</strong><span>Closest Tiebreaker</span><span>${c[0]?escapeHtml(`${c[0].player_name} · Week ${c[0].week}`):'—'}</span></div>`;
  }

  function renderWinners(p){
    const t=document.querySelector('[data-weekly-winners]');if(!t)return;const rows=p.weekly_winners||[];
    t.innerHTML=rows.length?`<div class="commissioner-list">${rows.map(r=>`<div class="commissioner-list-row"><div><strong>Week ${Number(r.week)} — ${escapeHtml(r.player_name)}</strong></div><span>${Number(r.correct||0)}-${Number(r.incorrect||0)}</span></div>`).join('')}</div>`:'<div class="commissioner-empty">No weekly winners have been graded yet.</div>';
  }

  function renderHealth(p){
    const t=document.querySelector('[data-system-health]');if(!t)return;const h=p.system_health||{},r=h.rollover_status||{},a=!!h.automation_controller_installed,l=!h.legacy_score_sync_trigger_present;
    t.innerHTML=`<div class="commissioner-health-row"><div><strong>Automation Controller</strong></div><span class="${a?'commissioner-health-ok':'commissioner-health-warning'}">${a?'✓ Healthy':'✕ Missing'}</span></div><div class="commissioner-health-row"><div><strong>Live Score Sync</strong></div><span>${h.live_score_sync_active?'Active':'Idle'}</span></div><div class="commissioner-health-row"><div><strong>Legacy Score Trigger</strong></div><span class="${l?'commissioner-health-ok':'commissioner-health-warning'}">${l?'✓ Not present':'⚠ Present'}</span></div><div class="commissioner-health-row"><div><strong>Last Stored Score Update</strong></div><span>${h.last_score_sync_utc?escapeHtml(formatLocal(h.last_score_sync_utc)):'Not available'}</span></div><div class="commissioner-health-row"><div><strong>Rollover Ready</strong></div><span>${r.ready_to_roll===true?'Yes':'No'}</span></div>`;
  }

  function renderActivity(p){
    const t=document.querySelector('[data-recent-activity]');if(!t)return;const rows=p.recent_commissioner_activity||[];
    t.innerHTML=rows.length?rows.map(r=>`<div class="commissioner-activity-row"><div><strong>${escapeHtml(String(r.action||'').replaceAll('_',' '))}</strong><small>${escapeHtml(r.details||r.entity_id||'')}</small></div><small>${r.timestamp_utc?escapeHtml(formatLocal(r.timestamp_utc)):''}</small></div>`).join(''):'<div class="commissioner-empty">No recent Commissioner activity.</div>';
  }

  function renderDashboard(p){renderAlerts(p);renderWeek(p);renderParticipation(p);renderSchedule(p);renderCompetition(p);renderAround(p);renderWinners(p);renderHealth(p);renderActivity(p);showDashboard();}

  async function loadDashboard(){
    const token=getSessionToken();if(!token){showLogin();return;}
    if(refreshButton){refreshButton.disabled=true;refreshButton.textContent='Refreshing…';}
    try{renderDashboard(await postJson({action:'getCommissionerDashboard',session_token:token}));}
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

  if(getSessionToken())loadDashboard();else showLogin();
})();
