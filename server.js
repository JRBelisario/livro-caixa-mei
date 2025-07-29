// server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const PDFDocument = require('pdfkit'); // Import PDFKit
const app = express();
const port = 3000;

// --- Configuração do Banco de Dados SQLite ---
const DB_PATH = path.join(__dirname, 'financeiro.db');
let db; // Declare db globally but initialize inside the async function

// Função assíncna para inicializar o banco de dados
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        console.log(`[DB Init] Tentando abrir o banco de dados em: ${DB_PATH}`);
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('[DB Init] Erro FATAL ao abrir o banco de dados:', err.message);
                return reject(err);
            }
            console.log('[DB Init] Conectado ao banco de dados SQLite.');

            db.serialize(() => {
                // Cria a tabela 'transacoes'
                console.log('[DB Init] Verificando/Criando tabela "transacoes"...');
                db.run(`CREATE TABLE IF NOT EXISTS transacoes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data TEXT NOT NULL,          -- Formato YYYY-MM-DD
                    descricao TEXT NOT NULL,
                    categoria TEXT NOT NULL,
                    tipo_pagamento TEXT NOT NULL,
                    valor REAL NOT NULL,
                    tipo_lancamento TEXT NOT NULL -- 'receita' ou 'despesa'
                )`, function(err) {
                    if (err) {
                        console.error('[DB Init] Erro ao criar tabela transacoes:', err.message);
                        return reject(err);
                    }
                    console.log('[DB Init] Tabela "transacoes" verificada/criada com sucesso.');

                    // Cria a tabela 'configuracoes'
                    console.log('[DB Init] Verificando/Criando tabela "configuracoes"...');
                    db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tipo TEXT NOT NULL,          -- 'categoria_entrada', 'categoria_saida', 'tipo_pagamento'
                        nome TEXT NOT NULL UNIQUE
                    )`, function(err) {
                        if (err) {
                            console.error('[DB Init] Erro ao criar tabela configuracoes:', err.message);
                            return reject(err);
                        }
                        console.log('[DB Init] Tabela "configuracoes" verificada/criada com sucesso.');

                        // Inserir algumas configurações padrão se a tabela estiver vazia
                        console.log('[DB Init] Verificando se as configurações padrão precisam ser inseridas...');
                        db.get("SELECT COUNT(*) as count FROM configuracoes", (err, row) => {
                            if (err) {
                                console.error('[DB Init] Erro ao verificar contagem de configurações:', err.message);
                                return reject(err);
                            }
                            if (row.count === 0) {
                                console.log('[DB Init] Inserindo configurações padrão...');
                                const defaultConfigs = [
                                    { tipo: 'categoria_entrada', nome: 'Adiantamento de Processos' },
                                    { tipo: 'categoria_entrada', nome: 'Recustos de Terceiros a Reembolsar' },
                                    { tipo: 'categoria_entrada', nome: 'Honorários de Sucumbencia' },
                                    { tipo: 'categoria_entrada', nome: 'Honorários Contratuais' },
                                    { tipo: 'categoria_entrada', nome: 'Honorários de Consultoria' },
                                    { tipo: 'categoria_entrada', nome: 'Honorários de Assessoria' },
                                    { tipo: 'categoria_entrada', nome: 'Outras Receitas' },
                                    { tipo: 'categoria_saida', nome: 'Salários e Encargos' },
                                    { tipo: 'categoria_saida', nome: 'Aluguel de Escritório' },
                                    { tipo: 'categoria_saida', nome: 'Manutenção de Escritório' },
                                    { tipo: 'categoria_saida', nome: 'Equipamentos e Materiais' },
                                    { tipo: 'categoria_saida', nome: 'Software e Licenças' },
                                    { tipo: 'categoria_saida', nome: 'Consultoria e Assessoria' },
                                    { tipo: 'categoria_saida', nome: 'Honorários de Advogados' },
                                    { tipo: 'categoria_saida', nome: 'Honorários de Contabilidade' },
                                    { tipo: 'categoria_saida', nome: 'Honorários de Marketing' },
                                    { tipo: 'categoria_saida', nome: 'Despesas Administrativas' },
                                    { tipo: 'categoria_saida', nome: 'Despesas de Viagem' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Publicidade' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Eventos' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Treinamento' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Tecnologia' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Escritório' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Telefonia' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Internet' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Energia' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Água' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Segurança' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Limpeza' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Manutenção' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Transporte' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Marketing Digital' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Publicidade Online' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Redes Sociais' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com SEO' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Conteúdo' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com E-mail Marketing' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Publicidade Impressa' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Eventos e Feiras' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Assessoria de Imprensa' },
                                    { tipo: 'categoria_saida', nome: 'Despesas com Relações Públicas' },
                                    { tipo: 'categoria_saida', nome: 'Simples Nacional' },
                                    { tipo: 'categoria_saida', nome: 'Imposto de Renda' },
                                    { tipo: 'categoria_saida', nome: 'INSS Patronal' },
                                    { tipo: 'categoria_saida', nome: 'FGTS' },
                                    { tipo: 'categoria_saida', nome: 'Outros Tributos' },
                                    { tipo: 'categoria_saida', nome: 'Outros Custos' },           
                                    { tipo: 'tipo_pagamento', nome: 'Dinheiro' },
                                    { tipo: 'tipo_pagamento', nome: 'Cartão de Crédito' },
                                    { tipo: 'tipo_pagamento', nome: 'Cartão de Débito' },
                                    { tipo: 'tipo_pagamento', nome: 'Pix' },
                                    { tipo: 'tipo_pagamento', nome: 'Transferência Bancária' },
                                    { tipo: 'tipo_pagamento', nome: 'Cheque' },
                                    { tipo: 'tipo_pagamento', nome: 'Boleto' }
                                ];
                                const stmt = db.prepare("INSERT INTO configuracoes (tipo, nome) VALUES (?, ?)");
                                let insertCount = 0;
                                defaultConfigs.forEach(config => {
                                    stmt.run(config.tipo, config.nome, function(insertErr) {
                                        if (insertErr) {
                                            console.error(`[DB Init] Erro ao inserir configuração "${config.nome}":`, insertErr.message);
                                        } else {
                                            insertCount++;
                                        }
                                    });
                                });
                                stmt.finalize(() => {
                                    console.log(`[DB Init] ${insertCount} configurações padrão inseridas.`);
                                    resolve(); // Resolve a Promise principal após todas as inserções
                                });
                            } else {
                                console.log('[DB Init] Configurações padrão já existem no banco de dados.');
                                resolve(); // Resolve a Promise principal
                            }
                        });
                    });
                });
            });
        });
    });
}

// --- Middleware ---
app.use(express.json()); // Permite que o Express entenda JSON no corpo das requisições

// --- ROTAS DA API ---

// POST para adicionar um novo lançamento
app.post('/api/lancamentos', (req, res) => {
    const { data, descricao, tipoLancamento, categoria, tipoPagamento, valor } = req.body;

    console.log('[API] Dados recebidos para POST /api/lancamentos:', req.body);

    // Validações básicas
    if (!data || !descricao || !tipoLancamento || !categoria || !tipoPagamento || valor === undefined || valor === null) {
        console.error('[API Error] (POST /api/lancamentos): Campos obrigatórios faltando.', req.body);
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    
    const valorNumerico = parseFloat(valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) { // Garante que o valor é um número positivo
        console.error('[API Error] (POST /api/lancamentos): Valor inválido ou não positivo.', valor);
        return res.status(400).json({ success: false, message: 'Valor inválido. Use um número positivo.' });
    }

    const valorFinal = tipoLancamento === 'despesa' ? -Math.abs(valorNumerico) : Math.abs(valorNumerico);
    
    const sql = `INSERT INTO transacoes (data, descricao, categoria, tipo_pagamento, valor, tipo_lancamento) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [data, descricao, categoria, tipoPagamento, valorFinal, tipoLancamento], function(err) {
        if (err) {
            console.error('[API Error] Erro ao adicionar lançamento ao banco de dados:', err.message);
            return res.status(500).json({ success: false, message: `Erro interno ao adicionar lançamento: ${err.message}` });
        }
        console.log(`[API] Lançamento adicionado com sucesso! ID: ${this.lastID}`);
        res.status(201).json({ success: true, message: 'Lançamento adicionado com sucesso!', id: this.lastID });
    });
});

