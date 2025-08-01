// server.js

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcryptjs'); // Importa bcryptjs
const session = require('express-session'); // Importa express-session
const app = express();
const port = 3000;

// --- Configuração do Banco de Dados PostgreSQL ---
// Para desenvolvimento local, as propriedades são definidas diretamente aqui
const dbConfig = {
    user: 'postgres', // Seu nome de usuário do PostgreSQL (geralmente 'postgres')
    host: 'localhost',
    database: 'financeiro', // O nome do banco de dados que você criou
    password: 'ZinaJR60##', // A sua senha real do PostgreSQL
    port: 5432, // A porta padrão do PostgreSQL
    // ssl: { rejectUnauthorized: false } // Descomente se estiver usando SSL e tiver problemas com certificados
};

const pool = new Pool(dbConfig); // Usando o objeto de configuração

// --- Configuração da Sessão ---
app.use(session({
    secret: 'seu_segredo_muito_secreto', // MUITO IMPORTANTE: Mude para uma string aleatória e complexa em produção
    resave: false, // Não salva a sessão se não houver modificações
    saveUninitialized: false, // Não cria uma sessão para utilizadores não autenticados
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 horas de duração do cookie
        httpOnly: true, // O cookie não pode ser acedido via JavaScript no cliente
        secure: false, // Defina como true em produção (HTTPS)
        sameSite: 'lax' // Proteção CSRF básica
    }
}));

// --- Middleware ---
app.use(express.json()); // Permite que o Express entenda JSON no corpo das requisições

// Middleware para verificar autenticação
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next(); // Utilizador autenticado, continua para a próxima função
    }
    console.log('[Auth] Acesso não autorizado. Redirecionando para login.');
    res.status(401).json({ success: false, message: 'Não autorizado. Por favor, faça login.' });
}

