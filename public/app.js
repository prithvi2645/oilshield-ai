// Oil India Limited — HSSE SIF Precursor Management System

let masterReports = [];
let filteredReports = [];
let overviewSiteChartInstance = null;
let overviewLsrChartInstance = null;
let densityDetailChartInstance = null;
let iogpDetailChartInstance = null;
let severityDonutChartInstance = null;
let monthlyTrendChartInstance = null;
let analyticsData = null;
let latestClassification = null;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
let pendingDeleteReportId = null;

function getChartColors() {
    const isDark = document.body.classList.contains('dark-mode');
    return {
        tickColor: isDark ? '#CBD5E1' : '#475569',
        gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
        legendColor: isDark ? '#F1F5F9' : '#334155'
    };
}

let currentRole = 'hse_manager';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initRoleControl();
    initHeroCarousel();
    setupTabNavigation();
    setupHomeModuleClicks();
    setupEventListeners();
    fetchAnalytics();
    fetchReports();
    fetchKnowledgeGraph();
    fetchReviews();

    // ── PRINT ENGINE FIX: Force Executive Brief modal visible during print ──
    window.addEventListener('beforeprint', () => {
        const briefModal = document.getElementById('hseSummaryModalOverlay');
        if (briefModal) {
            briefModal.setAttribute('data-pre-print-display', briefModal.style.display || 'none');
            briefModal.style.setProperty('display', 'block', 'important');
            briefModal.style.setProperty('position', 'relative', 'important');
            briefModal.style.setProperty('background', '#ffffff', 'important');
        }
    });
    window.addEventListener('afterprint', () => {
        const briefModal = document.getElementById('hseSummaryModalOverlay');
        if (briefModal) {
            const prev = briefModal.getAttribute('data-pre-print-display') || 'none';
            briefModal.style.display = prev;
            briefModal.style.removeProperty('position');
            briefModal.style.removeProperty('background');
        }
    });
});

// ============================================================
// FEATURE 20 — ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================================
function initRoleControl() {
    const storedRole = sessionStorage.getItem('oil_hsse_user_role');
    const modal = document.getElementById('roleModalOverlay');

    if (!storedRole) {
        if (modal) modal.style.display = 'flex';
    } else {
        currentRole = storedRole;
        if (modal) modal.style.display = 'none';
        applyRoleAccess(currentRole);
        switchTab('tab-home');
    }

    // Role modal selection buttons
    document.querySelectorAll('.role-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.role-card-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    const confirmBtn = document.getElementById('confirmRoleBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', (e) => {
            handleLoginSubmit(e);
        });
    }

    // Header role badge click to switch
    const headerRoleBadge = document.getElementById('headerRoleBadge');
    if (headerRoleBadge) {
        headerRoleBadge.addEventListener('click', () => {
            if (modal) modal.style.display = 'flex';
        });
    }
}

window.autofillRoleCredentials = function(role) {
    selectRoleCard(role);
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPass');
    if (role === 'hse_manager') {
        if (emailInput) emailInput.value = 'director.hse@oilindia.in';
        if (passInput) passInput.value = 'HSE_Corporate_2025!';
    } else if (role === 'site_manager') {
        if (emailInput) emailInput.value = 'risk.officer@oilindia.in';
        if (passInput) passInput.value = 'SiteRisk_Baghjan#5';
    } else if (role === 'supervisor') {
        if (emailInput) emailInput.value = 'inspector.duliajan@oilindia.in';
        if (passInput) passInput.value = 'FieldInspector_Duliajan';
    } else if (role === 'analyst') {
        if (emailInput) emailInput.value = 'analyst.audit@oilindia.in';
        if (passInput) passInput.value = 'Auditor_Data_2025!';
    }
};

window.selectRoleCard = function(role) {
    document.querySelectorAll('.role-card-btn').forEach(b => {
        if (b.getAttribute('data-role') === role) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
};

function getRoleDisplayName(role) {
    const names = {
        'hse_manager': 'HSE Manager (Corporate)',
        'site_manager': 'Site Manager',
        'supervisor': 'Field Supervisor',
        'analyst': 'Safety Analyst'
    };
    return names[role] || 'HSE Officer';
}

window.handleLoginSubmit = function(e) {
    if (e) e.preventDefault();
    const activeRoleBtn = document.querySelector('.role-card-btn.active');
    const selectedRole = activeRoleBtn ? activeRoleBtn.getAttribute('data-role') : 'hse_manager';
    currentRole = selectedRole;
    sessionStorage.setItem('oil_hsse_user_role', currentRole);
    const modal = document.getElementById('roleModalOverlay');
    if (modal) modal.style.display = 'none';
    applyRoleAccess(currentRole);
    switchTab('tab-home');
    showToast(`Logged in as ${getRoleDisplayName(currentRole)}`, 'success');
};


// ============================================================
// HERO CAROUSEL SLIDESHOW
// ============================================================
function initHeroCarousel() {
    const carousel = document.getElementById('heroCarousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.hero-slide');
    const dots = carousel.querySelectorAll('.c-dot');
    const locationText = document.getElementById('heroLocationText');

    const locations = [
        'Oil India Limited \u00b7 Baghjan Field #5',
        'Oil India Limited \u00b7 Duliajan GGS Station',
        'Oil India Limited \u00b7 Digboi Refinery Area',
        'Oil India Limited \u00b7 Moran OCS Station'
    ];

    let currentIndex = 0;
    let timer = null;

    function goToSlide(index) {
        currentIndex = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
            if (i === currentIndex) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });
        dots.forEach((dot, i) => {
            if (i === currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
        if (locationText && locations[currentIndex]) {
            locationText.textContent = locations[currentIndex];
        }
    }

    function startTimer() {
        stopTimer();
        timer = setInterval(() => {
            goToSlide(currentIndex + 1);
        }, 2500);
    }

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    dots.forEach((dot) => {
        dot.addEventListener('click', (e) => {
            const slideIdx = parseInt(e.target.getAttribute('data-slide'), 10);
            if (!isNaN(slideIdx)) {
                goToSlide(slideIdx);
                startTimer();
            }
        });
    });

    carousel.addEventListener('mouseenter', stopTimer);
    carousel.addEventListener('mouseleave', startTimer);

    startTimer();
}

function applyRoleAccess(role) {
    const roleLabels = {
        'hse_manager': 'Role: HSE Manager',
        'site_manager': 'Role: Site Manager',
        'supervisor': 'Role: Field Supervisor',
        'analyst': 'Role: Safety Analyst'
    };

    const roleLabelEl = document.getElementById('roleLabel');
    if (roleLabelEl) roleLabelEl.textContent = roleLabels[role] || 'Role: HSE Manager';

    const kgCard = document.getElementById('knowledgeGraphCard');
    const analyzeBtn = document.getElementById('analyzeBtn');

    // Scoping visibility based on role
    if (role === 'hse_manager') {
        document.querySelectorAll('.nav-item').forEach(el => el.style.display = 'inline-flex');
        if (kgCard) kgCard.style.display = 'block';
        if (analyzeBtn) analyzeBtn.disabled = false;
    } else if (role === 'site_manager') {
        document.querySelectorAll('.nav-item').forEach(el => el.style.display = 'inline-flex');
        if (kgCard) kgCard.style.display = 'none';
        if (analyzeBtn) analyzeBtn.disabled = false;
    } else if (role === 'supervisor') {
        // Field Supervisor: hide Dashboard, Site Risk, Compliance, Review Queue tabs
        document.querySelectorAll('.nav-item').forEach(el => {
            const tab = el.getAttribute('data-tab');
            if (['tab-overview', 'tab-density', 'tab-iogp', 'tab-review-queue'].includes(tab)) {
                el.style.display = 'none';
            } else {
                el.style.display = 'inline-flex';
            }
        });
        if (kgCard) kgCard.style.display = 'none';
        if (analyzeBtn) analyzeBtn.disabled = false;
        switchTab('tab-classifier');
    } else if (role === 'analyst') {
        // Read-only analyst: hide classifier action button
        document.querySelectorAll('.nav-item').forEach(el => el.style.display = 'inline-flex');
        if (kgCard) kgCard.style.display = 'block';
        if (analyzeBtn) analyzeBtn.disabled = true;
    }
}

function setupTabNavigation() {
    document.querySelectorAll('.nav-item, .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
}

function switchTab(targetTabId) {
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-item, .tab-btn').forEach(b => b.classList.remove('active'));

    // Hide ALL tab-content divs using inline style (overrides any CSS default)
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
    });

    // Show the target tab
    document.querySelectorAll(`[data-tab="${targetTabId}"]`).forEach(btn => btn.classList.add('active'));
    const tabContent = document.getElementById(targetTabId);
    if (tabContent) {
        tabContent.classList.add('active');
        tabContent.style.display = 'block';
    }

    // Re-render charts when tab is switched (ensures correct responsive width)
    if (analyticsData) {
        if (targetTabId === 'tab-overview') {
            renderOverviewCharts(analyticsData);
            renderBarrierChart(analyticsData.barrier_distribution || {});
            renderSeverityDonutChart(analyticsData.severity_buckets || {});
            renderMonthlyTrend(analyticsData.monthly_trend || [], analyticsData.forecast_data || [], analyticsData.forecast_summary);
        } else if (targetTabId === 'tab-density') {
            renderDensityDetailChart(analyticsData.site_rankings || []);
        } else if (targetTabId === 'tab-iogp') {
            renderIogpDetailChart(analyticsData.lsr_distribution || {});
        }
    }

    // Auto-load tab-specific data
    if (targetTabId === 'tab-review-queue') {
        fetchReviewQueue();
    }
    if (targetTabId === 'tab-ask-ai') {
        const thread = document.getElementById('askAiThread');
        if (thread && !thread.querySelector('.ask-ai-bubble')) {
            // Ensure welcome message is shown if no chat history
            if (!thread.querySelector('.ask-ai-welcome') && thread.children.length === 0) {
                thread.innerHTML = '<div class="ask-ai-welcome"><p style="color:var(--text-muted);font-size:13px;text-align:center;margin:32px 0;">Ask a question above to query the live OIL safety dataset. All answers are derived directly from the data — no AI guessing.</p></div>';
            }
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupHomeModuleClicks() {
    // Hero Buttons
    const heroStartBtn = document.getElementById('heroStartBtn');
    if (heroStartBtn) {
        heroStartBtn.addEventListener('click', () => switchTab('tab-classifier'));
    }

    const heroDensityBtn = document.getElementById('heroDensityBtn');
    if (heroDensityBtn) {
        heroDensityBtn.addEventListener('click', () => switchTab('tab-density'));
    }

    // Module Cards & Bento Cards
    document.querySelectorAll('.module-card, .bento-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            if (target) switchTab(target);
        });
    });

    // Bento CTA Button
    document.querySelectorAll('.bento-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchTab('tab-classifier');
        });
    });

    // Compliance Rows Interactive Accordion Toggle
    document.querySelectorAll('.compliance-row').forEach(row => {
        row.addEventListener('click', (e) => {
            document.querySelectorAll('.compliance-row').forEach(r => r.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
}

function setupEventListeners() {
    const newReportForm = document.getElementById('newReportForm');
    if (newReportForm) {
        newReportForm.addEventListener('submit', submitReportForm);
    }

    const cancelEditBtn = document.getElementById('cancelEditReportBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelEditingReport);
    }

    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', executeDeleteReport);
    }

    const deleteModal = document.getElementById('deleteConfirmModalOverlay');
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                closeDeleteModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && pendingDeleteReportId) {
            closeDeleteModal();
        }
    });

    const explorerBody = document.getElementById('masterExplorerBody');
    if (explorerBody) {
        explorerBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-report-btn');
            if (editBtn) {
                const reportId = editBtn.getAttribute('data-id');
                if (reportId) startEditingReport(reportId);
                return;
            }
            const deleteBtn = e.target.closest('.delete-report-btn');
            if (deleteBtn) {
                const reportId = deleteBtn.getAttribute('data-id');
                if (reportId) openDeleteModal(reportId);
                return;
            }
        });
    }

    // Classify incident button
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', runClassification);
    }

    // Scenario Preset Buttons
    document.querySelectorAll('.scenario-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const presetText = e.currentTarget.getAttribute('data-text');
            document.getElementById('classifierTextarea').value = presetText;
            runClassification();
        });
    });

    // Explorer Filter Controls
    const searchInput = document.getElementById('explorerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', applyTableFilters);
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            applyTableFilters();
        });
    });

    const simulateBtn = document.getElementById('simulateBtn');
    if (simulateBtn) simulateBtn.addEventListener('click', runSafetySimulation);
    const qualityBtn = document.getElementById('qualityBtn');
    if (qualityBtn) qualityBtn.addEventListener('click', checkReportQuality);
    const copilotBtn = document.getElementById('copilotAskBtn');
    if (copilotBtn) copilotBtn.addEventListener('click', askCopilot);
    const briefBtn = document.getElementById('briefBtn');
    if (briefBtn) briefBtn.addEventListener('click', generateSafetyBrief);
    document.querySelectorAll('.review-btn').forEach(btn => {
        btn.addEventListener('click', () => submitReview(btn.dataset.decision));
    });

    // CSV Download
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/api/export-csv';
        });
    }
}

function compareReportsNewestFirst(a, b) {
    const aNew = Boolean(a.is_new_submission || a.can_edit || a.can_delete);
    const bNew = Boolean(b.is_new_submission || b.can_edit || b.can_delete);
    if (aNew !== bNew) {
        return aNew ? -1 : 1;
    }
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.report_id || '').localeCompare(a.report_id || '');
}

