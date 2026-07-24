// portal.js
// Renders every section of the staff portal and wires up navigation,
// accordions, the media lightbox, and role-gated publish forms.
//
// Live Firestore wiring: Updates/News, Staff Directory, Media Gallery,
// Internal Applications, and Event Calendar all read from and (where
// noted) write to Firestore. Departments still renders from a
// placeholder array -- say the word if you want that wired up too.

import { guardPortal, logout } from './auth.js';
import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, orderBy, where, limit, serverTimestamp,
  doc, deleteDoc, updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

guardPortal((user, profile) => {
  document.getElementById('user-name').textContent = profile?.username ?? user.email;
  document.getElementById('user-department').textContent = profile?.department ?? 'No department set';
  document.getElementById('home-welcome').textContent =
    `Welcome back${profile?.username ? `, ${profile.username}` : ''}`;

  const canPublish = profile?.roleTier === 'management' || profile?.roleTier === 'admin';
  const session = { canPublish, authorName: profile?.username ?? user.email };

  if (canPublish) {
    ['new-post-btn', 'new-event-btn', 'new-media-btn', 'new-application-btn']
      .forEach((id) => document.getElementById(id).classList.remove('hidden'));
  }

  initPortal(session);
});

document.getElementById('logout-btn').addEventListener('click', () => logout());

function initPortal(session) {
  setupNav();
  renderHome();
  renderRules();
  renderFAQs();
  renderCalendar(session);
  renderDepartments();
  renderDirectory();
  renderUpdates(session);
  renderMedia(session);
  renderApplications(session);
}

// ---------- Navigation ----------

