/* ==========================================================================
   LOGISTRAX DASHBOARD - INTERACTIVE LOGIC (VANILLA JS - OUTBOUND VERSION)
   ========================================================================== */

// --- STATO DELL'APPLICAZIONE ---
let rawData = [];          // Contiene tutti i record grezzi dall'API
let filteredData = [];     // Contiene i dati dopo l'applicazione dei filtri
let previousKpis = null;   // Memorizza lo stato precedente per identificare allestimenti/spedizioni real-time

// Parametri Tabella (Ordinamento & Impaginazione)
let currentPage = 1;
const itemsPerPage = 10;
let sortColumn = 'colli_chiusi'; // Ordina per colli chiusi di default
let sortDirection = 'desc';

// Riferimenti ai Grafici (Chart.js)
let comparisonChartInstance = null;
let backlogChartInstance = null;
let summaryChartInstance = null;

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', () => {
    // Inizializza Icone Lucide
    lucide.createIcons();
    
    // Avvia orologio in tempo reale
    updateClock();
    setInterval(updateClock, 1000);
    
    // Fetch iniziale dei dati
    fetchDashboardData();
    
    // Configura Timer per Auto-Aggiornamento in tempo reale (ogni 10 secondi)
    setInterval(fetchDashboardData, 10000);
    
    // Associa Event Listeners
    setupEventListeners();

    // Avvia auto-scroll ogni 1 minuto
    startAutoScroll();

    // Carica comunicazioni e avvia ciclo
    fetchComunicazioni();
    setInterval(fetchComunicazioni, 30000);
    startCommCycle();

    // Carica dati vettori
    fetchVettori();

    // Pulsante apertura pannello comunicazioni
    document.getElementById('btn-open-comm').addEventListener('click', openCommPanel);

    // Carica info sito attivo
    loadSiteInfo();

    // Avvia presentazione automatica dopo 8s (dati già caricati)
    setTimeout(startPresentationMode, 8000);
});

// --- GESTIONE EVENTI (LISTENERS) ---
function setupEventListeners() {
    // Pulsante Aggiorna
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            fetchDashboardData(true);
        });
    }
    
    // Eventi di Input sui Filtri
    document.getElementById('filter-search').addEventListener('input', applyFiltersAndRender);
    document.getElementById('filter-backlog').addEventListener('change', applyFiltersAndRender);
    
    // Pulsante Pulisci Filtri
    document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);
    
    // Pulsante Esporta CSV
    document.getElementById('btn-export').addEventListener('click', exportToCSV);
    
    // Gestione click sulle intestazioni per ordinamento
    const headers = document.querySelectorAll('.data-table th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');
            handleSort(column);
        });
    });
    
    // Pulsanti Impaginazione
    document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });
    
    document.getElementById('btn-next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });
}

// --- RECUPERO DATI DALL'API ---
async function fetchDashboardData(manual = false) {
    const refreshIcon = document.getElementById('icon-refresh');
    if (refreshIcon) refreshIcon.classList.add('spinning');
    
    try {
        const response = await fetch('/api/logistica/dati');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const payload = await response.json();
        
        // Aggiorna badge connessione
        updateConnectionStatusBadge(payload.stato, payload.errore);
        
        // Copia i dati precedenti per il confronto
        const oldData = [...rawData];
        rawData = payload.dati_dettaglio || [];
        
        // Rilevamento cambiamenti per singolo cliente in tempo reale
        if (oldData.length > 0) {
            detectRealTimeChangesByClient(oldData, rawData);
        } else if (payload.kpis && manual) {
            showToast("Dati Aggiornati", "Dati allineati in tempo reale con AS/400.", "info");
        }
        
        // Aggiorna KPI numerici
        updateKPICards(payload.kpis);
        
        // Ricalcola i filtri e renderizza tabella e grafici
        applyFiltersAndRender();

        // Aggiorna badge sito (FIX: rimane sincronizzato ad ogni refresh)
        loadSiteInfo();

        // Aggiorna anche i vettori
        fetchVettori();

    } catch (error) {
        console.error("Errore nel recupero dati:", error);
        showToast("Errore di Caricamento", "Impossibile recuperare i dati outbound dall'AS/400.", "warning");
        updateConnectionStatusBadge("simulated", error.message);
    } finally {
        if (refreshIcon) {
            setTimeout(() => {
                refreshIcon.classList.remove('spinning');
            }, 600);
        }
    }
}