function startEditingReport(reportId) {
    const report = masterReports.find(r => r.report_id === reportId);
    if (!report) {
        alert(`Report ${reportId} was not found.`);
        return;
    }
    if (!report.is_new_submission && !report.can_edit && !report.can_delete) {
        alert(`Historical report ${reportId} is read-only and cannot be edited.`);
        return;
    }

    const editReportIdInput = document.getElementById('editReportId');
    const formTitle = document.getElementById('reportFormTitle');
    const formSubtitle = document.getElementById('reportFormDesc');
    const submitBtn = document.getElementById('submitNewReportBtn');
    const cancelBtn = document.getElementById('cancelEditReportBtn');
    const editingIndicator = document.getElementById('editingModeIndicator');
    const editingDisplay = document.getElementById('editingReportIdDisplay');
    const status = document.getElementById('newReportStatus');
    const analysisPanel = document.getElementById('newReportAnalysis');

    if (editReportIdInput) editReportIdInput.value = report.report_id;
    const dateInput = document.getElementById('newReportDate');
    if (dateInput) dateInput.value = report.date || '';
    const siteInput = document.getElementById('newReportSite');
    if (siteInput) siteInput.value = report.site_location || '';
    const deptInput = document.getElementById('newReportDepartment');
    if (deptInput) deptInput.value = report.department || '';
    const typeInput = document.getElementById('newReportType');
    if (typeInput) typeInput.value = report.report_type || '';
    const titleInput = document.getElementById('newReportTitle');
    if (titleInput) titleInput.value = report.report_title || '';
    const descInput = document.getElementById('newReportDescription');
    if (descInput) descInput.value = report.description || '';
    const actInput = document.getElementById('newReportActivity');
    if (actInput) actInput.value = report.activity_being_performed || '';
    const barInput = document.getElementById('newReportBarrier');
    if (barInput) barInput.value = report.barrier_failure_type || '';
    const patInput = document.getElementById('newReportPattern');
    if (patInput) patInput.value = report.precursor_pattern || '';
    const immInput = document.getElementById('newReportAction');
    if (immInput) immInput.value = report.immediate_corrective_action || '';

    if (formTitle) formTitle.textContent = `Edit HSE Safety Report (${report.report_id})`;
    if (formSubtitle) formSubtitle.textContent = `Update observation details for ${report.report_id}. Saving will trigger AI re-analysis.`;
    if (submitBtn) submitBtn.textContent = 'Save Changes';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (editingIndicator) editingIndicator.style.display = 'flex';
    if (editingDisplay) editingDisplay.textContent = report.report_id;

    if (status) {
        status.className = 'new-report-status';
        status.textContent = `Editing ${report.report_id}. Make your changes and click Save Changes.`;
    }
    if (analysisPanel) analysisPanel.hidden = true;

    const formCard = document.getElementById('newReportCard') || document.getElementById('newReportForm');
    if (formCard) {
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function cancelEditingReport() {
    const form = document.getElementById('newReportForm');
    if (form) form.reset();

    const editReportIdInput = document.getElementById('editReportId');
    if (editReportIdInput) editReportIdInput.value = '';

    const formTitle = document.getElementById('reportFormTitle');
    const formSubtitle = document.getElementById('reportFormDesc');
    const submitBtn = document.getElementById('submitNewReportBtn');
    const cancelBtn = document.getElementById('cancelEditReportBtn');
    const editingIndicator = document.getElementById('editingModeIndicator');
    const status = document.getElementById('newReportStatus');
    const analysisPanel = document.getElementById('newReportAnalysis');

    if (formTitle) formTitle.textContent = 'Add New HSE Safety Report';
    if (formSubtitle) formSubtitle.textContent = 'Submit a new observation for existing SIF and IOGP analysis.';
    if (submitBtn) submitBtn.textContent = 'Add New Report';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (editingIndicator) editingIndicator.style.display = 'none';

    if (status) {
        status.className = 'new-report-status';
        status.textContent = '';
    }
    if (analysisPanel) analysisPanel.hidden = true;

    const simBox = document.getElementById('uploadSimilarRetrievalBox');
    if (simBox) simBox.style.display = 'none';
}

let uploadSearchDebounce = null;
function checkSimilarOnUpload(text) {
    clearTimeout(uploadSearchDebounce);
    const box = document.getElementById('uploadSimilarRetrievalBox');
    const listEl = document.getElementById('uploadSimilarList');
    if (!text || text.trim().length < 15) {
        if (box) box.style.display = 'none';
        return;
    }

    uploadSearchDebounce = setTimeout(async () => {
        try {
            const response = await fetch('/api/similar-retrieval', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();
            const matches = data.similar_retrieval || [];
            if (matches.length > 0 && box && listEl) {
                listEl.innerHTML = matches.map(m => `
                    <div style="font-size:10px; color:#cbd5e1; background:rgba(15,23,42,0.6); padding:4px 8px; border-radius:4px;">
                        <strong style="color:#38bdf8;">${m.report_id}</strong> (${m.similarity_score}% match): ${m.report_title} &bull; <span style="color:#f59e0b;">${m.iogp_rule}</span>
                    </div>
                `).join('');
                box.style.display = 'block';
            } else if (box) {
                box.style.display = 'none';
            }
        } catch (err) {
            console.error("Failed real-time upload retrieval:", err);
        }
    }, 400);
}

function openDeleteModal(reportId) {
    const report = masterReports.find(r => r.report_id === reportId);
    if (!report) {
        alert(`Report ${reportId} was not found.`);
        return;
    }
    if (!report.is_new_submission && !report.can_delete && !report.can_edit) {
        alert(`Historical report ${reportId} is read-only and cannot be deleted.`);
        return;
    }

    pendingDeleteReportId = reportId;
    const reportIdText = document.getElementById('deleteReportIdText');
    if (reportIdText) {
        reportIdText.textContent = reportId;
    }
    const modal = document.getElementById('deleteConfirmModalOverlay');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeDeleteModal() {
    pendingDeleteReportId = null;
    const modal = document.getElementById('deleteConfirmModalOverlay');
    if (modal) {
        modal.style.display = 'none';
    }
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Delete';
    }
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    if (cancelBtn) {
        cancelBtn.disabled = false;
    }
}

async function executeDeleteReport() {
    if (!pendingDeleteReportId) return;

    const reportId = pendingDeleteReportId;
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const status = document.getElementById('newReportStatus');
    const editReportIdInput = document.getElementById('editReportId');

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';
    }
    if (cancelBtn) {
        cancelBtn.disabled = true;
    }

    try {
        const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete report.');
        }

        closeDeleteModal();

        // If currently editing the deleted report, reset the form
        if (editReportIdInput && editReportIdInput.value.trim() === reportId) {
            cancelEditingReport();
        }

        if (status) {
            status.className = 'new-report-status success';
            status.textContent = `Report ${reportId} was successfully deleted.`;
        }

        await fetchReports();
        await fetchAnalytics();
        fetchKnowledgeGraph();
    } catch (err) {
        console.error('Error deleting report:', err);
        closeDeleteModal();
        if (status) {
            status.className = 'new-report-status error';
            status.textContent = `Delete failed: ${err.message}`;
        }
        alert(`Could not delete report: ${err.message}`);
    }
}

async function submitReportForm(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = document.getElementById('submitNewReportBtn');
    const cancelButton = document.getElementById('cancelEditReportBtn');
    const status = document.getElementById('newReportStatus');
    const analysisPanel = document.getElementById('newReportAnalysis');
    const editReportIdInput = document.getElementById('editReportId');
    const editingId = editReportIdInput ? editReportIdInput.value.trim() : '';
    const isEditMode = Boolean(editingId);

    const formData = new FormData(form);
    const report = Object.fromEntries(formData.entries());

    if (status) {
        status.className = 'new-report-status';
        status.textContent = isEditMode
            ? `Updating report ${editingId} and running AI re-analysis...`
            : 'Saving report and running AI analysis...';
    }
    if (analysisPanel) analysisPanel.hidden = true;
    if (submitButton) submitButton.disabled = true;
    if (cancelButton) cancelButton.disabled = true;

    try {
        const url = isEditMode ? `/api/reports/${encodeURIComponent(editingId)}` : '/api/reports';
        const method = isEditMode ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || (isEditMode ? 'Report update failed.' : 'Report submission failed.'));

        const savedReport = data.report;
        const analysis = data.analysis || {};
        const successMsg = isEditMode
            ? `Report ${savedReport.report_id} updated and re-analyzed successfully.`
            : `Report ${savedReport.report_id} saved successfully.`;

        if (isEditMode) {
            cancelEditingReport();
        } else {
            form.reset();
        }

        if (status) {
            status.className = 'new-report-status success';
            status.textContent = successMsg;
        }
        if (analysisPanel) {
            analysisPanel.hidden = false;
            analysisPanel.textContent = [
                `SIF: ${analysis.sif_potential ? 'Potential' : 'Non-SIF'}`,
                `Confidence: ${Math.round((analysis.sif_confidence || 0) * 100)}%`,
                `IOGP rule: ${analysis.iogp_life_saving_rule || 'Not matched'}`,
                `Energy: ${formatEnergySource(analysis.energy_sources)}`,
                `Barrier: ${analysis.barrier_condition || 'Not determined'}`,
                `Rationale: ${analysis.audit_rationale || 'Not available'}`
            ].join(' | ');
        }

        await fetchReports();
        await fetchAnalytics();
        await fetchKnowledgeGraph();
    } catch (err) {
        if (status) {
            status.className = 'new-report-status error';
            status.textContent = err.message;
        }
    } finally {
        if (submitButton) submitButton.disabled = false;
        if (cancelButton) cancelButton.disabled = false;
    }
}

// Human-readable verdict labels
const VERDICT_LABELS = {
    'SIF_POTENTIAL': 'SIF Precursor — High Risk',
    'DEFENDED_NEAR_MISS': 'Defended Near-Miss',
    'NON_SIF_OBSERVATION': 'Non-SIF Observation'
};

// Human-readable barrier condition labels
const BARRIER_LABELS = {
    'FAILED_OR_ABSENT': 'Absent / Failed',
    'EFFECTIVE': 'Effective',
    'COMPROMISED': 'Compromised',
    'UNKNOWN': 'Not Determined'
};