function setupNav() {
  document.querySelectorAll('.sidebar-nav-item').forEach((btn) => {
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

// Wires a "+ New ___" button to show/hide its form, and returns the
// form element so callers can attach their own submit handler.
function setupPublishToggle(btnId, formId) {
  const btn = document.getElementById(btnId);
  const form = document.getElementById(formId);
  btn.addEventListener('click', () => form.classList.toggle('hidden'));
  return form;
}

// ---------- Home (live Firestore) ----------

const QUICK_LINKS = [
  { section: 'rules', label: 'Server Rules' },
  { section: 'updates', label: 'Updates / News' },
  { section: 'calendar', label: 'Event Calendar' },
  { section: 'applications', label: 'Internal Applications' },
];

function formatRelativeTime(ts) {
  if (!ts?.toDate) return 'Just now';
  const diffMs = Date.now() - ts.toDate().getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function renderHome() {
  const feed = document.getElementById('home-activity-feed');
  try {
    const snap = await getDocs(query(collection(db, 'updates'), orderBy('createdAt', 'desc'), limit(3)));
    const recent = snap.docs.map((d) => d.data());
    feed.innerHTML = recent.length === 0
      ? '<p class="eyebrow">No announcements yet.</p>'
      : recent.map((u) => `
        <div class="activity-row">
          <span class="status-pill info" style="height:fit-content;"><span class="dot"></span></span>
          <div>
            <p class="activity-title">${escapeHTML(u.title)}</p>
            <p class="activity-meta">${escapeHTML(u.authorName ?? '')} \u00b7 ${escapeHTML(formatRelativeTime(u.createdAt))}</p>
          </div>
        </div>
      `).join('');
  } catch (err) {
    console.error('Failed to load home activity feed', err);
    feed.innerHTML = '<p class="eyebrow">Couldn\u2019t load recent activity.</p>';
  }

  const events = document.getElementById('home-events-feed');
  try {
    const today = new Date().toISOString().slice(0, 10);
    const snap = await getDocs(query(
      collection(db, 'events'), where('date', '>=', today), orderBy('date', 'asc'), limit(2),
    ));
    const upcoming = snap.docs.map((d) => d.data());
    events.innerHTML = upcoming.length === 0
      ? '<p class="eyebrow">No upcoming events posted.</p>'
      : upcoming.map((e) => {
        const { day, num } = formatEventDate(e.date);
        return `
          <div class="event-row">
            <p class="activity-title">${escapeHTML(e.title)}</p>
            <p class="activity-meta">${escapeHTML(day)}, ${escapeHTML(num)} \u00b7 ${escapeHTML(e.time)}</p>
          </div>
        `;
      }).join('');
  } catch (err) {
    console.error('Failed to load home events feed', err);
    events.innerHTML = '<p class="eyebrow">Couldn\u2019t load upcoming events.</p>';
  }

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
const RULE_CATEGORIES = [
  {
    title: 'General Conduct',
    rules: [
      'Treat all members and guests with respect \u2014 harassment of any kind results in immediate action.',
      'No discrimination, hate speech, or targeted harassment in any channel or in-game.',
      'Staff decisions may be appealed through the proper channel, not disputed in public chat.',
    ],
  },
  {
    title: 'Roleplay Standards',
    rules: [
      'Fail RP (breaking immersion without cause) is not permitted during active scenes.',
      'Powergaming and metagaming are prohibited \u2014 act only on what your character could reasonably know.',
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
const FAQS = [
  { q: 'How do I request a leave of absence?', a: 'Submit a LOA form through the Internal Applications page under your department, and tag your department head for approval.' },
  { q: 'Who do I contact for a rule dispute?', a: 'Open a ticket in the staff Discord support channel \u2014 do not dispute moderation actions in public chat.' },
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

// ---------- Event Calendar (live Firestore) ----------
// Reads: /events, ordered by date ascending (date is stored as an
// ISO string like "2026-07-25", which sorts correctly as text).
// Writes: management/admin only, matching firestore.rules.

function formatEventDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    num: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

async function loadEvents() {
  const snap = await getDocs(query(collection(db, 'events'), orderBy('date', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function renderEventsList(events, canPublish) {
  const el = document.getElementById('calendar-list');
  if (events.length === 0) {
    el.innerHTML = '<p class="eyebrow">No events posted yet.</p>';
    return;
  }
  el.innerHTML = events.map((e) => {
    const { day, num } = formatEventDate(e.date);
    return `
      <div class="card event-item">
        <div class="event-date">
          <p class="day">${escapeHTML(day)}</p>
          <p class="num">${escapeHTML(num)}</p>
        </div>
        <div class="event-details">
          <p>${escapeHTML(e.title)}</p>
          <div class="event-meta">
            <span>${escapeHTML(e.time)}</span>
            <span>${escapeHTML(e.location)}</span>
          </div>
        </div>
        <span class="status-pill info">${escapeHTML(e.tag)}</span>
        ${canPublish ? `<button class="row-delete" data-id="${escapeHTML(e.id)}" title="Delete event">\u2715</button>` : ''}
      </div>
    `;
  }).join('');

  if (!canPublish) return;
  el.querySelectorAll('.row-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this event? This can\u2019t be undone.')) return;
      try {
        await deleteDoc(doc(db, 'events', btn.dataset.id));
        renderEventsList(await loadEvents(), canPublish);
      } catch (err) {
        console.error('Failed to delete event', err);
        alert('Could not delete -- check the console for details.');
      }
    });
  });
}

async function renderCalendar(session) {
  try {
    renderEventsList(await loadEvents(), session.canPublish);
  } catch (err) {
    console.error('Failed to load events', err);
    document.getElementById('calendar-list').innerHTML = '<p class="eyebrow">Couldn\u2019t load events.</p>';
  }

  if (!session.canPublish) return;
  const form = setupPublishToggle('new-event-btn', 'event-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('event-title').value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const location = document.getElementById('event-location').value;
    const tag = document.getElementById('event-tag').value;

    try {
      await addDoc(collection(db, 'events'), { title, date, time, location, tag, createdAt: serverTimestamp() });
      form.reset();
      form.classList.add('hidden');
      renderEventsList(await loadEvents(), session.canPublish);
    } catch (err) {
      console.error('Failed to add event', err);
      alert('Could not save the event -- check the console for details.');
    }
  });
}

// ---------- Departments ----------
// Still placeholder -- say the word if you want this wired to
// getDocs(collection(db, 'departments')) too.
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
      <p class="dept-lead">Lead \u2014 ${escapeHTML(d.lead)}</p>
    </div>
  `).join('');
}

// ---------- Staff Directory (live Firestore) ----------
// Reads every /staff doc with active == true, sorted by username.

async function renderDirectory() {
  const el = document.getElementById('directory-table');
  el.innerHTML = '<p class="eyebrow" style="padding:16px 20px;">Loading roster\u2026</p>';

  let staffList = [];
  try {
    const snap = await getDocs(query(collection(db, 'staff'), where('active', '==', true)));
    staffList = snap.docs.map((d) => d.data()).sort((a, b) =>
      (a.username ?? '').localeCompare(b.username ?? ''));
  } catch (err) {
    console.error('Failed to load staff directory', err);
    el.innerHTML = '<p class="eyebrow" style="padding:16px 20px;">Couldn\u2019t load the staff directory.</p>';
    return;
  }

  const header = `
    <div class="directory-row directory-header">
      <span class="eyebrow" style="margin:0;">Name</span>
      <span class="eyebrow" style="margin:0;">Department</span>
      <span class="eyebrow" style="margin:0;">Rank</span>
    </div>
  `;
  const rows = staffList.map((s) => `
    <div class="directory-row">
      <span class="directory-name">${escapeHTML(s.username ?? '\u2014')}</span>
      <span class="directory-cell">${escapeHTML(s.department ?? '\u2014')}</span>
      <span class="directory-cell">${escapeHTML(s.rank ?? '\u2014')}</span>
    </div>
  `).join('');
  el.innerHTML = header + (rows || '<p class="eyebrow" style="padding:16px 20px;">No active staff on file yet.</p>');
}

// ---------- Updates / News (live Firestore) ----------

async function loadUpdates() {
  const snap = await getDocs(query(collection(db, 'updates'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function formatTimestamp(ts) {
  if (!ts?.toDate) return 'Just now';
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderPostsList(posts, canPublish) {
  const el = document.getElementById('updates-list');
  if (posts.length === 0) {
    el.innerHTML = '<p class="eyebrow">No announcements posted yet.</p>';
    return;
  }
  el.innerHTML = posts.map((p) => `
    <article class="card post-card">
      <div class="post-top">
        <h3>${escapeHTML(p.title)}</h3>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="post-timestamp">${escapeHTML(formatTimestamp(p.createdAt))}</span>
          ${canPublish ? `<button class="post-delete" data-id="${escapeHTML(p.id)}" title="Delete announcement">\u2715</button>` : ''}
        </div>
      </div>
      <p class="post-author">${escapeHTML(p.authorName ?? '')}</p>
      <p class="post-body">${escapeHTML(p.body)}</p>
    </article>
  `).join('');

  if (canPublish) {
    el.querySelectorAll('.post-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this announcement? This can\u2019t be undone.')) return;
        try {
          await deleteDoc(doc(db, 'updates', btn.dataset.id));
          renderPostsList(await loadUpdates(), canPublish);
        } catch (err) {
          console.error('Failed to delete update', err);
          alert('Could not delete -- check the console for details.');
        }
      });
    });
  }
}

async function renderUpdates(session) {
  try {
    renderPostsList(await loadUpdates(), session.canPublish);
  } catch (err) {
    console.error('Failed to load updates', err);
    document.getElementById('updates-list').innerHTML = '<p class="eyebrow">Couldn\u2019t load updates.</p>';
  }

  if (!session.canPublish) return;
  const form = setupPublishToggle('new-post-btn', 'update-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('update-title').value;
    const body = document.getElementById('update-body').value;

    try {
      await addDoc(collection(db, 'updates'), {
        title, body, authorName: session.authorName, createdAt: serverTimestamp(),
      });
      form.reset();
      form.classList.add('hidden');
      renderPostsList(await loadUpdates(), session.canPublish);
    } catch (err) {
      console.error('Failed to publish update', err);
      alert('Could not publish -- check the console for details.');
    }
  });
}


// ---------- Media Gallery (live Firestore) ----------

const MEDIA_CATEGORIES = ['All', 'Events', 'Departments', 'Community'];

async function loadMedia() {
  const snap = await getDocs(collection(db, 'media'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function galleryThumbHTML(m) {
  if (m.imageUrl) {
    return `<img src="${escapeHTML(m.imageUrl)}" alt="${escapeHTML(m.caption)}" style="width:100%;height:100%;object-fit:cover;" />`;
  }
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;
}

function renderGalleryGrid(allMedia, filter, canPublish) {
  const el = document.getElementById('gallery-grid');
  const items = filter === 'All' ? allMedia : allMedia.filter((m) => m.category === filter);
  if (items.length === 0) {
    el.innerHTML = '<p class="eyebrow">No media in this category yet.</p>';
    return;
  }
  el.innerHTML = items.map((m) => `
    <div class="card gallery-item-wrap">
      <button class="gallery-item" data-caption="${escapeHTML(m.caption)}" data-url="${escapeHTML(m.imageUrl ?? '')}">
        <div class="gallery-thumb">${galleryThumbHTML(m)}</div>
        <div class="gallery-caption">
          <p>${escapeHTML(m.caption)}</p>
          <span class="status-pill info">${escapeHTML(m.category)}</span>
        </div>
      </button>
      ${canPublish ? `<button class="media-delete" data-id="${escapeHTML(m.id)}" title="Delete media">\u2715</button>` : ''}
    </div>
  `).join('');

  el.querySelectorAll('.gallery-item').forEach((btn) => {
    btn.addEventListener('click', () => openLightbox(btn.dataset.caption, btn.dataset.url));
  });

  if (canPublish) {
    el.querySelectorAll('.media-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this media item? This can\u2019t be undone.')) return;
        try {
          await deleteDoc(doc(db, 'media', btn.dataset.id));
          const fresh = await loadMedia();
          renderGalleryGrid(fresh, filter, canPublish);
          // Keep the outer allMedia reference in sync for future filter clicks.
          allMediaCache = fresh;
        } catch (err) {
          console.error('Failed to delete media', err);
          alert('Could not delete -- check the console for details.');
        }
      });
    });
  }
}

let allMediaCache = [];

async function renderMedia(session) {
  try {
    allMediaCache = await loadMedia();
  } catch (err) {
    console.error('Failed to load media', err);
  }

  const filtersEl = document.getElementById('gallery-filters');
  filtersEl.innerHTML = MEDIA_CATEGORIES.map((c, i) => `
    <button class="gallery-filter ${i === 0 ? 'active' : ''}" data-cat="${escapeHTML(c)}">${escapeHTML(c)}</button>
  `).join('');
  filtersEl.querySelectorAll('.gallery-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      filtersEl.querySelectorAll('.gallery-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderGalleryGrid(allMediaCache, btn.dataset.cat, session.canPublish);
    });
  });
  renderGalleryGrid(allMediaCache, 'All', session.canPublish);

  if (!session.canPublish) return;
  const form = setupPublishToggle('new-media-btn', 'media-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const caption = document.getElementById('media-caption').value;
    const category = document.getElementById('media-category').value;
    const imageUrl = document.getElementById('media-url').value || null;

    try {
      await addDoc(collection(db, 'media'), {
        caption, category, imageUrl, uploadedBy: session.authorName, createdAt: serverTimestamp(),
      });
      form.reset();
      form.classList.add('hidden');
      allMediaCache = await loadMedia();
      renderGalleryGrid(allMediaCache, 'All', session.canPublish);
      filtersEl.querySelectorAll('.gallery-filter').forEach((b, i) => b.classList.toggle('active', i === 0));
    } catch (err) {
      console.error('Failed to add media', err);
      alert('Could not save the media entry -- check the console for details.');
    }
  });
}

function openLightbox(caption, imageUrl) {
  const existing = document.querySelector('.lightbox');
  if (existing) existing.remove();

  const imageHTML = imageUrl
    ? `<img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(caption)}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md);" />`
    : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;

  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = `
    <div class="lightbox-inner">
      <div class="lightbox-top">
        <p style="margin:0; font-weight:600;">${escapeHTML(caption)}</p>
        <button class="lightbox-close">\u2715</button>
      </div>
      <div class="lightbox-image">${imageHTML}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('.lightbox-close').addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

// ---------- Internal Applications (live Firestore) ----------

async function loadApplications() {
  const snap = await getDocs(query(collection(db, 'applications'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function statusTone(status) {
  if (status === 'open') return 'open';
  if (status === 'under review') return 'warn';
  return 'closed';
}

function renderApplicationsList(applications, canPublish) {
  const el = document.getElementById('applications-list');
  if (applications.length === 0) {
    el.innerHTML = '<p class="eyebrow">No listings posted yet.</p>';
    return;
  }
  el.innerHTML = applications.map((a) => `
    <div class="card application-card">
      <div class="application-top">
        <h3 style="font-size:var(--text-lg);">${escapeHTML(a.name)}</h3>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="status-pill ${statusTone(a.status)}"><span class="dot"></span>${escapeHTML(a.status)}</span>
          ${canPublish ? `
            <button class="row-edit" data-id="${escapeHTML(a.id)}" title="Edit listing">\u270e</button>
            <button class="row-delete" data-id="${escapeHTML(a.id)}" title="Delete listing">\u2715</button>
          ` : ''}
        </div>
      </div>
      <p class="application-desc">${escapeHTML(a.description)}</p>
      <ul class="application-reqs">${(a.requirements ?? []).map((r) => `<li>${escapeHTML(r)}</li>`).join('')}</ul>
      ${renderApplyAction(a)}
    </div>
  `).join('');

  if (!canPublish) return;

  el.querySelectorAll('.row-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this listing? This can\u2019t be undone.')) return;
      try {
        await deleteDoc(doc(db, 'applications', btn.dataset.id));
        renderApplicationsList(await loadApplications(), canPublish);
      } catch (err) {
        console.error('Failed to delete listing', err);
        alert('Could not delete -- check the console for details.');
      }
    });
  });

  el.querySelectorAll('.row-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const app = applications.find((a) => a.id === btn.dataset.id);
      if (app) startEditingApplication(app);
    });
  });
}

function renderApplyAction(a) {
  if (a.status !== 'open') return '';
  if (a.link) {
    return `<a href="${escapeHTML(a.link)}" target="_blank" rel="noopener" class="btn btn-primary application-apply">Apply</a>`;
  }
  return '<p class="eyebrow" style="margin-top:14px;">Contact your department lead to apply.</p>';
}

let editingApplicationId = null;

function startEditingApplication(app) {
  editingApplicationId = app.id;
  document.getElementById('application-name').value = app.name ?? '';
  document.getElementById('application-description').value = app.description ?? '';
  document.getElementById('application-requirements').value = (app.requirements ?? []).join('\n');
  document.getElementById('application-link').value = app.link ?? '';
  document.getElementById('application-status').value = app.status ?? 'open';
  document.getElementById('application-submit-btn').textContent = 'Save changes';
  document.getElementById('application-form').classList.remove('hidden');
  document.getElementById('section-applications').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetApplicationForm(form) {
  editingApplicationId = null;
  form.reset();
  form.classList.add('hidden');
  document.getElementById('application-submit-btn').textContent = 'Publish listing';
}

async function renderApplications(session) {
  try {
    renderApplicationsList(await loadApplications(), session.canPublish);
  } catch (err) {
    console.error('Failed to load applications', err);
    document.getElementById('applications-list').innerHTML = '<p class="eyebrow">Couldn\u2019t load listings.</p>';
  }

  if (!session.canPublish) return;
  const form = setupPublishToggle('new-application-btn', 'application-form');

  // Opening the form fresh (not via an Edit click) should always start a
  // new listing, not silently continue editing a previous one.
  document.getElementById('new-application-btn').addEventListener('click', () => {
    if (!form.classList.contains('hidden') && editingApplicationId === null) return;
    editingApplicationId = null;
    form.reset();
    document.getElementById('application-submit-btn').textContent = 'Publish listing';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('application-name').value;
    const description = document.getElementById('application-description').value;
    const requirements = document.getElementById('application-requirements').value
      .split('\n').map((r) => r.trim()).filter(Boolean);
    const link = document.getElementById('application-link').value || null;
    const status = document.getElementById('application-status').value;
    const payload = { name, description, requirements, link, status };

    try {
      if (editingApplicationId) {
        await updateDoc(doc(db, 'applications', editingApplicationId), payload);
      } else {
        await addDoc(collection(db, 'applications'), { ...payload, createdAt: serverTimestamp() });
      }
      resetApplicationForm(form);
      renderApplicationsList(await loadApplications(), session.canPublish);
    } catch (err) {
      console.error('Failed to save listing', err);
      alert('Could not save the listing -- check the console for details.');
    }
  });
}

// ---------- Utility ----------

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