// Função assíncrona para inicializar o banco de dados
async function initializeDatabase() {
    try {
        console.log(`[DB Init] Tentando conectar ao banco de dados PostgreSQL...`);
        const client = await pool.connect(); // Obtém um cliente do pool
        console.log('[DB Init] Conectado ao banco de dados PostgreSQL.');

        // Tabela de utilizadores (agora com password_hash)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[DB Init] Tabela "users" verificada/criada com sucesso.');

        // Tabela de transações (agora com user_id)
        // Adicionei ON DELETE CASCADE para que as transações sejam apagadas se o utilizador for apagado
        await client.query(`
            CREATE TABLE IF NOT EXISTS transacoes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Chave estrangeira para users
                data DATE NOT NULL,
                descricao VARCHAR(255) NOT NULL,
                categoria VARCHAR(255) NOT NULL,
                tipo_pagamento VARCHAR(255) NOT NULL,
                valor REAL NOT NULL,
                tipo_lancamento VARCHAR(50) NOT NULL
            );
        `);
        console.log('[DB Init] Tabela "transacoes" verificada/criada com sucesso.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS configuracoes (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(255) NOT NULL,
                nome VARCHAR(255) UNIQUE NOT NULL
            );
        `);
        console.log('[DB Init] Tabela "configuracoes" verificada/criada com sucesso.');

        // Inserir algumas configurações padrão se a tabela estiver vazia
        const { rows } = await client.query("SELECT COUNT(*) as count FROM configuracoes");
        if (parseInt(rows[0].count) === 0) {
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
            let insertCount = 0;
            for (const config of defaultConfigs) {
                try {
                    await client.query("INSERT INTO configuracoes (tipo, nome) VALUES ($1, $2) ON CONFLICT (nome) DO NOTHING", [config.tipo, config.nome]);
                    insertCount++;
                } catch (insertErr) {
                    console.error(`[DB Init] Erro ao inserir configuração "${config.nome}":`, insertErr.message);
                }
            }
            console.log(`[DB Init] ${insertCount} configurações padrão inseridas (ou ignoradas se já existiam).`);
        } else {
            console.log('[DB Init] Configurações padrão já existem no banco de dados.');
        }
        client.release(); // Libera o cliente de volta para o pool
        console.log('[DB Init] Banco de dados inicializado com sucesso.');
    } catch (err) {
        console.error('[DB Init] Erro FATAL durante a inicialização do banco de dados:', err.message);
        throw err; // Rejeita a Promise para o processo principal
    }
}

// --- ROTAS DE AUTENTICAÇÃO ---

// Rota de Registo de Utilizador
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    console.log('[Auth] Tentativa de registo para:', email);

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
    }

    try {
        // Verificar se o e-mail já existe
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            console.log('[Auth] Registo falhou: E-mail já registado:', email);
            return res.status(409).json({ success: false, message: 'Este e-mail já está registado.' });
        }

        // Criptografar a senha
        const salt = await bcrypt.genSalt(10); // Gerar um salt
        const passwordHash = await bcrypt.hash(password, salt); // Hash da senha

        // Inserir novo utilizador no banco de dados
        const result = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
            [email, passwordHash]
        );
        console.log('[Auth] Utilizador registado com sucesso! ID:', result.rows[0].id);
        res.status(201).json({ success: true, message: 'Utilizador registado com sucesso!' });

    } catch (err) {
        console.error('[Auth Error] Erro no registo de utilizador:', err.message);
        res.status(500).json({ success: false, message: 'Erro interno ao registar utilizador.' });
    }
});

// Rota de Login de Utilizador
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('[Auth] Tentativa de login para:', email);

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
    }

    try {
        // Buscar utilizador pelo e-mail
        const result = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            console.log('[Auth] Login falhou: Utilizador não encontrado:', email);
            return res.status(400).json({ success: false, message: 'Credenciais inválidas.' });
        }

        // Comparar a senha fornecida com a senha criptografada
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            console.log('[Auth] Login falhou: Senha incorreta para:', email);
            return res.status(400).json({ success: false, message: 'Credenciais inválidas.' });
        }

        // Login bem-sucedido: Armazenar userId na sessão
        req.session.userId = user.id;
        console.log('[Auth] Login bem-sucedido! User ID na sessão:', req.session.userId);
        res.json({ success: true, message: 'Login bem-sucedido!' });

    } catch (err) {
        console.error('[Auth Error] Erro no login de utilizador:', err.message);
        res.status(500).json({ success: false, message: 'Erro interno ao fazer login.' });
    }
});

// Rota de Logout de Utilizador
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('[Auth Error] Erro ao destruir sessão durante logout:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao fazer logout.' });
        }
        res.clearCookie('connect.sid'); // Limpa o cookie da sessão
        console.log('[Auth] Logout bem-sucedido.');
        res.json({ success: true, message: 'Logout bem-sucedido!' });
    });
});

// Rota para verificar o status da sessão (útil para o frontend)
app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ isAuthenticated: true, userId: req.session.userId });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// --- ROTAS DA API (PROTEGIDAS E FILTRADAS POR UTILIZADOR) ---

// POST para adicionar um novo lançamento
app.post('/api/lancamentos', isAuthenticated, async (req, res) => {
    const { data, descricao, tipoLancamento, categoria, tipoPagamento, valor } = req.body;
    const userId = req.session.userId; // Obtém o ID do utilizador da sessão

    console.log(`[API] Dados recebidos para POST /api/lancamentos (User ID: ${userId}):`, req.body);

    if (!data || !descricao || !tipoLancamento || !categoria || !tipoPagamento || valor === undefined || valor === null) {
        console.error('[API Error] (POST /api/lancamentos): Campos obrigatórios faltando.', req.body);
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    
    const valorNumerico = parseFloat(valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
        console.error('[API Error] (POST /api/lancamentos): Valor inválido ou não positivo.', valor);
        return res.status(400).json({ success: false, message: 'Valor inválido. Use um número positivo.' });
    }

    const valorFinal = tipoLancamento === 'despesa' ? -Math.abs(valorNumerico) : Math.abs(valorNumerico);
    
    try {
        const result = await pool.query(
            `INSERT INTO transacoes (user_id, data, descricao, categoria, tipo_pagamento, valor, tipo_lancamento) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [userId, data, descricao, categoria, tipoPagamento, valorFinal, tipoLancamento]
        );
        console.log(`[API] Lançamento adicionado com sucesso! ID: ${result.rows[0].id} para User ID: ${userId}`);
        res.status(201).json({ success: true, message: 'Lançamento adicionado com sucesso!', id: result.rows[0].id });
    } catch (err) {
        console.error('[API Error] Erro ao adicionar lançamento ao banco de dados:', err.message);
        res.status(500).json({ success: false, message: `Erro interno ao adicionar lançamento: ${err.message}` });
    }
});

