/* ===================================================
   Pip's Orchard — shared progress logic
   Keeps to-do tasks, daily reset, and streak in sync
   between index.html and tracker.html via localStorage.
=================================================== */

// ---------- PWA: register the service worker ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  });
}

// ---------- PWA: install button ----------
let pipDeferredInstallPrompt = null;

function pipIsStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function pipIsIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  pipDeferredInstallPrompt = e;
  document.querySelectorAll('.install-btn').forEach(b => b.style.display = 'inline-flex');
});

window.addEventListener('appinstalled', ()=>{
  pipDeferredInstallPrompt = null;
  document.querySelectorAll('.install-btn').forEach(b => b.style.display = 'none');
});

function pipInitInstallButton(){
  const btns = document.querySelectorAll('.install-btn');
  if(!btns.length || pipIsStandalone()) return;

  if(pipIsIOS()){
    btns.forEach(b => b.style.display = 'inline-flex');
  }

  btns.forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(pipDeferredInstallPrompt){
        pipDeferredInstallPrompt.prompt();
        await pipDeferredInstallPrompt.userChoice;
        pipDeferredInstallPrompt = null;
        btns.forEach(b => b.style.display = 'none');
      } else if(pipIsIOS()){
        alert("На iPhone / iPad:\n1. Натисніть кнопку «Поділитися» ⬆️ внизу екрана Safari\n2. Оберіть «На екран «Домой»»");
      } else {
        alert("Відкрийте меню браузера (⋮) і оберіть «Встановити застосунок» або «Додати на головний екран».");
      }
    });
  });
}
const PIP_TODOS_KEY   = 'pipTodos';
const PIP_STREAK_KEY  = 'pipStreak';
const PIP_LAST_DONE   = 'pipLastCompleteDate';
const PIP_LAST_OPEN   = 'pipLastOpenDate';
const PIP_WEATHER_KEY = 'pipWeather';

const PIP_DEFAULT_TODOS = [
  { text: 'Water the flowers 🌸', done: false },
  { text: 'Practice the ABC song 🔤', done: false },
  { text: 'Feed the cat 🐱', done: false },
  { text: 'Count to 10 in English 🔢', done: false }
];

function pipToday(){
  return new Date().toISOString().slice(0,10);
}

function pipLoadTodos(){
  const raw = localStorage.getItem(PIP_TODOS_KEY);
  if(!raw) return PIP_DEFAULT_TODOS.map(t => ({...t}));
  try{
    const parsed = JSON.parse(raw);
    if(Array.isArray(parsed) && parsed.length) return parsed;
  } catch(e){}
  return PIP_DEFAULT_TODOS.map(t => ({...t}));
}

function pipSaveTodos(todos){
  localStorage.setItem(PIP_TODOS_KEY, JSON.stringify(todos));
}

/* Call once per page load: if it's a new day since the user last opened
   the site, mark all tasks as not-done again (fresh daily list). */
function pipCheckDailyReset(){
  const today = pipToday();
  const lastOpen = localStorage.getItem(PIP_LAST_OPEN);
  if(lastOpen !== today){
    const todos = pipLoadTodos().map(t => ({...t, done:false}));
    pipSaveTodos(todos);
    localStorage.setItem(PIP_LAST_OPEN, today);
  }
}

function pipGetStreak(){
  return parseInt(localStorage.getItem(PIP_STREAK_KEY) || '0', 10);
}

/* Call whenever a task gets checked. Increases the streak once per day:
   +1 if the last completed day was yesterday, resets to 1 otherwise. */
function pipBumpStreak(){
  const today = pipToday();
  const lastDone = localStorage.getItem(PIP_LAST_DONE);
  if(lastDone === today) return pipGetStreak();

  let streak = pipGetStreak();
  if(lastDone){
    const diffDays = Math.round((new Date(today) - new Date(lastDone)) / 86400000);
    streak = (diffDays === 1) ? streak + 1 : 1;
  } else {
    streak = 1;
  }
  localStorage.setItem(PIP_STREAK_KEY, String(streak));
  localStorage.setItem(PIP_LAST_DONE, today);
  pipUpdateBestStreak();
  return streak;
}

function pipDoneCount(todos){
  return todos.filter(t => t.done).length;
}

function pipSaveWeather(icon, temp, word){
  localStorage.setItem(PIP_WEATHER_KEY, JSON.stringify({icon, temp, word}));
}