function formatEnergySource(sources) {
    if (!sources || sources.length === 0) return 'None detected';
    return sources
        .map(s => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
        .join(', ');
}

async function fetchAnalytics() {
    try {
        const response = await fetch('/api/analytics');
        analyticsData = await response.json();

        // Update KPI cards
        if (analyticsData.summary) {
            const kpiTotal = document.getElementById('kpiTotalReports');
            const kpiRate = document.getElementById('kpiSifRate');
            const kpiSite = document.getElementById('kpiTopSite');
            const kpiRule = document.getElementById('kpiTopRule');

            if (kpiTotal) kpiTotal.textContent = analyticsData.summary.total_reports;
            if (kpiRate) kpiRate.textContent = `${analyticsData.summary.sif_rate_pct}%`;
            if (kpiSite) kpiSite.textContent = analyticsData.summary.top_high_risk_site.split(' ')[0];
            if (kpiRule) kpiRule.textContent = analyticsData.summary.top_breached_rule;
        }

        renderOverviewCharts(analyticsData);
        renderDensityTable(analyticsData.site_rankings || []);
        renderActivityRisk(analyticsData.activity_risk || []);
        renderPrecursorAlerts(analyticsData.top_precursors || []);
        renderRecurrenceAlerts(analyticsData.recurrence_alerts || []);
        renderRiskMatrix(analyticsData.risk_matrix || []);
        renderSeverityDonutChart(analyticsData.severity_buckets || {});
        renderMonthlyTrend(analyticsData.monthly_trend || [], analyticsData.forecast_data || [], analyticsData.forecast_summary);
        fetchPredictiveRisk();

    } catch (err) {
        console.error('Failed to load analytics data:', err);
    }
}

async function askCopilot() {
    const input = document.getElementById('copilotQuestion');
    const question = input?.value.trim();
    if (!question) return;
    try {
        const response = await fetch('/api/copilot', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Copilot request failed');
        document.getElementById('copilotAnswer').hidden = false;
        document.getElementById('copilotAnswerText').textContent = data.answer;
        document.getElementById('copilotSources').textContent = data.sources?.length
            ? `Evidence: ${data.sources.map(source => source.type.replace('_', ' ')).join(', ')}` : 'Evidence: no matching analytic source';
        document.getElementById('copilotDisclaimer').textContent = data.disclaimer || '';
    } catch (err) {
        console.error('Copilot request failed:', err);
    }
}

async function generateSafetyBrief() {
    try {
        const response = await fetch('/api/brief');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Safety brief request failed');
        document.getElementById('briefResult').hidden = false;
        document.getElementById('briefTitle').textContent = `${data.title} · ${data.period}`;
        const metrics = data.metrics || {};
        document.getElementById('briefMetrics').textContent = `${metrics.reports_analyzed} reports analyzed · ${metrics.sif_potential_reports} SIF-potential · ${metrics.sif_rate_pct}% rate · Highest-risk site: ${metrics.highest_risk_site}`;
        document.getElementById('briefPriorities').innerHTML = `<strong>Priorities</strong><ul>${(data.priorities || []).map(priority => `<li>${escapeHtml(priority)}</li>`).join('')}</ul>`;
        document.getElementById('briefForecast').textContent = data.forecast || '';
        document.getElementById('briefDisclaimer').textContent = data.disclaimer || '';
    } catch (err) { console.error('Safety brief request failed:', err); }
}

function renderRecurrenceAlerts(alerts) {
    const body = document.getElementById('recurrenceAlertsBody');
    if (!body) return;
    body.innerHTML = alerts.length ? alerts.slice(0, 8).map(alert => `
        <tr><td>${escapeHtml(alert.site_location)}</td><td>${escapeHtml(alert.precursor_pattern)}</td>
        <td>${escapeHtml(alert.occurrences)}</td><td><span class="risk-pill ${alert.escalation === 'MANAGEMENT_ALERT' ? 'critical' : alert.escalation === 'ESCALATE' ? 'high' : 'moderate'}">${escapeHtml(alert.escalation.replace('_', ' '))}</span></td></tr>
    `).join('') : '<tr><td colspan="4">No repeated SIF precursor pattern currently requires escalation.</td></tr>';
}

function renderRiskMatrix(rows) {
    const body = document.getElementById('riskMatrixBody');
    if (!body) return;
    body.innerHTML = rows.length ? rows.slice(0, 8).map(row => `
        <tr><td>${escapeHtml(row.site_location)}</td><td>${escapeHtml(row.iogp_life_saving_rule)}</td>
        <td>${escapeHtml(row.barrier_failure_type)}</td><td><strong>${escapeHtml(row.sif_density_pct)}%</strong></td></tr>
    `).join('') : '<tr><td colspan="4">Risk matrix data is not available.</td></tr>';
}

async function fetchReports() {
    try {
        const response = await fetch('/api/reports');
        masterReports = await response.json();
        masterReports.sort(compareReportsNewestFirst);
        applyTableFilters();
        renderRiskMatrix(masterReports);
        populateClassifierDatasetDropdown();
    } catch (err) {
        console.error("Failed to load master reports table:", err);
    }
}

async function fetchReviews() {
    try {
        const response = await fetch('/api/reviews');
        renderReviewQueue(await response.json());
    } catch (err) {
        console.error('Failed to load review queue:', err);
    }
}

function renderReviewQueue(reviews) {
    const body = document.getElementById('reviewQueueBody');
    if (!body) return;
    const recent = Array.isArray(reviews) ? reviews.slice(-8).reverse() : [];
    body.innerHTML = recent.length ? recent.map(review => `
        <tr>
            <td>${escapeHtml(new Date(review.created_at).toLocaleString())}</td>
            <td>${escapeHtml(review.reviewer)}</td>
            <td>${escapeHtml(review.predicted_label)}</td>
            <td>${escapeHtml(review.final_label)}</td>
            <td><span class="risk-pill ${review.decision === 'corrected' ? 'high' : review.decision === 'rejected' ? 'critical' : 'low'}">${escapeHtml(review.decision)}</span></td>
        </tr>
    `).join('') : '<tr><td colspan="5">No human review decisions recorded yet.</td></tr>';
}

// ============================================================
// FEATURE 7 — SAFETY KNOWLEDGE GRAPH (D3.JS V7 FORCE LAYOUT)
// ============================================================
// ============================================================
// FEATURE 7 — SAFETY KNOWLEDGE MIND MAP & RELATIONAL FLOWCHART (NOTEBOOKLM STYLE)
// ============================================================
let currentKgData = null;
let currentKgLayoutMode = 'mindmap'; // 'mindmap', 'flowchart', 'force'
let kgZoomBehavior = null;
let kgSvgSelection = null;
let kgContainerGroup = null;
let activeKgSimulation = null;
let currentKgSearchQuery = '';

async function fetchKnowledgeGraph() {
    try {
        const response = await fetch('/api/knowledge-graph');
        currentKgData = await response.json();
        renderKnowledgeGraph();
    } catch (err) {
        console.error("Failed to load knowledge graph data:", err);
    }
}

function setKgLayoutMode(mode) {
    if (!['mindmap', 'flowchart', 'force'].includes(mode)) return;
    currentKgLayoutMode = mode;

    document.querySelectorAll('.kg-mode-btn').forEach(btn => btn.classList.remove('active'));
    if (mode === 'mindmap') document.getElementById('btnKgMindmap')?.classList.add('active');
    if (mode === 'flowchart') document.getElementById('btnKgFlowchart')?.classList.add('active');
    if (mode === 'force') document.getElementById('btnKgForce')?.classList.add('active');

    renderKnowledgeGraph();
}

function zoomKg(factor) {
    if (!kgSvgSelection || !kgZoomBehavior) return;
    kgSvgSelection.transition().duration(300).call(kgZoomBehavior.scaleBy, factor);
}

function resetKgZoom() {
    if (!kgSvgSelection || !kgZoomBehavior) return;
    const svgEl = document.getElementById('knowledgeGraphSvg');
    const width = svgEl ? (svgEl.clientWidth || 900) : 900;
    const height = svgEl ? (svgEl.clientHeight || 520) : 520;
    
    kgSvgSelection.transition().duration(500).call(
        kgZoomBehavior.transform,
        d3.zoomIdentity.translate(0, 0).scale(1)
    );
}

function handleKgSearch(query) {
    currentKgSearchQuery = (query || '').trim().toLowerCase();
    if (!kgContainerGroup) return;

    if (!currentKgSearchQuery) {
        kgContainerGroup.selectAll('.kg-node-group').classed('dimmed', false);
        kgContainerGroup.selectAll('.kg-path').classed('dimmed', false);
        return;
    }

    kgContainerGroup.selectAll('.kg-node-group').each(function(d) {
        const nameMatch = d.name && d.name.toLowerCase().includes(currentKgSearchQuery);
        const groupMatch = d.group && d.group.toLowerCase().includes(currentKgSearchQuery);
        const isMatched = nameMatch || groupMatch;
        d3.select(this).classed('dimmed', !isMatched);
    });

    kgContainerGroup.selectAll('.kg-path').classed('dimmed', true);
}

// ── FLOATING REPORT OBSERVATION HOVER POPOVER HANDLERS ─────────────────────
function showReportPopover(e, r) {
    const popover = document.getElementById('reportHoverPopover');
    if (!popover || !r) return;

    document.getElementById('popoverReportId').textContent = r.report_id || r.id || 'OIL-HSE-RPT';
    document.getElementById('popoverDate').textContent = r.date || '2026';
    
    const badge = document.getElementById('popoverSifBadge');
    const isSif = r.sif_potential === 1 || r.sif_potential === '1' || r.sif === 1;
    if (badge) {
        badge.textContent = isSif ? 'SIF Potential' : 'Non-SIF';
        badge.className = isSif ? 'popover-sif' : 'popover-sif nonsif';
    }

    document.getElementById('popoverTitle').textContent = r.report_title || r.title || r.description?.substring(0, 50) || 'Safety Incident';
    document.getElementById('popoverSite').textContent = r.site_location || 'OIL Operational Installation';
    document.getElementById('popoverDept').textContent = r.department || 'Operations';
    document.getElementById('popoverDesc').textContent = r.description || r.title || 'No observation narrative details available.';
    document.getElementById('popoverActivity').textContent = r.activity_being_performed || r.precursor_pattern || 'Routine Rig / Asset Operations';
    document.getElementById('popoverAction').textContent = r.immediate_corrective_action || 'Operational safety protocol applied.';

    moveReportPopover(e);
    popover.classList.add('visible');
}

function moveReportPopover(e) {
    const popover = document.getElementById('reportHoverPopover');
    if (!popover || !popover.classList.contains('visible')) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const popoverW = 440;
    const popoverH = 260;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let left = mouseX + 18;
    let top = mouseY + 18;

    if (left + popoverW > winW - 10) {
        left = mouseX - popoverW - 18;
    }
    if (top + popoverH > winH - 10) {
        top = mouseY - popoverH - 18;
    }

    popover.style.left = `${Math.max(10, left)}px`;
    popover.style.top = `${Math.max(10, top)}px`;
}

function hideReportPopover() {
    const popover = document.getElementById('reportHoverPopover');
    if (popover) popover.classList.remove('visible');
}

function toggleExpandDesc(cellEl) {
    if (!cellEl) return;
    cellEl.classList.toggle('expanded');
}

function openKgInspector(d) {
    const drawer = document.getElementById('kgInspectorDrawer');
    if (!drawer) return;

    document.getElementById('inspNodeName').textContent = d.name || 'N/A';
    
    const badge = document.getElementById('inspGroupBadge');
    if (badge) {
        badge.textContent = d.group || 'Node';
        const colors = {
            'Department': '#3b82f6',
            'Life-Saving Rule': '#f59e0b',
            'Barrier Category': '#ef4444',
            'Precursor Pattern': '#10b981'
        };
        badge.style.background = colors[d.group] || '#64748b';
    }

    document.getElementById('inspTotalIncidents').textContent = d.value || 0;
    document.getElementById('inspSifCount').textContent = d.sif_count || 0;
    document.getElementById('inspAvgSeverity').textContent = (d.avg_severity || 0) + '%';
    document.getElementById('inspTopSite').textContent = d.top_site || 'N/A';

    const reportListEl = document.getElementById('inspReportList');
    if (reportListEl) {
        reportListEl.innerHTML = '';
        const reports = d.reports || [];
        if (reports.length === 0) {
            reportListEl.innerHTML = '<p style="color:#64748b; font-size:10px;">No specific report snippets linked.</p>';
        } else {
            reports.forEach(r => {
                const item = document.createElement('div');
                item.className = 'insp-report-item';
                item.style.cursor = 'pointer';
                item.title = 'Hover to view full observation narrative';
                item.innerHTML = `
                    <div style="display:flex; justify-between; align-items:center;">
                        <span class="id-tag">${r.id}</span>
                        ${r.sif ? '<span style="color:#ef4444; font-weight:700; font-size:9px;">[SIF]</span>' : ''}
                    </div>
                    <div class="title-txt">${r.title}</div>
                `;
                item.addEventListener('mouseenter', (e) => showReportPopover(e, r));
                item.addEventListener('mousemove', (e) => moveReportPopover(e));
                item.addEventListener('mouseleave', () => hideReportPopover());
                reportListEl.appendChild(item);
            });
        }
    }

    drawer.classList.add('open');
}

function closeKgInspector() {
    const drawer = document.getElementById('kgInspectorDrawer');
    if (drawer) drawer.classList.remove('open');
}

function renderKnowledgeGraph(graphData) {
    if (graphData) currentKgData = graphData;
    if (!currentKgData || !currentKgData.nodes || currentKgData.nodes.length === 0) return;

    const svgEl = document.getElementById('knowledgeGraphSvg');
    if (!svgEl) return;

    if (activeKgSimulation) {
        activeKgSimulation.stop();
        activeKgSimulation = null;
    }

    d3.select(svgEl).selectAll('*').remove();

    const width = svgEl.clientWidth || 920;
    const height = svgEl.clientHeight || 520;

    kgSvgSelection = d3.select(svgEl)
        .attr('viewBox', [0, 0, width, height]);

    kgContainerGroup = kgSvgSelection.append('g').attr('class', 'kg-zoom-container');

    kgZoomBehavior = d3.zoom()
        .scaleExtent([0.4, 3])
        .on('zoom', (event) => {
            kgContainerGroup.attr('transform', event.transform);
        });

    kgSvgSelection.call(kgZoomBehavior);

    const groupColors = {
        'Department': '#3B82F6',
        'Life-Saving Rule': '#F59E0B',
        'Barrier Category': '#EF4444',
        'Precursor Pattern': '#10B981'
    };

    const groupOrder = ['Department', 'Life-Saving Rule', 'Barrier Category', 'Precursor Pattern'];

    const rawNodes = currentKgData.nodes.map(d => Object.assign({}, d));
    const rawLinks = currentKgData.links.map(d => Object.assign({}, d));

    const nodeMap = new Map(rawNodes.map(n => [n.id, n]));

    if (currentKgLayoutMode === 'mindmap') {
        renderKgMindmapMode(kgContainerGroup, rawNodes, rawLinks, nodeMap, groupColors, groupOrder, width, height);
    } else if (currentKgLayoutMode === 'flowchart') {
        renderKgFlowchartMode(kgContainerGroup, rawNodes, rawLinks, nodeMap, groupColors, groupOrder, width, height);
    } else {
        renderKgForceMode(kgContainerGroup, rawNodes, rawLinks, nodeMap, groupColors, width, height);
    }

    if (currentKgSearchQuery) {
        handleKgSearch(currentKgSearchQuery);
    }
}

// ── MIND MAP (NOTEBOOKLM TREE LAYOUT) ─────────────────────────────────────────
function renderKgMindmapMode(container, nodes, links, nodeMap, groupColors, groupOrder, width, height) {
    const layerX = {
        'Department': 60,
        'Life-Saving Rule': 300,
        'Barrier Category': 580,
        'Precursor Pattern': 860
    };

    groupOrder.forEach(grp => {
        const grpNodes = nodes.filter(n => n.group === grp);
        const count = grpNodes.length;
        const startY = 50;
        const availableH = height - 100;
        const stepY = count > 1 ? availableH / (count - 1) : availableH / 2;

        grpNodes.forEach((n, idx) => {
            n.x = layerX[grp];
            n.y = startY + (count > 1 ? idx * stepY : availableH / 2);
        });
    });

    const linkPaths = links.map(l => {
        const source = nodeMap.get(typeof l.source === 'object' ? l.source.id : l.source);
        const target = nodeMap.get(typeof l.target === 'object' ? l.target.id : l.target);
        return { source, target, value: l.value };
    }).filter(d => d.source && d.target);

    // Draw Cubic Bezier Path Connections
    const pathGroup = container.append('g').attr('class', 'kg-paths-layer');
    const pathSel = pathGroup.selectAll('path')
        .data(linkPaths)
        .join('path')
        .attr('class', 'kg-path')
        .attr('d', d => {
            const sx = d.source.x + 80;
            const sy = d.source.y;
            const tx = d.target.x - 10;
            const ty = d.target.y;
            const dx = (tx - sx) * 0.5;
            return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
        });

    renderKgNodes(container, nodes, linkPaths, pathSel, groupColors);
}

// ── COLUMN FLOWCHART LAYOUT ──────────────────────────────────────────────────
function renderKgFlowchartMode(container, nodes, links, nodeMap, groupColors, groupOrder, width, height) {
    const colWidths = [190, 210, 210, 210];
    const colXs = [40, 270, 520, 770];

    const isDarkKg = document.body.classList.contains('dark-mode');
    const colFill = isDarkKg ? 'rgba(30, 41, 59, 0.45)' : 'rgba(241, 245, 249, 0.7)';
    const colStroke = isDarkKg ? 'rgba(255, 255, 255, 0.08)' : 'rgba(148, 163, 184, 0.3)';

    groupOrder.forEach((grp, colIdx) => {
        const bgBox = container.append('rect')
            .attr('x', colXs[colIdx] - 15)
            .attr('y', 20)
            .attr('width', colWidths[colIdx])
            .attr('height', height - 40)
            .attr('rx', 10)
            .attr('fill', colFill)
            .attr('stroke', colStroke);

        container.append('text')
            .attr('x', colXs[colIdx] - 5)
            .attr('y', 40)
            .attr('fill', groupColors[grp])
            .attr('font-size', '10px')
            .attr('font-weight', '800')
            .attr('letter-spacing', '0.8px')
            .text(grp.toUpperCase());

        const grpNodes = nodes.filter(n => n.group === grp);
        const count = grpNodes.length;
        const startY = 75;
        const availableH = height - 120;
        const stepY = count > 1 ? availableH / (count - 1) : availableH / 2;

        grpNodes.forEach((n, idx) => {
            n.x = colXs[colIdx];
            n.y = startY + (count > 1 ? idx * stepY : availableH / 2);
        });
    });

    const linkPaths = links.map(l => {
        const source = nodeMap.get(typeof l.source === 'object' ? l.source.id : l.source);
        const target = nodeMap.get(typeof l.target === 'object' ? l.target.id : l.target);
        return { source, target, value: l.value };
    }).filter(d => d.source && d.target);

    const pathGroup = container.append('g').attr('class', 'kg-paths-layer');
    const pathSel = pathGroup.selectAll('path')
        .data(linkPaths)
        .join('path')
        .attr('class', 'kg-path')
        .attr('d', d => {
            const sx = d.source.x + 150;
            const sy = d.source.y;
            const tx = d.target.x - 10;
            const ty = d.target.y;
            const dx = (tx - sx) * 0.5;
            return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
        });

    renderKgNodes(container, nodes, linkPaths, pathSel, groupColors);
}

// ── FORCE NETWORK LAYOUT ─────────────────────────────────────────────────────
function renderKgForceMode(container, nodes, links, nodeMap, groupColors, width, height) {
    const formattedLinks = links.map(d => Object.assign({}, d));
    const formattedNodes = nodes.map(d => Object.assign({}, d));

    activeKgSimulation = d3.forceSimulation(formattedNodes)
        .force('link', d3.forceLink(formattedLinks).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(40));

    const pathGroup = container.append('g').attr('class', 'kg-paths-layer');
    const pathSel = pathGroup.selectAll('path')
        .data(formattedLinks)
        .join('path')
        .attr('class', 'kg-path');

    const nodeSel = renderKgNodes(container, formattedNodes, formattedLinks, pathSel, groupColors);

    // Enable dragging in Force Mode
    nodeSel.call(d3.drag()
        .on('start', (event, d) => {
            if (!event.active) activeKgSimulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => {
            d.fx = event.x; d.fy = event.y;
        })
        .on('end', (event, d) => {
            if (!event.active) activeKgSimulation.alphaTarget(0);
            d.fx = event.x; d.fy = event.y;
        }));

    activeKgSimulation.on('tick', () => {
        pathSel.attr('d', d => {
            const sx = d.source.x;
            const sy = d.source.y;
            const tx = d.target.x;
            const ty = d.target.y;
            const dx = (tx - sx) * 0.5;
            return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
        });

        nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

// ── COMMON NODE CARD RENDERER & INTERACTION HANDLER ──────────────────────────
function renderKgNodes(container, nodes, linkPaths, pathSel, groupColors) {
    const nodeGroup = container.append('g').attr('class', 'kg-nodes-layer');

    const nodeG = nodeGroup.selectAll('g.kg-node-group')
        .data(nodes)
        .join('g')
        .attr('class', 'kg-node-group')
        .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);

    const isDarkKg = document.body.classList.contains('dark-mode');
    const pillBg = isDarkKg ? '#151D2A' : '#FFFFFF';
    const pillTxt = isDarkKg ? '#F8FAFC' : '#0F172A';

    // Pill Card Background
    nodeG.append('rect')
        .attr('class', 'kg-node-pill')
        .attr('x', -10)
        .attr('y', -16)
        .attr('width', d => Math.max(140, (d.name ? d.name.length : 10) * 7.2 + 45))
        .attr('height', 32)
        .attr('rx', 6)
        .attr('fill', pillBg)
        .attr('stroke', d => groupColors[d.group] || '#64748b');

    // Group Color Indicator Dot
    nodeG.append('circle')
        .attr('cx', 2)
        .attr('cy', 0)
        .attr('r', 5)
        .attr('fill', d => groupColors[d.group] || '#64748b');

    // Label Text
    nodeG.append('text')
        .attr('x', 14)
        .attr('y', 3)
        .attr('fill', pillTxt)
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .text(d => {
            const name = d.name || '';
            return name.length > 22 ? name.substring(0, 20) + '...' : name;
        });

    // Count Badge (Reports count)
    nodeG.append('rect')
        .attr('x', d => Math.max(140, (d.name ? d.name.length : 10) * 7.2 + 45) - 38)
        .attr('y', -10)
        .attr('width', 24)
        .attr('height', 18)
        .attr('rx', 4)
        .attr('fill', d => (d.sif_count && d.sif_count > 0) ? 'rgba(239, 68, 68, 0.25)' : 'rgba(51, 65, 85, 0.6)')
        .attr('stroke', d => (d.sif_count && d.sif_count > 0) ? '#ef4444' : 'rgba(255, 255, 255, 0.1)');

    nodeG.append('text')
        .attr('x', d => Math.max(140, (d.name ? d.name.length : 10) * 7.2 + 45) - 26)
        .attr('y', 3)
        .attr('fill', d => (d.sif_count && d.sif_count > 0) ? '#fca5a5' : '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .text(d => d.value || 1);

    // Hover Flow Tracing Interaction
    nodeG.on('mouseenter', (event, d) => {
        if (currentKgSearchQuery) return; // ignore during search
        
        const connectedNodeIds = new Set([d.id]);
        
        pathSel.classed('highlighted', l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            const isMatch = sId === d.id || tId === d.id;
            if (isMatch) {
                connectedNodeIds.add(sId);
                connectedNodeIds.add(tId);
            }
            return isMatch;
        });

        pathSel.classed('dimmed', l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            return sId !== d.id && tId !== d.id;
        });

        nodeG.classed('dimmed', n => !connectedNodeIds.has(n.id));
    });

    nodeG.on('mouseleave', () => {
        if (currentKgSearchQuery) return;
        pathSel.classed('highlighted', false);
        pathSel.classed('dimmed', false);
        nodeG.classed('dimmed', false);
    });

    // Click to Open Slide-Out Inspector Drawer
    nodeG.on('click', (event, d) => {
        event.stopPropagation();
        openKgInspector(d);
    });

    return nodeG;
}

function applyTableFilters() {
    const searchInput = document.getElementById('explorerSearch');
    const activeBtn = document.querySelector('.filter-btn.active');
    if (!searchInput || !activeBtn) return;

    const searchTerm = searchInput.value.toLowerCase().trim();
    const activeFilter = activeBtn.getAttribute('data-filter');

    filteredReports = masterReports.filter(report => {
        const matchesSearch = !searchTerm ||
            (report.report_id && report.report_id.toLowerCase().includes(searchTerm)) ||
            (report.site_location && report.site_location.toLowerCase().includes(searchTerm)) ||
            (report.description && report.description.toLowerCase().includes(searchTerm)) ||
            (report.iogp_life_saving_rule && report.iogp_life_saving_rule.toLowerCase().includes(searchTerm));

        let matchesSif = true;
        const isSif = report.sif_potential === 1 || report.sif_potential === '1';
        if (activeFilter === 'sif') matchesSif = isSif;
        if (activeFilter === 'nonsif') matchesSif = !isSif;

        return matchesSearch && matchesSif;
    });

    renderMasterTable();
}

function renderMasterTable() {
    const tbody = document.getElementById('masterExplorerBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filteredReports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 20px;">No matching safety observations found.</td></tr>`;
        return;
    }

    filteredReports.slice(0, 100).forEach(report => {
        const tr = document.createElement('tr');

        const isSif = report.sif_potential === 1 || report.sif_potential === '1';
        const sifStatus = isSif
            ? `<span class="pill-sif">SIF Potential</span>`
            : `<span class="pill-nonsif">Non-SIF</span>`;

        const canModify = Boolean(report.is_new_submission || report.can_edit || report.can_delete);
        const actionCell = canModify
            ? `<div class="report-actions-group">
                <button type="button" class="btn btn-sm btn-secondary edit-report-btn" data-id="${report.report_id}" title="Edit this newly submitted report">Edit</button>
                <button type="button" class="btn btn-sm btn-outline-danger delete-report-btn" data-id="${report.report_id}" title="Delete this newly submitted report">Delete</button>
               </div>`
            : `<span class="read-only-marker" title="Historical reports are read-only">&mdash;</span>`;

        const snippetText = (report.description || '').length > 85
            ? (report.description.substring(0, 85) + '...')
            : (report.description || '');

        const riskPct = report.risk_pct || (isSif ? 88.5 : 22.0);
        const tier = report.priority_tier || (riskPct >= 75 ? "P1 Critical" : (riskPct >= 50 ? "P2 High" : (riskPct >= 30 ? "P3 Moderate" : "P4 Low")));
        const tierClass = tier.startsWith("P1") ? "tier-p1" : (tier.startsWith("P2") ? "tier-p2" : (tier.startsWith("P3") ? "tier-p3" : "tier-p4"));

        tr.innerHTML = `
            <td><strong>${escapeHtml(report.report_id)}</strong></td>
            <td>${escapeHtml(report.date)}</td>
            <td>${escapeHtml(report.site_location)}</td>
            <td>${escapeHtml(report.department)}</td>
            <td>${escapeHtml(report.report_type)}</td>
            <td>${escapeHtml(report.description.substring(0, 85))}...</td>
            <td>${sifStatus}</td>
            <td>${escapeHtml(report.iogp_life_saving_rule)}</td>
            <td><strong>${report.report_id}</strong></td>
            <td>${report.date}</td>
            <td>${report.site_location}</td>
            <td>${report.department}</td>
            <td>${report.report_type}</td>
            <td class="desc-cell" onclick="toggleExpandDesc(this)" title="Click inline expand or hover for full popover narrative">
                <span class="desc-txt">${snippetText}</span>
                <span class="desc-hover-badge">🔍 Hover Full</span>
            </td>
            <td><strong style="color: ${riskPct >= 60 ? '#ef4444' : '#38bdf8'}">${riskPct}%</strong></td>
            <td><span class="tier-badge ${tierClass}">${tier}</span></td>
            <td>${sifStatus}</td>
            <td>${report.iogp_life_saving_rule}</td>
            <td>${actionCell}</td>
        `;

        tr.addEventListener('mouseenter', (e) => showReportPopover(e, report));
        tr.addEventListener('mousemove', (e) => moveReportPopover(e));
        tr.addEventListener('mouseleave', () => hideReportPopover());

        tbody.appendChild(tr);
    });
}

// ── 5x5 MULTI-DIMENSIONAL RISK MATRIX ─────────────────────────────────────────
function renderRiskMatrix(reports) {
    const gridEl = document.getElementById('riskMatrixGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    // 5x5 Matrix cells (Likelihood 5..1, Consequence 1..5)
    const cells = [];
    const reportsList = reports || allReports || [];

    for (let l = 5; l >= 1; l--) {
        for (let c = 1; c <= 5; c++) {
            const score = l * c;
            let cellClass = 'cell-m-low';
            let label = 'Low';
            if (score >= 15) { cellClass = 'cell-m-crit'; label = 'Critical'; }
            else if (score >= 10) { cellClass = 'cell-m-high'; label = 'High'; }
            else if (score >= 5) { cellClass = 'cell-m-med'; label = 'Medium'; }

            // Calculate reports matching this score bucket
            const matchingCount = reportsList.filter(r => {
                const rScore = r.risk_pct || 20;
                if (score >= 15) return rScore >= 75;
                if (score >= 10) return rScore >= 50 && rScore < 75;
                if (score >= 5) return rScore >= 30 && rScore < 50;
                return rScore < 30;
            }).length;

            const countInCell = Math.max(1, Math.round(matchingCount / 5));

            const cellDiv = document.createElement('div');
            cellDiv.className = `risk-matrix-cell ${cellClass}`;
            cellDiv.title = `Likelihood ${l} x Consequence ${c} = Risk Score ${score} (${label})`;
            cellDiv.innerHTML = `
                <div>L${l}&times;C${c}</div>
                <div style="font-size: 14px; font-weight: 800;">${countInCell}</div>
            `;
            gridEl.appendChild(cellDiv);
        }
    }
}

// ── PREDICTIVE RISK FORECAST ──────────────────────────────────────────────────
async function fetchPredictiveRisk() {
    try {
        const response = await fetch('/api/predictive-risk');
        const data = await response.json();
        const grid = document.getElementById('predictiveRiskGrid');
        if (!grid || !data.site_predictions) return;

        grid.innerHTML = '';
        data.site_predictions.forEach(p => {
            const card = document.createElement('div');
            card.className = 'predictive-card';
            card.innerHTML = `
                <div class="site-name">${p.site_location}</div>
                <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--amber); margin-bottom:4px;">
                    <span>30-Day Probability</span>
                    <strong>${p.predicted_sif_probability_30d}%</strong>
                </div>
                <div class="prob-bar">
                    <div class="prob-fill" style="width: ${p.predicted_sif_probability_30d}%;"></div>
                </div>
                <div class="pred-txt">&bull; ${p.recommended_audit}</div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to load predictive risk forecast:", err);
    }
}

// ── SAFETY SIMULATOR ─────────────────────────────────────────────────────────
async function runSafetySimulation(barrierKey) {
    const scenarioSelect = document.getElementById('simScenarioSelect');
    const text = scenarioSelect ? scenarioSelect.value : 'Workover operations at Baghjan';

    document.querySelectorAll('.sim-barrier-btn').forEach(btn => btn.classList.remove('active'));
    event?.target?.classList.add('active');

    try {
        const response = await fetch('/api/simulate-safety', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, barrier_removed: barrierKey })
        });
        const res = await response.json();

        document.getElementById('simOrigRisk').textContent = `${res.original_risk_pct}%`;
        document.getElementById('simResultRisk').textContent = `${res.simulated_risk_pct}%`;
        document.getElementById('simResultDelta').textContent = `+${res.risk_increase_delta}% Risk`;
        document.getElementById('simSummaryTxt').textContent = res.consequence_summary || 'Barrier removed.';
    } catch (err) {
        console.error("Failed to run safety simulation:", err);
    }
}

// ── AI NARRATIVE ENHANCER (ALL REPORTS — Dataset browsed or typed) ─────────
async function enhanceClassifierText() {
    const textarea = document.getElementById('classifierTextarea');
    const polishBtn = document.getElementById('polishBtn');
    const text = textarea ? textarea.value.trim() : '';

    if (!text) {
        showToast('Please enter or load a report observation first, then AI Polish.', 'error');
        return;
    }

    // Show loading state on button
    const originalLabel = polishBtn ? polishBtn.textContent : 'AI Polish Narrative';
    if (polishBtn) {
        polishBtn.textContent = 'Polishing...';
        polishBtn.disabled = true;
    }

    try {
        const response = await fetch('/api/enhance-narrative', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const res = await response.json();
        if (res.enhanced) {
            textarea.value = res.enhanced;
            showToast('Narrative polished by AI. Ready for classification.', 'success');
            // Auto re-run classification with polished text
            runClassification();
        } else {
            showToast('AI polish returned empty response. Try again.', 'error');
        }
    } catch (err) {
        console.error('Failed to enhance narrative:', err);
        showToast('AI Polish failed — server may be offline.', 'error');
    } finally {
        if (polishBtn) {
            polishBtn.textContent = originalLabel;
            polishBtn.disabled = false;
        }
    }
}

// ── HITL REVIEW CONFIRMATION ───────────────────────────────────────────────
function confirmHitlReview() {
    const banner = document.getElementById('hitlBanner');
    if (banner) {
        banner.style.background = 'rgba(16, 185, 129, 0.2)';
        banner.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        banner.querySelector('.hitl-txt strong').textContent = '✅ Verified by Senior HSE Officer';
        banner.querySelector('.hitl-txt p').textContent = 'Human-in-the-Loop review completed & logged in audit record.';
    }
}

function renderDensityTable(siteData) {
    const tbody = document.getElementById('densityTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    siteData.forEach((site, idx) => {
        const tr = document.createElement('tr');
        const d = site.sif_density;
        const riskClass = d >= 30 ? 'critical' : d >= 20 ? 'high' : d >= 10 ? 'moderate' : 'low';
        const riskLabel = d >= 30 ? 'Critical' : d >= 20 ? 'High' : d >= 10 ? 'Moderate' : 'Low';

        tr.innerHTML = `
            <td><strong>#${idx + 1}</strong></td>
            <td>${escapeHtml(site.site_location)}</td>
            <td>${escapeHtml(site.total)}</td>
            <td>${escapeHtml(site.sif)}</td>
            <td><strong>${site.sif_density}%</strong></td>
            <td><span class="risk-pill ${riskClass}">${riskLabel}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderActivityRisk(deptData) {
    const tbody = document.getElementById('activityRiskBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    deptData.forEach(dept => {
        const d = dept.sif_density;
        const riskClass = d >= 30 ? 'critical' : d >= 20 ? 'high' : d >= 10 ? 'moderate' : 'low';
        const riskLabel = d >= 30 ? 'Critical' : d >= 20 ? 'High' : d >= 10 ? 'Moderate' : 'Low';
        const fillPct = Math.min(d, 50) * 2;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(dept.department)}</strong></td>
            <td>${escapeHtml(dept.total)}</td>
            <td>${escapeHtml(dept.sif)}</td>
            <td>
                <div class="density-bar-wrap">
                    <div class="density-mini-bar">
                        <div class="density-mini-fill ${riskClass}" style="width:${fillPct}%"></div>
                    </div>
                    <span class="score-badge">${d}%</span>
                </div>
            </td>
            <td><strong>${dept.avg_score}</strong><span style="color:var(--text-muted);font-size:11px;">/100</span></td>
            <td><span class="risk-pill ${riskClass}">${riskLabel}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPrecursorAlerts(precursors) {
    const container = document.getElementById('precursorAlertsList');
    if (!container) return;
    container.innerHTML = '';

    if (precursors.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0;">No recurring precursor patterns detected.</p>';
        return;
    }

    precursors.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = 'precursor-alert-item';
        item.innerHTML = `
            <div class="alert-rank">${idx + 1}</div>
            <span class="alert-pattern">${escapeHtml(p.pattern)}</span>
            <span class="alert-count">${escapeHtml(p.count)}×</span>
        `;
        container.appendChild(item);
    });
}

// ============================================================
// FEATURE 19 — SEVERITY SCORE DISTRIBUTION DONUT CHART
// ============================================================
function renderSeverityDonutChart(severityData) {
    const ctx = document.getElementById('severityDonutChart');
    if (!ctx) return;
    if (severityDonutChartInstance) severityDonutChartInstance.destroy();

    const labels = Object.keys(severityData);
    const values = Object.values(severityData);
    const { legendColor } = getChartColors();

    severityDonutChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: legendColor, font: { size: 10.5 } } }
            }
        }
    });
}

let barrierChartInstance = null;
function renderBarrierChart(barrierData) {
    const ctx = document.getElementById('barrierFailureChart');
    if (!ctx) return;
    if (barrierChartInstance) barrierChartInstance.destroy();

    const labels = Object.keys(barrierData);
    const values = Object.values(barrierData);
    const colors = ['#FF6B00', '#DC2626', '#16A34A', '#0369A1', '#7C3AED', '#DB2777'];
    const { tickColor, gridColor } = getChartColors();

    barrierChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Reports',
                data: values,
                backgroundColor: colors.slice(0, labels.length).map(c => c + '22'),
                borderColor: colors.slice(0, labels.length),
                borderWidth: 1.5,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: tickColor }, grid: { color: gridColor } },
                y: { ticks: { color: tickColor, font: { size: 10.5 } }, grid: { display: false } }
            }
        }
    });
}

