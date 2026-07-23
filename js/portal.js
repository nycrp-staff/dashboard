// portal.js
// Renders every section of the staff portal and wires up navigation,
// accordions, the media lightbox, and the (role-gated) publish form.
//
// Every array below is placeholder data. Each render function is the
// spot to swap in a live Firestore query — see the comment above each
// one for the exact collection it maps to.

import { guardPortal, logout } from './auth.js';
import { db } from './firebase-config.js';
import {
  collection, addDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

guardPortal((user, profile) => {
  document.getElementById('user-name').textContent = profile?.username ?? user.email;
  document.getElementById('user-department').textContent = profile?.department ?? 'No department set';
  document.getElementById('home-welcome').textContent =
    `Welcome back${profile?.username ? `, ${profile.username}` : ''}`;

  const canPublish = profile?.roleTier === 'management' || profile?.roleTier === 'admin';
  if (canPublish) document.getElementById('new-post-btn').classList.remove('hidden');

  initPortal({ canPublish, authorName: profile?.username ?? user.email });
});

document.getElementById('logout-btn').addEventListener('click', () => logout());

function initPortal(session) {
  setupNav();
  renderHome();
  renderRules();
  renderFAQs();
  renderCalendar();
  renderDepartments();
  renderDirectory();
  renderUpdates(session);
  renderMedia();
  renderApplications();
}

// ---------- Navigation ----------

function setupNav() {
  const buttons = document.querySelectorAll('.sidebar-nav-item');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => goToSection(btn.dataset.section));
  });
  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => goToSection(el.dataset.goto));
  });
}

function goToSection(name) {
  document.querySelectorAll('.sidebar-nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
  document.querySelectorAll('.page-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `section-${name}`);
  });
}

// ---------- Home ----------
// Replace with: query(collection(db, 'updates'), orderBy('createdAt','desc'), limit(3))
const RECENT_ACTIVITY = [
  { title: 'Winter event schedule posted', author: 'Command Staff', time: '2h ago', tone: 'info' },
  { title: 'Server Rules §4 (Vehicle Conduct) revised', author: 'Admin Team', time: '1d ago', tone: 'warn' },
  { title: 'EMS department recruiting for winter cycle', author: 'EMS Command', time: '3d ago', tone: 'open' },
];

// Replace with: query(collection(db, 'events'), orderBy('date'), limit(2))
const UPCOMING_EVENTS_HOME = [
  { title: 'Weekly Patrol Session', date: 'Sat, Jul 25', time: '8:00 PM ET' },
  { title: 'Department Head Meeting', date: 'Mon, Jul 27', time: '9:00 PM ET' },
];

const QUICK_LINKS = [
  { section: 'rules', label: 'Server Rules' },
  { section: 'updates', label: 'Updates / News' },
  { section: 'calendar', label: 'Event Calendar' },
  { section: 'applications', label: 'Internal Applications' },
];

function renderHome() {
  const feed = document.getElementById('home-activity-feed');
  feed.innerHTML = RECENT_ACTIVITY.map((u) => `
    <div class="activity-row">
      <span class="status-pill ${u.tone}" style="height:fit-content;"><span class="dot"></span></span>
      <div>
        <p class="activity-title">${escapeHTML(u.title)}</p>
        <p class="activity-meta">${escapeHTML(u.author)} · ${escapeHTML(u.time)}</p>
      </div>
    </div>
  `).join('');

  const events = document.getElementById('home-events-feed');
  events.innerHTML = UPCOMING_EVENTS_HOME.map((e) => `
    <div class="event-row">
      <p class="activity-title">${escapeHTML(e.title)}</p>
      <p class="activity-meta">${escapeHTML(e.date)} · ${escapeHTML(e.time)}</p>
    </div>
  `).join('');

  const links = document.getElementById('home-quick-links');
  links.innerHTML = QUICK_LINKS.map((l) => `
    <button class="card quick-link-card" data-goto="${l.section}">
      <span>${escapeHTML(l.label)}</span>
    </button>
  `).join('');
  links.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => goToSection(el.dataset.goto));
  });
}

