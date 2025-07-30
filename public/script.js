// script.js (Updated for Multi-Page Navigation and Authentication Frontend)

// DOM Elements (conditionally selected based on page)
let lancamentoForm, dataInput, descricaoInput, tipoLancamentoSelect, categoriaSelect, tipoPagamentoSelect, valorInput;
let statusMessage; // Used on transactions, login, register pages
let totalReceitaSpan, totalDespesaSpan, saldoAtualSpan;
let transactionsTableWrapper, noTransactionsMessage;
let ctx, lancamentosChart;
let generateCsvButton, generatePdfButton, reportStatusMessage;

// Auth Page elements
let loginForm, registerForm;
let emailInput, passwordInput, confirmPasswordInput;

// Global variables to store dynamic options fetched from backend
let categoriasBackend = { receita: [], despesa: [] };
let tiposPagamentoBackend = [];

// --- Utility Functions ---
function showStatusMessage(message, type, targetElementId = 'statusMessage') {
    const targetElement = document.getElementById(targetElementId);
    if (targetElement) {
        targetElement.textContent = message;
        targetElement.className = `message ${type}`;
        targetElement.style.display = 'block';
        setTimeout(() => {
            targetElement.style.display = 'none';
        }, 3000); // Hide after 3 seconds
    } else {
        console.warn(`Element with ID '${targetElementId}' not found on this page.`);
    }
}

// Function to fetch configurations (categories and payment types) from the backend
async function fetchConfigurations() {
    try {
        const response = await fetch('/api/configuracoes');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success) {
            categoriasBackend.receita = data.income.map(name => ({ value: name, label: name }));
            categoriasBackend.despesa = data.expense.map(name => ({ value: name, label: name }));
            tiposPagamentoBackend = data.payments.map(name => ({ value: name, label: name }));
            
            // Populate selects if they exist on the current page
            if (tipoPagamentoSelect) {
                populateSelect(tipoPagamentoSelect, tiposPagamentoBackend, 'Selecione um meio de pagamento...');
            }
            if (editTipoPagamentoSelect) {
                populateSelect(editTipoPagamentoSelect, tiposPagamentoBackend, 'Selecione um meio de pagamento...');
            }
        } else {
            showStatusMessage("Erro ao carregar configurações: " + data.message, "error");
        }
    } catch (error) {
        console.error("Erro ao buscar configurações:", error);
        // Only show status message if on a page where it's relevant (e.g., transactions page)
        if (window.location.pathname.includes('transactions.html')) {
            showStatusMessage("Erro ao carregar configurações. Verifique o servidor.", "error");
        }
    }
}

// Function to populate select elements dynamically
function populateSelect(selectElement, options, defaultOptionLabel) {
    if (!selectElement) return; // Guard clause if element doesn't exist
    selectElement.innerHTML = `<option value="">${defaultOptionLabel}</option>`;
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        selectElement.appendChild(opt);
    });
    selectElement.disabled = false;
}