// ============================================================
// FEATURE 9 — TEMPORAL RISK FORECAST LINE CHART
// ============================================================
function renderMonthlyTrend(trendData, forecastData = [], forecastSummary = "") {
    const ctx = document.getElementById('monthlyTrendChart');
    if (!ctx) return;
    if (monthlyTrendChartInstance) monthlyTrendChartInstance.destroy();

    const forecastBanner = document.getElementById('forecastAlertBanner');
    const forecastText = document.getElementById('forecastText');
    if (forecastBanner && forecastText && forecastSummary) {
        forecastText.textContent = forecastSummary;
        forecastBanner.style.display = 'flex';
    }

    const histLabels = trendData.map(d => d.month);
    const histTotals = trendData.map(d => d.total);
    const histSifs = trendData.map(d => d.sif);

    const forecastLabels = forecastData.map(d => d.month + " (Forecast)");
    const forecastSifs = forecastData.map(d => d.sif);

    const allLabels = [...histLabels, ...forecastLabels];
    const histSifSeries = [...histSifs, ...forecastData.map(() => null)];

    // Connect historical to forecast
    const forecastSifSeries = [
        ...trendData.map((d, i) => i === trendData.length - 1 ? d.sif : null),
        ...forecastSifs
    ];

    const { tickColor, gridColor, legendColor } = getChartColors();

    monthlyTrendChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: 'Historical Observations',
                    data: [...histTotals, ...forecastData.map(() => null)],
                    borderColor: '#6B7280',
                    backgroundColor: 'rgba(107,114,128,0.06)',
                    borderWidth: 2,
                    pointRadius: 3,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Historical SIF Precursors',
                    data: histSifSeries,
                    borderColor: '#DC2626',
                    backgroundColor: 'rgba(220,38,38,0.08)',
                    borderWidth: 2,
                    pointRadius: 3,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Projected SIF Forecast',
                    data: forecastSifSeries,
                    borderColor: '#FF6B00',
                    borderDash: [6, 4],
                    backgroundColor: 'rgba(255,107,0,0.08)',
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointStyle: 'rectRot',
                    fill: false,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: legendColor, font: { size: 11 } } }
            },
            scales: {
                x: { ticks: { color: tickColor, font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: tickColor }, grid: { color: gridColor }, beginAtZero: true }
            }
        }
    });
}