// PUT para atualizar um lançamento existente
app.put('/api/lancamentos/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { data, descricao, tipoLancamento, categoria, tipoPagamento, valor } = req.body;
    const userId = req.session.userId;

    console.log(`[API] Dados recebidos para PUT /api/lancamentos/${id} (User ID: ${userId}):`, req.body);

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

    try {
        const result = await pool.query(
            `UPDATE transacoes SET data = $1, descricao = $2, categoria = $3, tipo_pagamento = $4, valor = $5, tipo_lancamento = $6 WHERE id = $7 AND user_id = $8`,
            [data, descricao, categoria, tipoPagamento, valorFinal, tipoLancamento, id, userId]
        );
        if (result.rowCount === 0) {
            console.warn(`[API] Lançamento ${id} não encontrado ou não pertence ao User ID: ${userId} para atualização.`);
            return res.status(404).json({ success: false, message: 'Lançamento não encontrado ou você não tem permissão para editá-lo.' });
        }
        console.log(`[API] Lançamento ${id} atualizado com sucesso para User ID: ${userId}!`);
        res.json({ success: true, message: 'Lançamento atualizado com sucesso!' });
    } catch (err) {
        console.error(`[API Error] Erro ao atualizar lançamento ${id} no banco de dados:`, err.message);
        res.status(500).json({ success: false, message: `Erro interno ao atualizar lançamento: ${err.message}` });
    }
});

// DELETE para excluir um lançamento
app.delete('/api/lancamentos/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    console.log(`[API] Requisição DELETE para /api/lancamentos/${id} (User ID: ${userId}) recebida.`);

    try {
        const result = await pool.query(`DELETE FROM transacoes WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (result.rowCount === 0) {
            console.warn(`[API] Lançamento ${id} não encontrado ou não pertence ao User ID: ${userId} para exclusão.`);
            return res.status(404).json({ success: false, message: 'Lançamento não encontrado ou você não tem permissão para excluí-lo.' });
        }
        console.log(`[API] Lançamento ${id} excluído com sucesso para User ID: ${userId}!`);
        res.json({ success: true, message: 'Lançamento excluído com sucesso!' });
    } catch (err) {
        console.error(`[API Error] Erro ao excluir lançamento ${id} do banco de dados:`, err.message);
        res.status(500).json({ success: false, message: `Erro interno ao excluir lançamento: ${err.message}` });
    }
});

// GET para obter todas as configurações (categorias e tipos de pagamento)
// Esta rota não precisa de autenticação se for para todos os utilizadores (ex: na página de registo)
// Mas se as configurações forem por utilizador, adicione 'isAuthenticated'
app.get('/api/configuracoes', async (req, res) => { // Removi isAuthenticated para permitir acesso antes do login
    console.log('[API] Requisição GET para /api/configuracoes recebida.');
    const categories = { income: [], expense: [], payments: [] };
    
    try {
        const incomeRows = await pool.query("SELECT nome FROM configuracoes WHERE tipo = 'categoria_entrada'");
        categories.income = incomeRows.rows.map(row => row.nome);

        const expenseRows = await pool.query("SELECT nome FROM configuracoes WHERE tipo = 'categoria_saida'");
        categories.expense = expenseRows.rows.map(row => row.nome);

        const paymentRows = await pool.query("SELECT nome FROM configuracoes WHERE tipo = 'tipo_pagamento'");
        categories.payments = paymentRows.rows.map(row => row.nome);

        console.log('[API] Configurações retornadas com sucesso.');
        res.json({ success: true, ...categories });
    } catch (err) {
        console.error('[API Error] Erro ao buscar configurações:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao carregar configurações.' });
    }
});

// POST para importar extrato (simulado) - PROTEGER
app.post('/api/importar-extrato', isAuthenticated, (req, res) => {
    console.log('[API] Requisição POST para /api/importar-extrato recebida.');
    res.json({ success: true, message: 'Extrato simulado importado! (Lógica real de processamento de arquivo precisa ser implementada no backend)' });
});

// GET para obter o resumo financeiro - PROTEGER E FILTRAR
app.get('/api/resumo-financeiro', isAuthenticated, async (req, res) => {
    console.log('[API] Requisição GET para /api/resumo-financeiro recebida.');
    const userId = req.session.userId;
    
    try {
        const { rows } = await pool.query("SELECT valor, tipo_lancamento FROM transacoes WHERE user_id = $1", [userId]);
        let receita = 0;
        let despesa = 0;

        rows.forEach(row => {
            if (row.tipo_lancamento === 'receita') {
                receita += parseFloat(row.valor);
            } else {
                despesa += parseFloat(row.valor);
            }
        });

        console.log(`[API] Resumo financeiro calculado para User ID: ${userId}:`, { receita, despesa });
        res.json({
            success: true,
            totalReceita: receita.toFixed(2),
            totalDespesa: Math.abs(despesa).toFixed(2),
            saldoAtual: (receita + despesa).toFixed(2)
        });
    } catch (err) {
        console.error('[API Error] Erro ao buscar resumo financeiro:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao carregar resumo financeiro.' });
    }
});

// GET para obter dados para o gráfico - PROTEGER E FILTRAR
app.get('/api/dados-grafico', isAuthenticated, async (req, res) => {
    console.log('[API] Requisição GET para /api/dados-grafico recebida.');
    const userId = req.session.userId;
    try {
        const { rows } = await pool.query("SELECT data, descricao, categoria, tipo_pagamento, valor, tipo_lancamento FROM transacoes WHERE user_id = $1 ORDER BY data ASC", [userId]);
        console.log(`[API] Dados para gráfico encontrados para User ID: ${userId}: ${rows.length} registros.`);
        res.json(rows); 
    } catch (err) {
        console.error('[API Error] Erro ao buscar dados para gráfico:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao carregar dados para gráfico.' });
    }
});

// GET para obter todos os lançamentos - PROTEGER E FILTRAR
app.get('/api/lancamentos', isAuthenticated, async (req, res) => {
    console.log('[API] Requisição GET para /api/lancamentos recebida.');
    const userId = req.session.userId;
    try {
        const { rows } = await pool.query("SELECT * FROM transacoes WHERE user_id = $1 ORDER BY data DESC", [userId]);
        console.log(`[API] Lançamentos encontrados para User ID: ${userId}: ${rows.length}`);
        res.json({ success: true, data: rows }); 
    } catch (err) {
        console.error('[API Error] Erro ao buscar lançamentos:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao carregar lançamentos.' });
    }
});

// GET endpoint to generate CSV report - PROTEGER E FILTRAR
app.get('/api/reports/csv', isAuthenticated, async (req, res) => {
    console.log('[API] Requisição GET para /api/reports/csv recebida.');
    const userId = req.session.userId;
    try {
        const { rows } = await pool.query("SELECT data, descricao, categoria, tipo_pagamento, valor, tipo_lancamento FROM transacoes WHERE user_id = $1 ORDER BY data ASC", [userId]);

        const headers = ['Data', 'Descrição', 'Categoria', 'Meio de Pagamento', 'Valor', 'Tipo de Lançamento'];
        let csvContent = headers.join(';') + '\n';

        rows.forEach(row => {
            const formattedValue = parseFloat(row.valor).toFixed(2).replace('.', ',');
            const rowData = [
                row.data,
                `"${row.descricao.replace(/"/g, '""')}"`,
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
        console.log(`[API] Relatório CSV gerado e enviado com sucesso para User ID: ${userId}.`);
    } catch (err) {
        console.error('[API Error] Erro ao gerar relatório CSV:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao gerar relatório CSV.' });
    }
});