function pipLoadWeather(){
  const raw = localStorage.getItem(PIP_WEATHER_KEY);
  if(!raw) return { icon:'☀️', temp:'24°C', word:'Sunny' };
  try{ return JSON.parse(raw); } catch(e){ return { icon:'☀️', temp:'24°C', word:'Sunny' }; }
}

/* ===================================================
   Achievements / badges
   All underlying stats only ever grow (or, for streak,
   we track the best-ever value) so a badge, once earned,
   stays earned even if today's tasks reset.
=================================================== */
const PIP_LIFETIME_TASKS_KEY = 'pipLifetimeTasks';
const PIP_BEST_STREAK_KEY    = 'pipBestStreak';
const PIP_LETTERS_SEEN_KEY   = 'pipLettersSeen';
const PIP_NUMBERS_SEEN_KEY   = 'pipNumbersSeen';
const PIP_MATCH_BEST_KEY     = 'pipMatchBest';
const PIP_CLOCK_BEST_KEY     = 'pipClockBest';
const PIP_FULL_BASKET_KEY    = 'pipFullBasket';
const PIP_ANNOUNCED_KEY      = 'pipAnnouncedBadges';

function pipRecordTaskDone(){
  const n = parseInt(localStorage.getItem(PIP_LIFETIME_TASKS_KEY) || '0', 10);
  localStorage.setItem(PIP_LIFETIME_TASKS_KEY, String(n + 1));
}

function pipRecordBasketState(doneCount, total){
  if(total > 0 && doneCount === total){
    localStorage.setItem(PIP_FULL_BASKET_KEY, '1');
  }
}

function pipLoadSet(key){
  try{
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  }catch(e){ return []; }
}

function pipMarkLetterSeen(letter){
  const seen = new Set(pipLoadSet(PIP_LETTERS_SEEN_KEY));
  seen.add(letter);
  localStorage.setItem(PIP_LETTERS_SEEN_KEY, JSON.stringify([...seen]));
}
function pipLettersSeenCount(){ return pipLoadSet(PIP_LETTERS_SEEN_KEY).length; }

function pipMarkNumberSeen(n){
  const seen = new Set(pipLoadSet(PIP_NUMBERS_SEEN_KEY));
  seen.add(n);
  localStorage.setItem(PIP_NUMBERS_SEEN_KEY, JSON.stringify([...seen]));
}
function pipNumbersSeenCount(){ return pipLoadSet(PIP_NUMBERS_SEEN_KEY).length; }

function pipUpdateBest(key, score){
  const best = parseInt(localStorage.getItem(key) || '0', 10);
  if(score > best) localStorage.setItem(key, String(score));
}
function pipGetBest(key){ return parseInt(localStorage.getItem(key) || '0', 10); }

/* Call this right after pipBumpStreak() so the all-time best streak
   is remembered even after the current streak later resets. */
function pipUpdateBestStreak(){
  const cur = pipGetStreak();
  const best = parseInt(localStorage.getItem(PIP_BEST_STREAK_KEY) || '0', 10);
  if(cur > best) localStorage.setItem(PIP_BEST_STREAK_KEY, String(cur));
}

function pipGetStats(){
  return {
    lifetimeTasks: parseInt(localStorage.getItem(PIP_LIFETIME_TASKS_KEY) || '0', 10),
    bestStreak:    parseInt(localStorage.getItem(PIP_BEST_STREAK_KEY) || '0', 10),
    lettersSeen:   pipLettersSeenCount(),
    numbersSeen:   pipNumbersSeenCount(),
    matchBest:     pipGetBest(PIP_MATCH_BEST_KEY),
    clockBest:     pipGetBest(PIP_CLOCK_BEST_KEY),
    fullBasket:    localStorage.getItem(PIP_FULL_BASKET_KEY) === '1',
    greetingsSeen: pipGreetingsSeenCount(),
    emoBest:       pipGetBest(PIP_EMO_BEST_KEY),
    colorsSeen:    pipColorsSeenCount(),
    shapesSeen:    pipShapesSeenCount(),
    colorQuizBest: pipGetBest(PIP_COLOR_QUIZ_BEST_KEY),
    animalsSeen:   pipAnimalsSeenCount(),
    animalQuizBest: pipGetBest(PIP_ANIMAL_QUIZ_BEST_KEY),
    daysSeen:      pipDaysSeenCount(),
    monthsSeen:    pipMonthsSeenCount(),
    calQuizBest:   pipGetBest(PIP_CAL_QUIZ_BEST_KEY)
  };
}