// --- Transactions Page Listeners (for transactions.html) ---
function setupTransactionsPageListeners() {
    lancamentoForm = document.getElementById('lancamentoForm');
    dataInput = document.getElementById('data');
    descricaoInput = document.getElementById('descricao');
    tipoLancamentoSelect = document.getElementById('tipoLancamento');
    categoriaSelect = document.getElementById('categoria');
    tipoPagamentoSelect = document.getElementById('tipoPagamento');
    valorInput = document.getElementById('valor');
    statusMessage = document.getElementById('statusMessage'); // Status for form submissions
    transactionsTableWrapper = document.getElementById('transactionsTableWrapper');
    noTransactionsMessage = transactionsTableWrapper ? transactionsTableWrapper.querySelector('.no-transactions-message') : null;

    if (lancamentoForm) {
        lancamentoForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = dataInput.value;
            const descricao = descricaoInput.value.trim();
            const tipoLancamento = tipoLancamentoSelect.value;
            const categoria = categoriaSelect.value;
            const tipoPagamento = tipoPagamentoSelect.value;
            let valor = valorInput.value.replace(',', '.'); // Handle comma as decimal separator for input

            if (!data || !descricao || !tipoLancamento || !categoria || !tipoPagamento || isNaN(parseFloat(valor)) || parseFloat(valor) <= 0) {
                showStatusMessage("Por favor, preencha todos os campos corretamente.", "error");
                return;
            }

            try {
                const response = await fetch('/api/lancamentos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        data,
                        descricao,
                        tipoLancamento,
                        categoria,
                        tipoPagamento,
                        valor: parseFloat(valor) // Ensure value is sent as a number
                    })
                });

                const result = await response.json();
                if (result.success) {
                    showStatusMessage("Lançamento adicionado com sucesso!", "success");
                    lancamentoForm.reset(); // Clear form
                    dataInput.value = ''; // Ensure date input is cleared
                    if (categoriaSelect) {
                        categoriaSelect.innerHTML = '<option value="">Selecione um tipo primeiro...</option>';
                        categoriaSelect.disabled = true;
                    }
                    fetchAndDisplayTransactions(); // Refresh transactions list
                } else {
                    showStatusMessage("Erro ao adicionar lançamento: " + result.message, "error");
                }
            } catch (e) {
                console.error("Erro ao adicionar lançamento:", e);
                showStatusMessage("Erro de comunicação com o servidor. Tente novamente.", "error");
            }
        });

        tipoLancamentoSelect.addEventListener('change', () => {
            const selectedType = tipoLancamentoSelect.value;
            if (selectedType === 'receita') {
                populateSelect(categoriaSelect, categoriasBackend.receita, 'Selecione uma categoria...');
            } else if (selectedType === 'despesa') {
                populateSelect(categoriaSelect, categoriasBackend.despesa, 'Selecione uma categoria...');
            } else {
                categoriaSelect.innerHTML = '<option value="">Selecione um tipo primeiro...</option>';
                categoriaSelect.disabled = true;
            }
        });

        // Set today's date as default for the date input
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dataInput.value = `${yyyy}-${mm}-${dd}`;

        fetchAndDisplayTransactions(); // Initial load of transactions
    }
}

