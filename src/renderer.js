(function () {

  // ---------- SUBCATEGORY MAP ----------
  const SUBCATS = {
    MSK:   ['Shoulder','Elbow','Wrist','Cervical','Lumbar','Hip','Knee','Foot','Inflammatory'],
    CVR:   ['Cardiac','Respiratory','Vascular'],
    NEURO: ['CNS','PNS','Vestibular','Neuromuscular'],
  };

  // ---------- BUILT-IN DATA ----------
  const BUILT_IN = [
    ...(window.MSK_SHOULDER || []),
    ...(window.MSK_ELBOW || []),
    ...(window.MSK_WRIST || []),
    ...(window.MSK_CERVICAL || []),
    ...(window.MSK_LUMBAR || []),
    ...(window.MSK_HIP || []),
    ...(window.MSK_KNEE || []),
    ...(window.MSK_FOOT || []),
    ...(window.MSK_INFLAMMATORY || []),
    ...(window.CVR_CARDIAC || []),
    ...(window.CVR_RESPIRATORY || []),
    ...(window.CVR_VASCULAR || []),
    ...(window.NEURO_CNS || []),
    ...(window.NEURO_PNS || []),
    ...(window.NEURO_VESTIBULAR || []),
    ...(window.NEURO_NEUROMUSCULAR || []),
  ];
  const BUILT_IN_IDS = new Set(BUILT_IN.map(p => p.id));

  // ---------- PERSISTED DATA ----------
  // CUSTOM:    user-created pathologies
  // OVERRIDES: edited fields for built-in pathologies, keyed by id
  let CUSTOM    = JSON.parse(localStorage.getItem('physioref_custom')    || '[]');
  let OVERRIDES = JSON.parse(localStorage.getItem('physioref_overrides') || '{}');

  function saveCustom()    { localStorage.setItem('physioref_custom',    JSON.stringify(CUSTOM));    }
  function saveOverrides() { localStorage.setItem('physioref_overrides', JSON.stringify(OVERRIDES)); }

  // Merge overrides into built-ins; append custom entries
  function allPathologies() {
    return [
      ...BUILT_IN.map(p => OVERRIDES[p.id] ? { ...p, ...OVERRIDES[p.id] } : p),
      ...CUSTOM,
    ];
  }

  function isCustomEntry(id) { return CUSTOM.some(c => c.id === id); }
  function isOverridden(id)  { return !!OVERRIDES[id]; }
  function isBuiltIn(id)     { return BUILT_IN_IDS.has(id); }

  // ---------- STATE ----------
  let activeId     = null;
  let activeFilter = 'ALL';
  let searchQuery  = '';

  // ---------- DOM REFS ----------
  const listEl            = document.getElementById('pathology-list');
  const notesCount        = document.getElementById('notes-count');
  const searchInput       = document.getElementById('search-input');
  const welcomeScreen     = document.getElementById('welcome-screen');
  const contentPanel      = document.getElementById('content-panel');
  const pathologyTitle    = document.getElementById('pathology-title');
  const headerBadge       = document.getElementById('header-badge');
  const pathologyMeta     = document.getElementById('pathology-meta');
  const sectionsContainer = document.getElementById('sections-container');

  // ---------- RENDER SIDEBAR ----------
  function renderSidebar() {
    const q   = searchQuery.toLowerCase().trim();
    const all = allPathologies();
    const filtered = all.filter(p => {
      const matchCat = activeFilter === 'ALL' || p.category === activeFilter;
      const matchQ   = !q || p.name.toLowerCase().includes(q) || p.subcategory.toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    notesCount.textContent = all.length;
    listEl.innerHTML = '';

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="padding:30px 16px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px;">No pathologies found</div>';
      return;
    }

    const groups = {};
    filtered.forEach(p => {
      if (!groups[p.category]) groups[p.category] = {};
      if (!groups[p.category][p.subcategory]) groups[p.category][p.subcategory] = [];
      groups[p.category][p.subcategory].push(p);
    });

    const catOrder  = ['MSK', 'CVR', 'NEURO'];
    const catLabels = { MSK: 'Musculoskeletal', CVR: 'Cardiorespiratory', NEURO: 'Neurology' };

    catOrder.forEach(cat => {
      if (!groups[cat]) return;

      const catDiv = document.createElement('div');
      catDiv.className = 'group-header';
      catDiv.textContent = catLabels[cat] || cat;
      listEl.appendChild(catDiv);

      const knownSubs  = SUBCATS[cat] || [];
      const subcatKeys = Object.keys(groups[cat]).sort((a, b) => {
        const ia = knownSubs.indexOf(a), ib = knownSubs.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });

      subcatKeys.forEach(sub => {
        const subDiv = document.createElement('div');
        subDiv.className = 'subgroup-header';
        subDiv.textContent = sub;
        listEl.appendChild(subDiv);

        groups[cat][sub].forEach(p => {
          const custom     = isCustomEntry(p.id);
          const overridden = isOverridden(p.id);
          const item = document.createElement('div');
          item.className = 'pathology-item' + (p.id === activeId ? ' active' : '');
          item.dataset.id = p.id;
          item.innerHTML = `
            <span class="item-name">${p.name}</span>
            ${custom     ? '<span class="item-custom-dot"   title="Custom pathology"></span>'   : ''}
            ${overridden ? '<span class="item-override-dot" title="Edited"></span>' : ''}
            <span class="item-badge badge-${p.category}">${p.category}</span>
          `;
          item.addEventListener('click', () => selectPathology(p.id));
          listEl.appendChild(item);
        });
      });
    });
  }

  // ---------- CONTENT RENDERING ----------
  // Built-in section content is HTML. Custom/overridden sections may be plain text.
  function looksLikeHTML(str) {
    return /<[a-z][\s\S]*?>/i.test(str);
  }

  function formatInline(str) {
    return str
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,'<em>$1</em>');
  }

  function renderPlainContent(text) {
    if (!text || !text.trim())
      return '<p style="color:#9ca3af;font-style:italic">No content added.</p>';
    return text.split(/\n\n+/).map(block => {
      const lines = block.split('\n').filter(l => l.trim());
      const isList = lines.length && lines.every(l => /^[-•]/.test(l.trim()));
      if (isList) {
        return '<ul>' + lines.map(l =>
          `<li>${formatInline(l.trim().replace(/^[-•]\s*/,''))}</li>`
        ).join('') + '</ul>';
      }
      return '<p>' + lines.map(formatInline).join('<br>') + '</p>';
    }).join('');
  }

  function renderSectionContent(content) {
    return looksLikeHTML(content) ? content : renderPlainContent(content);
  }

  // ---------- SELECT PATHOLOGY ----------
  function selectPathology(id) {
    activeId = id;
    const p = allPathologies().find(x => x.id === id);
    if (!p) return;

    document.querySelectorAll('.pathology-item').forEach(el =>
      el.classList.toggle('active', el.dataset.id === id)
    );

    pathologyTitle.textContent = p.name;
    headerBadge.textContent    = p.category;
    headerBadge.className      = `header-badge header-badge-${p.category}`;

    const custom     = isCustomEntry(id);
    const overridden = isOverridden(id);

    // Every pathology gets an Edit button
    let buttons = `<button class="btn-edit-custom" data-id="${id}">Edit</button>`;
    if (custom)     buttons += `<button class="btn-delete-custom" data-id="${id}">Delete</button>`;
    if (overridden) buttons += `<button class="btn-reset-custom"  data-id="${id}">Reset to original</button>`;

    pathologyMeta.innerHTML = `
      <span>${p.category}</span><span>${p.subcategory}</span>
      <span class="custom-controls">${buttons}</span>
    `;

    pathologyMeta.querySelector('.btn-edit-custom')
      .addEventListener('click', () => openModal(id));
    if (custom) {
      pathologyMeta.querySelector('.btn-delete-custom')
        .addEventListener('click', () => deleteCustom(id));
    }
    if (overridden) {
      pathologyMeta.querySelector('.btn-reset-custom')
        .addEventListener('click', () => resetOverride(id));
    }

    sectionsContainer.innerHTML = '';
    p.sections.forEach(sec => {
      const card = document.createElement('div');
      card.className = 'section-card' + (sec.open ? ' open' : '') + (sec.redFlag ? ' red-flag-card' : '');
      card.innerHTML = `
        <div class="section-header">
          <h3>${sec.title}</h3>
          <span class="section-toggle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </div>
        <div class="section-body">${renderSectionContent(sec.content)}</div>
      `;
      card.querySelector('.section-header').addEventListener('click', () =>
        card.classList.toggle('open')
      );
      sectionsContainer.appendChild(card);
    });

    welcomeScreen.style.display = 'none';
    contentPanel.style.display  = 'flex';
    contentPanel.scrollTop      = 0;

    if (window.innerWidth < 768) document.body.classList.add('content-visible');
  }

  // ---------- MOBILE BACK ----------
  const mobileBackBtn = document.getElementById('mobile-back-btn');
  if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', () => {
      document.body.classList.remove('content-visible');
      activeId = null;
      renderSidebar();
    });
  }

  // ---------- SEARCH ----------
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderSidebar();
  });

  // ---------- FILTER PILLS ----------
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.cat;
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSidebar();
    });
  });

  // ---------- EXPAND / COLLAPSE ALL ----------
  document.getElementById('expand-all').addEventListener('click', () =>
    document.querySelectorAll('.section-card').forEach(c => c.classList.add('open'))
  );
  document.getElementById('collapse-all').addEventListener('click', () =>
    document.querySelectorAll('.section-card').forEach(c => c.classList.remove('open'))
  );

  // ---------- KEYBOARD ----------
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault(); searchInput.focus(); searchInput.select();
    }
    if (e.key === 'Escape') { searchInput.blur(); closeModal(); }
  });

  // ============================
  //  MODAL / EDIT / CRUD
  // ============================

  const modalOverlay  = document.getElementById('modal-overlay');
  const modalTitle    = document.getElementById('modal-title');
  const modalClose    = document.getElementById('modal-close');
  const formEditId    = document.getElementById('form-edit-id');
  const formName      = document.getElementById('form-name');
  const formCategory  = document.getElementById('form-category');
  const formSubcat    = document.getElementById('form-subcategory');
  const subcatList    = document.getElementById('subcategory-list');
  const sectionInputs = document.getElementById('section-inputs');
  const addSectionBtn = document.getElementById('add-section-btn');
  const formCancel    = document.getElementById('form-cancel');
  const formSave      = document.getElementById('form-save');
  const aiGenerateBtn = document.getElementById('ai-generate-btn');

  const DEFAULT_SECTION_TITLES = [
    'Overview & Definition',
    'Clinical Presentation',
    'Assessment & Outcome Measures',
    '⚠ Red Flags',
    'Physiotherapy Management',
    'Evidence Base & Guidelines',
  ];

  function updateSubcatList() {
    subcatList.innerHTML = (SUBCATS[formCategory.value] || [])
      .map(o => `<option value="${o}">`).join('');
  }
  formCategory.addEventListener('change', updateSubcatList);

  function addSectionRow(title = '', content = '', isRedFlag = false, isOpen = false) {
    const row = document.createElement('div');
    row.className = 'section-row';
    const uid = Date.now() + '-' + Math.random().toString(36).slice(2);
    row.innerHTML = `
      <div class="section-row-top">
        <input type="text" class="form-input sec-title"
               placeholder="Section title, e.g. Overview &amp; Definition"
               value="${title.replace(/"/g,'&quot;')}">
        <button type="button" class="del-section-btn" title="Remove section">&#x2715;</button>
      </div>
      <textarea class="form-input sec-content"
                placeholder="Your notes…&#10;&#10;Use **bold**, *italic*, or lines starting with - for bullets.&#10;HTML is also supported."
                style="min-height:140px">${content}</textarea>
      <div class="section-redflag-row">
        <input type="checkbox" id="rf-${uid}" class="sec-redflag" ${isRedFlag ? 'checked' : ''}>
        <label for="rf-${uid}">Red Flag section</label>
        <input type="checkbox" id="op-${uid}" class="sec-open" style="margin-left:12px" ${isOpen ? 'checked' : ''}>
        <label for="op-${uid}">Open by default</label>
      </div>
    `;
    row.querySelector('.del-section-btn').addEventListener('click', () => row.remove());
    sectionInputs.appendChild(row);
  }

  // Open modal: null = new custom, id = edit existing (built-in or custom)
  function openModal(editId = null) {
    formEditId.value        = editId || '';
    sectionInputs.innerHTML = '';
    updateSubcatList();

    if (editId) {
      const p = allPathologies().find(x => x.id === editId);
      if (!p) return;
      modalTitle.textContent = 'Edit Pathology';
      formName.value     = p.name;
      formCategory.value = p.category;
      updateSubcatList();
      formSubcat.value   = p.subcategory;
      p.sections.forEach(s => addSectionRow(s.title, s.content, s.redFlag, s.open));
    } else {
      modalTitle.textContent = 'Add Pathology';
      formName.value     = '';
      formCategory.value = 'MSK';
      updateSubcatList();
      formSubcat.value   = '';
      DEFAULT_SECTION_TITLES.forEach(t =>
        addSectionRow(
          t, '',
          t.includes('⚠') || t.toLowerCase().includes('red flag'),
          t !== 'Assessment & Outcome Measures' && t !== 'Evidence Base & Guidelines'
        )
      );
    }

    modalOverlay.classList.add('open');
    setTimeout(() => formName.focus(), 80);
  }

  function closeModal() { modalOverlay.classList.remove('open'); }

  function collectSections() {
    return Array.from(sectionInputs.querySelectorAll('.section-row')).map(row => ({
      title:   row.querySelector('.sec-title').value.trim() || 'Section',
      content: row.querySelector('.sec-content').value,
      redFlag: row.querySelector('.sec-redflag').checked,
      open:    row.querySelector('.sec-open').checked,
    }));
  }

  // Save: route to OVERRIDES (built-in) or CUSTOM array
  formSave.addEventListener('click', () => {
    const name   = formName.value.trim();
    const cat    = formCategory.value;
    const subcat = formSubcat.value.trim();
    if (!name)   { formName.focus();   return; }
    if (!subcat) { formSubcat.focus(); return; }

    const sections = collectSections();
    const editId   = formEditId.value;

    if (!editId) {
      CUSTOM.push({ id: 'custom-' + Date.now(), name, category: cat, subcategory: subcat, sections });
      saveCustom();
    } else if (isBuiltIn(editId)) {
      OVERRIDES[editId] = { name, category: cat, subcategory: subcat, sections };
      saveOverrides();
    } else {
      const idx = CUSTOM.findIndex(c => c.id === editId);
      if (idx !== -1) CUSTOM[idx] = { ...CUSTOM[idx], name, category: cat, subcategory: subcat, sections };
      saveCustom();
    }

    closeModal();
    renderSidebar();
    if (editId && activeId === editId) selectPathology(editId);
  });

  function deleteCustom(id) {
    const p = allPathologies().find(x => x.id === id);
    if (!confirm(`Delete "${p?.name}"?\n\nThis cannot be undone.`)) return;
    CUSTOM = CUSTOM.filter(c => c.id !== id);
    saveCustom();
    clearContentView();
    renderSidebar();
  }

  function resetOverride(id) {
    const p = BUILT_IN.find(x => x.id === id);
    if (!confirm(`Reset "${p?.name}" back to the original content?\n\nYour edits will be lost.`)) return;
    delete OVERRIDES[id];
    saveOverrides();
    renderSidebar();
    if (activeId === id) selectPathology(id);
  }

  function clearContentView() {
    activeId = null;
    contentPanel.style.display  = 'none';
    welcomeScreen.style.display = 'flex';
    if (window.innerWidth < 768) document.body.classList.remove('content-visible');
  }

  // ---------- AI GENERATE ----------

  formName.addEventListener('input', () => {
    aiGenerateBtn.disabled = !formName.value.trim();
  });

  // ---------- API KEY DIALOG ----------
  const apikeyOverlay = document.getElementById('apikey-overlay');
  const apikeyInput   = document.getElementById('apikey-input');
  const apikeyConfirm = document.getElementById('apikey-confirm');
  const apikeyCancel  = document.getElementById('apikey-cancel');

  function promptApiKey() {
    return new Promise(resolve => {
      apikeyInput.value = '';
      apikeyOverlay.classList.add('open');
      setTimeout(() => apikeyInput.focus(), 80);

      function finish(val) {
        apikeyOverlay.classList.remove('open');
        apikeyConfirm.removeEventListener('click', onConfirm);
        apikeyCancel.removeEventListener('click', onCancel);
        resolve(val);
      }
      function onConfirm() {
        const val = apikeyInput.value.trim();
        if (!val) { apikeyInput.focus(); return; }
        localStorage.setItem('anthropic_api_key', val);
        finish(val);
      }
      function onCancel() { finish(null); }

      apikeyConfirm.addEventListener('click', onConfirm);
      apikeyCancel.addEventListener('click', onCancel);
      apikeyInput.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Enter')  { onConfirm(); apikeyInput.removeEventListener('keydown', onKey); }
        if (e.key === 'Escape') { onCancel();  apikeyInput.removeEventListener('keydown', onKey); }
      });
    });
  }

  async function getApiKey() {
    const stored = localStorage.getItem('anthropic_api_key');
    if (stored) return stored;
    return await promptApiKey();
  }

  async function callAnthropicAPI(pathologyName) {
    const apiKey = await getApiKey();
    if (!apiKey) throw new Error('No API key provided.');

    const prompt = `You are a clinical reference assistant for physiotherapists. Generate structured clinical notes for the pathology: "${pathologyName}".

Return ONLY valid JSON in this exact structure (no markdown, no extra text, no code fences):
{
  "category": "MSK",
  "subcategory": "<specific body region or system, e.g. Knee, Cardiac, CNS>",
  "sections": [
    { "title": "Overview & Definition", "content": "<text>", "redFlag": false, "open": true },
    { "title": "Clinical Presentation", "content": "<text>", "redFlag": false, "open": true },
    { "title": "Assessment & Outcome Measures", "content": "<text>", "redFlag": false, "open": false },
    { "title": "⚠ Red Flags", "content": "<text>", "redFlag": true, "open": true },
    { "title": "Physiotherapy Management", "content": "<text>", "redFlag": false, "open": true },
    { "title": "Evidence Base & Guidelines", "content": "<text>", "redFlag": false, "open": false }
  ]
}

category must be one of: MSK, CVR, NEURO. Use **bold**, *italic*, or lines starting with - for bullets in content fields. Be concise but clinically thorough.`;

    const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;
    let json, res;

    if (isElectron) {
      // Direct call from Electron desktop app (no CORS restrictions)
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      json = await res.json();
    } else {
      // Browser/mobile — route through local proxy to avoid CORS
      res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pathologyName, apiKey })
      });
      json = await res.json();
    }

    if (res.status === 401) {
      localStorage.removeItem('anthropic_api_key');
      throw new Error('Invalid API key — please try again.');
    }
    if (!res.ok) throw new Error(json.error?.message || `API error ${res.status}`);
    return json.content?.[0]?.text || '';
  }

  aiGenerateBtn.addEventListener('click', async () => {
    const name = formName.value.trim();
    if (!name) return;

    aiGenerateBtn.disabled = true;
    aiGenerateBtn.classList.add('loading');
    aiGenerateBtn.textContent = '⏳ Generating…';

    try {
      const rawText = await callAnthropicAPI(name);
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response.');
      const data = JSON.parse(jsonMatch[0]);

      if (data.category && ['MSK','CVR','NEURO'].includes(data.category)) {
        formCategory.value = data.category;
        updateSubcatList();
      }
      if (data.subcategory) formSubcat.value = data.subcategory;

      if (Array.isArray(data.sections) && data.sections.length) {
        sectionInputs.innerHTML = '';
        data.sections.forEach(s => addSectionRow(s.title || '', s.content || '', !!s.redFlag, !!s.open));
      }
    } catch (err) {
      alert('AI generation failed: ' + err.message);
    } finally {
      aiGenerateBtn.classList.remove('loading');
      aiGenerateBtn.disabled = !formName.value.trim();
      aiGenerateBtn.textContent = '✦ AI Generate Notes';
    }
  });

  // Wire up modal controls
  document.getElementById('add-pathology-btn').addEventListener('click', () => openModal());
  modalClose.addEventListener('click', closeModal);
  formCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  addSectionBtn.addEventListener('click', () => addSectionRow());

  // ---------- INITIAL RENDER ----------
  renderSidebar();

})();
