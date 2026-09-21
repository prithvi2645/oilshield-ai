// Oil India Limited  —  HSSE SIF Precursor Management System

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
// FEATURE 20  —  ROLE-BASED ACCESS CONTROL (RBAC)
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

    const headerRoleSelect = document.getElementById('headerRoleSelect');
    if (headerRoleSelect) headerRoleSelect.value = role;

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
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
    });

    document.querySelectorAll(`[data-tab="${targetTabId}"]`).forEach(btn => btn.classList.add('active'));

    const tabContent = document.getElementById(targetTabId);
    if (tabContent) {
        tabContent.classList.add('active');
        tabContent.style.display = 'block';
    }

    // Specific tab triggers
    if (targetTabId === 'tab-review-queue') {
        if (typeof window.fetchReviewQueue === 'function') window.fetchReviewQueue();
    } else if (targetTabId === 'tab-ask-ai') {
        const input = document.getElementById('askAiInput');
        if (input) setTimeout(() => input.focus(), 100);
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

    // Dataset dropdown selection
    const datasetDropdown = document.getElementById('classifierDatasetDropdown');
    if (datasetDropdown) {
        datasetDropdown.addEventListener('change', (e) => {
            loadReportFromDropdown(e.target.value);
        });
    }

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
    'SIF_POTENTIAL':       'SIF Precursor  —  High Risk',
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

        // Fetch 30-Day Predictive Site SIF Risk Forecast
        fetchPredictiveRisk();

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
        document.getElementById('briefTitle').textContent = `${data.title}  •  ${data.period}`;
        const metrics = data.metrics || {};
        document.getElementById('briefMetrics').textContent = `${metrics.reports_analyzed} reports analyzed  •  ${metrics.sif_potential_reports} SIF-potential  •  ${metrics.sif_rate_pct}% rate  •  Highest-risk site: ${metrics.highest_risk_site}`;
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
        populateClassifierDropdown();
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
// FEATURE 7  —  SAFETY KNOWLEDGE GRAPH (D3.JS V7 FORCE LAYOUT)
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
            <span class="alert-count">${escapeHtml(p.count)} × </span>
        `;
        container.appendChild(item);
    });
}

// ============================================================
// FEATURE 19  —  SEVERITY SCORE DISTRIBUTION DONUT CHART
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
// FEATURE 9  —  TEMPORAL RISK FORECAST LINE CHART
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
// FEATURE 15  —  HIERARCHY OF CONTROLS CORRECTIVE ACTION LIST
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
// FEATURE 8  —  SIMILAR INCIDENT RETRIEVAL
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
                <div class="similar-title">${escapeHtml(r.report_id)}  —  ${escapeHtml(r.report_title)}</div>
                <div class="similar-desc">${escapeHtml(r.description)}</div>
                <div class="similar-meta">
                    <span>Installation: <strong>${escapeHtml(r.site_location)}</strong></span>
                    <span> • </span>
                    <span>Rule: <strong>${escapeHtml(r.iogp_rule)}</strong></span>
                    <span> • </span>
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
    if (analyzeBtn) { analyzeBtn.disabled = true; analyzeBtn.textContent = 'Analysing ª'; }

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

        // Feature 16  —  Language Badge Update
        const langBadge = document.getElementById('langBadge');
        if (langBadge) {
            langBadge.textContent = data.language_label || 'Detected: English (Standard Domain)';
        }

        // ΓöÇΓöÇ Verdict banner + risk score ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

        // ΓöÇΓöÇ Explainable Contributing Factors ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
                    ? 'Safety barrier absent or failed  —  worker potentially exposed'
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
                    ? 'Barrier intervened  —  near-miss was defended successfully'
                    : isSIF
                        ? 'Uncontrolled energy release pathway  —  immediate action required'
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

        // ΓöÇΓöÇ Assessment grid ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        const resRule    = document.getElementById('resRule');
        const resEnergy  = document.getElementById('resEnergy');
        const resBarrier = document.getElementById('resBarrier');
        const resLsrAgreement = document.getElementById('resLsrAgreement');
        if (resRule)    resRule.textContent    = data.iogp_life_saving_rule || ' — ';
        if (resEnergy)  resEnergy.textContent  = formatEnergySource(data.energy_sources);
        if (resBarrier) resBarrier.textContent = BARRIER_LABELS[data.barrier_condition] || data.barrier_condition || ' — ';
        if (resLsrAgreement) {
            resLsrAgreement.textContent = data.lsr_model_agreement === null
                ? 'Unavailable'
                : data.lsr_model_agreement ? 'Agrees' : `Differs: ${data.lsr_model_rule || 'Unknown'}`;
        }

        // ΓöÇΓöÇ Rationale and action plan ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        const resRationale  = document.getElementById('resRationale');
        const resActionPlan = document.getElementById('resActionPlan');
        if (resRationale)  resRationale.textContent  = data.audit_rationale;
        if (resActionPlan) resActionPlan.textContent = data.oisd_action_plan;

        // Feature 15  —  Hierarchy of Controls Render
        renderCorrectiveActions(data.corrective_actions || []);

        // Feature 8  —  Similar Incident Search Call
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
// IMAGE UPLOAD HANDLING FOR SAFETY REPORTS
// ============================================================
let currentReportImage = null;

function handleReportImageUpload(event) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image file size must be less than 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        currentReportImage = {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            dataUrl: e.target.result
        };

        const placeholder = document.getElementById('imageUploadPlaceholder');
        const container = document.getElementById('imagePreviewContainer');
        const thumb = document.getElementById('imagePreviewThumb');
        const nameEl = document.getElementById('imagePreviewName');
        const sizeEl = document.getElementById('imagePreviewSize');

        if (placeholder) placeholder.style.display = 'none';
        if (container) container.style.display = 'flex';
        if (thumb) thumb.src = e.target.result;
        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
    };
    reader.readAsDataURL(file);
}

function removeReportImage(event) {
    if (event) event.stopPropagation();
    currentReportImage = null;
    const input = document.getElementById('reportImageInput');
    if (input) input.value = '';

    const placeholder = document.getElementById('imageUploadPlaceholder');
    const container = document.getElementById('imagePreviewContainer');
    if (placeholder) placeholder.style.display = 'flex';
    if (container) container.style.display = 'none';
}

// ============================================================
// REGISTER AS OFFICIAL REPORT & REDIRECT TO REPORTS DATABASE
// ============================================================
window.saveClassifierReportToDataset = async function() {
    const textarea = document.getElementById('classifierTextarea');
    const text = textarea ? textarea.value.trim() : '';

    if (!text) {
        showToast('Please enter or select an observation text first.', 'error');
        return;
    }

    const btn = document.getElementById('saveFromClassifierBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Registering...';
    }

    try {
        const payload = {
            date: new Date().toISOString().split('T')[0],
            site_location: 'Baghjan Field #5',
            department: 'Workover & Operations',
            report_type: 'Unsafe Condition',
            report_title: text.slice(0, 60) + (text.length > 60 ? '...' : ''),
            description: text,
            activity_being_performed: 'Workover operations & high pressure line maintenance',
            image_data: currentReportImage ? currentReportImage.dataUrl : null
        };

        const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to register report.');

        const saved = data.report;
        showToast(`Report ${saved.report_id} successfully registered into live dataset!`, 'success');

        // Reset image input
        removeReportImage();

        // Refresh master dataset, analytics & knowledge graph
        await fetchReports();
        await fetchAnalytics();
        fetchKnowledgeGraph();

        // Redirect to Reports database tab (tab-explorer)
        switchTab('tab-explorer');

        // Select and highlight the newly registered report in the explorer filter
        const searchInput = document.getElementById('explorerSearch');
        if (searchInput) {
            searchInput.value = saved.report_id;
            applyTableFilters();
        }

    } catch (err) {
        console.error('Failed to register report from classifier:', err);
        showToast(`Registration failed: ${err.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span>Register as Official Report</span>';
        }
    }
};