// ---------- Server Rules ----------
// Replace with: getDocs(collection(db, 'rules_doc'))
const RULE_CATEGORIES = [
  {
    title: 'General Conduct',
    rules: [
      'Treat all members and guests with respect — harassment of any kind results in immediate action.',
      'No discrimination, hate speech, or targeted harassment in any channel or in-game.',
      'Staff decisions may be appealed through the proper channel, not disputed in public chat.',
    ],
  },
  {
    title: 'Roleplay Standards',
    rules: [
      'Fail RP (breaking immersion without cause) is not permitted during active scenes.',
      'Powergaming and metagaming are prohibited — act only on what your character could reasonably know.',
      'Vehicle and firearm roleplay must follow department-specific SOPs.',
    ],
  },
  {
    title: 'Staff Expectations',
    rules: [
      'Staff must remain neutral and professional when handling reports.',
      'Abuse of staff permissions results in immediate demotion and review.',
      'Inactivity beyond the posted threshold without an approved leave results in removal.',
    ],
  },
];

function renderRules() {
  const el = document.getElementById('rules-list');
  el.innerHTML = RULE_CATEGORIES.map((cat, i) => `
    <div class="card accordion-item ${i === 0 ? 'open' : ''}">
      <button class="accordion-trigger">
        <span>${escapeHTML(cat.title)}</span>
        <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="accordion-body">
        <ol>${cat.rules.map((r) => `<li>${escapeHTML(r)}</li>`).join('')}</ol>
      </div>
    </div>
  `).join('');
  wireAccordions(el);
}

// ---------- FAQs ----------
// Replace with: getDocs(collection(db, 'faqs'))
const FAQS = [
  { q: 'How do I request a leave of absence?', a: 'Submit a LOA form through the Internal Applications page under your department, and tag your department head for approval.' },
  { q: 'Who do I contact for a rule dispute?', a: 'Open a ticket in the staff Discord support channel — do not dispute moderation actions in public chat.' },
  { q: 'How often is the Event Calendar updated?', a: 'Command staff update it weekly, typically every Sunday, with the following week\u2019s scheduled sessions.' },
  { q: 'Where can I find department-specific SOPs?', a: 'Each department card on the Departments page links out to its SOP document once published.' },
];

function renderFAQs() {
  const el = document.getElementById('faqs-list');
  el.innerHTML = FAQS.map((item) => `
    <div class="card accordion-item">
      <button class="accordion-trigger">
        <span>${escapeHTML(item.q)}</span>
        <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <div class="accordion-body">${escapeHTML(item.a)}</div>
    </div>
  `).join('');
  wireAccordions(el);
}

function wireAccordions(container) {
  container.querySelectorAll('.accordion-item').forEach((item) => {
    item.querySelector('.accordion-trigger').addEventListener('click', () => {
      item.classList.toggle('open');
    });
  });
}

// ---------- Event Calendar ----------
// Replace with: query(collection(db, 'events'), orderBy('date'))
const EVENTS = [
  { title: 'Weekly Patrol Session', day: 'Sat', num: 'Jul 25', time: '8:00 PM ET', location: 'Main server', tag: 'Recurring' },
  { title: 'Department Head Meeting', day: 'Mon', num: 'Jul 27', time: '9:00 PM ET', location: 'Discord — Command VC', tag: 'Staff only' },
  { title: 'EMS Training Night', day: 'Wed', num: 'Jul 29', time: '7:30 PM ET', location: 'Training server', tag: 'Department' },
  { title: 'Community Takeover Event', day: 'Sat', num: 'Aug 1', time: '6:00 PM ET', location: 'Main server', tag: 'Community' },
];

function renderCalendar() {
  const el = document.getElementById('calendar-list');
  el.innerHTML = EVENTS.map((e) => `
    <div class="card event-item">
      <div class="event-date">
        <p class="day">${escapeHTML(e.day)}</p>
        <p class="num">${escapeHTML(e.num)}</p>
      </div>
      <div class="event-details">
        <p>${escapeHTML(e.title)}</p>
        <div class="event-meta">
          <span>${escapeHTML(e.time)}</span>
          <span>${escapeHTML(e.location)}</span>
        </div>
      </div>
      <span class="status-pill info">${escapeHTML(e.tag)}</span>
    </div>
  `).join('');
}