// --- Fetch and Display Transactions (for transactions.html) ---
async function fetchAndDisplayTransactions() {
    if (!transactionsTableWrapper) return;

    try {
        const response = await fetch('/api/lancamentos');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        const lancamentos = result.success ? result.data : [];

        transactionsTableWrapper.innerHTML = ''; // Clear previous content

        if (lancamentos.length === 0) {
            const p = document.createElement('p');
            p.className = 'no-transactions-message';
            p.textContent = 'Nenhum lançamento registrado ainda.';
            transactionsTableWrapper.appendChild(p);
            return;
        }

        // Create table structure
        const table = document.createElement('table');
        table.className = 'transactions-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Pagamento</th>
                    <th>Valor</th>
                    <th>Tipo</th>
                    <th class="transaction-actions-cell">Ações</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;
        const tbody = table.querySelector('tbody');

        lancamentos.forEach(lancamento => {
            const row = document.createElement('tr');
            row.setAttribute('data-id', lancamento.id);

            const valueClass = lancamento.tipo_lancamento === 'receita' ? 'value-income' : 'value-expense';
            const formattedValue = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(lancamento.valor);

            row.innerHTML = `
                <td>${new Date(lancamento.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${lancamento.descricao}</td>
                <td>${lancamento.categoria}</td>
                <td>${lancamento.tipo_pagamento}</td>
                <td class="${valueClass}">${formattedValue}</td>
                <td>${lancamento.tipo_lancamento === 'receita' ? 'Receita' : 'Despesa'}</td>
                <td class="transaction-actions-cell">
                    <div class="transaction-actions">
                        <button class="edit-btn" title="Editar Lançamento">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                            </svg>
                        </button>
                        <button class="delete-btn" title="Excluir Lançamento">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                                <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 0 1 .75.75v2.25c0 .243-.16.46-.385.568A42.603 42.603 0 0 1 12 10.5c-2.842 0-5.455-.221-7.96-.609a.75.75 0 0 1-.385-.568V6a.75.75 0 0 1 .75-.75 48.855 48.855 0 0 1 3.878-.512V4.478c0-1.564 1.213-2.9 2.816-2.953Q12 1.5 12 1.5t-.008.004c1.603.053 2.816 1.389 2.816 2.953Zm-6.161 7.132a.75.75 0 0 1 0 1.06L9.439 14.25l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06-1.06-1.06a.75.75 0 0 1 1.06-1.06l1.06 1.06 1.06-1.06a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        transactionsTableWrapper.appendChild(table);

        // Add event listeners to the new buttons
        tbody.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.closest('tr').getAttribute('data-id'));
                const lancamentoToEdit = lancamentos.find(l => l.id === id);
                if (lancamentoToEdit) {
                    openEditModal(lancamentoToEdit);
                }
            });
        });

        tbody.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.closest('tr').getAttribute('data-id'));
                showConfirmationModal('Tem certeza que deseja excluir este lançamento?', () => deleteLancamento(id));
            });
        });

    } catch (error) {
        console.error("Erro ao buscar transações:", error);
        showStatusMessage("Erro ao carregar transações. Verifique a conexão com o servidor.", "error");
    }
}

// --- Dashboard Page Listeners (for dashboard.html) ---
function setupDashboardPageListeners() {
    totalReceitaSpan = document.getElementById('totalReceita');
    totalDespesaSpan = document.getElementById('totalDespesa');
    saldoAtualSpan = document.getElementById('saldoAtual');
    ctx = document.getElementById('graficoLancamentos') ? document.getElementById('graficoLancamentos').getContext('2d') : null;
    generateCsvButton = document.getElementById('generateCsvReport');
    generatePdfButton = document.getElementById('generatePdfReport');
    reportStatusMessage = document.getElementById('reportStatusMessage');

    if (totalReceitaSpan && ctx) {
        fetchAndDisplayDashboardData();

        if (generateCsvButton) {
            generateCsvButton.addEventListener('click', () => {
                console.log("[Frontend Debug] Botão 'Gerar CSV' clicado.");
                generateReport('/api/reports/csv', 'csv', 'relatorio_financeiro.csv');
            });
        }
        if (generatePdfButton) {
            generatePdfButton.addEventListener('click', () => {
                console.log("[Frontend Debug] Botão 'Gerar PDF' clicado.");
                generateReport('/api/reports/pdf', 'pdf', 'relatorio_financeiro.pdf');
            });
        }
    }
}

async function fetchAndDisplayDashboardData() {
    try {
        const summaryResponse = await fetch('/api/resumo-financeiro');
        if (!summaryResponse.ok) throw new Error(`HTTP error! status: ${summaryResponse.status}`);
        const summaryResult = await summaryResponse.json();
        if (summaryResult.success) {
            updateSummary(summaryResult);
        } else {
            console.error("Erro ao carregar resumo: " + summaryResult.message);
        }

        const chartDataResponse = await fetch('/api/dados-grafico');
        if (!chartDataResponse.ok) throw new Error(`HTTP error! status: ${chartDataResponse.status}`);
        const chartData = await chartDataResponse.json();
        updateChart(chartData);

    } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
    }
}

function updateSummary(summaryData) {
    totalReceitaSpan.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summaryData.totalReceita);
    totalDespesaSpan.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summaryData.totalDespesa);
    saldoAtualSpan.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summaryData.saldoAtual);

    if (parseFloat(summaryData.saldoAtual) >= 0) {
        saldoAtualSpan.style.color = 'var(--success-color)';
    } else {
        saldoAtualSpan.style.color = 'var(--danger-color)';
    }
}

function updateChart(lancamentos) {
    if (!ctx) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentLancamentos = lancamentos.filter(l => {
        const lancamentoDate = new Date(l.data + 'T00:00:00');
        return lancamentoDate >= thirtyDaysAgo;
    });

    const categoryData = {};
    recentLancamentos.forEach(l => {
        const categoryKey = `${l.categoria} (${l.tipo_lancamento === 'receita' ? 'R' : 'D'})`;
        if (!categoryData[categoryKey]) {
            categoryData[categoryKey] = 0;
        }
        categoryData[categoryKey] += l.tipo_lancamento === 'receita' ? l.valor : Math.abs(l.valor); 
    });

    const labels = Object.keys(categoryData);
    const data = Object.values(categoryData);
    const backgroundColors = labels.map(label => {
        if (label.includes('(R)')) return 'rgba(16, 185, 129, 0.6)';
        if (label.includes('(D)')) return 'rgba(239, 68, 68, 0.6)';
        return 'rgba(79, 70, 229, 0.6)';
    });
    const borderColors = labels.map(label => {
        if (label.includes('(R)')) return 'rgba(16, 185, 129, 1)';
        if (label.includes('(D)')) return 'rgba(239, 68, 68, 1)';
        return 'rgba(79, 70, 229, 1)';
    });

    if (lancamentosChart) {
        lancamentosChart.destroy();
    }

    lancamentosChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor (R$)',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Valor (R$)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Categoria'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// --- Report Generation Function ---
async function generateReport(endpoint, fileType, filename) {
    console.log(`[Frontend Debug] Iniciando geração de relatório: ${fileType.toUpperCase()} de ${endpoint}`);
    showStatusMessage(`Gerando relatório ${fileType.toUpperCase()}...`, 'success', 'reportStatusMessage');
    try {
        const response = await fetch(endpoint);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Frontend Debug] Erro na resposta do servidor (${response.status}):`, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showStatusMessage(`Relatório ${fileType.toUpperCase()} gerado e baixado com sucesso!`, 'success', 'reportStatusMessage');
        console.log(`[Frontend Debug] Relatório ${fileType.toUpperCase()} baixado com sucesso.`);
    } catch (error) {
        console.error(`[Frontend Debug] Erro ao gerar relatório ${fileType.toUpperCase()}:`, error);
        showStatusMessage(`Erro ao gerar relatório ${fileType.toUpperCase()}. Verifique o servidor.`, 'error', 'reportStatusMessage');
    }
}


// --- Edit and Delete Functionality (for transactions.html) ---
async function deleteLancamento(id) {
    try {
        const response = await fetch(`/api/lancamentos/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
            showStatusMessage("Lançamento excluído com sucesso!", "success");
            fetchAndDisplayTransactions(); // Refresh transactions list
        } else {
            showStatusMessage("Erro ao excluir lançamento: " + result.message, "error");
        }
    } catch (e) {
        console.error("Erro ao excluir lançamento:", e);
        showStatusMessage("Erro de comunicação com o servidor ao excluir.", "error");
    }
}

// --- Modal for Edit (used on transactions.html) ---
const modalOverlay = document.createElement('div');
modalOverlay.className = 'modal-overlay';
modalOverlay.innerHTML = `
    <div class="modal-content">
        <h3>Editar Lançamento</h3>
        <form id="editLancamentoForm">
            <div class="form-group">
                <label for="editData">Data:</label>
                <input type="date" id="editData" required>
            </div>
            <div class="form-group">
                <label for="editDescricao">Descrição:</label>
                <input type="text" id="editDescricao" required>
            </div>
            <div class="form-group">
                <label for="editTipoLancamento">Tipo:</label>
                <select id="editTipoLancamento" required>
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editCategoria">Categoria:</label>
                <select id="editCategoria" required></select>
            </div>
            <div class="form-group">
                <label for="editTipoPagamento">Meio de Pagamento:</label>
                <select id="editTipoPagamento" required></select>
            </div>
            <div class="form-group">
                <label for="editValor">Valor:</label>
                <input type="text" id="editValor" required>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-cancel" id="cancelEdit">Cancelar</button>
                <button type="submit" class="btn btn-primary">Salvar Alterações</button>
            </div>
        </form>
    </div>
`;
document.body.appendChild(modalOverlay);

const editLancamentoForm = document.getElementById('editLancamentoForm');
const editDataInput = document.getElementById('editData');
const editDescricaoInput = document.getElementById('editDescricao');
const editTipoLancamentoSelect = document.getElementById('editTipoLancamento');
const editCategoriaSelect = document.getElementById('editCategoria');
const editTipoPagamentoSelect = document.getElementById('editTipoPagamento');
const editValorInput = document.getElementById('editValor');
const cancelEditButton = document.getElementById('cancelEdit');

let currentEditId = null;

function openEditModal(lancamento) {
    currentEditId = lancamento.id;
    editDataInput.value = lancamento.data;
    editDescricaoInput.value = lancamento.descricao;
    editTipoLancamentoSelect.value = lancamento.tipo_lancamento;

    const selectedType = lancamento.tipo_lancamento;
    if (selectedType === 'receita') {
        populateSelect(editCategoriaSelect, categoriasBackend.receita, 'Selecione uma categoria...');
    } else if (selectedType === 'despesa') {
        populateSelect(editCategoriaSelect, categoriasBackend.despesa, 'Selecione uma categoria...');
    }
    editCategoriaSelect.value = lancamento.categoria;

    populateSelect(editTipoPagamentoSelect, tiposPagamentoBackend, 'Selecione um meio de pagamento...');
    editTipoPagamentoSelect.value = lancamento.tipo_pagamento;

    editValorInput.value = Math.abs(lancamento.valor).toFixed(2).replace('.', ','); // Format for display

    modalOverlay.classList.add('active');
}

editTipoLancamentoSelect.addEventListener('change', () => {
    const selectedType = editTipoLancamentoSelect.value;
    if (selectedType === 'receita') {
        populateSelect(editCategoriaSelect, categoriasBackend.receita, 'Selecione uma categoria...');
    } else if (selectedType === 'despesa') {
        populateSelect(editCategoriaSelect, categoriasBackend.despesa, 'Selecione uma categoria...');
    } else {
        editCategoriaSelect.innerHTML = '<option value="">Selecione um tipo primeiro...</option>';
        editCategoriaSelect.disabled = true;
    }
});

cancelEditButton.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    currentEditId = null;
});

editLancamentoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentEditId) {
        showStatusMessage("Nenhum lançamento selecionado para edição.", "error");
        return;
    }

    const data = editDataInput.value;
    const descricao = editDescricaoInput.value.trim();
    const tipoLancamento = editTipoLancamentoSelect.value;
    const categoria = editCategoriaSelect.value;
    const tipoPagamento = editTipoPagamentoSelect.value;
    let valor = editValorInput.value.replace(',', '.'); // Handle comma as decimal separator for input

    if (!data || !descricao || !tipoLancamento || !categoria || !tipoPagamento || isNaN(parseFloat(valor)) || parseFloat(valor) <= 0) {
        showStatusMessage("Por favor, preencha todos os campos do formulário de edição corretamente.", "error");
        return;
    }

    try {
        const response = await fetch(`/api/lancamentos/${currentEditId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data,
                descricao,
                tipoLancamento,
                categoria,
                tipoPagamento,
                valor: parseFloat(valor)
            })
        });
        const result = await response.json();
        if (result.success) {
            showStatusMessage("Lançamento atualizado com sucesso!", "success");
            modalOverlay.classList.remove('active');
            currentEditId = null;
            fetchAndDisplayTransactions(); // Refresh transactions list
        } else {
            showStatusMessage("Erro ao atualizar lançamento: " + result.message, "error");
        }
    } catch (e) {
        console.error("Erro ao atualizar lançamento:", e);
        showStatusMessage("Erro de comunicação com o servidor ao atualizar.", "error");
    }
});