// PUT para atualizar um lançamento existente
app.put('/api/lancamentos/:id', (req, res) => {
    const { id } = req.params;
    const { data, descricao, tipoLancamento, categoria, tipoPagamento, valor } = req.body;

    console.log(`[API] Dados recebidos para PUT /api/lancamentos/${id}:`, req.body);

    if (!data || !descricao || !tipoLancamento || !categoria || !tipoPagamento || valor === undefined || valor === null) {
        console.error(`[API Error] (PUT /api/lancamentos/${id}): Campos obrigatórios faltando.`, req.body);
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios para atualização.' });
    }

    const valorNumerico = parseFloat(valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
        console.error(`[API Error] (PUT /api/lancamentos/${id}): Valor inválido ou não positivo.`, valor);
        return res.status(400).json({ success: false, message: 'Valor inválido. Use um número positivo.' });
    }

    const valorFinal = tipoLancamento === 'despesa' ? -Math.abs(valorNumerico) : Math.abs(valorNumerico);

    const sql = `UPDATE transacoes SET data = ?, descricao = ?, categoria = ?, tipo_pagamento = ?, valor = ?, tipo_lancamento = ? WHERE id = ?`;
    db.run(sql, [data, descricao, categoria, tipoPagamento, valorFinal, tipoLancamento, id], function(err) {
        if (err) {
            console.error(`[API Error] Erro ao atualizar lançamento ${id} no banco de dados:`, err.message);
            return res.status(500).json({ success: false, message: `Erro interno ao atualizar lançamento: ${err.message}` });
        }
        if (this.changes === 0) {
            console.warn(`[API] Lançamento ${id} não encontrado para atualização.`);
            return res.status(404).json({ success: false, message: 'Lançamento não encontrado para atualização.' });
        }
        console.log(`[API] Lançamento ${id} atualizado com sucesso!`);
        res.json({ success: true, message: 'Lançamento atualizado com sucesso!' });
    });
});

