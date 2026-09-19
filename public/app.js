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
}

let currentRole = 'hse_manager';

document.addEventListener('DOMContentLoaded', () => {
    initRoleControl();
    initHeroCarousel();
    setupTabNavigation();
    setupHomeModuleClicks();
    setupEventListeners();
    fetchAnalytics();
    fetchReports();
    fetchKnowledgeGraph();
    fetchReviews();
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
        confirmBtn.addEventListener('click', () => {
            const activeRoleBtn = document.querySelector('.role-card-btn.active');
            if (activeRoleBtn) {
                currentRole = activeRoleBtn.getAttribute('data-role');
                sessionStorage.setItem('oil_hsse_user_role', currentRole);
                if (modal) modal.style.display = 'none';
                applyRoleAccess(currentRole);
            }
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
        // Hide Dashboard, Site Risk, Compliance tabs
        document.querySelectorAll('.nav-item').forEach(el => {
            const tab = el.getAttribute('data-tab');
            if (['tab-overview', 'tab-density', 'tab-iogp'].includes(tab)) {
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
    document.querySelectorAll('.nav-item, .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    document.querySelectorAll(`[data-tab="${targetTabId}"]`).forEach(btn => btn.classList.add('active'));

    const tabContent = document.getElementById(targetTabId);
    if (tabContent) tabContent.classList.add('active');

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

// Human-readable verdict labels
const VERDICT_LABELS = {
    'SIF_POTENTIAL':       'SIF Precursor — High Risk',
    'DEFENDED_NEAR_MISS':  'Defended Near-Miss',
    'NON_SIF_OBSERVATION': 'Non-SIF Observation'
};

// Human-readable barrier condition labels
const BARRIER_LABELS = {
    'FAILED_OR_ABSENT': 'Absent / Failed',
    'EFFECTIVE':        'Effective',
    'COMPROMISED':      'Compromised',
    'UNKNOWN':          'Not Determined'
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
            const kpiRate  = document.getElementById('kpiSifRate');
            const kpiSite  = document.getElementById('kpiTopSite');
            const kpiRule  = document.getElementById('kpiTopRule');

            if (kpiTotal) kpiTotal.textContent = analyticsData.summary.total_reports;
            if (kpiRate)  kpiRate.textContent  = `${analyticsData.summary.sif_rate_pct}%`;
            if (kpiSite)  kpiSite.textContent  = analyticsData.summary.top_high_risk_site.split(' ')[0];
            if (kpiRule)  kpiRule.textContent  = analyticsData.summary.top_breached_rule;
        }

        renderOverviewCharts(analyticsData);
        renderDensityTable(analyticsData.site_rankings || []);
        renderActivityRisk(analyticsData.activity_risk || []);
        renderPrecursorAlerts(analyticsData.top_precursors || []);
        renderRecurrenceAlerts(analyticsData.recurrence_alerts || []);
        renderRiskMatrix(analyticsData.risk_matrix || []);
        renderSeverityDonutChart(analyticsData.severity_buckets || {});
        renderMonthlyTrend(analyticsData.monthly_trend || [], analyticsData.forecast_data || [], analyticsData.forecast_summary);

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
        filteredReports = [...masterReports];
        renderMasterTable();
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
async function fetchKnowledgeGraph() {
    try {
        const response = await fetch('/api/knowledge-graph');
        const graphData = await response.json();
        renderKnowledgeGraph(graphData);
    } catch (err) {
        console.error("Failed to load knowledge graph data:", err);
    }
}

function renderKnowledgeGraph(graphData) {
    const svgEl = document.getElementById('knowledgeGraphSvg');
    if (!svgEl || !graphData || !graphData.nodes || graphData.nodes.length === 0) return;

    // Clear previous SVG contents
    d3.select(svgEl).selectAll('*').remove();

    const width = svgEl.clientWidth || 800;
    const height = 480;

    const svg = d3.select(svgEl)
        .attr('viewBox', [0, 0, width, height]);

    // Color scale for node groups
    const groupColors = {
        'Department': '#3B82F6',
        'Life-Saving Rule': '#D97706',
        'Barrier Category': '#EF4444',
        'Precursor Pattern': '#10B981'
    };

    const links = graphData.links.map(d => Object.assign({}, d));
    const nodes = graphData.nodes.map(d => Object.assign({}, d));

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(85))
        .force('charge', d3.forceManyBody().strength(-140))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(22));

    const link = svg.append('g')
        .selectAll('line')
        .data(links)
        .join('line');

    const node = svg.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .call(d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x; d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                // Keep node fixed at pulled position so it stays in place
                d.fx = event.x;
                d.fy = event.y;
            }));

    node.append('circle')
        .attr('r', d => Math.min(18, 7 + Math.sqrt(d.value || 1) * 2))
        .attr('fill', d => groupColors[d.group] || '#64748B')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 2);

    node.append('text')
        .text(d => d.name.length > 22 ? d.name.substring(0, 20) + '...' : d.name)
        .attr('x', 14)
        .attr('y', 4);

    // Click to highlight connected edges
    node.on('click', (event, d) => {
        event.stopPropagation();
        link.classed('highlighted', l => l.source.id === d.id || l.target.id === d.id);
    });

    // Double-click to unpin/release node position
    node.on('dblclick', (event, d) => {
        event.stopPropagation();
        d.fx = null;
        d.fy = null;
        simulation.alphaTarget(0.1).restart();
    });

    svg.on('click', () => link.classed('highlighted', false));

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${Math.max(20, Math.min(width - 20, d.x))},${Math.max(20, Math.min(height - 20, d.y))})`);
    });
}

function applyTableFilters() {
    const searchInput = document.getElementById('explorerSearch');
    const activeBtn = document.querySelector('.filter-btn.active');
    if (!searchInput || !activeBtn) return;

    const searchTerm = searchInput.value.toLowerCase();
    const activeFilter = activeBtn.getAttribute('data-filter');

    filteredReports = masterReports.filter(report => {
        const matchesSearch = 
            report.report_id.toLowerCase().includes(searchTerm) ||
            report.site_location.toLowerCase().includes(searchTerm) ||
            report.description.toLowerCase().includes(searchTerm) ||
            report.iogp_life_saving_rule.toLowerCase().includes(searchTerm);

        let matchesSif = true;
        if (activeFilter === 'sif') matchesSif = report.sif_potential === 1;
        if (activeFilter === 'nonsif') matchesSif = report.sif_potential === 0;

        return matchesSearch && matchesSif;
    });

    renderMasterTable();
}

function renderMasterTable() {
    const tbody = document.getElementById('masterExplorerBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filteredReports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 20px;">No matching safety observations found.</td></tr>`;
        return;
    }

    filteredReports.slice(0, 100).forEach(report => {
        const tr = document.createElement('tr');
        
        const sifStatus = report.sif_potential === 1 
            ? `<span class="pill-sif">SIF Potential</span>`
            : `<span class="pill-nonsif">Non-SIF</span>`;

        tr.innerHTML = `
            <td><strong>${escapeHtml(report.report_id)}</strong></td>
            <td>${escapeHtml(report.date)}</td>
            <td>${escapeHtml(report.site_location)}</td>
            <td>${escapeHtml(report.department)}</td>
            <td>${escapeHtml(report.report_type)}</td>
            <td>${escapeHtml(report.description.substring(0, 85))}...</td>
            <td>${sifStatus}</td>
            <td>${escapeHtml(report.iogp_life_saving_rule)}</td>
        `;

        tbody.appendChild(tr);
    });
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
                legend: { position: 'bottom', labels: { color: '#374151', font: { size: 10 } } }
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
    const colors = ['#E07B00', '#DC2626', '#16A34A', '#0369A1', '#7C3AED', '#DB2777'];

    barrierChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Reports',
                data: values,
                backgroundColor: colors.slice(0, labels.length).map(c => c + '22'),
                borderColor:     colors.slice(0, labels.length),
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
                x: { ticks: { color: '#6B7280' }, grid: { color: '#F3F4F6' } },
                y: { ticks: { color: '#374151', font: { size: 10.5 } }, grid: { display: false } }
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
    const histSifs   = trendData.map(d => d.sif);

    const forecastLabels = forecastData.map(d => d.month + " (Forecast)");
    const forecastSifs   = forecastData.map(d => d.sif);

    const allLabels = [...histLabels, ...forecastLabels];
    const histSifSeries = [...histSifs, ...forecastData.map(() => null)];
    
    // Connect historical to forecast
    const forecastSifSeries = [
        ...trendData.map((d, i) => i === trendData.length - 1 ? d.sif : null),
        ...forecastSifs
    ];

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
                    borderColor: '#D97706',
                    borderDash: [6, 4],
                    backgroundColor: 'rgba(217,119,6,0.08)',
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
                legend: { position: 'top', labels: { color: '#374151', font: { size: 11 } } }
            },
            scales: {
                x: { ticks: { color: '#6B7280', font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#6B7280' }, grid: { color: '#F3F4F6' }, beginAtZero: true }
            }
        }
    });
}