// --- Modal for Confirmation ---
const confirmationModalOverlay = document.createElement('div');
confirmationModalOverlay.className = 'modal-overlay';
confirmationModalOverlay.innerHTML = `
    <div class="modal-content">
        <h3 id="confirmationModalTitle">Confirmação</h3>
        <p id="confirmationModalMessage"></p>
        <div class="modal-actions">
            <button type="button" class="btn btn-cancel" id="cancelConfirmation">Cancelar</button>
            <button type="button" class="btn btn-confirm" id="confirmAction">Confirmar</button>
        </div>
    </div>
`;
document.body.appendChild(confirmationModalOverlay);

const confirmationModalTitle = document.getElementById('confirmationModalTitle');
const confirmationModalMessage = document.getElementById('confirmationModalMessage');
const cancelConfirmationButton = document.getElementById('cancelConfirmation');
const confirmActionButton = document.getElementById('confirmAction');

let confirmCallback = null;

function showConfirmationModal(message, callback) {
    confirmationModalMessage.textContent = message;
    confirmCallback = callback;
    confirmationModalOverlay.classList.add('active');
}

cancelConfirmationButton.addEventListener('click', () => {
    confirmationModalOverlay.classList.remove('active');
    confirmCallback = null;
});

confirmActionButton.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    confirmationModalOverlay.classList.remove('active');
    confirmCallback = null;
});