const PIP_GREETINGS_SEEN_KEY = 'pipGreetingsSeen';
const PIP_EMO_BEST_KEY       = 'pipEmoBest';
const PIP_COLORS_SEEN_KEY    = 'pipColorsSeen';
const PIP_SHAPES_SEEN_KEY    = 'pipShapesSeen';
const PIP_COLOR_QUIZ_BEST_KEY = 'pipColorQuizBest';
const PIP_ANIMALS_SEEN_KEY   = 'pipAnimalsSeen';
const PIP_ANIMAL_QUIZ_BEST_KEY = 'pipAnimalQuizBest';
const PIP_DAYS_SEEN_KEY      = 'pipDaysSeen';
const PIP_MONTHS_SEEN_KEY    = 'pipMonthsSeen';
const PIP_CAL_QUIZ_BEST_KEY  = 'pipCalQuizBest';

function pipMarkGreetingSeen(phrase){
  const seen = new Set(pipLoadSet(PIP_GREETINGS_SEEN_KEY));
  seen.add(phrase);
  localStorage.setItem(PIP_GREETINGS_SEEN_KEY, JSON.stringify([...seen]));
}
function pipGreetingsSeenCount(){ return pipLoadSet(PIP_GREETINGS_SEEN_KEY).length; }

function pipMarkColorSeen(name){
  const seen = new Set(pipLoadSet(PIP_COLORS_SEEN_KEY));
  seen.add(name);
  localStorage.setItem(PIP_COLORS_SEEN_KEY, JSON.stringify([...seen]));
}
function pipColorsSeenCount(){ return pipLoadSet(PIP_COLORS_SEEN_KEY).length; }

function pipMarkShapeSeen(name){
  const seen = new Set(pipLoadSet(PIP_SHAPES_SEEN_KEY));
  seen.add(name);
  localStorage.setItem(PIP_SHAPES_SEEN_KEY, JSON.stringify([...seen]));
}
function pipShapesSeenCount(){ return pipLoadSet(PIP_SHAPES_SEEN_KEY).length; }

function pipMarkAnimalSeen(name){
  const seen = new Set(pipLoadSet(PIP_ANIMALS_SEEN_KEY));
  seen.add(name);
  localStorage.setItem(PIP_ANIMALS_SEEN_KEY, JSON.stringify([...seen]));
}
function pipAnimalsSeenCount(){ return pipLoadSet(PIP_ANIMALS_SEEN_KEY).length; }

function pipMarkDaySeen(name){
  const seen = new Set(pipLoadSet(PIP_DAYS_SEEN_KEY));
  seen.add(name);
  localStorage.setItem(PIP_DAYS_SEEN_KEY, JSON.stringify([...seen]));
}
function pipDaysSeenCount(){ return pipLoadSet(PIP_DAYS_SEEN_KEY).length; }

function pipMarkMonthSeen(name){
  const seen = new Set(pipLoadSet(PIP_MONTHS_SEEN_KEY));
  seen.add(name);
  localStorage.setItem(PIP_MONTHS_SEEN_KEY, JSON.stringify([...seen]));
}
function pipMonthsSeenCount(){ return pipLoadSet(PIP_MONTHS_SEEN_KEY).length; }