// --- CONTROLLO DEI CAMBIAMENTI IN TEMPO REALE PER CLIENTE ---
function detectRealTimeChangesByClient(oldData, newData) {
    const oldMap = new Map();
    oldData.forEach(row => {
        if (row.tkinde) {
            oldMap.set(row.tkinde, row);
        }
    });
    
    newData.forEach(newRow => {
        if (!newRow.tkinde) return;
        
        const oldRow = oldMap.get(newRow.tkinde);
        if (!oldRow) return; // Salta se il cliente non c'era prima
        
        const diffChiusi = (newRow.colli_chiusi || 0) - (oldRow.colli_chiusi || 0);
        const diffOrdiniChiusi = (newRow.nr_order_chiusi || 0) - (oldRow.nr_order_chiusi || 0);
        
        const diffSpediti = (newRow.colli_spedito || 0) - (oldRow.colli_spedito || 0);
        const diffOrdiniSpediti = (newRow.nr_order_spedito || 0) - (oldRow.nr_order_spedito || 0);
        
        const clientName = (newRow.mddesc || newRow.tkinde).trim();
        
        if (diffChiusi > 0) {
            showToast(
                "Nuovo Allestimento!", 
                `<strong>${clientName}</strong>: allestiti +${diffChiusi} colli (+${diffOrdiniChiusi} ordini)`, 
                "success"
            );
        }
        
        if (diffSpediti > 0) {
            showToast(
                "Spedizione Partita!", 
                `<strong>${clientName}</strong>: spediti +${diffSpediti} colli (+${diffOrdiniSpediti} ordini)`, 
                "success"
            );
        }
    });
}

// --- AGGIORNAMENTO UI BADGE STATO ---
function updateConnectionStatusBadge(stato, errore) {
    const badge = document.getElementById('conn-badge');
    if (!badge) return;
    
    badge.className = 'connection-status';
    const label = badge.querySelector('.status-label');
    
    if (stato === 'connected') {
        badge.classList.add('status-live');
        label.textContent = 'Live - AS/400';
        badge.setAttribute('title', 'Connesso direttamente al DB2 su AS/400');
    } else {
        badge.classList.add('status-simulated');
        label.textContent = 'Offline - Simulazione';
        let tooltip = 'Database non raggiungibile. Utilizzo dati simulati.';
        if (errore) {
            tooltip += ` Dettaglio errore: ${errore}`;
        }
        badge.setAttribute('title', tooltip);
    }
}

// --- AGGIORNAMENTO KPI CARDS ---
function updateKPICards(kpis) {
    if (!kpis) return;
    
    animateNumberValue('val-colli-chiusi', kpis.colli_chiusi_tot || 0);
    animateNumberValue('val-colli-spediti', kpis.colli_spediti_tot || 0);
    animateNumberValue('val-ordini-chiusi', kpis.ordini_chiusi_tot || 0);
    animateNumberValue('val-colli-partenza', kpis.colli_partenza_tot || 0);
}

// Effetto contatore animato
function animateNumberValue(id, endValue) {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    const startValue = parseInt(obj.textContent.replace(/\./g, '')) || 0;
    if (startValue === endValue) {
        obj.textContent = endValue.toLocaleString('it-IT');
        return;
    }
    
    const duration = 800;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsedTime = currentTime - startTime;
        if (elapsedTime >= duration) {
            obj.textContent = endValue.toLocaleString('it-IT');
        } else {
            const progress = elapsedTime / duration;
            const easeOutQuad = progress * (2 - progress);
            const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuad);
            obj.textContent = currentValue.toLocaleString('it-IT');
            requestAnimationFrame(updateNumber);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// --- FILTRO DATI E RENDERIZZAZIONE ---
function applyFiltersAndRender() {
    const searchVal = document.getElementById('filter-search').value.toLowerCase().trim();
    const backlogVal = document.getElementById('filter-backlog').value;
    
    filteredData = rawData.filter(row => {
        // Filtro Cerca (Cliente o Codice mandante)
        const matchSearch = !searchVal || 
                            row.mddesc.toLowerCase().includes(searchVal) || 
                            row.tkinde.toLowerCase().includes(searchVal);
                            
        // Filtro Backlog
        let matchBacklog = true;
        if (backlogVal === 'has_backlog') {
            matchBacklog = (row.colli_partenza || 0) > 0;
        } else if (backlogVal === 'no_backlog') {
            matchBacklog = (row.colli_partenza || 0) === 0;
        }
        
        return matchSearch && matchBacklog;
    });
    
    currentPage = 1;
    
    // Ordina e visualizza
    sortFilteredData();
    renderTable();
    renderCharts();
}

// --- AZZERAMENTO FILTRI ---
function clearFilters() {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-backlog').value = '';
    
    applyFiltersAndRender();
    showToast("Filtri Resettati", "Tutti i clienti sono ora visualizzati.", "info");
}

// --- ORDINAMENTO DATI ---
function handleSort(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'desc'; // Ordine decrescente per difetto per quantità numeriche
    }
    
    updateTableSortIcons();
    sortFilteredData();
    renderTable();
}