// DELETE para excluir um lançamento
app.delete('/api/lancamentos/:id', (req, res) => {
    const { id } = req.params;

    console.log(`[API] Requisição DELETE para /api/lancamentos/${id} recebida.`);

    const sql = `DELETE FROM transacoes WHERE id = ?`;
    db.run(sql, id, function(err) {
        if (err) {
            console.error(`[API Error] Erro ao excluir lançamento ${id} do banco de dados:`, err.message);
            return res.status(500).json({ success: false, message: `Erro interno ao excluir lançamento: ${err.message}` });
        }
        if (this.changes === 0) {
            console.warn(`[API] Lançamento ${id} não encontrado para exclusão.`);
            return res.status(404).json({ success: false, message: 'Lançamento não encontrado para exclusão.' });
        }
        console.log(`[API] Lançamento ${id} excluído com sucesso!`);
        res.json({ success: true, message: 'Lançamento excluído com sucesso!' });
    });
});

// GET para obter todas as configurações (categorias e tipos de pagamento)
app.get('/api/configuracoes', (req, res) => {
    console.log('[API] Requisição GET para /api/configuracoes recebida.');
    const categories = { income: [], expense: [], payments: [] };
    
    let completedQueries = 0;
    const totalQueries = 3;

    const checkComplete = () => {
        completedQueries++;
        if (completedQueries === totalQueries) {
            console.log('[API] Configurações retornadas com sucesso.');
            res.json({ success: true, ...categories });
        }
    };

    db.all("SELECT nome FROM configuracoes WHERE tipo = 'categoria_entrada'", (err, rows) => {
        if (err) {
            console.error('[API Error] Erro ao buscar categorias de entrada:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao carregar categorias de entrada.' });
        }
        categories.income = rows.map(row => row.nome);
        checkComplete();
    });

    db.all("SELECT nome FROM configuracoes WHERE tipo = 'categoria_saida'", (err, rows) => {
        if (err) {
            console.error('[API Error] Erro ao buscar categorias de saída:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao carregar categorias de saída.' });
        }
        categories.expense = rows.map(row => row.nome);
        checkComplete();
    });

    db.all("SELECT nome FROM configuracoes WHERE tipo = 'tipo_pagamento'", (err, rows) => {
        if (err) {
            console.error('[API Error] Erro ao buscar tipos de pagamento:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao carregar tipos de pagamento.' });
        }
        categories.payments = rows.map(row => row.nome);
        checkComplete();
    });
});