const PIP_ACHIEVEMENTS = [
  { id:'first_step',  icon:'🍎', title:'First Step',       desc:'Finish your first task',        check:s=>s.lifetimeTasks>=1,  progress:s=>`${Math.min(s.lifetimeTasks,1)}/1` },
  { id:'busy_bee',     icon:'🍏', title:'Busy Bee',         desc:'Finish 10 tasks in all',         check:s=>s.lifetimeTasks>=10, progress:s=>`${Math.min(s.lifetimeTasks,10)}/10` },
  { id:'full_basket',  icon:'🧺', title:'Full Basket',      desc:'Finish every task in one day',   check:s=>s.fullBasket,        progress:s=>s.fullBasket?'Done!':'Not yet' },
  { id:'streak_3',     icon:'🔥', title:'3-Day Streak',     desc:'Check off a task 3 days running', check:s=>s.bestStreak>=3,   progress:s=>`${Math.min(s.bestStreak,3)}/3` },
  { id:'streak_7',     icon:'🔥', title:'7-Day Streak',     desc:'Check off a task 7 days running', check:s=>s.bestStreak>=7,   progress:s=>`${Math.min(s.bestStreak,7)}/7` },
  { id:'abc_explorer', icon:'🔤', title:'Alphabet Explorer', desc:'Meet 13 letters',               check:s=>s.lettersSeen>=13,   progress:s=>`${Math.min(s.lettersSeen,13)}/13` },
  { id:'abc_master',   icon:'🏆', title:'Alphabet Master',  desc:'Meet all 26 letters',            check:s=>s.lettersSeen>=26,   progress:s=>`${Math.min(s.lettersSeen,26)}/26` },
  { id:'number_ninja', icon:'🔢', title:'Number Ninja',     desc:'Count every number, 1 to 10',    check:s=>s.numbersSeen>=10,   progress:s=>`${Math.min(s.numbersSeen,10)}/10` },
  { id:'sound_champ',  icon:'🎧', title:'Sound Match Champ', desc:'Score 5 in Listen & Match',     check:s=>s.matchBest>=5,      progress:s=>`${Math.min(s.matchBest,5)}/5` },
  { id:'clock_star',   icon:'🕐', title:'Clock Star',       desc:'Score 5 in the Clock Quiz',       check:s=>s.clockBest>=5,      progress:s=>`${Math.min(s.clockBest,5)}/5` },
  { id:'greeter',      icon:'🤗', title:'Friendly Greeter', desc:'Flip every greeting card',       check:s=>s.greetingsSeen>=10, progress:s=>`${Math.min(s.greetingsSeen,10)}/10` },
  { id:'feelings_friend', icon:'😊', title:'Feelings Friend', desc:'Score 5 in the Feelings Quiz', check:s=>s.emoBest>=5,        progress:s=>`${Math.min(s.emoBest,5)}/5` },
  { id:'color_explorer', icon:'🎨', title:'Color Explorer',  desc:'Discover every color',           check:s=>s.colorsSeen>=10,    progress:s=>`${Math.min(s.colorsSeen,10)}/10` },
  { id:'shape_shifter', icon:'⭐', title:'Shape Shifter',    desc:'Discover every shape',            check:s=>s.shapesSeen>=8,     progress:s=>`${Math.min(s.shapesSeen,8)}/8` },
  { id:'color_quiz',   icon:'🖌️', title:'Color & Shape Star', desc:'Score 5 in the Color & Shape Quiz', check:s=>s.colorQuizBest>=5, progress:s=>`${Math.min(s.colorQuizBest,5)}/5` },
  { id:'animal_friend', icon:'🐾', title:'Animal Friend',    desc:'Meet every animal',               check:s=>s.animalsSeen>=12,   progress:s=>`${Math.min(s.animalsSeen,12)}/12` },
  { id:'animal_expert', icon:'🦁', title:'Animal Sound Expert', desc:'Score 5 in the Animal Quiz',  check:s=>s.animalQuizBest>=5, progress:s=>`${Math.min(s.animalQuizBest,5)}/5` },
  { id:'week_wise',    icon:'📅', title:'Week Wise',        desc:'Meet all 7 days of the week',     check:s=>s.daysSeen>=7,       progress:s=>`${Math.min(s.daysSeen,7)}/7` },
  { id:'year_wise',    icon:'🗓️', title:'Year Wise',        desc:'Meet all 12 months',              check:s=>s.monthsSeen>=12,    progress:s=>`${Math.min(s.monthsSeen,12)}/12` },
  { id:'calendar_champ', icon:'🏅', title:'Calendar Champ',  desc:'Score 5 in the Calendar Quiz',    check:s=>s.calQuizBest>=5,    progress:s=>`${Math.min(s.calQuizBest,5)}/5` }
];

function pipGetAchievements(){
  const stats = pipGetStats();
  return PIP_ACHIEVEMENTS.map(a => ({
    id: a.id, icon: a.icon, title: a.title, desc: a.desc,
    unlocked: !!a.check(stats),
    progress: a.progress ? a.progress(stats) : ''
  }));
}

/* Returns badges that just became unlocked since the last time we
   checked, and remembers them so we don't toast twice. Call this
   after any action that might unlock something. */
function pipCheckNewlyUnlocked(){
  const announced = new Set(pipLoadSet(PIP_ANNOUNCED_KEY));
  const current = pipGetAchievements();
  const fresh = current.filter(a => a.unlocked && !announced.has(a.id));
  if(fresh.length){
    fresh.forEach(a => announced.add(a.id));
    localStorage.setItem(PIP_ANNOUNCED_KEY, JSON.stringify([...announced]));
  }
  return fresh;
}

/* Shows a small celebratory toast in the corner of the screen.
   Works on any page since it builds its own element. */