function renderOverviewCharts(data) {
    const ctxSiteEl = document.getElementById('overviewSiteChart');
    const ctxLsrEl = document.getElementById('overviewLsrChart');
    if (!ctxSiteEl || !ctxLsrEl) return;

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
                backgroundColor: 'rgba(243, 156, 18, 0.65)',
                borderColor: '#F39C12',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#6B7280', font: { size: 10, weight: '600' } }, grid: { display: false } },
                y: { ticks: { color: '#6B7280' }, grid: { color: '#F3F4F6' }, title: { display: true, text: 'SIF Density (%)', color: '#374151' } }
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
                backgroundColor: ['#EF4444', '#F39C12', '#D97706', '#10B981', '#F59E0B', '#9333EA', '#14B8A6', '#E11D48'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#374151', font: { size: 10.5 } } }
            }
        }
    });
}

function renderDensityDetailChart(siteData) {
    const ctx = document.getElementById('densityDetailChart');
    if (!ctx) return;
    const labels = siteData.map(s => s.site_location);
    const densities = siteData.map(s => s.sif_density);

    if (densityDetailChartInstance) densityDetailChartInstance.destroy();

    densityDetailChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'SIF Precursor Density (%)',
                data: densities,
                backgroundColor: 'rgba(243, 156, 18, 0.7)',
                borderColor: '#F39C12',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#6B7280', font: { size: 10, weight: '600' } }, grid: { color: '#F3F4F6' } },
                y: { ticks: { color: '#6B7280' }, grid: { color: '#F3F4F6' } }
            }
        }
    });
}