function sortFilteredData() {
    filteredData.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        
        if (typeof valA === 'number' && typeof valB === 'number') {
            // Ordinamento numerico
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        } else {
            // Ordinamento stringa
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        }
    });
}

function updateTableSortIcons() {
    const headers = document.querySelectorAll('.data-table th.sortable');
    headers.forEach(header => {
        const col = header.getAttribute('data-column');
        if (col === sortColumn) {
            header.classList.add('sort-active');
            header.innerHTML = `${header.textContent.trim()} <i data-lucide="${sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}"></i>`;
        } else {
            header.classList.remove('sort-active');
            header.innerHTML = `${header.textContent.trim()} <i data-lucide="chevrons-up-down"></i>`;
        }
    });
    lucide.createIcons();
}

// --- HELPER: BADGE PILL PER BACKLOG ---
function backlogBadge(val) {
    let level;
    if (val === 0)       level = 'level-zero';
    else if (val <= 15)  level = 'level-low';
    else                 level = 'level-high';
    return `<span class="backlog-badge ${level}">${val.toLocaleString('it-IT')}</span>`;
}

// --- RENDERING TABELLA DATI ---
function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5 text-muted">
                    <i data-lucide="info" style="width: 24px; height: 24px; margin-bottom: 0.5rem; display: inline-block;"></i>
                    <p>Nessun cliente corrispondente ai filtri impostati.</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        updatePaginationUI();
        return;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);
    
    paginatedData.forEach(row => {
        const tr = document.createElement('tr');

        const backlogColli = row.colli_partenza || 0;
        const backlogOrdini = row.nr_order_partenza || 0;

        if (backlogColli > 15) tr.classList.add('row-backlog-high');

        tr.innerHTML = `
            <td><code>${row.tkinde || 'N/D'}</code></td>
            <td style="font-weight: 600;">${row.mddesc || 'N/D'}</td>
            <td class="numeric text-center" style="font-weight: bold; color: var(--color-primary);">${(row.colli_chiusi || 0).toLocaleString('it-IT')}</td>
            <td class="numeric text-center">${(row.nr_order_chiusi || 0).toLocaleString('it-IT')}</td>
            <td class="numeric text-center" style="font-weight: bold; color: var(--color-success);">${(row.colli_spedito || 0).toLocaleString('it-IT')}</td>
            <td class="numeric text-center">${(row.nr_order_spedito || 0).toLocaleString('it-IT')}</td>
            <td class="numeric text-center">${backlogBadge(backlogColli)}</td>
            <td class="numeric text-center">${backlogBadge(backlogOrdini)}</td>
        `;

        tbody.appendChild(tr);
    });
    
    updatePaginationUI();
}

function updatePaginationUI() {
    const totalRows = filteredData.length;
    const totalPages = Math.ceil(totalRows / itemsPerPage);
    
    const startIndex = totalRows === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(startIndex + itemsPerPage - 1, totalRows);
    
    document.getElementById('val-shown-start').textContent = startIndex;
    document.getElementById('val-shown-end').textContent = endIndex;
    document.getElementById('val-total-rows').textContent = totalRows;
    
    document.getElementById('btn-prev-page').disabled = currentPage === 1;
    document.getElementById('btn-next-page').disabled = currentPage === totalPages || totalPages === 0;
    
    const pageContainer = document.getElementById('page-numbers');
    if (!pageContainer) return;
    
    pageContainer.innerHTML = '';
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
            currentPage = i;
            renderTable();
        });
        pageContainer.appendChild(btn);
    }
}

// --- AGGIORNAMENTO GRAFICI (CHART.JS) ---
function renderCharts() {
    renderComparisonChart();
    renderBacklogChart();
    renderSummaryChart();
}

function renderComparisonChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    
    // Estrae i top 6 clienti per volume allestito (per non affollare il grafico)
    const sortedClients = [...filteredData]
        .sort((a,b) => (b.colli_chiusi || 0) - (a.colli_chiusi || 0))
        .slice(0, 6);
        
    const labels = sortedClients.map(c => {
        let name = c.mddesc || 'N/D';
        return name.length > 15 ? name.substring(0, 13) + '..' : name;
    });
    
    const chiusiData = sortedClients.map(c => c.colli_chiusi || 0);
    const speditiData = sortedClients.map(c => c.colli_spedito || 0);
    
    if (comparisonChartInstance) {
        comparisonChartInstance.data.labels = labels;
        comparisonChartInstance.data.datasets[0].data = chiusiData;
        comparisonChartInstance.data.datasets[1].data = speditiData;
        comparisonChartInstance.update();
    } else {
        comparisonChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Colli Chiusi Oggi',
                        data: chiusiData,
                        backgroundColor: 'rgba(59, 130, 246, 0.75)',
                        borderColor: '#3b82f6',
                        borderWidth: 1.5,
                        borderRadius: 4
                    },
                    {
                        label: 'Colli Spediti Oggi',
                        data: speditiData,
                        backgroundColor: 'rgba(16, 185, 129, 0.75)',
                        borderColor: '#10b981',
                        borderWidth: 1.5,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3b8', font: { family: 'Outfit' } }
                    },
                    tooltip: {
                        titleFont: { family: 'Outfit' },
                        bodyFont: { family: 'Outfit' }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { family: 'Outfit', size: 10 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#64748b', font: { family: 'Outfit' } },
                        title: { display: true, text: 'Numero Colli', color: '#94a3b8', font: { family: 'Outfit' } }
                    }
                }
            }
        });
    }
}

function renderBacklogChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    // Estrae i clienti con backlog in partenza (>0 colli)
    const backlogClients = filteredData
        .filter(c => (c.colli_partenza || 0) > 0)
        .sort((a,b) => (b.colli_partenza || 0) - (a.colli_partenza || 0));
        
    const labels = backlogClients.map(c => c.mddesc || 'N/D');
    const dataVals = backlogClients.map(c => c.colli_partenza || 0);
    
    const palette = [
        '#ec4899', // Rosa
        '#f59e0b', // Arancione
        '#8b5cf6', // Viola
        '#3b82f6', // Blu
        '#10b981', // Verde
        '#06b6d4', // Azzurro
        '#64748b'  // Grigio
    ];
    
    if (backlogChartInstance) {
        backlogChartInstance.data.labels = labels;
        backlogChartInstance.data.datasets[0].data = dataVals;
        backlogChartInstance.data.datasets[0].backgroundColor = palette.slice(0, labels.length);
        backlogChartInstance.update();
    } else {
        backlogChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataVals,
                    backgroundColor: palette.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#0f172a',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#94a3b8',
                            boxWidth: 10,
                            padding: 8,
                            font: { family: 'Outfit', size: 10 }
                        }
                    },
                    tooltip: { titleFont: { family: 'Outfit' }, bodyFont: { family: 'Outfit' } }
                },
                cutout: '70%'
            }
        });
    }
}

function renderSummaryChart() {
    const ctx = document.getElementById('priorityChart');
    if (!ctx) return;
    
    // Totale ordini Chiusi, Spediti e Partenza
    let totChiusi = 0;
    let totSpediti = 0;
    let totPartenza = 0;
    
    filteredData.forEach(c => {
        totChiusi += c.nr_order_chiusi || 0;
        totSpediti += c.nr_order_spedito || 0;
        totPartenza += c.nr_order_partenza || 0;
    });
    
    const labels = ['Chiusi (Oggi)', 'Spediti (Oggi)', 'Backlog Partenza'];
    const dataVals = [totChiusi, totSpediti, totPartenza];
    
    if (summaryChartInstance) {
        summaryChartInstance.data.datasets[0].data = dataVals;
        summaryChartInstance.update();
    } else {
        summaryChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: dataVals,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.75)',  // Blu
                        'rgba(16, 185, 129, 0.75)',  // Verde
                        'rgba(236, 72, 153, 0.75)'   // Rosa
                    ],
                    borderColor: [
                        '#3b82f6',
                        '#10b981',
                        '#ec4899'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', // Rende la barra orizzontale
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { titleFont: { family: 'Outfit' }, bodyFont: { family: 'Outfit' } }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#64748b', font: { family: 'Outfit' } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { family: 'Outfit', size: 11 } }
                    }
                }
            }
        });
    }
}

// --- UTILITY ESPORTAZIONE CSV ---
function exportToCSV() {
    if (filteredData.length === 0) {
        showToast("Esportazione Annullata", "Nessun dato presente da esportare.", "warning");
        return;
    }
    
    const headers = [
        "Cod. Mandante", "Cliente", "Colli Chiusi", "Ordini Chiusi", 
        "Colli Spediti", "Ordini Spediti", "Colli in Partenza", "Ordini in Partenza"
    ];
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += headers.join(";") + "\n";
    
    filteredData.forEach(row => {
        const line = [
            `"${row.tkinde}"`,
            `"${row.mddesc.replace(/"/g, '""')}"`,
            row.colli_chiusi,
            row.nr_order_chiusi,
            row.colli_spedito,
            row.nr_order_spedito,
            row.colli_partenza,
            row.nr_order_partenza
        ];
        csvContent += line.join(";") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const timestamp = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `outbound_speditioni_${timestamp}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Esportazione Completata", `Esportati ${filteredData.length} clienti in formato CSV.`, "success");
}

// --- NOTIFICHE FLOTTANTI (TOASTS) ---
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    else if (type === 'warning') iconName = 'alert-triangle';
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <div class="toast-info">
            <span class="toast-title">${title}</span>
            <span class="toast-desc">${message}</span>
        </div>
    `;
    
    container.appendChild(toast);
    playSound('toast');
    lucide.createIcons();
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 50);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            container.removeChild(toast);
        }, 400);
    }, 4500);
}