function pipShowBadgeToast(achievement){
  pipCelebrate();
  pipConfettiBurst();
  const toast = document.createElement('div');
  toast.className = 'pip-badge-toast';
  toast.innerHTML = `<div class="pip-badge-toast-icon">${achievement.icon}</div>
    <div><div class="pip-badge-toast-title">Badge unlocked!</div>
    <div class="pip-badge-toast-name">${achievement.title}</div></div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(()=> toast.classList.add('show'));
  setTimeout(()=>{
    toast.classList.remove('show');
    setTimeout(()=> toast.remove(), 400);
  }, 3800);
}

/* Scatters a burst of colorful confetti pieces from the top of the
   screen. Pure CSS/DOM, no canvas — cheap enough to fire freely. */
function pipConfettiBurst(){
  const colors = ['#FF4B4B','#FFC022','#4ECB6C','#33B6E8','#9B6BF0','#FF6FA5','#22D6C0'];
  const count = 26;
  const holder = document.createElement('div');
  holder.className = 'pip-confetti-holder';
  for(let i=0;i<count;i++){
    const piece = document.createElement('div');
    piece.className = 'pip-confetti-piece';
    const left = Math.random()*100;
    const delay = Math.random()*0.3;
    const duration = 1.6 + Math.random()*0.9;
    const rotate = Math.random()*360;
    const color = colors[i % colors.length];
    const drift = (Math.random()*80 - 40);
    piece.style.left = left+'vw';
    piece.style.background = color;
    piece.style.animationDelay = delay+'s';
    piece.style.animationDuration = duration+'s';
    piece.style.setProperty('--rot', rotate+'deg');
    piece.style.setProperty('--drift', drift+'px');
    if(Math.random() < 0.4) piece.style.borderRadius = '50%';
    holder.appendChild(piece);
  }
  document.body.appendChild(holder);
  setTimeout(()=> holder.remove(), 2800);
}

function pipAnnounceNewBadges(){
  pipCheckNewlyUnlocked().forEach((a,i)=> setTimeout(()=> pipShowBadgeToast(a), i*4200));
  pipApplyMood();
}

/* ===================================================
   Pip's mood
   - "sad": user skipped a day (no task finished yesterday
     or before), gently encourages them back — clears itself
     as soon as they check off today's first task.
   - "crowned": user has unlocked at least half the badges.
   - otherwise Pip is just his default happy self.
=================================================== */
function pipMissedStreak(){
  const lastDone = localStorage.getItem(PIP_LAST_DONE);
  if(!lastDone) return false;
  const diffDays = Math.round((new Date(pipToday()) - new Date(lastDone)) / 86400000);
  return diffDays >= 2;
}

function pipMoodClass(){
  if(pipMissedStreak()) return 'sad';
  const unlockedCount = pipGetAchievements().filter(a=>a.unlocked).length;
  if(unlockedCount >= 5) return 'crowned';
  return '';
}

/* Call after any DOM containing .pip elements is ready, and again
   after actions that could change the mood (finishing a task,
   unlocking a badge). Safe to call as many times as you like. */
function pipApplyMood(){
  const mood = pipMoodClass();
  document.querySelectorAll('.pip').forEach(el=>{
    el.classList.remove('sad','crowned');
    if(mood) el.classList.add(mood);
  });
}

/* Makes every Pip on the page hop for joy for a moment. */
function pipCelebrate(){
  document.querySelectorAll('.pip-wrap').forEach(el=>{
    el.classList.add('celebrate');
    setTimeout(()=> el.classList.remove('celebrate'), 950);
  });
}

/* ===================================================
   Shared page chrome: fixed header/footer behaviour
   and the "back to top" button. Call once per page,
   after the footer + button markup exists in the DOM.
=================================================== */
function pipInitChrome(){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', pipInitChrome, { once:true });
    return;
  }
  const btn = document.getElementById('toTopBtn');
  const nav = document.querySelector('.nav-bar');

  function onScroll(){
    const y = window.scrollY || window.pageYOffset;
    if(btn) btn.classList.toggle('show', y > 380);
    if(nav) nav.classList.toggle('scrolled', y > 20);
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  if(btn){
    btn.addEventListener('click', ()=>{
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }

  const navToggle = document.getElementById('navToggle');
  const navLinks = document.querySelector('.nav-links');
  if(navToggle && navLinks){
    navToggle.addEventListener('click', ()=>{
      navLinks.classList.toggle('open');
      navToggle.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
    });
    navLinks.querySelectorAll('a').forEach(a=>{
      a.addEventListener('click', ()=>{
        navLinks.classList.remove('open');
        navToggle.textContent = '☰';
      });
    });
  }

  pipInitInstallButton();
}