function renderIogpDetailChart(lsrData) {
    const ctx = document.getElementById('iogpDetailChart');
    if (!ctx) return;

    if (iogpDetailChartInstance) iogpDetailChartInstance.destroy();

    iogpDetailChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(lsrData),
            datasets: [{
                label: 'Report Count',
                data: Object.values(lsrData),
                backgroundColor: 'rgba(245, 158, 11, 0.7)',
                borderColor: '#F59E0B',
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
                x: { ticks: { color: '#6B7280' }, grid: { color: '#F3F4F6' } },
                y: { ticks: { color: '#374151', font: { size: 10.5 } }, grid: { display: false } }
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

        const confPct   = Math.round((data.sif_confidence || 0.90) * 100);
        const riskScore = Math.round((data.sif_severity_score || data.sif_confidence || 0.90) * 100);

        const riskNum = document.getElementById('riskScoreNum');
        if (riskNum) riskNum.textContent = riskScore;

        const vConf = document.getElementById('verdictConf');
        if (vConf) vConf.textContent = `${confPct}%`;

        const confMeter = document.getElementById('confMeter');
        if (confMeter) confMeter.style.width = `${confPct}%`;

        // ── Explainable Contributing Factors ─────────────────────────────
        const hasEnergy  = data.energy_sources && data.energy_sources.length > 0;
        const barrierOut = data.barrier_condition === 'FAILED_OR_ABSENT' || data.barrier_condition === 'COMPROMISED';
        const isSIF      = data.dekra_verdict === 'SIF_POTENTIAL';
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

        // ── Assessment grid ───────────────────────────────────────────────
        const resRule    = document.getElementById('resRule');
        const resEnergy  = document.getElementById('resEnergy');
        const resBarrier = document.getElementById('resBarrier');
        const resLsrAgreement = document.getElementById('resLsrAgreement');
        if (resRule)    resRule.textContent    = data.iogp_life_saving_rule || '—';
        if (resEnergy)  resEnergy.textContent  = formatEnergySource(data.energy_sources);
        if (resBarrier) resBarrier.textContent = BARRIER_LABELS[data.barrier_condition] || data.barrier_condition || '—';
        if (resLsrAgreement) {
            resLsrAgreement.textContent = data.lsr_model_agreement === null
                ? 'Unavailable'
                : data.lsr_model_agreement ? 'Agrees' : `Differs: ${data.lsr_model_rule || 'Unknown'}`;
        }

        // ── Rationale and action plan ─────────────────────────────────────
        const resRationale  = document.getElementById('resRationale');
        const resActionPlan = document.getElementById('resActionPlan');
        if (resRationale)  resRationale.textContent  = data.audit_rationale;
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