// ---------- Departments ----------
// Replace with: getDocs(collection(db, 'departments'))
const DEPARTMENTS = [
  { name: 'Police Department', description: 'Handles patrol, traffic enforcement, and criminal investigations across the city.', lead: 'Chief R. Alvarez' },
  { name: 'Emergency Medical Services', description: 'Responds to medical emergencies and coordinates with fire and police on scene.', lead: 'Director T. Nguyen' },
  { name: 'Fire Department', description: 'Handles fire suppression, rescue operations, and hazard response.', lead: 'Chief M. Okafor' },
  { name: 'Human Resources', description: 'Manages staff applications, onboarding, and internal conduct reviews.', lead: 'Director S. Patel' },
];

function renderDepartments() {
  const el = document.getElementById('departments-grid');
  el.innerHTML = DEPARTMENTS.map((d) => `
    <div class="card dept-card">
      <div class="dept-card-top">
        <h3 style="font-size:var(--text-lg);">${escapeHTML(d.name)}</h3>
      </div>
      <p class="dept-desc">${escapeHTML(d.description)}</p>
      <p class="dept-lead">Lead — ${escapeHTML(d.lead)}</p>
    </div>
  `).join('');
}

// ---------- Staff Directory ----------
// Replace with: query(collection(db, 'staff'), where('active','==',true))
const STAFF = [
  { name: 'R. Alvarez', department: 'Police Department', rank: 'Chief' },
  { name: 'T. Nguyen', department: 'Emergency Medical Services', rank: 'Director' },
  { name: 'M. Okafor', department: 'Fire Department', rank: 'Chief' },
  { name: 'S. Patel', department: 'Human Resources', rank: 'Director' },
  { name: 'J. Ruiz', department: 'Police Department', rank: 'Deputy Chief' },
];

function renderDirectory() {
  const el = document.getElementById('directory-table');
  const header = `
    <div class="directory-row directory-header">
      <span class="eyebrow" style="margin:0;">Name</span>
      <span class="eyebrow" style="margin:0;">Department</span>
      <span class="eyebrow" style="margin:0;">Rank</span>
    </div>
  `;
  const rows = STAFF.map((s) => `
    <div class="directory-row">
      <span class="directory-name">${escapeHTML(s.name)}</span>
      <span class="directory-cell">${escapeHTML(s.department)}</span>
      <span class="directory-cell">${escapeHTML(s.rank)}</span>
    </div>
  `).join('');
  el.innerHTML = header + rows;
}

// ---------- Updates / News ----------
// Replace with: query(collection(db, 'updates'), orderBy('createdAt','desc'))
let POSTS = [
  { title: 'Winter event schedule posted', author: 'Command Staff', date: 'Jul 20, 2026', body: 'The full winter event lineup is now live on the Event Calendar — expect two community takeovers and a department showcase.' },
  { title: 'Server Rules §4 (Vehicle Conduct) revised', author: 'Admin Team', date: 'Jul 19, 2026', body: 'Vehicle conduct rules have been clarified around pursuit termination. Review the updated Server Rules page.' },
  { title: 'EMS department recruiting for winter cycle', author: 'EMS Command', date: 'Jul 17, 2026', body: 'EMS is opening additional slots this cycle. See Internal Applications for requirements.' },
];

function renderUpdates(session) {
  const form = document.getElementById('update-form');
  if (session.canPublish) {
    document.getElementById('new-post-btn').addEventListener('click', () => {
      form.classList.toggle('hidden');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('update-title').value;
      const body = document.getElementById('update-body').value;

      // Live version: await addDoc(collection(db, 'updates'), {
      //   title, body, authorName: session.authorName, createdAt: serverTimestamp(),
      // });
      POSTS = [{ title, author: session.authorName, date: 'Just now', body }, ...POSTS];
      renderPostsList();
      form.reset();
      form.classList.add('hidden');
    });
  }
  renderPostsList();
}

function renderPostsList() {
  const el = document.getElementById('updates-list');
  el.innerHTML = POSTS.map((p) => `
    <article class="card post-card">
      <div class="post-top">
        <h3>${escapeHTML(p.title)}</h3>
        <span class="post-timestamp">${escapeHTML(p.date)}</span>
      </div>
      <p class="post-author">${escapeHTML(p.author)}</p>
      <p class="post-body">${escapeHTML(p.body)}</p>
    </article>
  `).join('');
}