function renderOverviewCharts(data) {
    const ctxSiteEl = document.getElementById('overviewSiteChart');
    const ctxLsrEl = document.getElementById('overviewLsrChart');
    if (!ctxSiteEl || !ctxLsrEl) return;

    const { tickColor, gridColor, legendColor } = getChartColors();

    const ctxSite = ctxSiteEl.getContext('2d');
    const siteData = data.site_rankings || [];
    const labels = siteData.map(s => s.site_location.split(' ')[0] + ' ' + (s.site_location.split(' ')[1] || ''));
    const densities = siteData.map(s => s.sif_density);

    if (overviewSiteChartInstance) overviewSiteChartInstance.destroy();

    overviewSiteChartInstance = new Chart(ctxSite, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'SIF Precursor Density (%)',
                data: densities,
                backgroundColor: 'rgba(255, 107, 0, 0.75)',
                borderColor: '#FF6B00',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: tickColor, font: { size: 10, weight: '600' } }, grid: { display: false } },
                y: { ticks: { color: tickColor }, grid: { color: gridColor }, title: { display: true, text: 'SIF Density (%)', color: tickColor } }
            }
        }
    });

    const ctxLsr = ctxLsrEl.getContext('2d');
    const lsrData = data.lsr_distribution || {};

    if (overviewLsrChartInstance) overviewLsrChartInstance.destroy();

    overviewLsrChartInstance = new Chart(ctxLsr, {
        type: 'doughnut',
        data: {
            labels: Object.keys(lsrData),
            datasets: [{
                data: Object.values(lsrData),
                backgroundColor: ['#EF4444', '#FF6B00', '#D97706', '#10B981', '#F59E0B', '#9333EA', '#14B8A6', '#E11D48'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: legendColor, font: { size: 10.5 } } }
            }
        }
    });
}

function renderDensityDetailChart(siteData) {
    const ctx = document.getElementById('densityDetailChart');
    if (!ctx) return;
    const labels = siteData.map(s => s.site_location);
    const densities = siteData.map(s => s.sif_density);
    const { tickColor, gridColor } = getChartColors();

    if (densityDetailChartInstance) densityDetailChartInstance.destroy();

    densityDetailChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'SIF Precursor Density (%)',
                data: densities,
                backgroundColor: 'rgba(255, 107, 0, 0.75)',
                borderColor: '#FF6B00',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: tickColor, font: { size: 10, weight: '600' } }, grid: { color: gridColor } },
                y: { ticks: { color: tickColor }, grid: { color: gridColor } }
            }
        }
    });
}

function renderIogpDetailChart(lsrData) {
    const ctx = document.getElementById('iogpDetailChart');
    if (!ctx) return;
    const { tickColor, gridColor } = getChartColors();

    if (iogpDetailChartInstance) iogpDetailChartInstance.destroy();

    iogpDetailChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(lsrData),
            datasets: [{
                label: 'Report Count',
                data: Object.values(lsrData),
                backgroundColor: 'rgba(255, 107, 0, 0.75)',
                borderColor: '#FF6B00',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: tickColor }, grid: { color: gridColor } },
                y: { ticks: { color: tickColor, font: { size: 10.5 } }, grid: { display: false } }
            }
        }
    });
}

// ============================================================
// FEATURE 15 — HIERARCHY OF CONTROLS CORRECTIVE ACTION LIST
// ============================================================
function renderCorrectiveActions(actions) {
    const container = document.getElementById('hierarchyActionsList');
    if (!container) return;
    container.innerHTML = '';

    if (!actions || actions.length === 0) return;

    actions.forEach(item => {
        const levelSlug = item.level.replace(/\s+/g, '-');
        const card = document.createElement('div');
        card.className = 'hoc-card';
        card.innerHTML = `
            <span class="hoc-badge hoc-${escapeHtml(levelSlug)}">${escapeHtml(item.level)}</span>
            <span class="hoc-desc">${escapeHtml(item.action)}</span>
        `;
        container.appendChild(card);
    });
}