// ============================================================
// HSE ASK AI ENGINE
// ============================================================
window.sendAskAi = async function() {
    const input = document.getElementById('askAiInput');
    const btn = document.getElementById('askAiBtn');
    const thread = document.getElementById('askAiThread');
    const question = input ? input.value.trim() : '';
    if (!question) return;

    // Clear welcome message
    const welcome = thread.querySelector('.ask-ai-welcome');
    if (welcome) welcome.remove();

    // User question bubble
    thread.innerHTML += `
        <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
            <div style="background:var(--amber); color:#fff; padding:10px 14px; border-radius:12px 12px 2px 12px; max-width:75%; font-size:13px; font-weight:600;">${escapeHtml(question)}</div>
        </div>`;
    thread.scrollTop = thread.scrollHeight;

    input.value = '';
    btn.textContent = 'Querying...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/ask-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await res.json();

        let tableHtml = '';
        if (data.table && data.table.length > 0) {
            const cols = Object.keys(data.table[0]);
            tableHtml = `
                <div style="overflow-x:auto; margin-top:10px;">
                    <table class="corp-table" style="font-size:12px;">
                        <thead><tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${data.table.slice(0, 8).map(row => `<tr>${cols.map(c => `<td>${escapeHtml(row[c])}</td>`).join('')}</tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;
        }

        const answerFormatted = escapeHtml(data.answer || 'Query returned response.')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        thread.innerHTML += `
            <div style="display:flex; justify-content:flex-start; margin-bottom:14px;">
                <div style="background:#FFFFFF; border:1px solid var(--border-color, rgba(255,255,255,0.1)); color:var(--text-primary, #f8fafc); padding:12px 16px; border-radius:12px 12px 12px 2px; max-width:85%; font-size:13px; line-height:1.6;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; font-size:11px; color:var(--amber, #f59e0b); font-weight:700;">
                        <span>OIL Safety AI Engine  •  Grounded Dataset Query</span>
                    </div>
                    <div>${answerFormatted}</div>
                    ${tableHtml}
                </div>
            </div>`;
        thread.scrollTop = thread.scrollHeight;

    } catch (err) {
        console.error('Ask AI failed:', err);
        thread.innerHTML += `
            <div style="display:flex; justify-content:flex-start; margin-bottom:12px;">
                <div style="background:rgba(239,68,68,0.1); border:1px solid var(--red); color:var(--red); padding:10px 14px; border-radius:8px; font-size:12px;">
                    Failed to execute query: ${escapeHtml(err.message)}
                </div>
            </div>`;
    } finally {
        if (btn) { btn.textContent = 'Ask AI'; btn.disabled = false; }
    }
};