// ---------- Media Gallery ----------
// Replace with: getDocs(collection(db, 'media'))
const MEDIA_CATEGORIES = ['All', 'Events', 'Departments', 'Community'];
const MEDIA = [
  { category: 'Events', caption: 'Winter Takeover 2025' },
  { category: 'Departments', caption: 'PD graduation ceremony' },
  { category: 'Community', caption: 'Community car meet' },
  { category: 'Events', caption: 'Anniversary celebration' },
  { category: 'Departments', caption: 'EMS training exercise' },
  { category: 'Community', caption: 'Staff appreciation night' },
];

function renderMedia() {
  const filtersEl = document.getElementById('gallery-filters');
  filtersEl.innerHTML = MEDIA_CATEGORIES.map((c, i) => `
    <button class="gallery-filter ${i === 0 ? 'active' : ''}" data-cat="${escapeHTML(c)}">${escapeHTML(c)}</button>
  `).join('');

  filtersEl.querySelectorAll('.gallery-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      filtersEl.querySelectorAll('.gallery-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderGalleryGrid(btn.dataset.cat);
    });
  });

  renderGalleryGrid('All');
}

function renderGalleryGrid(filter) {
  const el = document.getElementById('gallery-grid');
  const items = filter === 'All' ? MEDIA : MEDIA.filter((m) => m.category === filter);
  el.innerHTML = items.map((m) => `
    <button class="card gallery-item" data-caption="${escapeHTML(m.caption)}">
      <div class="gallery-thumb">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      </div>
      <div class="gallery-caption">
        <p>${escapeHTML(m.caption)}</p>
        <span class="status-pill info">${escapeHTML(m.category)}</span>
      </div>
    </button>
  `).join('');

  el.querySelectorAll('.gallery-item').forEach((btn) => {
    btn.addEventListener('click', () => openLightbox(btn.dataset.caption));
  });
}

function openLightbox(caption) {
  const existing = document.querySelector('.lightbox');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = `
    <div class="lightbox-inner">
      <div class="lightbox-top">
        <p style="margin:0; font-weight:600;">${escapeHTML(caption)}</p>
        <button class="lightbox-close">✕</button>
      </div>
      <div class="lightbox-image">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      </div>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('.lightbox-close').addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

// ---------- Internal Applications ----------
// Replace with: getDocs(collection(db, 'applications'))
const APPLICATIONS = [
  { name: 'Police Department — Cadet', status: 'open', tone: 'open', description: 'Entry-level position for new recruits joining the Police Department.', requirements: ['14+ days in the group', 'No active warnings', 'Available for weekly training'] },
  { name: 'Fire Department — Firefighter', status: 'open', tone: 'open', description: 'Join the Fire Department\u2019s response roster.', requirements: ['7+ days in the group', 'Discord voice access'] },
  { name: 'Media Team — Content Creator', status: 'under review', tone: 'warn', description: 'Produce highlight clips and promotional media for NYCRP.', requirements: ['Portfolio of prior edits', 'Active in community events'] },
  { name: 'Command Staff — Internal Affairs', status: 'closed', tone: 'closed', description: 'Investigates staff conduct reports. Applications closed for this cycle.', requirements: ['Management-tier and above'] },
];

function renderApplications() {
  const el = document.getElementById('applications-list');
  el.innerHTML = APPLICATIONS.map((a) => `
    <div class="card application-card">
      <div class="application-top">
        <h3 style="font-size:var(--text-lg);">${escapeHTML(a.name)}</h3>
        <span class="status-pill ${a.tone}"><span class="dot"></span>${escapeHTML(a.status)}</span>
      </div>
      <p class="application-desc">${escapeHTML(a.description)}</p>
      <ul class="application-reqs">${a.requirements.map((r) => `<li>${escapeHTML(r)}</li>`).join('')}</ul>
      ${a.status === 'open' ? '<button class="btn btn-primary application-apply">Apply</button>' : ''}
    </div>
  `).join('');
}

// ---------- Utility ----------

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