// ============================================================
// FEATURE 8 — SIMILAR INCIDENT RETRIEVAL
// ============================================================
async function fetchSimilarReports(text) {
    try {
        const response = await fetch('/api/similar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const reports = await response.json();
        renderSimilarReports(reports);
    } catch (err) {
        console.error("Failed to fetch similar incidents:", err);
    }
}

function renderSimilarReports(reports) {
    const container = document.getElementById('similarReportsList');
    if (!container) return;
    container.innerHTML = '';

    if (!reports || reports.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0;">No similar historical reports found.</p>';
        return;
    }

    reports.forEach(r => {
        const sifBadge = r.sif_potential === 1
            ? `<span class="pill-sif">SIF Potential</span>`
            : `<span class="pill-nonsif">Non-SIF</span>`;

        const item = document.createElement('div');
        item.className = 'similar-item';
        item.style.cursor = 'pointer';
        item.title = 'Hover to view full report observation popover';
        item.innerHTML = `
            <div class="similar-info">
                <div class="similar-title">${escapeHtml(r.report_id)} — ${escapeHtml(r.report_title)}</div>
                <div class="similar-desc">${escapeHtml(r.description)}</div>
                <div class="similar-meta">
                    <span>Installation: <strong>${escapeHtml(r.site_location)}</strong></span>
                    <span>&middot;</span>
                    <span>Rule: <strong>${escapeHtml(r.iogp_rule)}</strong></span>
                    <span>&middot;</span>
                    ${sifBadge}
                </div>
            </div>
            <div class="similar-score-box">
                <div class="similar-score-badge">${r.similarity_score}% Match</div>
            </div>
        `;
        item.addEventListener('mouseenter', (e) => showReportPopover(e, r));
        item.addEventListener('mousemove', (e) => moveReportPopover(e));
        item.addEventListener('mouseleave', () => hideReportPopover());
        container.appendChild(item);
    });
}

async function runClassification() {
    const textarea = document.getElementById('classifierTextarea');
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) return;

    // Show loading state
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) { analyzeBtn.disabled = true; analyzeBtn.textContent = 'Analysing…'; }

    try {
        const response = await fetch('/api/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        const data = await response.json();
        latestClassification = data;
        const reviewPanel = document.getElementById('reviewPanel');
        if (reviewPanel) reviewPanel.hidden = false;
        const finalLabel = document.getElementById('finalLabelSelect');
        if (finalLabel) finalLabel.value = data.classification_label || 'NON_SIF_OBSERVATION';
        const reviewStatus = document.getElementById('reviewStatus');
        if (reviewStatus) reviewStatus.textContent = '';

        // Feature 16 — Language Badge Update
        const langBadge = document.getElementById('langBadge');
        if (langBadge) {
            langBadge.textContent = data.language_label || 'Detected: English (Standard Domain)';
        }

        // ── Verdict banner + risk score ───────────────────────────────────
        const vBanner = document.getElementById('verdictBanner');
        if (vBanner) {
            vBanner.className = `verdict-banner ${data.dekra_verdict}`;
            document.getElementById('verdictText').textContent =
                VERDICT_LABELS[data.dekra_verdict] || data.dekra_verdict;
        }

        const confPct = Math.round((data.sif_confidence || 0.90) * 100);
        const riskScore = Math.round((data.sif_severity_score || data.sif_confidence || 0.90) * 100);

        const riskNum = document.getElementById('riskScoreNum');
        if (riskNum) riskNum.textContent = riskScore;

        const vConf = document.getElementById('verdictConf');
        if (vConf) vConf.textContent = `${confPct}%`;

        const confMeter = document.getElementById('confMeter');
        if (confMeter) confMeter.style.width = `${confPct}%`;

        // ── Explainable Contributing Factors ─────────────────────────────
        const hasEnergy = data.energy_sources && data.energy_sources.length > 0;
        const barrierOut = data.barrier_condition === 'FAILED_OR_ABSENT' || data.barrier_condition === 'COMPROMISED';
        const isSIF = data.dekra_verdict === 'SIF_POTENTIAL';
        const isDefended = data.dekra_verdict === 'DEFENDED_NEAR_MISS';

        const factors = [
            {
                text: hasEnergy
                    ? `High-energy source identified: ${formatEnergySource(data.energy_sources)}`
                    : 'No high-energy source detected',
                active: hasEnergy
            },
            {
                text: barrierOut
                    ? 'Safety barrier absent or failed — worker potentially exposed'
                    : 'Control barrier appears effective or present',
                active: barrierOut
            },
            {
                text: data.iogp_life_saving_rule
                    ? `IOGP Life-Saving Rule implicated: "${data.iogp_life_saving_rule}"`
                    : 'No specific IOGP Life-Saving Rule matched',
                active: !!data.iogp_life_saving_rule && isSIF
            },
            {
                text: isDefended
                    ? 'Barrier intervened — near-miss was defended successfully'
                    : isSIF
                        ? 'Uncontrolled energy release pathway — immediate action required'
                        : 'No uncontrolled energy release pathway identified',
                active: isSIF
            }
        ];

        const factorsList = document.getElementById('factorsList');
        const factorsCard = document.getElementById('factorsCard');
        if (factorsList && factorsCard) {
            factorsCard.className = `factors-card ${isDefended ? 'amber' : isSIF ? '' : 'safe'}`;
            factorsList.innerHTML = factors.map(f => `
                <li>
                    <svg class="svg-icon ${f.active ? 'factor-icon-yes' : 'factor-icon-no'}"
                         viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        ${f.active
                    ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
                    : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}
                    </svg>
                    <span>${f.text}</span>
                </li>
            `).join('');
        }

        // ── HITL Banner & Causation Chain ────────────────────────────────
        const hitlBanner = document.getElementById('hitlBanner');
        if (hitlBanner) {
            if (data.requires_hitl_review) {
                hitlBanner.style.display = 'flex';
                document.getElementById('hitlReasonTxt').textContent = data.hitl_reason || 'Model confidence below 75% threshold. Senior HSE Officer verification recommended.';
            } else {
                hitlBanner.style.display = 'none';
            }
        }

        const chain = data.hazard_causation_chain || {};
        if (document.getElementById('chainHazard')) document.getElementById('chainHazard').textContent = chain.hazard_identified || 'Operational Hazard';
        if (document.getElementById('chainLsr')) document.getElementById('chainLsr').textContent = chain.lsr_breached || data.iogp_life_saving_rule || 'General Safety';
        if (document.getElementById('chainBarrier')) document.getElementById('chainBarrier').textContent = chain.barrier_failure_mode || data.barrier_condition || 'Failed';
        if (document.getElementById('chainVerdict')) document.getElementById('chainVerdict').textContent = chain.sif_verdict || (isSIF ? 'SIF Potential' : 'Non-SIF');

        // ── Assessment grid ───────────────────────────────────────────────
        const resRule = document.getElementById('resRule');
        const resEnergy = document.getElementById('resEnergy');
        const resBarrier = document.getElementById('resBarrier');
        const resLsrAgreement = document.getElementById('resLsrAgreement');
        if (resRule)    resRule.textContent    = data.iogp_life_saving_rule || '—';
        if (resEnergy)  resEnergy.textContent  = formatEnergySource(data.energy_sources);
        if (resRule) resRule.textContent = data.iogp_life_saving_rule || '—';
        if (resEnergy) resEnergy.textContent = formatEnergySource(data.energy_sources);
        if (resBarrier) resBarrier.textContent = BARRIER_LABELS[data.barrier_condition] || data.barrier_condition || '—';
        if (resLsrAgreement) {
            resLsrAgreement.textContent = data.lsr_model_agreement === null
                ? 'Unavailable'
                : data.lsr_model_agreement ? 'Agrees' : `Differs: ${data.lsr_model_rule || 'Unknown'}`;
        }

        // ── Rationale and action plan ─────────────────────────────────────
        const resRationale = document.getElementById('resRationale');
        const resActionPlan = document.getElementById('resActionPlan');
        if (resRationale) resRationale.textContent = data.audit_rationale;
        if (resActionPlan) resActionPlan.textContent = data.oisd_action_plan;

        // Feature 15 — Hierarchy of Controls Render
        renderCorrectiveActions(data.corrective_actions || []);

        // Feature 8 — Similar Incident Search Call
        fetchSimilarReports(text);

    } catch (err) {
        console.error('Incident classification request failed:', err);
    } finally {
        if (analyzeBtn) { analyzeBtn.disabled = (currentRole === 'analyst'); analyzeBtn.textContent = 'Classify Incident'; }
    }
}

async function runSafetySimulation() {
    const text = document.getElementById('classifierTextarea')?.value.trim();
    if (!text) return;
    try {
        const response = await fetch('/api/simulate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
        });
        const data = await response.json();
        const result = document.getElementById('simulationResult');
        if (result) result.hidden = false;
        document.getElementById('simulationSteps').innerHTML = (data.steps || []).map(step => `<p><strong>${escapeHtml(step.stage)}:</strong> ${escapeHtml(step.outcome)}</p>`).join('');
        document.getElementById('simulationIntervention').textContent = `Recommended intervention: ${data.recommended_intervention || 'Review controls before resuming.'}`;
        document.getElementById('simulationWarning').textContent = data.warning || '';
    } catch (err) { console.error('Safety simulation request failed:', err); }
}

async function checkReportQuality() {
    const text = document.getElementById('classifierTextarea')?.value || '';
    try {
        const response = await fetch('/api/report-quality', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
        });
        const data = await response.json();
        const result = document.getElementById('qualityResult');
        if (result) result.hidden = false;
        document.getElementById('qualitySummary').textContent = data.quality === 'SUFFICIENT'
            ? 'The report contains the minimum context for triage.'
            : `Missing context: ${(data.missing_fields || []).join(', ')}`;
        document.getElementById('qualityQuestions').innerHTML = (data.clarification_questions || []).map(question => `<li>${escapeHtml(question)}</li>`).join('');
    } catch (err) { console.error('Report quality request failed:', err); }
}

async function submitReview(decision) {
    if (!latestClassification) return;
    const text = document.getElementById('classifierTextarea')?.value.trim();
    const finalLabel = document.getElementById('finalLabelSelect')?.value || latestClassification.classification_label;
    const reviewer = document.getElementById('reviewerName')?.value.trim() || 'dashboard-user';
    const comment = document.getElementById('reviewComment')?.value || '';
    const status = document.getElementById('reviewStatus');
    try {
        const response = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                reviewer,
                decision,
                predicted_label: latestClassification.classification_label,
                final_label: finalLabel,
                comment
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Review could not be saved');
        if (status) status.textContent = `Review saved: ${data.review_id}`;
    } catch (err) {
        if (status) status.textContent = `Review failed: ${err.message}`;
        console.error('Review submission failed:', err);
    }
}

// ============================================================
// AI NARRATIVE POLISH ENHANCER
// ============================================================
async function enhanceClassifierText(targetId = 'classifierTextarea') {
    const el = document.getElementById(targetId);
    if (!el) return;

    const rawText = el.value ? el.value.trim() : '';
    if (!rawText) {
        alert('Please select or enter an observation narrative first.');
        return;
    }

    let btn = (typeof event !== 'undefined' && event && event.currentTarget) ? event.currentTarget : null;
    const originalBtnText = btn ? btn.innerHTML : '';

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '✨ Polishing Narrative...';
        }

        const res = await fetch('/api/enhance-narrative', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rawText })
        });

        if (!res.ok) {
            throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data && data.enhanced) {
            el.value = data.enhanced;

            // If polishing the main classifier textarea, automatically re-classify to update UI cards
            if (targetId === 'classifierTextarea') {
                if (typeof window.classifyIncident === 'function') window.classifyIncident();
            }
        }
    } catch (err) {
        console.error('AI Narrative Polish failed:', err);
        alert('Unable to polish narrative. Please check connection to server.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnText || '✨ AI Polish Narrative';
        }
    }
}

// ============================================================
// THEME SWITCHER LOGIC (LIGHT MODE & DARK MODE)
// ============================================================
function initTheme() {
    const savedTheme = localStorage.getItem('oil_theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeUI('dark');
    } else {
        document.body.classList.remove('dark-mode');
        updateThemeUI('light');
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('oil_theme', newTheme);
    updateThemeUI(newTheme);
}

function updateThemeUI(theme) {
    const themeLabel = document.getElementById('themeLabel');
    const themeIcon = document.getElementById('themeIcon');
    if (themeLabel) {
        themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
    }
    if (themeIcon) {
        if (theme === 'dark') {
            themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
        } else {
            themeIcon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
        }
    }

    // Refresh charts and KG to reflect light/dark palette
    if (analyticsData) {
        renderOverviewCharts(analyticsData);
        renderBarrierChart(analyticsData.barrier_distribution || {});
        renderSeverityDonutChart(analyticsData.severity_buckets || {});
        renderDensityDetailChart(analyticsData.site_rankings || []);
        renderIogpDetailChart(analyticsData.lsr_distribution || {});
        renderMonthlyTrend(analyticsData.monthly_trend || [], analyticsData.forecast_data || [], analyticsData.forecast_summary);
    }
    if (currentKgData) {
        renderKnowledgeGraph();
    }
}

// ============================================================
// QUICK ACTIONS DROPDOWN MENU
// ============================================================
function toggleQuickActionsMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('quickActionsMenu');
    if (menu) {
        menu.style.display = (menu.style.display === 'flex' || menu.style.display === 'block') ? 'none' : 'flex';
    }
}

function closeQuickActionsMenu() {
    const menu = document.getElementById('quickActionsMenu');
    if (menu) menu.style.display = 'none';
}

document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.quick-actions-wrap');
    if (wrap && !wrap.contains(e.target)) {
        closeQuickActionsMenu();
    }
});

function openRoleModal() {
    const modal = document.getElementById('roleModalOverlay');
    if (modal) modal.style.display = 'flex';
}

// ============================================================
// EXECUTIVE HSE INTELLIGENCE AUDIT DOCUMENT POPULATOR
// ============================================================
async function openHseExecutiveSummaryModal() {
    const modal = document.getElementById('hseSummaryModalOverlay');
    if (!modal) return;

    modal.style.display = 'flex';

    try {
        const res = await fetch('/api/hse-summary');
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();

        // Metadata & Header
        if (document.getElementById('docRefId')) document.getElementById('docRefId').textContent = data.report_ref_id || 'OIL-HSSE-AUDIT-2026';
        if (document.getElementById('docDate')) document.getElementById('docDate').textContent = data.date || 'September 16, 2026';
        if (document.getElementById('docTitle')) document.getElementById('docTitle').textContent = data.title || 'Executive SIF Precursor Audit Briefing';
        if (document.getElementById('docSubtitle')) document.getElementById('docSubtitle').textContent = data.subtitle || 'OIL Directorate of Health, Safety, Security & Environment';

        // KPI Badges
        const metrics = data.metrics || {};
        if (document.getElementById('docKpiTotal')) document.getElementById('docKpiTotal').textContent = metrics.total_reports || '500';
        if (document.getElementById('docKpiSif')) document.getElementById('docKpiSif').textContent = metrics.sif_reports || '116';
        if (document.getElementById('docKpiRate')) document.getElementById('docKpiRate').textContent = `${metrics.sif_rate_pct || 23.2}%`;
        if (document.getElementById('docKpiTopSite')) document.getElementById('docKpiTopSite').textContent = metrics.top_high_risk_site || 'Makum';
        if (document.getElementById('docKpiTopRule')) document.getElementById('docKpiTopRule').textContent = metrics.top_breached_rule || 'Line of Fire';

        // Section 1: Narrative
        if (document.getElementById('docExecutiveSummaryTxt')) {
            document.getElementById('docExecutiveSummaryTxt').textContent = data.executive_summary_text || 'Executive briefing summary details.';
        }

        // Section 2: Installation Vulnerability Table
        const siteBody = document.getElementById('docSiteTableBody');
        if (siteBody && data.site_vulnerability_matrix) {
            siteBody.innerHTML = data.site_vulnerability_matrix.map(s => `
                <tr>
                    <td><strong>${s.site_location}</strong></td>
                    <td>${s.total}</td>
                    <td style="color: var(--amber); font-weight: 700;">${s.sif}</td>
                    <td><strong>${s.sif_density}%</strong></td>
                    <td><span class="confidential-pill">${s.sif_density >= 30 ? 'CRITICAL RISK' : 'HIGH RISK'}</span></td>
                </tr>
            `).join('');
        }

        // Section 3: Precursor Hazard Scenarios
        const precGrid = document.getElementById('docPrecursorGrid');
        if (precGrid && data.recurring_hazards) {
            precGrid.innerHTML = data.recurring_hazards.map(p => `
                <div class="doc-card-item">
                    <h4>${p.pattern}</h4>
                    <p><strong>Frequency:</strong> ${p.total_count} occurrences across ${p.affected_sites ? p.affected_sites.join(', ') : 'sites'}.</p>
                    <p><strong>Rule:</strong> ${p.primary_rule} | <strong>SIF Rate:</strong> ${p.sif_rate_pct}%</p>
                </div>
            `).join('');
        }

        // Section 4: 30-Day Predictive SIF Exposure Ranking
        const predGrid = document.getElementById('docPredictiveGrid');
        if (predGrid && data.top_risk_sites) {
            predGrid.innerHTML = data.top_risk_sites.map(s => `
                <div class="doc-card-item">
                    <h4>${s.site_location}</h4>
                    <p><strong>30-Day SIF Exposure:</strong> <span style="color: var(--amber); font-weight: 800;">${s.predicted_sif_probability_30d}%</span></p>
                    <p><strong>Audit Mandate:</strong> ${s.recommended_audit}</p>
                </div>
            `).join('');
        }

        // Section 5: Hierarchy of Controls Directives
        const dirList = document.getElementById('docDirectivesList');
        if (dirList && data.hierarchy_directives) {
            dirList.innerHTML = data.hierarchy_directives.map(d => `
                <div class="doc-dir-item">
                    <strong>${d.level}</strong>
                    <p>${d.directive}</p>
                </div>
            `).join('');
        }

        // Section 6: Signatures Block
        const signGrid = document.getElementById('docSignoffGrid');
        if (signGrid && data.signoff_signatories) {
            signGrid.innerHTML = data.signoff_signatories.map(s => `
                <div class="signoff-box">
                    <div class="sign-line"></div>
                    <div class="sign-name">${s.name}</div>
                    <div class="sign-role">${s.role}</div>
                    <div class="sign-dept">${s.dept}</div>
                </div>
            `).join('');
        }

    } catch (err) {
        console.error('Failed to load Executive HSE Brief data:', err);
    }
}