window.askAiPreset = function(question) {
    const input = document.getElementById('askAiInput');
    if (input) input.value = question;
    sendAskAi();
};

// ============================================================
// HSE REVIEW QUEUE — HUMAN-IN-THE-LOOP HITL VALIDATION
// ============================================================
window.fetchReviewQueue = async function() {
    const container = document.getElementById('reviewQueueContainer');
    const countBadge = document.getElementById('reviewQueueCount');
    if (!container) return;

    container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:32px;">Loading review queue from AI pipeline...</p>';

    try {
        const res = await fetch('/api/reviews');
        const reviews = await res.json();
        
        if (countBadge) countBadge.textContent = `${reviews.length || 0} Decisions Logged`;

        if (!Array.isArray(reviews) || reviews.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:32px; color:var(--text-muted);">
                    <strong>No human reviews logged yet.</strong><br>Use the Incident Classifier to validate reports.
                </div>`;
            return;
        }

        container.innerHTML = `
            <table class="corp-table">
                <thead>
                    <tr>
                        <th>Review ID</th>
                        <th>Timestamp</th>
                        <th>Reviewer</th>
                        <th>Decision</th>
                        <th>Predicted</th>
                        <th>Final</th>
                        <th>Observation Snippet</th>
                    </tr>
                </thead>
                <tbody>
                    ${reviews.slice().reverse().map(r => `
                        <tr>
                            <td><code>${escapeHtml(r.review_id || 'REV')}</code></td>
                            <td>${escapeHtml((r.created_at || '').slice(0, 10))}</td>
                            <td><strong>${escapeHtml(r.reviewer || 'HSE Officer')}</strong></td>
                            <td><span class="badge ${r.decision === 'accepted' ? 'badge-green' : 'badge-amber'}">${escapeHtml(r.decision)}</span></td>
                            <td>${escapeHtml(r.predicted_label || '-')}</td>
                            <td><strong>${escapeHtml(r.final_label || '-')}</strong></td>
                            <td style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(r.text || '')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;

    } catch (err) {
        console.error('Failed to fetch review queue:', err);
        container.innerHTML = `<p style="color:var(--red); text-align:center; padding:20px;">Error loading review queue: ${escapeHtml(err.message)}</p>`;
    }
};

function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#0284c7');
    toast.style.cssText = `background:${bgColor}; color:#fff; padding:12px 18px; border-radius:8px; font-size:13px; font-weight:600; box-shadow:0 10px 15px -3px rgba(0,0,0,0.3); transition:all 0.3s ease; opacity:0; transform:translateY(10px);`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============================================================
// SAFETY KNOWLEDGE MIND MAP & RELATIONAL FLOWCHART (D3.JS V7)
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

function openKgInspector(d) {
    const drawer = document.getElementById('kgInspectorDrawer');
    if (!drawer) return;

    const inspName = document.getElementById('inspNodeName');
    if (inspName) inspName.textContent = d.name || 'N/A';
    
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

    const inspTot = document.getElementById('inspTotalIncidents');
    if (inspTot) inspTot.textContent = d.value || d.incident_count || 0;

    const inspSif = document.getElementById('inspSifCount');
    if (inspSif) inspSif.textContent = d.sif_count || 0;

    const inspSev = document.getElementById('inspAvgSeverity');
    if (inspSev) inspSev.textContent = (d.sif_rate || 0) + '%';

    const inspSite = document.getElementById('inspTopSite');
    if (inspSite) inspSite.textContent = d.oisd_standard || 'OISD-STD-105';

    const reportListEl = document.getElementById('inspReportList');
    if (reportListEl) {
        reportListEl.innerHTML = '';
        const sampleIncidents = d.sample_incidents || [];
        if (sampleIncidents.length === 0) {
            reportListEl.innerHTML = '<p style="color:#64748b; font-size:11px;">No specific report snippets linked.</p>';
        } else {
            sampleIncidents.forEach(inc => {
                const item = document.createElement('div');
                item.className = 'insp-report-item';
                item.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:8px 10px; border-radius:6px; font-size:11px; line-height:1.4; color:var(--text-secondary, #cbd5e1);';
                item.textContent = inc;
                reportListEl.appendChild(item);
            });
        }
    }

    drawer.style.right = '0px';
}

function closeKgInspector() {
    const drawer = document.getElementById('kgInspectorDrawer');
    if (drawer) drawer.style.right = '-380px';
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

// ── MIND MAP (TREE LAYOUT) ───────────────────────────────────────────────────
function renderKgMindmapMode(container, nodes, links, nodeMap, groupColors, groupOrder, width, height) {
    const layerX = {
        'Department': 40,
        'Life-Saving Rule': 280,
        'Barrier Category': 520,
        'Precursor Pattern': 760
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
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.2)')
        .attr('stroke-width', 1.5)
        .attr('d', d => {
            const sx = d.source.x + 200;
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
    const colXs = [40, 270, 520, 770];
    const colFill = 'rgba(30, 41, 59, 0.45)';
    const colStroke = 'rgba(255, 255, 255, 0.08)';

    groupOrder.forEach((grp, colIdx) => {
        container.append('rect')
            .attr('x', colXs[colIdx] - 15)
            .attr('y', 20)
            .attr('width', 200)
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
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.2)')
        .attr('stroke-width', 1.5)
        .attr('d', d => {
            const sx = d.source.x + 200;
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
        .force('collision', d3.forceCollide().radius(45));

    const pathGroup = container.append('g').attr('class', 'kg-paths-layer');
    const pathSel = pathGroup.selectAll('path')
        .data(formattedLinks)
        .join('path')
        .attr('class', 'kg-path')
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.2)')
        .attr('stroke-width', 1.5);

    const nodeSel = renderKgNodes(container, formattedNodes, formattedLinks, pathSel, groupColors);

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

// ── COMMON NODE CARD RENDERER ─────────────────────────────────────────────────
function renderKgNodes(container, nodes, linkPaths, pathSel, groupColors) {
    const nodeGroup = container.append('g').attr('class', 'kg-nodes-layer');

    const nodeG = nodeGroup.selectAll('g.kg-node-group')
        .data(nodes)
        .join('g')
        .attr('class', 'kg-node-group')
        .attr('style', 'cursor:pointer;')
        .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);

    const pillBg = '#FFFFFF';
    const pillTxt = '#0F172A';
    const pillW = 210;
    const pillH = 36;

    // Node Pill Outer Container (Matching UI Palette from Screenshot)
    nodeG.append('rect')
        .attr('class', 'kg-node-pill')
        .attr('x', -10)
        .attr('y', -18)
        .attr('width', pillW)
        .attr('height', pillH)
        .attr('rx', 7)
        .attr('fill', pillBg)
        .attr('stroke', d => groupColors[d.group] || '#3b82f6')
        .attr('stroke-width', 1.6);

    // Group Color Left Indicator Dot
    nodeG.append('circle')
        .attr('cx', 4)
        .attr('cy', 0)
        .attr('r', 4.5)
        .attr('fill', d => groupColors[d.group] || '#3b82f6');

    // Node Title Label Text
    nodeG.append('text')
        .attr('x', 16)
        .attr('y', 4)
        .attr('fill', pillTxt)
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(d => {
            const name = d.name || '';
            return name.length > 21 ? name.substring(0, 19) + '...' : name;
        });

    // Right Edge Count Badge Box (Dark Red with Red Border)
    nodeG.append('rect')
        .attr('x', 158)
        .attr('y', -11)
        .attr('width', 34)
        .attr('height', 22)
        .attr('rx', 5)
        .attr('fill', 'rgba(239, 68, 68, 0.22)')
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 1.2);

    nodeG.append('text')
        .attr('x', 175)
        .attr('y', 4)
        .attr('fill', '#ffffff')
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .text(d => d.value || d.incident_count || 1);

    // Hover Flow Tracing Interaction
    nodeG.on('mouseenter', (event, d) => {
        if (currentKgSearchQuery) return;
        const connectedNodeIds = new Set([d.id]);

        pathSel.style('stroke', l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            const isMatch = sId === d.id || tId === d.id;
            if (isMatch) {
                connectedNodeIds.add(sId);
                connectedNodeIds.add(tId);
            }
            return isMatch ? '#f59e0b' : 'rgba(255,255,255,0.05)';
        }).style('stroke-width', l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            return (sId === d.id || tId === d.id) ? 2.5 : 1;
        });

        nodeG.style('opacity', n => connectedNodeIds.has(n.id) ? 1 : 0.25);
    });

    nodeG.on('mouseleave', () => {
        if (currentKgSearchQuery) return;
        pathSel.style('stroke', 'rgba(255, 255, 255, 0.18)').style('stroke-width', 1.5);
        nodeG.style('opacity', 1);
    });

    // Click to Open Inspector Drawer
    nodeG.on('click', (event, d) => {
        event.stopPropagation();
        openKgInspector(d);
    });

    return nodeG;
}



// ============================================================
// 500 REPORTS DATASET DROPDOWN FOR INCIDENT CLASSIFIER
// ============================================================
function populateClassifierDropdown() {
    const dropdown = document.getElementById('classifierDatasetDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="" style="color:var(--text-muted);">-- Select from 500 Historical Reports Dataset --</option>';

    if (!masterReports || masterReports.length === 0) return;

    masterReports.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.report_id || r.id;
        opt.style.background = '';
        opt.style.color = '';
        const site = r.site_location ? ` [${r.site_location}]` : '';
        const title = r.report_title || r.description || 'Report';
        const titleTrunc = title.length > 70 ? title.substring(0, 67) + '...' : title;
        opt.textContent = `${r.report_id || r.id} — ${titleTrunc}${site}`;
        dropdown.appendChild(opt);
    });
}

function loadReportFromDropdown(reportId) {
    if (!reportId) return;
    const report = masterReports.find(r => (r.report_id || r.id) === reportId);
    if (!report) return;

    const textarea = document.getElementById('classifierTextarea');
    if (textarea) {
        textarea.value = report.description || report.report_title || '';
        runClassification();
    }
}

// ============================================================
// ADD NEW REPORT MODAL & IMAGE ATTACHMENT
// ============================================================
let modalUploadedImageData = null;

function openNewReportModal() {
    const modal = document.getElementById('newReportModalOverlay');
    if (!modal) return;

    const dateInput = document.getElementById('modalReportDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const form = document.getElementById('newReportForm');
    if (form) form.reset();

    removeModalImage();
    modal.style.display = 'flex';
}

function closeNewReportModal() {
    const modal = document.getElementById('newReportModalOverlay');
    if (modal) modal.style.display = 'none';
}

function handleModalImageUpload(event) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image file size must be less than 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        modalUploadedImageData = e.target.result;

        const placeholder = document.getElementById('modalImagePlaceholder');
        const container = document.getElementById('modalImagePreviewContainer');
        const thumb = document.getElementById('modalImageThumb');
        const nameEl = document.getElementById('modalImageName');
        const sizeEl = document.getElementById('modalImageSize');

        if (placeholder) placeholder.style.display = 'none';
        if (container) container.style.display = 'flex';
        if (thumb) thumb.src = e.target.result;
        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
    };
    reader.readAsDataURL(file);
}

function removeModalImage(event) {
    if (event) event.stopPropagation();
    modalUploadedImageData = null;
    const input = document.getElementById('modalReportImageInput');
    if (input) input.value = '';

    const placeholder = document.getElementById('modalImagePlaceholder');
    const container = document.getElementById('modalImagePreviewContainer');
    if (placeholder) placeholder.style.display = 'flex';
    if (container) container.style.display = 'none';
}

async function submitNewReportForm(event) {
    if (event) event.preventDefault();

    const title = document.getElementById('modalReportTitle')?.value.trim();
    const description = document.getElementById('modalReportDesc')?.value.trim();
    const site_location = document.getElementById('modalReportSite')?.value || 'Baghjan Field #5';
    const department = document.getElementById('modalReportDept')?.value || 'Workover & Operations';
    const report_type = document.getElementById('modalReportType')?.value || 'Unsafe Condition';
    const date = document.getElementById('modalReportDate')?.value || new Date().toISOString().split('T')[0];
    const activity_being_performed = document.getElementById('modalReportActivity')?.value.trim() || 'General Operations';
    const immediate_action_taken = document.getElementById('modalReportAction')?.value.trim() || 'Work paused & site secured';

    if (!title || !description) {
        showToast('Please fill in both Report Title and Observation Description.', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitNewReportBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting Report...';
    }

    try {
        const payload = {
            date,
            site_location,
            department,
            report_type,
            report_title: title,
            description,
            activity_being_performed,
            immediate_action_taken,
            image_data: modalUploadedImageData
        };

        const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit report');

        const saved = data.report;
        showToast(`Report ${saved.report_id} successfully added to database!`, 'success');

        closeNewReportModal();

        await fetchReports();
        await fetchAnalytics();
        fetchKnowledgeGraph();

        const searchInput = document.getElementById('explorerSearch');
        if (searchInput) {
            searchInput.value = saved.report_id;
            applyTableFilters();
        }

    } catch (err) {
        console.error('Submit report failed:', err);
        showToast(`Failed to submit report: ${err.message}`, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Submit & Add to Dataset';
        }
    }
}

window.populateClassifierDropdown = populateClassifierDropdown;
window.loadReportFromDropdown = loadReportFromDropdown;
window.openNewReportModal = openNewReportModal;
window.closeNewReportModal = closeNewReportModal;
window.handleModalImageUpload = handleModalImageUpload;
window.removeModalImage = removeModalImage;
window.submitNewReportForm = submitNewReportForm;


// ============================================================
// RBAC ROLE SWITCHING & DASHBOARD TRIAGE SORTING
// ============================================================
window.switchActiveRole = function(role) {
    if (!role) return;
    currentRole = role;
    sessionStorage.setItem('oil_hsse_user_role', role);

    document.querySelectorAll('.role-card-btn').forEach(b => {
        if (b.getAttribute('data-role') === role) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    applyRoleAccess(role);
    showToast(`Role switched to: ${role.replace('_', ' ').toUpperCase()}`, 'info');
};

window.triageFilterDashboard = function(category) {
    document.querySelectorAll('.triage-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    if (category === 'review_queue') {
        switchTab('tab-review-queue');
        return;
    }

    switchTab('tab-explorer');

    const searchInput = document.getElementById('explorerSearch');
    const sifFilterBtn = document.querySelector('[data-filter="sif"]');
    const nonSifFilterBtn = document.querySelector('[data-filter="nonsif"]');
    const allFilterBtn = document.querySelector('[data-filter="all"]');

    if (category === 'all') {
        if (searchInput) searchInput.value = '';
        if (allFilterBtn) allFilterBtn.click();
    } else if (category === 'sif') {
        if (searchInput) searchInput.value = '';
        if (sifFilterBtn) sifFilterBtn.click();
    } else if (category === 'nonsif') {
        if (searchInput) searchInput.value = '';
        if (nonSifFilterBtn) nonSifFilterBtn.click();
    } else if (category === 'line_of_fire') {
        if (searchInput) searchInput.value = 'Line of Fire';
        applyTableFilters();
    } else if (category === 'unsafe_condition') {
        if (searchInput) searchInput.value = 'Unsafe Condition';
        applyTableFilters();
    }
};


// ============================================================
// 30-DAY SITE SIF RISK PROBABILITY FORECAST
// ============================================================
async function fetchPredictiveRisk() {
    try {
        const res = await fetch('/api/predictive-risk');
        const data = await res.json();
        renderPredictiveRisk(data.site_predictions || []);
    } catch (err) {
        console.error('Failed to fetch predictive risk forecast:', err);
    }
}

function renderPredictiveRisk(predictions) {
    const container = document.getElementById('predictiveRiskBody');
    if (!container) return;

    if (!predictions || predictions.length === 0) {
        container.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">Statistical predictive model loading...</td></tr>';
        return;
    }

    container.innerHTML = predictions.map(p => {
        const prob = p.predicted_sif_probability_30d || 0;
        const levelClass = prob >= 75 ? 'badge-red' : (prob >= 50 ? 'badge-amber' : 'badge-green');
        const barColor = prob >= 75 ? '#ef4444' : (prob >= 50 ? '#f59e0b' : '#10b981');
        return `
            <tr>
                <td><strong>${escapeHtml(p.site_location)}</strong></td>
                <td>${p.total_reports} reports (${p.historical_sif} SIF)</td>
                <td style="min-width:140px;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-bottom:3px;">
                        <span>${prob}% Prob</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.08); height:6px; border-radius:3px; overflow:hidden;">
                        <div style="width:${prob}%; height:100%; background:${barColor}; border-radius:3px;"></div>
                    </div>
                </td>
                <td><span class="badge ${levelClass}">${escapeHtml(p.risk_level)}</span></td>
                <td style="font-size:12px; color:var(--text-secondary);">${escapeHtml(p.recommended_audit)}</td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// SINGLE UNIFIED HEADER DROPDOWN & PRINTABLE EXECUTIVE BRIEF
// ============================================================
window.toggleUnifiedHeaderMenu = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('unifiedHeaderMenu');
    if (!menu) return;
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
};

document.addEventListener('click', (e) => {
    const menu = document.getElementById('unifiedHeaderMenu');
    const btn = document.getElementById('unifiedHeaderMenuBtn');
    if (menu && menu.style.display === 'block') {
        if (btn && btn.contains(e.target)) return;
        if (!menu.contains(e.target)) menu.style.display = 'none';
    }
});

window.selectUnifiedRole = function(role) {
    currentRole = role;
    sessionStorage.setItem('oil_hsse_user_role', role);

    const labels = {
        'hse_manager': 'Role: HSE Manager',
        'site_manager': 'Role: Site Manager',
        'supervisor': 'Role: Field Supervisor',
        'analyst': 'Role: Safety Analyst'
    };

    const labelEl = document.getElementById('activeRoleHeaderLabel');
    if (labelEl) labelEl.textContent = labels[role] || 'Role: HSE Manager';

    document.querySelectorAll('.menu-role-opt').forEach(b => {
        if (b.getAttribute('data-role') === role) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    const menu = document.getElementById('unifiedHeaderMenu');
    if (menu) menu.style.display = 'none';

    applyRoleAccess(role);
    showToast(`Role switched to: ${role.replace('_', ' ').toUpperCase()}`, 'info');
};

window.openPrintableBriefModal = async function() {
    const menu = document.getElementById('unifiedHeaderMenu');
    if (menu) menu.style.display = 'none';

    const modal = document.getElementById('printableBriefModalOverlay');
    const content = document.getElementById('printableBriefContent');
    if (modal) modal.style.display = 'flex';

    if (content) content.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:24px;">Fetching latest site activity & executive audit brief...</p>';

    try {
        const res = await fetch('/api/hse-summary');
        const data = await res.json();

        if (content) {
            const m = data.metrics || {};
            const matrix = data.site_vulnerability_matrix || [];
            const directives = data.hierarchy_directives || [];
            const signatories = data.signoff_signatories || [];

            content.innerHTML = `
                <div style="background:rgba(255,107,0,0.06); border:1px solid rgba(255,107,0,0.2); padding:14px; border-radius:8px; margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:var(--amber, #ff6b00); margin-bottom:6px;">
                        <span>${escapeHtml(data.report_ref_id || 'OIL-HSSE-AUDIT-2026')}</span>
                        <span>Date: ${escapeHtml(data.date || '')}</span>
                    </div>
                    <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:6px;">${escapeHtml(data.subtitle || '')}</div>
                    <div style="font-size:12.5px; color:var(--text-secondary); line-height:1.5;">${escapeHtml(data.executive_summary_text || '')}</div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:16px;">
                    <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; text-align:center;">
                        <span style="font-size:10px; color:var(--text-muted); display:block;">Total Observations</span>
                        <strong style="font-size:18px; color:var(--text-primary);">${m.total_reports || 500}</strong>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; text-align:center;">
                        <span style="font-size:10px; color:var(--text-muted); display:block;">SIF Precursors</span>
                        <strong style="font-size:18px; color:var(--red);">${m.sif_reports || 116}</strong>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; text-align:center;">
                        <span style="font-size:10px; color:var(--text-muted); display:block;">Precursor Density</span>
                        <strong style="font-size:18px; color:var(--amber);">${m.sif_rate_pct || 23.2}%</strong>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; text-align:center;">
                        <span style="font-size:10px; color:var(--text-muted); display:block;">Top Risk Site</span>
                        <strong style="font-size:14px; color:var(--text-primary);">${m.top_high_risk_site || 'Makum'}</strong>
                    </div>
                </div>

                <div style="margin-bottom:16px;">
                    <h4 style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:8px;">Mandatory OISD Hierarchy Directives (Action Plan):</h4>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${directives.map(d => `
                            <div style="background:rgba(255,255,255,0.02); border-left:3px solid var(--amber, #ff6b00); padding:8px 12px; font-size:12px;">
                                <strong style="color:var(--amber);">${escapeHtml(d.level)}:</strong> ${escapeHtml(d.directive)}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; margin-top:20px; padding-top:16px; border-top:1px dashed var(--border);">
                    ${signatories.map(s => `
                        <div>
                            <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${escapeHtml(s.name)}</div>
                            <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(s.role)} — ${escapeHtml(s.dept)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

    } catch (err) {
        console.error('Failed to load summary brief:', err);
        if (content) content.innerHTML = `<p style="color:var(--red); text-align:center; padding:20px;">Error loading report: ${escapeHtml(err.message)}</p>`;
    }
};

window.closePrintableBriefModal = function() {
    const modal = document.getElementById('printableBriefModalOverlay');
    if (modal) modal.style.display = 'none';
};

// ============================================================
// DASHBOARD SECTION TAB NAVIGATION
// ============================================================
window.switchDashSection = function(section) {
    const tab = document.getElementById('tab-overview');
    if (!tab) return;

    // All elements with data-dash-section
    const allSections = tab.querySelectorAll('[data-dash-section]');
    allSections.forEach(el => {
        if (section === 'all') {
            el.style.display = '';
        } else {
            el.style.display = el.getAttribute('data-dash-section') === section ? '' : 'none';
        }
    });

    // Update active button
    const tabs = document.querySelectorAll('.dash-stab');
    tabs.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-section') === section);
    });

    const labels = {
        summary: 'KPI Overview',
        risk: 'Site Risk & Forecast',
        barriers: 'Barriers & Patterns',
        trends: 'Trends & Knowledge Graph',
        all: 'All Sections'
    };
    showToast('Dashboard: ' + (labels[section] || section), 'info');
};

// Keep backward compat if anything still calls the old function
window.toggleDashboardViewMode = function(mode) {
    switchDashSection(mode === 'summary' ? 'summary' : 'all');
};