// ==========================================================================
//  GESTIONE SITI
// ==========================================================================
async function loadSiteInfo() {
    try {
        const res  = await fetch('/api/sites');
        const data = await res.json();

        // Aggiorna badge
        const badge = document.getElementById('site-badge');
        const dot   = document.getElementById('site-dot');
        const name  = document.getElementById('site-name');

        name.textContent       = data.active_name;
        dot.style.background   = data.active_color;
        dot.style.boxShadow    = `0 0 8px ${data.active_color}`;
        badge.style.borderColor = data.active_color + '66';
        badge.style.background  = data.active_color + '1a';

        // Popola dropdown
        const dropdown = document.getElementById('site-dropdown');
        dropdown.innerHTML = data.sites.map(s => `
            <div class="site-dropdown-item ${s.key === data.active ? 'active' : ''}"
                 onclick="switchSite('${s.key}')">
                <span class="site-dropdown-dot" style="background:${s.color};box-shadow:0 0 6px ${s.color}"></span>
                <span>${s.name}</span>
                ${s.key === data.active ? '<i data-lucide="check" class="site-dropdown-check"></i>' : ''}
            </div>
        `).join('');
        lucide.createIcons();
    } catch(e) { console.warn('Siti non disponibili', e); }
}

function toggleSiteMenu() {
    const dropdown = document.getElementById('site-dropdown');
    const badge    = document.getElementById('site-badge');
    const open     = dropdown.style.display === 'block';
    dropdown.style.display = open ? 'none' : 'block';
    badge.classList.toggle('open', !open);
}

async function switchSite(key) {
    document.getElementById('site-dropdown').style.display = 'none';
    document.getElementById('site-badge').classList.remove('open');
    try {
        await fetch(`/api/sites/switch/${key}`, { method: 'POST' });
        await loadSiteInfo();
        fetchDashboardData(true);
        showToast('Sito Cambiato', `Connesso a: ${key.toUpperCase()}`, 'success');
    } catch(e) {
        showToast('Errore', 'Impossibile cambiare sito.', 'warning');
    }
}

// Chiudi dropdown cliccando fuori
document.addEventListener('click', e => {
    const sw = document.getElementById('site-switcher');
    if (sw && !sw.contains(e.target)) {
        document.getElementById('site-dropdown').style.display = 'none';
        document.getElementById('site-badge').classList.remove('open');
    }
});

// --- HELPER SLEEP ---
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ==========================================================================
//  MODALITÀ PRESENTAZIONE AUTOMATICA
// ==========================================================================
let presentationActive = false;