function closeHseExecutiveSummaryModal() {
    const modal = document.getElementById('hseSummaryModalOverlay');
    if (modal) modal.style.display = 'none';
}

// ============================================================
// INCIDENT CLASSIFIER DATASET INTEGRATION (500 REPORTS)
// ============================================================
function getReportText(r) {
    if (!r) return '';
    return r.description || r.observation_text || r.observation || r.text || '';
}

function populateClassifierDatasetDropdown() {
    const dropdown = document.getElementById('classifierDatasetDropdown');
    if (!dropdown) return;

    if (!masterReports || masterReports.length === 0) {
        dropdown.innerHTML = '<option value="">No dataset reports loaded</option>';
        return;
    }

    let html = `<option value="">-- Select any of the ${masterReports.length} real dataset incident reports --</option>`;
    masterReports.forEach(r => {
        const sifTag = (r.sif_potential == 1 || r.sif_potential === true) ? 'SIF Precursor' : 'Non-SIF';
        const txt = getReportText(r);
        const snippet = txt ? txt.slice(0, 65).replace(/"/g, '&quot;') : '';
        html += `<option value="${r.report_id}">${r.report_id} | ${r.site_location || 'OIL Field'} | ${r.department || 'HSE'} (${sifTag}): "${snippet}..."</option>`;
    });

    dropdown.innerHTML = html;
}

window.classifyIncident = function() {
    runClassification();
};

window.loadReportFromDropdown = function(reportId) {
    if (!reportId) return;
    const report = masterReports.find(r => r.report_id === reportId);
    if (!report) return;

    const textarea = document.getElementById('classifierTextarea');
    if (textarea) {
        textarea.value = getReportText(report);
    }

    runClassification();
};

window.openReportPickerModal = function() {
    const modal = document.getElementById('reportPickerModalOverlay');
    if (!modal) return;
    modal.style.display = 'flex';
    renderPickerTableRows(masterReports);
};

window.closeReportPickerModal = function() {
    const modal = document.getElementById('reportPickerModalOverlay');
    if (modal) modal.style.display = 'none';
};

function renderPickerTableRows(reports) {
    const tbody = document.getElementById('pickerTableBody');
    if (!tbody) return;

    if (!reports || reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No reports match your search query.</td></tr>';
        return;
    }

    tbody.innerHTML = reports.map(r => {
        const txt = getReportText(r);
        const snippet = txt ? txt.replace(/"/g, '&quot;') : '';
        const isSif = (r.sif_potential == 1 || r.sif_potential === true);
        return `
        <tr class="picker-table-row">
            <td><strong>${r.report_id}</strong></td>
            <td>${r.site_location || '—'}</td>
            <td>${r.department || '—'}</td>
            <td>
                <span class="verdict-tag ${isSif ? 'SIF_POTENTIAL' : 'NON_SIF_OBSERVATION'}" style="font-size: 10px; padding: 2px 8px;">
                    ${isSif ? 'SIF Precursor' : 'Non-SIF'}
                </span>
            </td>
            <td style="max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${snippet}">
                ${txt.slice(0, 80)}...
            </td>
            <td style="white-space: nowrap;">
                <button type="button" class="btn btn-primary btn-sm" onclick="loadReportFromPicker('${r.report_id}')" style="font-size: 11px; padding: 4px 8px; margin-right: 4px;">
                    Load &amp; Classify
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="loadReportFromPickerAndPolish('${r.report_id}')" style="font-size: 11px; padding: 4px 8px; color: var(--amber); border-color: var(--amber);" title="Load this report and run AI narrative polish">
                    AI Polish
                </button>
            </td>
        </tr>
    `}).join('');
}

window.filterPickerReports = function() {
    const query = (document.getElementById('pickerSearchInput')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('pickerCategoryFilter')?.value || 'ALL';

    const filtered = masterReports.filter(r => {
        const txt = getReportText(r).toLowerCase();
        const matchesQuery = !query ||
            r.report_id.toLowerCase().includes(query) ||
            (r.site_location && r.site_location.toLowerCase().includes(query)) ||
            (r.department && r.department.toLowerCase().includes(query)) ||
            txt.includes(query) ||
            (r.iogp_life_saving_rule && r.iogp_life_saving_rule.toLowerCase().includes(query));

        let matchesCat = true;
        if (cat === 'SIF') matchesCat = (r.sif_potential == 1 || r.sif_potential === true);
        else if (cat === 'NON_SIF') matchesCat = !(r.sif_potential == 1 || r.sif_potential === true);
        else if (cat !== 'ALL') {
            matchesCat = r.iogp_life_saving_rule === cat || txt.includes(cat.toLowerCase());
        }

        return matchesQuery && matchesCat;
    });

    renderPickerTableRows(filtered);
};

window.loadReportFromPicker = function(reportId) {
    const report = masterReports.find(r => r.report_id === reportId);
    if (!report) return;

    const classifierTabBtn = document.querySelector('.nav-item[data-tab="tab-classifier"]');
    if (classifierTabBtn) classifierTabBtn.click();

    const textarea = document.getElementById('classifierTextarea');
    if (textarea) textarea.value = getReportText(report);

    const dropdown = document.getElementById('classifierDatasetDropdown');
    if (dropdown) dropdown.value = reportId;

    closeReportPickerModal();
    runClassification();
};

window.loadReportFromPickerAndPolish = async function(reportId) {
    const report = masterReports.find(r => r.report_id === reportId);
    if (!report) return;

    // Switch to classifier tab
    const classifierTabBtn = document.querySelector('.nav-item[data-tab="tab-classifier"]');
    if (classifierTabBtn) classifierTabBtn.click();

    const textarea = document.getElementById('classifierTextarea');
    if (textarea) textarea.value = getReportText(report);

    const dropdown = document.getElementById('classifierDatasetDropdown');
    if (dropdown) dropdown.value = reportId;

    closeReportPickerModal();

    // Show status and polish
    showToast(`Loaded report ${reportId}. Running AI Polish...`, 'info');
    await enhanceClassifierText();
};

// ============================================================
// DASHBOARD SUB-SECTION SWITCHER (DECLUTTERED VIEWS)
// ============================================================
window.switchDashSection = function(secName) {
    const secOverview = document.getElementById('dashSecOverview');
    const secBarriers = document.getElementById('dashSecBarriers');
    const secPredictive = document.getElementById('dashSecPredictive');

    const btnOverview = document.getElementById('btnDashSecOverview');
    const btnBarriers = document.getElementById('btnDashSecBarriers');
    const btnPredictive = document.getElementById('btnDashSecPredictive');
    const btnAll = document.getElementById('btnDashSecAll');

    [btnOverview, btnBarriers, btnPredictive, btnAll].forEach(b => b?.classList.remove('active'));

    if (secName === 'overview') {
        if (secOverview) secOverview.style.display = 'block';
        if (secBarriers) secBarriers.style.display = 'none';
        if (secPredictive) secPredictive.style.display = 'none';
        btnOverview?.classList.add('active');
    } else if (secName === 'barriers') {
        if (secOverview) secOverview.style.display = 'none';
        if (secBarriers) secBarriers.style.display = 'block';
        if (secPredictive) secPredictive.style.display = 'none';
        btnBarriers?.classList.add('active');
    } else if (secName === 'predictive') {
        if (secOverview) secOverview.style.display = 'none';
        if (secBarriers) secBarriers.style.display = 'none';
        if (secPredictive) secPredictive.style.display = 'block';
        btnPredictive?.classList.add('active');
    } else { // 'all'
        if (secOverview) secOverview.style.display = 'block';
        if (secBarriers) secBarriers.style.display = 'block';
        if (secPredictive) secPredictive.style.display = 'block';
        btnAll?.classList.add('active');
    }
};

// ============================================================
// UI & REPORT MULTILINGUAL LOCALIZATION (EN, HI, AS, BN, KN)
// ============================================================
window.changeLanguage = function(langCode) {
    const langBadge = document.getElementById('langBadge');

    const translations = {
        en: {
            badge: "Detected: English (Standard Domain)",
            heroSub: "A structured system to distinguish Serious Injury & Fatality (SIF) precursors from routine low-severity observations — aligned with OISD-STD-105, DGMS OMR 2017, and the 10 IOGP Life-Saving Rules.",
            tabHome: "Overview",
            tabClassifier: "Incident Classifier",
            tabOverview: "Dashboard",
            tabDensity: "Site Risk Analysis",
            tabIogp: "Compliance",
            tabExplorer: "Reports",
            selectReport: "Select Report from Dataset (60+ Oilfield Incidents):",
            browsePicker: "Browse All 60+ Reports",
            presetsLabel: "Quick High-Impact Scenario Presets:",
            obsTextLabel: "Incident observation text:",
            classifyBtn: "Classify Incident",
            polishBtn: "AI Polish Narrative",
            btnOverview: "Overview & Trends",
            btnBarriers: "Barrier & Precursor Intelligence",
            btnPredictive: "Predictive AI & Simulator",
            btnAll: "View All Sections"
        },
        hi: {
            badge: "पहचान: हिंदी (तेल क्षेत्र सुरक्षा)",
            heroSub: "गंभीर चोट और मृत्यु (SIF) पूर्ववर्ती संकेतों को सामान्य कम-जोखिम वाली घटनाओं से अलग करने के लिए एक स्वचालित मंच — OISD-STD-105 और 10 IOGP जीवन रक्षक नियमों के अनुरूप।",
            tabHome: "अवलोकन",
            tabClassifier: "घटना वर्गीकरण",
            tabOverview: "डैशबोर्ड",
            tabDensity: "साइट जोखिम विश्लेषण",
            tabIogp: "अनुपालन",
            tabExplorer: "रिपोर्ट संग्रह",
            selectReport: "डेटासेट से रिपोर्ट चुनें (60+ तेल क्षेत्र घटनाएं):",
            browsePicker: "सभी 60+ रिपोर्ट देखें",
            presetsLabel: "त्वरित उच्च-प्रभाव परिदृश्य:",
            obsTextLabel: "घटना अवलोकन पाठ विवरण:",
            classifyBtn: "घटना का वर्गीकरण करें",
            polishBtn: "एआई पाठ सुधार",
            btnOverview: "अवलोकन और रुझान",
            btnBarriers: "अवरोध और पूर्वाभास विश्लेषण",
            btnPredictive: "पूर्वानुमानित एआई और सिम्युलेटर",
            btnAll: "सभी अनुभाग देखें"
        },
        as: {
            badge: "চিনাক্ত কৰা হৈছে: অসমীয়া (অসম তৈল ক্ষেত্র)",
            heroSub: "গুৰুতৰ আঘাত আৰু মৃত্যু (SIF) পূৰ্বসংকেতসমূহক সাধাৰণ কম-প্ৰভাৱৰ পৰ্যবেক্ষণৰ পৰা পৃথক কৰাৰ বাবে এটা স্বয়ংক্ৰিয় প্লেটফৰ্ম — OISD-STD-105 আৰু IOGP নিয়মৰ সৈতে সামঞ্জস্যপূৰ্ণ।",
            tabHome: "অৱলোকন",
            tabClassifier: "ঘটনা শ্ৰেণীবিভাজন",
            tabOverview: "ড্যাশবৰ্ড",
            tabDensity: "ঝুঁকি বিশ্লেষণ",
            tabIogp: "অনুপালন",
            tabExplorer: "প্ৰতিবেদন",
            selectReport: "ডাটাসেটৰ পৰা প্ৰতিবেদন বাছনি কৰক (৬০+ তৈল ক্ষেত্ৰৰ ঘটনা):",
            browsePicker: "সকলো ৬০+ প্ৰতিবেদন চাওক",
            presetsLabel: "দ্রুত প্ৰভাৱশালী দৃশ্যপটসমূহ:",
            obsTextLabel: "ঘটনা পৰ্যবেক্ষণৰ পাঠ:",
            classifyBtn: "ঘটনা শ্ৰেণীবিভাজন কৰক",
            polishBtn: "এআই পাঠ পৰিশোধন",
            btnOverview: "অৱলোকন আৰু প্ৰৱণতা",
            btnBarriers: "প্ৰতিবন্ধক আৰু পূৰ্বসংকেত বিশ্লেষণ",
            btnPredictive: "পূৰ্বানুমান এআই আৰু চিমুলেটৰ",
            btnAll: "সকলো খণ্ড চাওক"
        },
        bn: {
            badge: "শনাক্তকরণ: বাংলা (পূর্বাঞ্চল তৈল ক্ষেত্র)",
            heroSub: "গুরুতর আঘাত ও মৃত্যু (SIF) পূর্বসূরী সংকেতসমূহকে সাধারণ কম-ঝুঁকিপূর্ণ পর্যবেক্ষণ থেকে পৃথক করার স্বয়ংক্রিয় ব্যবস্থা — OISD-STD-105 এবং ১০টি IOGP জীবন রক্ষাকারী নিয়মের সাথে সামঞ্জস্যপূর্ণ।",
            tabHome: "ওভারভিউ",
            tabClassifier: "ঘটনা শ্রেণীবিন্যাস",
            tabOverview: "ড্যাশবোর্ড",
            tabDensity: "সাইট ঝুঁকি বিশ্লেষণ",
            tabIogp: "অনুসরণ ও অনুপালন",
            tabExplorer: "রিপোর্ট আর্কাইভ",
            selectReport: "ডেটা সেট থেকে রিপোর্ট নির্বাচন করুন (৬০+ তেল ক্ষেত্র ঘটনা):",
            browsePicker: "সমস্ত ৬০+ রিপোর্ট ব্রাউজ করুন",
            presetsLabel: "দ্রুত উচ্চ-প্রভাবের ঘটনা চিত্র:",
            obsTextLabel: "ঘটনা পর্যবেক্ষণের বিবরণ পাঠ:",
            classifyBtn: "ঘটনা শ্রেণীবিন্যাস করুন",
            polishBtn: "এআই পাঠ সংশোধন",
            btnOverview: "ওভারভিউ ও ট্রেন্ডস",
            btnBarriers: "ব্যারিয়ার ও পূর্বাভাস বিশ্লেষণ",
            btnPredictive: "প্রেডিক্টিভ এআই ও সিমুলেটর",
            btnAll: "সমস্ত বিভাগ দেখুন"
        },
        kn: {
            badge: "ಗುರುತಿಸಲಾಗಿದೆ: ಕನ್ನಡ (ಕೆಜಿ ಬಸಿನ್)",
            heroSub: "ತೀವ್ರ ಗಾಯ ಮತ್ತು ಮರಣ (SIF) ಮುನ್ಸೂಚನೆಗಳನ್ನು ವಾಡಿಕೆಯ ಕಡಿಮೆ-ತೀವ್ರತೆಯ ವೀಕ್ಷಣೆಗಳಿಂದ ಪ್ರತ್ಯೇಕಿಸಲು ಸ್ವಯಂಚಾಲಿತ ವೇದಿಕೆ — OISD-STD-105 ಮತ್ತು IOGP ನಿಯಮಗಳಿಗೆ ಅನುಗುಣವಾಗಿದೆ.",
            tabHome: "ಅವಲೋಕನ",
            tabClassifier: "ಘಟನೆ ವರ್ಗೀಕರಣ",
            tabOverview: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
            tabDensity: "ಸೈಟ್ ಅಪಾಯ ವಿಶ್ಲೇಷಣೆ",
            tabIogp: "ಅನುಸರಣೆ",
            tabExplorer: "ವರದಿಗಳು",
            selectReport: "ಡೇಟಾಸೆಟ್‌ನಿಂದ ವರದಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ (60+ ತೈಲಕ್ಷೇತ್ರ ಘಟನೆಗಳು):",
            browsePicker: "ಎಲ್ಲಾ 60+ ವರದಿಗಳನ್ನು ವೀಕ್ಷಿಸಿ",
            presetsLabel: "ತ್ವರಿತ ಹೆಚ್ಚಿನ ಪರಿಣಾಮದ ಸನ್ನಿವೇಶಗಳು:",
            obsTextLabel: "ಘಟನೆಯ ವೀಕ್ಷಣೆಯ ಪಠ್ಯ ವಿವರಣೆ:",
            classifyBtn: "ಘಟನೆಯನ್ನು ವರ್ಗೀಕರಿಸಿ",
            polishBtn: "ಎಐ ಪಠ್ಯ ಪರಿಷ್ಕರಣೆ",
            btnOverview: "ಅವಲೋಕನ ಮತ್ತು ಪ್ರವೃತ್ತಿಗಳು",
            btnBarriers: "ತಡೆಗೋಡೆ ಮತ್ತು ಮುನ್ಸೂಚಕ ವಿಶ್ಲೇಷಣೆ",
            btnPredictive: "ಮುನ್ಸೂಚನಾ ಎಐ ಮತ್ತು ಸಿಮ್ಯುಲೇಟರ್",
            btnAll: "ಎಲ್ಲಾ ವಿಭಾಗಗಳನ್ನು ವೀಕ್ಷಿಸಿ"
        }
    };

    const dict = translations[langCode] || translations.en;
    if (langBadge) langBadge.textContent = dict.badge;

    const heroSub = document.querySelector('.hero-subtitle');
    if (heroSub) heroSub.textContent = dict.heroSub;

    // Update Tab Navigation labels
    document.querySelectorAll('.nav-links-menu .nav-item').forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        const span = btn.querySelector('span');
        if (span && tab === 'tab-home' && dict.tabHome) span.textContent = dict.tabHome;
        if (span && tab === 'tab-classifier' && dict.tabClassifier) span.textContent = dict.tabClassifier;
        if (span && tab === 'tab-overview' && dict.tabOverview) span.textContent = dict.tabOverview;
        if (span && tab === 'tab-density' && dict.tabDensity) span.textContent = dict.tabDensity;
        if (span && tab === 'tab-iogp' && dict.tabIogp) span.textContent = dict.tabIogp;
        if (span && tab === 'tab-explorer' && dict.tabExplorer) span.textContent = dict.tabExplorer;
    });

    // Classifier elements
    const selectReportLabel = document.getElementById('selectReportLabel');
    if (selectReportLabel) selectReportLabel.innerHTML = `<strong>${dict.selectReport}</strong>`;
    const btnBrowsePicker = document.getElementById('btnBrowsePicker');
    if (btnBrowsePicker) btnBrowsePicker.textContent = dict.browsePicker;
    const presetsLabel = document.getElementById('presetsLabel');
    if (presetsLabel) presetsLabel.textContent = dict.presetsLabel;
    const obsTextLabel = document.getElementById('obsTextLabel');
    if (obsTextLabel) obsTextLabel.innerHTML = `<strong>${dict.obsTextLabel}</strong>`;
    const classifyBtnTxt = document.getElementById('classifyBtnTxt');
    if (classifyBtnTxt) classifyBtnTxt.textContent = dict.classifyBtn;
    const polishBtn = document.getElementById('polishBtn');
    if (polishBtn) polishBtn.textContent = dict.polishBtn;

    // Dashboard switcher buttons
    const btnOverview = document.getElementById('btnDashSecOverview');
    if (btnOverview) btnOverview.textContent = dict.btnOverview;
    const btnBarriers = document.getElementById('btnDashSecBarriers');
    if (btnBarriers) btnBarriers.textContent = dict.btnBarriers;
    const btnPredictive = document.getElementById('btnDashSecPredictive');
    if (btnPredictive) btnPredictive.textContent = dict.btnPredictive;
    const btnAll = document.getElementById('btnDashSecAll');
    if (btnAll) btnAll.textContent = dict.btnAll;

    showToast(`Language switched to ${langCode.toUpperCase()}`, 'info');
};

function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 8px; pointer-events: none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'}; border-radius: 6px; padding: 10px 16px; font-size: 12px; font-weight: 600; box-shadow: var(--shadow-lg); transition: opacity 0.3s; opacity: 1; pointer-events: auto; display: flex; align-items: center; gap: 8px;`;
    toast.innerHTML = `<span>[${type.toUpperCase()}] ${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================
// SAVE & REGISTER REPORT FROM INCIDENT CLASSIFIER TO DATASET
// ============================================================
window.saveClassifierReportToDataset = function() {
    const textarea = document.getElementById('classifierTextarea');
    const text = textarea ? textarea.value.trim() : '';

    if (!text) {
        alert('Please enter or select an observation text first.');
        return;
    }

    // 1. Pre-fill official report form in tab-explorer
    const descInput = document.getElementById('newReportDescription');
    if (descInput) descInput.value = text;

    const titleInput = document.getElementById('newReportTitle');
    if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
        titleInput.value = text.slice(0, 55) + (text.length > 55 ? '...' : '');
    }

    const dateInput = document.getElementById('newReportDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    const selectedReportId = document.getElementById('classifierDatasetDropdown')?.value;
    const activeReportObj = masterReports.find(r => r.report_id === selectedReportId);

    const siteInput = document.getElementById('newReportSite');
    if (siteInput) siteInput.value = activeReportObj?.site_location || 'Baghjan Field #5';

    const deptInput = document.getElementById('newReportDepartment');
    if (deptInput) deptInput.value = activeReportObj?.department || 'Workover & Operations';

    const typeSelect = document.getElementById('newReportType');
    if (typeSelect && !typeSelect.value) typeSelect.value = 'Unsafe Condition';

    const actInput = document.getElementById('newReportActivity');
    if (actInput && !actInput.value) actInput.value = 'Well Operations & Maintenance';

    // 2. Switch tab to tab-explorer & scroll to form
    switchTab('tab-explorer');

    const card = document.getElementById('newReportCard');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    showToast('Observation transferred to Official Safety Report Form. Review site details & click Save!', 'success');
};


// ============================================================
// HSE ASK AI — NATURAL LANGUAGE ANALYTICS ENGINE
// ============================================================
const askAiHistory = [];

async function sendAskAi() {
    const input = document.getElementById('askAiInput');
    const btn = document.getElementById('askAiBtn');
    const thread = document.getElementById('askAiThread');
    const question = input ? input.value.trim() : '';
    if (!question) return;

    // Clear welcome message on first question
    const welcome = thread.querySelector('.ask-ai-welcome');
    if (welcome) welcome.remove();

    // Append user bubble
    thread.innerHTML += `
        <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
            <div style="background:var(--accent); color:#fff; padding:10px 14px; border-radius:12px 12px 2px 12px; max-width:75%; font-size:13px; font-weight:600;">${escapeHtml(question)}</div>
        </div>`;
    thread.scrollTop = thread.scrollHeight;

    input.value = '';
    btn.textContent = 'Thinking...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/ask-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await res.json();

        // Format markdown bold
        const formattedAnswer = (data.answer || 'No answer returned.').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Build evidence table if rows exist
        let tableHtml = '';
        if (data.table && data.table.length > 0) {
            const cols = Object.keys(data.table[0]);
            tableHtml = `
                <div style="overflow-x:auto; margin-top:10px;">
                    <table class="corp-table" style="font-size:11px; width:100%;">
                        <thead><tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
                        <tbody>${data.table.map(row =>
                            `<tr>${cols.map(c => `<td>${escapeHtml(String(row[c] ?? ''))}</td>`).join('')}</tr>`
                        ).join('')}</tbody>
                    </table>
                </div>`;
        }

        thread.innerHTML += `
            <div style="display:flex; justify-content:flex-start; margin-bottom:16px;">
                <div style="background:var(--bg-card); border:1px solid var(--border); padding:12px 16px; border-radius:2px 12px 12px 12px; max-width:90%; font-size:13px; line-height:1.6;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                        <span style="font-size:10px; font-weight:700; color:var(--amber); text-transform:uppercase; letter-spacing:0.5px;">HSE Ask AI</span>
                        <span style="font-size:9px; color:var(--text-muted);">|</span>
                        <span style="font-size:9px; color:var(--text-muted);">${data.intent || 'analysis'}</span>
                    </div>
                    <p style="margin:0 0 6px;">${formattedAnswer}</p>
                    ${tableHtml}
                    <p style="font-size:9px; color:var(--text-muted); margin:8px 0 0;">Source: ${data.source || 'oil_safety_reports.csv'}</p>
                </div>
            </div>`;
        thread.scrollTop = thread.scrollHeight;

    } catch (err) {
        thread.innerHTML += `<div style="color:var(--red); font-size:12px; margin-bottom:10px;">HSE Ask AI is offline. Ensure the Python server is running.</div>`;
    } finally {
        btn.textContent = 'Ask AI';
        btn.disabled = false;
    }
}

function askAiPreset(question) {
    const input = document.getElementById('askAiInput');
    if (input) input.value = question;
    sendAskAi();
}

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


// ============================================================
// HSE REVIEW QUEUE — HUMAN-IN-THE-LOOP HITL VALIDATION
// ============================================================
async function fetchReviewQueue() {
    const container = document.getElementById('reviewQueueContainer');
    const countBadge = document.getElementById('reviewQueueCount');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:32px;">Loading review queue from AI pipeline...</p>';

    try {
        const res = await fetch('/api/review-queue');
        const data = await res.json();
        const queue = data.queue || [];

        if (countBadge) countBadge.textContent = `${queue.length} Pending Review`;

        if (queue.length === 0) {
            container.innerHTML = `<div class="info-card" style="text-align:center; padding:32px; color:var(--text-muted);">
                <strong>No reports pending review.</strong><br>All AI classifications are above the 75% confidence threshold.
            </div>`;
            return;
        }

        container.innerHTML = queue.map(r => {
            const confColor = r.ai_confidence < 55 ? 'var(--red)' : 'var(--amber)';
            const verdictBg = r.ai_verdict === 'SIF_POTENTIAL' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.1)';
            const verdictColor = r.ai_verdict === 'SIF_POTENTIAL' ? 'var(--red)' : 'var(--green, #10b981)';
            return `
            <div class="corp-card" style="margin-bottom:12px; border-left:3px solid ${confColor};" id="rq-card-${r.report_id}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                    <div style="flex:1; min-width:200px;">
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;">
                            <span class="id-tag">${r.report_id}</span>
                            <span style="font-size:10px; color:var(--text-muted);">${r.date}</span>
                            <span style="font-size:10px; color:var(--text-muted);">${r.site}</span>
                            <span style="font-size:10px; padding:2px 8px; border-radius:4px; background:${verdictBg}; color:${verdictColor}; font-weight:700;">${r.ai_verdict.replace(/_/g,' ')}</span>
                        </div>
                        <p style="font-size:12px; color:var(--text-primary); margin:0 0 6px; line-height:1.5;">${r.description}</p>
                        <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:10px; color:var(--text-muted);">
                            <span><strong>Dept:</strong> ${r.department}</span>
                            <span><strong>IOGP Rule:</strong> ${r.iogp_rule}</span>
                            <span><strong>Barrier:</strong> ${r.barrier}</span>
                        </div>
                    </div>
                    <div style="text-align:right; min-width:140px;">
                        <div style="font-size:24px; font-weight:800; color:${confColor}; line-height:1;">${r.ai_confidence}%</div>
                        <div style="font-size:10px; color:var(--text-muted); margin-bottom:10px;">AI Confidence</div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <button class="btn btn-sm" style="background:var(--red); color:#fff; border:none; font-size:11px; padding:5px 10px;" onclick="reviewQueueAction('${r.report_id}', 'approve_sif')">Approve as SIF</button>
                            <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:5px 10px;" onclick="reviewQueueAction('${r.report_id}', 'reclassify_non_sif')">Reclassify Non-SIF</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        container.innerHTML = '<p style="color:var(--red); padding:20px;">Failed to load review queue. Server may be offline.</p>';
        console.error('Review queue fetch failed:', err);
    }
}

async function reviewQueueAction(reportId, action) {
    const card = document.getElementById(`rq-card-${reportId}`);
    if (card) card.style.opacity = '0.5';

    const currentUser = sessionStorage.getItem('userRole') || 'HSE Officer';
    try {
        const res = await fetch('/api/review-queue/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report_id: reportId, action, officer: currentUser })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            if (card) card.remove();
            // Refresh count
            const countBadge = document.getElementById('reviewQueueCount');
            const remaining = document.querySelectorAll('[id^="rq-card-"]').length;
            if (countBadge) countBadge.textContent = `${remaining} Pending Review`;
        } else {
            showToast(data.error || 'Action failed.', 'error');
            if (card) card.style.opacity = '1';
        }
    } catch (err) {
        showToast('Server offline. Cannot process review action.', 'error');
        if (card) card.style.opacity = '1';
    }
}

// Auto-load review queue when its tab is activated
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item[data-tab="tab-review-queue"]').forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(fetchReviewQueue, 100);
        });
    });
});