// --- Authentication Page Listeners (for login.html and register.html) ---
function setupAuthPageListeners() {
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    statusMessage = document.getElementById('statusMessage'); // Status for auth forms

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('#email').value.trim();
            const password = loginForm.querySelector('#password').value.trim();

            if (!email || !password) {
                showStatusMessage("Por favor, preencha todos os campos.", "error");
                return;
            }
            // TODO: Implement actual login API call here
            showStatusMessage("Login em desenvolvimento...", "success");
            console.log("Tentativa de Login:", { email, password });
            // Simulate success and redirect
            setTimeout(() => {
                 window.location.href = 'transactions.html'; // Redirect to transactions page
            }, 1000);
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = registerForm.querySelector('#email').value.trim();
            const password = registerForm.querySelector('#password').value.trim();
            const confirmPassword = registerForm.querySelector('#confirmPassword').value.trim();

            if (!email || !password || !confirmPassword) {
                showStatusMessage("Por favor, preencha todos os campos.", "error");
                return;
            }
            if (password !== confirmPassword) {
                showStatusMessage("As senhas não coincidem.", "error");
                return;
            }
            if (password.length < 6) {
                showStatusMessage("A senha deve ter pelo menos 6 caracteres.", "error");
                return;
            }

            // TODO: Implement actual registration API call here
            showStatusMessage("Registro em desenvolvimento...", "success");
            console.log("Tentativa de Registro:", { email, password });
            // Simulate success and redirect
            setTimeout(() => {
                window.location.href = 'login.html'; // Redirect to login page after registration
            }, 1000);
        });
    }
}


// --- Initial Setup on Load ---
window.onload = function() {
    fetchConfigurations(); // Always fetch configurations for all relevant pages

    const currentPage = window.location.pathname;

    if (currentPage.includes('index.html') || currentPage === '/') {
        console.log("[Main] Loading landing page scripts (no specific JS init needed for this page).");
        // No specific JS setup needed for the landing page beyond nav links and general styles
    } else if (currentPage.includes('login.html') || currentPage.includes('register.html')) {
        console.log("[Main] Loading authentication page scripts...");
        setupAuthPageListeners();
    }
    else if (currentPage.includes('transactions.html')) { // Renamed from index.html
        console.log("[Main] Loading transactions page specific scripts...");
        setupTransactionsPageListeners();
    } else if (currentPage.includes('dashboard.html')) {
        console.log("[Main] Loading dashboard.html specific scripts...");
        setupDashboardPageListeners();
    }
};