// POST para importar extrato (simulado)
app.post('/api/importar-extrato', (req, res) => {
    console.log('[API] Requisição POST para /api/importar-extrato recebida.');
    res.json({ success: true, message: 'Extrato simulado importado! (Lógica real de processamento de arquivo precisa ser implementada no backend)' });
});

// GET para obter o resumo financeiro
app.get('/api/resumo-financeiro', (req, res) => {
    console.log('[API] Requisição GET para /api/resumo-financeiro recebida.');
    let receita = 0;
    let despesa = 0;

    db.all("SELECT valor, tipo_lancamento FROM transacoes", [], (err, rows) => {
        if (err) {
            console.error('[API Error] Erro ao buscar resumo financeiro:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao carregar resumo financeiro.' });
        }

        rows.forEach(row => {
            if (row.tipo_lancamento === 'receita') {
                receita += row.valor;
            } else {
                despesa += row.valor;
            }
        });

        console.log('[API] Resumo financeiro calculado:', { receita, despesa });
        res.json({
            success: true,
            totalReceita: receita.toFixed(2),
            totalDespesa: Math.abs(despesa).toFixed(2), // Sempre positivo
            saldoAtual: (receita + despesa).toFixed(2)
        });
    });
});

// GET para obter dados para o gráfico
app.get('/api/dados-grafico', (req, res) => {
    console.log('[API] Requisição GET para /api/dados-grafico recebida.');
    db.all("SELECT data, descricao, categoria, tipo_pagamento, valor, tipo_lancamento FROM transacoes ORDER BY data ASC", [], (err, rows) => {
        if (err) {
            console.error('[API Error] Erro ao buscar dados para gráfico:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao carregar dados para gráfico.' });
        }
        console.log(`[API] Dados para gráfico encontrados: ${rows.length} registros.`);
        res.json(rows); 
    });
});

// GET para obter todos os lançamentos
app.get('/api/lancamentos', (req, res) => {
    console.log('[API] Requisição GET para /api/lancamentos recebida.');
    db.all("SELECT * FROM transacoes ORDER BY data DESC", [], (err, rows) => {
        if (err) {
            console.error('[API Error] Erro ao buscar lançamentos:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao carregar lançamentos.' });
        }
        console.log(`[API] Lançamentos encontrados: ${rows.length}`);
        res.json({ success: true, data: rows }); 
    });
});

