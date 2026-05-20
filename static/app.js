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

    // Avvia auto-scroll ogni 2 minuti
    startAutoScroll();
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

// --- AUTO-SCROLL OGNI 2 MINUTI ---
function startAutoScroll() {
    setInterval(() => {
        // Scrolla fino all'intestazione della tabella
        const tableSection = document.querySelector('.data-section');
        if (tableSection) {
            const targetY = tableSection.getBoundingClientRect().top + window.scrollY - 16;
            window.scrollTo({ top: targetY, behavior: 'smooth' });
        }

        // Dopo 10 secondi torna in cima
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 10000);
    }, 60000); // ogni 1 minuto
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