// GET endpoint to generate PDF report - PROTEGER E FILTRAR
app.get('/api/reports/pdf', isAuthenticated, async (req, res) => {
    console.log('[API] Requisição GET para /api/reports/pdf recebida.');
    const userId = req.session.userId;
    try {
        const { rows } = await pool.query("SELECT data, descricao, categoria, tipo_pagamento, valor, tipo_lancamento FROM transacoes WHERE user_id = $1 ORDER BY data ASC", [userId]);

        console.log(`[API PDF] Dados para PDF encontrados para User ID: ${userId}: ${rows.length} registros.`);

        const doc = new PDFDocument();
        let filename = 'relatorio_financeiro.pdf';
        filename = encodeURIComponent(filename);
        
        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);
        console.log('[API PDF] PDFDocument inicializado e piped para a resposta.');

        doc.fontSize(20).text('Relatório Financeiro', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`);
        doc.moveDown();

        const tableHeaders = ['Data', 'Descrição', 'Cat.', 'Pag.', 'Valor', 'Tipo'];
        const columnWidths = [60, 150, 70, 70, 70, 70];

        let startX = 50;
        let startY = doc.y;
        let rowHeight = 20;

        doc.font('Helvetica-Bold');
        tableHeaders.forEach((header, i) => {
            doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, { width: columnWidths[i], align: 'left' });
        });
        doc.moveDown();
        doc.font('Helvetica');
        startY = doc.y;

        rows.forEach(row => {
            if (doc.y + rowHeight > doc.page.height - 50) {
                doc.addPage();
                startY = 50;
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
            startY += rowHeight;
        });

        doc.end();
        console.log(`[API PDF] Relatório PDF finalizado e enviado com sucesso para User ID: ${userId}.`);
    } catch (err) {
        console.error('[API Error] Erro ao gerar relatório PDF:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao gerar relatório PDF.' });
    }
});


// --- SERVIR ARQUIVOS ESTÁTICOS ---
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
    process.exit(1);
});