// GET endpoint to generate CSV report
app.get('/api/reports/csv', (req, res) => {
    console.log('[API] Requisição GET para /api/reports/csv recebida.');
    db.all("SELECT data, descricao, categoria, tipo_pagamento, valor, tipo_lancamento FROM transacoes ORDER BY data ASC", [], (err, rows) => {
        if (err) {
            console.error('[API Error] Erro ao gerar relatório CSV:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao gerar relatório CSV.' });
        }

        // CSV Headers
        const headers = ['Data', 'Descrição', 'Categoria', 'Meio de Pagamento', 'Valor', 'Tipo de Lançamento'];
        let csvContent = headers.join(';') + '\n'; // Use semicolon as separator for PT-BR compatibility

        // CSV Rows
        rows.forEach(row => {
            const formattedValue = row.valor.toFixed(2).replace('.', ','); // Format value for PT-BR
            const rowData = [
                row.data,
                `"${row.descricao.replace(/"/g, '""')}"`, // Escape double quotes
                row.categoria,
                row.tipo_pagamento,
                formattedValue,
                row.tipo_lancamento
            ];
            csvContent += rowData.join(';') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="relatorio_financeiro.csv"');
        res.status(200).send(csvContent);
        console.log('[API] Relatório CSV gerado e enviado com sucesso.');
    });
});

// GET endpoint to generate PDF report
app.get('/api/reports/pdf', (req, res) => {
    console.log('[API] Requisição GET para /api/reports/pdf recebida.');
    db.all("SELECT data, descricao, categoria, tipo_pagamento, valor, tipo_lancamento FROM transacoes ORDER BY data ASC", [], (err, rows) => {
        if (err) {
            console.error('[API Error] Erro ao buscar dados para relatório PDF:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao gerar relatório PDF: ' + err.message });
        }

        console.log(`[API PDF] Dados para PDF encontrados: ${rows.length} registros.`);

        const doc = new PDFDocument();
        let filename = 'relatorio_financeiro.pdf';
        filename = encodeURIComponent(filename);
        
        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res); // Pipe the PDF to the response stream
        console.log('[API PDF] PDFDocument inicializado e piped para a resposta.');

        doc.fontSize(20).text('Relatório Financeiro', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`);
        doc.moveDown();

        // Table Headers
        const tableHeaders = ['Data', 'Descrição', 'Cat.', 'Pag.', 'Valor', 'Tipo'];
        const columnWidths = [60, 150, 70, 70, 70, 70]; // Adjusted widths

        let startX = 50;
        let startY = doc.y;
        let rowHeight = 20;

        // Draw headers
        doc.font('Helvetica-Bold');
        tableHeaders.forEach((header, i) => {
            doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, { width: columnWidths[i], align: 'left' });
        });
        doc.moveDown();
        doc.font('Helvetica');
        startY = doc.y; // Update startY for rows

        // Draw rows
        rows.forEach(row => {
            if (doc.y + rowHeight > doc.page.height - 50) { // Check for page break (50 is bottom margin)
                doc.addPage();
                startY = 50; // Reset Y for new page (50 is top margin)
                // Redraw headers on new page
                doc.font('Helvetica-Bold');
                tableHeaders.forEach((header, i) => {
                    doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, { width: columnWidths[i], align: 'left' });
                });
                doc.moveDown();
                doc.font('Helvetica');
                startY = doc.y;
            }

            const formattedValue = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(row.valor);

            const rowData = [
                row.data,
                row.descricao,
                row.categoria,
                row.tipo_pagamento,
                formattedValue,
                row.tipo_lancamento
            ];

            rowData.forEach((cell, i) => {
                doc.text(cell, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, { width: columnWidths[i], align: 'left', continued: false });
            });
            startY += rowHeight; // Move to next row
        });

        doc.end(); // Finalize the PDF
        console.log('[API PDF] Relatório PDF finalizado e enviado.');
    });
});


// --- SERVIR ARQUIVOS ESTÁTICOS ---
// Certifique-se de que seus arquivos HTML, CSS e JS estão dentro de uma pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));


// --- Iniciar o Servidor APENAS APÓS A INICIALIZAÇÃO DO BANCO DE DADOS ---
console.log('[Server Startup] Iniciando processo de inicialização do banco de dados...');
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`\n[Server Startup] Servidor rodando em http://localhost:${port}`);
        console.log(`[Server Startup] Abra seu navegador e acesse http://localhost:${port}\n`);
    });
}).catch(err => {
    console.error('\n[Server Startup] Falha ao iniciar o servidor devido a erro no banco de dados:', err);
    process.exit(1); // Encerra o processo se o DB não puder ser inicializado
});