// Cicla le pagine della tabella (5s per pagina) poi torna su
async function runScrollCycle() {
    const tableSection = document.querySelector('.data-section');
    if (!tableSection || filteredData.length === 0) return;

    const targetY     = tableSection.getBoundingClientRect().top + window.scrollY - 16;
    const timePerPage = 10000; // 10s per pagina
    const totalPages  = Math.ceil(filteredData.length / itemsPerPage);

    window.scrollTo({ top: targetY, behavior: 'smooth' });

    for (let p = 1; p <= totalPages; p++) {
        if (p > 1) {
            currentPage = p;
            renderTable();
            window.scrollTo({ top: targetY, behavior: 'smooth' });
        }
        await sleep(timePerPage);
    }

    currentPage = 1;
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Mostra schermata animata di cambio sito
async function showSiteTransition(siteInfo) {
    const overlay = document.getElementById('site-transition');
    const nameEl  = document.getElementById('st-name');
    const dotEl   = document.getElementById('st-dot');

    nameEl.textContent      = siteInfo.name;
    dotEl.style.background  = siteInfo.color;
    dotEl.style.boxShadow   = `0 0 24px ${siteInfo.color}`;

    overlay.style.display   = 'flex';
    overlay.style.animation = 'commFsIn 0.4s cubic-bezier(0.16,1,0.3,1)';
    playSound('comm');

    await sleep(2800);
}

function hideSiteTransition() {
    const overlay = document.getElementById('site-transition');
    overlay.style.animation = 'commFsOut 0.35s ease forwards';
    setTimeout(() => {
        overlay.style.display   = 'none';
        overlay.style.animation = '';
    }, 350);
}

// Helper: controlla se il pannello comunicazioni è aperto
function isCommPanelOpen() {
    return document.getElementById('comm-panel').classList.contains('open');
}

// Loop presentazione: Liscate → Calvenzano → Liscate → …
async function startPresentationMode() {
    if (presentationActive) return;
    presentationActive = true;

    try {
        const res  = await fetch('/api/sites');
        const data = await res.json();
        const sitesList = data.sites;

        if (sitesList.length < 2) {
            setInterval(runScrollCycle, 60000);
            return;
        }

        let idx = sitesList.findIndex(s => s.key === data.active);

        while (presentationActive) {
            // 1. Pausa iniziale (12s) — aumentata per dare più tempo di lettura
            await sleep(12000);

            // 2. Se il pannello è aperto, aspetta e riprova senza cambiare sito
            if (isCommPanelOpen()) {
                await sleep(15000);
                continue;
            }

            // 3. Cicla pagine del sito corrente
            await runScrollCycle();

            // 4. Pausa in cima prima del cambio
            await sleep(3000);

            // 5. Controlla di nuovo prima della transizione
            if (isCommPanelOpen()) {
                continue;
            }

            // 6. Passa al sito successivo
            idx = (idx + 1) % sitesList.length;
            const nextSite = sitesList[idx];

            // 7. Mostra schermata di transizione
            await showSiteTransition(nextSite);

            // 8. Cambia sito e ricarica dati
            await fetch(`/api/sites/switch/${nextSite.key}`, { method: 'POST' });
            await loadSiteInfo();
            await fetchDashboardData();
            await fetchVettori();

            // 9. Nascondi transizione e torna in cima
            hideSiteTransition();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } catch(e) {
        console.error('Errore presentazione:', e);
        presentationActive = false;
    }
}

// Compatibilità vecchio nome (non più usato come interval)
function startAutoScroll() {
    // Presentazione gestita da startPresentationMode()
}

// ==========================================================================
//  SISTEMA COMUNICAZIONI
// ==========================================================================

let selectedPriority = 'info';

// Apri pannello
function openCommPanel() {
    document.getElementById('comm-panel').classList.add('open');
    document.getElementById('comm-overlay').classList.add('active');
    loadCommList();
    lucide.createIcons();
}

// Chiudi pannello
function closeCommPanel() {
    document.getElementById('comm-panel').classList.remove('open');
    document.getElementById('comm-overlay').classList.remove('active');
}

// Cambia tab
function switchCommTab(tab) {
    document.querySelectorAll('.comm-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.comm-tab-content').forEach(c => c.style.display = 'none');

    if (tab === 'new') {
        document.querySelectorAll('.comm-tab')[0].classList.add('active');
        document.getElementById('comm-tab-new').style.display = 'flex';
    } else {
        document.querySelectorAll('.comm-tab')[1].classList.add('active');
        document.getElementById('comm-tab-list').style.display = 'flex';
        loadCommList();
    }
}

// Seleziona priorità
function selectPriority(btn) {
    document.querySelectorAll('.pri-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedPriority = btn.getAttribute('data-priority');
}

// Anteprima immagine
function previewImage(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('comm-image-preview').src = e.target.result;
        document.getElementById('comm-image-preview-wrap').style.display = 'block';
        document.getElementById('image-drop-zone').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Rimuovi immagine
function removeImage() {
    document.getElementById('comm-image').value = '';
    document.getElementById('comm-image-preview-wrap').style.display = 'none';
    document.getElementById('image-drop-zone').style.display = 'flex';
}

// Pubblica comunicazione
async function publishComm() {
    const title   = document.getElementById('comm-title').value.trim();
    const message = document.getElementById('comm-message').value.trim();
    const name    = document.getElementById('comm-name').value.trim();
    const role    = document.getElementById('comm-role').value.trim();
    const expiry  = document.getElementById('comm-expiry').value;
    const imageFile = document.getElementById('comm-image').files[0];

    if (!title || !message || !name) {
        showToast('Campi mancanti', 'Compila Titolo, Messaggio e Nome prima di pubblicare.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-publish-comm');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader"></i> Pubblicazione...';
    lucide.createIcons();

    const formData = new FormData();
    formData.append('title', title);
    formData.append('message', message);
    formData.append('name', name);
    formData.append('role', role);
    formData.append('priority', selectedPriority);
    formData.append('expiry', expiry);
    if (imageFile) formData.append('image', imageFile);

    try {
        const res = await fetch('/api/comunicazioni', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Errore server');

        // Reset form
        document.getElementById('comm-title').value = '';
        document.getElementById('comm-message').value = '';
        document.getElementById('comm-expiry').value = '';
        removeImage();

        showToast('Comunicazione Pubblicata!', `"${title}" è ora visibile a tutti.`, 'success');
        await fetchComunicazioni();
        closeCommPanel();
        // Mostra subito full-screen la comunicazione appena pubblicata
        if (activeComms.length > 0) setTimeout(() => showFullscreenComm(activeComms[0]), 400);
        switchCommTab('list');

    } catch (e) {
        showToast('Errore', 'Impossibile pubblicare la comunicazione.', 'warning');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send"></i> Pubblica Comunicazione';
        lucide.createIcons();
    }
}

// Elimina comunicazione
async function deleteComm(id) {
    await fetch(`/api/comunicazioni/${id}`, { method: 'DELETE' });
    fetchComunicazioni();
    loadCommList();
    showToast('Eliminata', 'Comunicazione rimossa.', 'info');
}

// Carica lista nel pannello
async function loadCommList() {
    const container = document.getElementById('comm-list-container');
    try {
        const res  = await fetch('/api/comunicazioni');
        const list = await res.json();

        if (list.length === 0) {
            container.innerHTML = '<p class="comm-empty">Nessuna comunicazione attiva.</p>';
            return;
        }

        container.innerHTML = list.map(c => `
            <div class="comm-list-item pri-${c.priority}" style="margin-bottom:0.75rem">
                <div class="comm-list-item-header">
                    <span class="comm-list-title">${c.title}</span>
                    <button class="comm-list-delete" onclick="deleteComm(${c.id})" title="Elimina">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                <p class="comm-list-msg">${c.message}</p>
                <div class="comm-list-footer">
                    <span class="comm-list-sig"><i data-lucide="user" style="width:11px;height:11px"></i> ${c.name}${c.role ? ' — ' + c.role : ''}</span>
                    <span>${c.created_at}</span>
                </div>
            </div>
        `).join('');

        const badge = document.getElementById('comm-tab-count');
        if (badge) badge.textContent = list.length;

        lucide.createIcons();
    } catch (e) {
        container.innerHTML = '<p class="comm-empty">Errore caricamento comunicazioni.</p>';
    }
}

// ==========================================================================
//  SUONI NOTIFICA (Web Audio API — nessun file esterno)
// ==========================================================================
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playSound(type = 'toast') {
    try {
        const ctx = getAudioCtx();
        const notes = type === 'comm'
            ? [523.25, 659.25, 783.99, 1046.5]  // C5 E5 G5 C6 — accordo trionfale
            : [440, 523.25];                      // A4 C5 — tocco leggero toast

        notes.forEach((freq, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.18;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(type === 'comm' ? 0.25 : 0.12, t + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
            osc.start(t);
            osc.stop(t + 0.6);
        });
    } catch (e) { /* audio non disponibile */ }
}

// ==========================================================================
//  SCHERMATA FULL-SCREEN COMUNICAZIONE
// ==========================================================================
let fsTimer       = null;
let fsCountdown   = 30;
let activeComms   = [];
let lastCommIds   = new Set();
let fsCycleTimer  = null;

const iconMap = { info: 'info', warning: 'alert-triangle', urgent: 'alert-octagon' };
const labelMap = { info: '📋 INFORMAZIONE', warning: '⚠️ AVVISO', urgent: '🚨 URGENTE' };

function showFullscreenComm(comm) {
    const fs = document.getElementById('comm-fullscreen');

    // Popola contenuto
    document.getElementById('comm-fs-title').textContent   = comm.title;
    document.getElementById('comm-fs-message').textContent = comm.message;
    document.getElementById('comm-fs-name').textContent    = comm.name;
    document.getElementById('comm-fs-role').textContent    = comm.role || '';
    document.getElementById('comm-fs-date').textContent    = comm.created_at;
    document.getElementById('comm-fs-label').textContent   = labelMap[comm.priority] || '📢 COMUNICAZIONE';

    const initials = comm.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('comm-fs-avatar').textContent = initials;

    // Icona priorità
    const iconEl = document.getElementById('comm-fs-icon');
    iconEl.innerHTML = `<i data-lucide="${iconMap[comm.priority] || 'info'}"></i>`;

    // Barra priorità
    const bar = document.getElementById('comm-fs-priority-bar');
    bar.className = `comm-fs-priority-bar pri-${comm.priority}`;

    // Immagine
    const img = document.getElementById('comm-fs-image');
    if (comm.image) { img.src = comm.image; img.style.display = 'block'; }
    else            { img.style.display = 'none'; }

    // Mostra
    fs.style.display = 'flex';
    lucide.createIcons();
    playSound('comm');

    // Countdown 30s
    fsCountdown = 30;
    document.getElementById('comm-fs-countdown').textContent = fsCountdown;
    document.getElementById('comm-fs-progress').style.width  = '100%';

    clearInterval(fsTimer);
    fsTimer = setInterval(() => {
        fsCountdown--;
        document.getElementById('comm-fs-countdown').textContent = fsCountdown;
        const pct = (fsCountdown / 30) * 100;
        document.getElementById('comm-fs-progress').style.width = pct + '%';
        if (fsCountdown <= 0) closeFullscreenComm();
    }, 1000);
}

function closeFullscreenComm() {
    clearInterval(fsTimer);
    const fs = document.getElementById('comm-fullscreen');
    fs.style.animation = 'commFsOut 0.35s ease forwards';
    setTimeout(() => {
        fs.style.display    = 'none';
        fs.style.animation  = '';
    }, 350);
}

// Ciclo automatico comunicazioni (ogni 3 minuti)
function startCommCycle() {
    clearInterval(fsCycleTimer);
    fsCycleTimer = setInterval(() => {
        // FIX: non mostrare fullscreen se l'utente sta usando il pannello
        const panelOpen = document.getElementById('comm-panel').classList.contains('open');
        if (activeComms.length > 0 && !panelOpen) {
            showFullscreenComm(activeComms[0]);
        }
    }, 3 * 60 * 1000);
}

// Recupera comunicazioni e aggiorna badge
async function fetchComunicazioni() {
    try {
        const res  = await fetch('/api/comunicazioni');
        const list = await res.json();
        activeComms = list;

        const badge = document.getElementById('comm-count-badge');
        if (list.length === 0) {
            badge.style.display = 'none';
            return;
        }
        badge.textContent   = list.length;
        badge.style.display = 'flex';

        // Controlla se ci sono comunicazioni nuove
        // FIX: non interrompere l'utente se sta compilando il pannello
        const panelOpen = document.getElementById('comm-panel').classList.contains('open');
        const newIds = list.filter(c => !lastCommIds.has(c.id));
        if (!panelOpen && newIds.length > 0 && lastCommIds.size > 0) {
            // Nuova comunicazione arrivata — mostra subito full-screen
            showFullscreenComm(newIds[0]);
        } else if (!panelOpen && lastCommIds.size === 0 && list.length > 0) {
            // Prima volta che carichiamo con comunicazioni — mostra dopo 3s
            setTimeout(() => {
                if (!document.getElementById('comm-panel').classList.contains('open')) {
                    showFullscreenComm(list[0]);
                }
            }, 3000);
        }

        lastCommIds = new Set(list.map(c => c.id));

    } catch (e) {
        console.warn('Comunicazioni non disponibili:', e);
    }
}

// ==========================================================================
//  SEZIONE VETTORI
// ==========================================================================

async function fetchVettori() {
    try {
        const res  = await fetch('/api/logistica/vettori');
        const data = await res.json();
        renderVettori(data.dati || []);
        // badge connessione vettori
        const badge = document.getElementById('vettori-conn-badge');
        if (badge) {
            badge.textContent = data.stato === 'connected' ? '🟢 Live AS/400' : '🟡 Simulazione';
        }
    } catch (e) {
        console.warn('Vettori non disponibili:', e);
    }
}

function renderVettori(dati) {
    const tbody = document.getElementById('vettori-body');
    if (!tbody) return;

    if (!dati || dati.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i data-lucide="truck" style="width:24px;height:24px;margin-bottom:0.5rem;display:inline-block;"></i>
                    <p>Nessuna spedizione registrata oggi per vettore.</p>
                </td>
            </tr>`;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = dati.map((r, idx) => `
        <tr>
            <td><span class="vettore-code">${r.cod_vettore || '—'}</span></td>
            <td class="vettore-name">${r.vettore || 'N/D'}</td>
            <td class="numeric text-center" style="font-weight:bold;color:var(--color-success);">${(r.colli_spedito || 0).toLocaleString('it-IT')}</td>
            <td class="numeric text-center">${(r.pezzi_spedito || 0).toLocaleString('it-IT')}</td>
            <td class="numeric text-center">${(r.nr_order_spedito || 0).toLocaleString('it-IT')}</td>
            <td class="numeric text-center"><span class="bancali-badge">📦 ${r.bancali || 0}</span></td>
            <td class="numeric text-center"><span class="camion-badge">🚛 ${r.camion || 0}</span></td>
        </tr>
    `).join('');

    lucide.createIcons();
}

// --- OROLOGIO ---
function updateClock() {
    const timeSpan = document.getElementById('current-time');
    if (!timeSpan) return;
    
    const now = new Date();
    const options = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    };
    timeSpan.textContent = now.toLocaleDateString('it-IT', options);
}
