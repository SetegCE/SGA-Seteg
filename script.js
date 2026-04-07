// ==================== CONFIGURAÇÃO ====================
const SUPABASE_URL = 'https://melphsmbvknfcfqtnymo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aZDIn8B_gjv-x-IyWL8loQ_2Naml9ce';

let appSupabase = null;
let dadosTabela = [];
let usuarioLogado = false;
let filtroAtual = 'todos';
let formAberto = true;
let carregandoDados = false;

// Variáveis de paginação
let paginaAtual = 1;
let itensPorPagina = 10;
let totalPaginas = 1;

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
        document.getElementById('headerLogo').src = 'images/logo-branco.png';
    });
    
    try {
        if (typeof window.supabase !== 'undefined') {
            appSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            carregarDados();
        }
    } catch (e) {
        console.error('Erro init:', e);
    }
});

// ==================== INTERFACE ====================
function toggleFormulario() {
    const content = document.getElementById('formContent');
    const icon = document.getElementById('toggleIcon');
    const text = document.getElementById('toggleText');
    
    formAberto = !formAberto;
    
    if (formAberto) {
        content.classList.add('expanded');
        icon.style.transform = 'rotate(180deg)';
        text.textContent = 'Recolher Formulário';
    } else {
        content.classList.remove('expanded');
        icon.style.transform = 'rotate(0deg)';
        text.textContent = 'Abrir Formulário';
    }
}

function toggleField(id, show) {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) {
        el.classList.remove('hidden');
        const input = el.querySelector('input, textarea, select');
        if (input) setTimeout(() => input.focus(), 50);
    } else {
        el.classList.add('hidden');
    }
}

function toggleEye() {
    const input = document.getElementById('codigoAcesso');
    const icon = document.getElementById('toggleEye');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function limparFormulario() {
    document.getElementById('requestForm').reset();
    document.querySelectorAll('.conditional').forEach(el => el.classList.add('hidden'));
    document.getElementById('successMessage').classList.add('hidden');
}

// ==================== LOGIN ====================
function abrirModalLogin() {
    document.getElementById('modalLoginOverlay').classList.add('show');
    setTimeout(() => document.getElementById('codigoAcesso').focus(), 50);
}

function fecharModalLogin() {
    document.getElementById('modalLoginOverlay').classList.remove('show');
    document.getElementById('loginErro').classList.add('hidden');
    document.getElementById('codigoAcesso').value = '';
}

async function logar() {
    const btn = document.getElementById('btnLogin');
    const codigo = document.getElementById('codigoAcesso').value.trim();
    const erroMsg = document.getElementById('loginErro');

    if (!codigo) {
        erroMsg.textContent = 'Digite o código.';
        erroMsg.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

    try {
        const promise = appSupabase.rpc('validar_codigo_acesso', { codigo_input: codigo });
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000));
        
        const { data, error } = await Promise.race([promise, timeout]);

        if (error || !data || !data[0]?.valido) {
            erroMsg.textContent = 'Código incorreto.';
            erroMsg.classList.remove('hidden');
            const input = document.getElementById('codigoAcesso');
            input.style.borderColor = 'var(--danger)';
            setTimeout(() => input.style.borderColor = '', 500);
        } else {
            usuarioLogado = true;
            fecharModalLogin();
            atualizarHeader(true);
            mostrarToast('Bem-vindo, Gestor!', 'success');
            await carregarDados();
        }
    } catch (err) {
        console.error(err);
        erroMsg.textContent = 'Erro de conexão.';
        erroMsg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
    }
}

function atualizarHeader(logado) {
    const actions = document.getElementById('headerActions');
    const formSection = document.getElementById('formSection');
    
    if (logado) {
        actions.innerHTML = `
            <span style="color: var(--success); font-size: 0.85rem; margin-right: 10px; display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-shield-alt"></i> <strong>Gestor</strong>
            </span>
            <button class="btn btn-outline btn-sm" onclick="sair()">
                <i class="fas fa-sign-out-alt"></i> Sair
            </button>
        `;
        if (formSection) formSection.style.display = 'none';
    } else {
        actions.innerHTML = `<button class="btn btn-primary" onclick="abrirModalLogin()"><i class="fas fa-lock"></i> Acesso Restrito</button>`;
        if (formSection) formSection.style.display = 'block';
    }
}

function sair() {
    usuarioLogado = false;
    atualizarHeader(false);
    mostrarToast('Logout realizado', 'info');
    dadosTabela = [];
    renderizarTabela();
    atualizarMetricas();
}

// ==================== DADOS ====================
async function carregarDados() {
    if (!appSupabase || carregandoDados) return;
    carregandoDados = true;
    
    try {
        const { data, error } = await appSupabase
            .from('solicitacoes')
            .select('*')
            .order('criado_em', { ascending: false });

        if (error) throw error;

        dadosTabela = data || [];
        
        requestAnimationFrame(() => {
            renderizarTabela();
            atualizarMetricas();
        });
    } catch (e) {
        console.error('Erro ao carregar:', e);
    } finally {
        carregandoDados = false;
    }
}

// ==================== RENDERIZAÇÃO COM PAGINAÇÃO ====================
function renderizarTabela() {
    const tbody = document.getElementById('tableBody');
    const emptyOverlay = document.getElementById('emptyStateOverlay');
    const paginationContainer = document.getElementById('paginationContainer');
    
    if (!tbody) return;
    
    // Filtra os dados
    const filtrados = filtroAtual === 'todos' 
        ? dadosTabela 
        : dadosTabela.filter(r => r.status === filtroAtual);

    console.log('📊 Dados:', dadosTabela.length, '| Filtrados:', filtrados.length, '| Filtro:', filtroAtual);

    // ✅ CASO 1: NÃO TEM DADOS - Mostra overlay, esconde tabela
    if (filtrados.length === 0) {
        console.log('❌ Sem dados - mostrando overlay');
        
        // Esconde tbody e paginação
        tbody.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';
        
        // Mostra overlay COM A CLASSE 'mostrar'
        if (emptyOverlay) {
            emptyOverlay.classList.add('mostrar');
            emptyOverlay.style.display = 'flex';
        }
        
        atualizarPaginacao(0);
        return;
    }

    // ✅ CASO 2: TEM DADOS - Esconde overlay, mostra tabela
    console.log('✅ Tem dados - escondendo overlay e mostrando tabela');
    
    // Esconde overlay SEM a classe 'mostrar'
    if (emptyOverlay) {
        emptyOverlay.classList.remove('mostrar');
        emptyOverlay.style.display = 'none';
    }
    
    // Mostra tbody
    tbody.style.display = 'table-row-group';
    tbody.innerHTML = '';

    // Lógica de Paginação
    totalPaginas = Math.ceil(filtrados.length / itensPorPagina);
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensPagina = filtrados.slice(inicio, fim);

    const fragment = document.createDocumentFragment();
    
    itensPagina.forEach(item => {
        const tr = document.createElement('tr');
        
        let statusText = {
            'na_fila':'Na Fila',
            'em_andamento':'Processando',
            'ajustes':'Aguardando',
            'concluido':'Finalizado'
        }[item.status] || 'Na Fila';

        let formatoHTML = '-';
        if (item.formatos && Array.isArray(item.formatos) && item.formatos.length > 0) {
            const fmts = item.formatos.filter(f => f && f !== 'outros');
            if (fmts.length <= 2) {
                formatoHTML = fmts.map(f => `<span style="display:inline-block;padding:3px 8px;background:rgba(100,116,139,0.2);border-radius:4px;font-size:0.7rem;margin:2px;color:#cbd5e1;">${f}</span>`).join('');
            } else {
                formatoHTML = `<span style="display:inline-block;padding:3px 8px;background:rgba(100,116,139,0.2);border-radius:4px;font-size:0.7rem;color:#cbd5e1;">${fmts.length} canais</span>`;
            }
            if (item.formato_outros) formatoHTML += `<span style="display:inline-block;padding:3px 8px;background:rgba(245,158,11,0.2);border-radius:4px;font-size:0.7rem;margin:2px;color:#fbbf24;">${item.formato_outros}</span>`;
        } else if (item.formatos && typeof item.formatos === 'string') {
            formatoHTML = `<span style="display:inline-block;padding:3px 8px;background:rgba(100,116,139,0.2);border-radius:4px;font-size:0.7rem;color:#cbd5e1;">${item.formatos}</span>`;
        }

        let prazoDisplay = '-';
        if (item.prazo_ideal) {
            prazoDisplay = new Date(item.prazo_ideal).toLocaleDateString('pt-BR');
            if (item.urgente) prazoDisplay = `<span style="color:var(--danger);font-weight:600;"><i class="fas fa-exclamation-circle"></i> ${prazoDisplay}</span>`;
        }

        let statusHTML = '';
        if (usuarioLogado) {
            statusHTML = `<select class="status-select" onchange="mudarStatus('${item.id}', this.value)">
                <option value="na_fila" ${item.status==='na_fila'?'selected':''}>Na Fila</option>
                <option value="em_andamento" ${item.status==='em_andamento'?'selected':''}>Processando</option>
                <option value="ajustes" ${item.status==='ajustes'?'selected':''}>Aguardando</option>
                <option value="concluido" ${item.status==='concluido'?'selected':''}>Finalizado</option>
            </select>`;
        } else {
            statusHTML = `<span class="status-badge status-${item.status || 'na_fila'}">${statusText}</span>`;
        }

        let acoesHTML = `<button class="action-btn" onclick="verDetalhes('${item.id}')" title="Ver"><i class="fas fa-eye"></i></button>`;
        if (usuarioLogado) acoesHTML += `<button class="action-btn delete" onclick="excluirSolicitacao('${item.id}')" title="Excluir"><i class="fas fa-trash"></i></button>`;

        tr.innerHTML = `
            <td><strong style="color:var(--primary);font-family:monospace;">${item.protocolo || item.id}</strong></td>
            <td>${item.solicitante_nome || '-'}</td>
            <td>${item.solicitante_setor || '-'}</td>
            <td>${item.tipo_material_outro || item.tipo_material || '-'}</td>
            <td>${formatoHTML}</td>
            <td>${prazoDisplay}</td>
            <td class="center">${statusHTML}</td>
            <td class="center">${acoesHTML}</td>
        `;
        fragment.appendChild(tr);
    });
    
    tbody.appendChild(fragment);
    
    if (paginationContainer) paginationContainer.style.display = 'flex';
    atualizarPaginacao(filtrados.length);
}
// ==================== FUNÇÕES DE PAGINAÇÃO ====================
function atualizarPaginacao(totalItens) {
    const infoEl = document.getElementById('paginationInfo');
    const container = document.getElementById('paginationContainer');
    const numbersEl = document.getElementById('paginationNumbers');
    const btnFirst = document.getElementById('btnFirst');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const btnLast = document.getElementById('btnLast');
    
    if (!container || totalItens === 0) {
        if (container) container.style.display = 'none';
        return;
    }
    
    container.style.display = 'flex';
    
    const inicio = (paginaAtual - 1) * itensPorPagina + 1;
    const fim = Math.min(paginaAtual * itensPorPagina, totalItens);
    
    if (infoEl) {
        infoEl.textContent = `${inicio}-${fim} de ${totalItens}`;
    }
    
    if (btnFirst) btnFirst.disabled = paginaAtual === 1;
    if (btnPrev) btnPrev.disabled = paginaAtual === 1;
    if (btnNext) btnNext.disabled = paginaAtual === totalPaginas;
    if (btnLast) btnLast.disabled = paginaAtual === totalPaginas;
    
    if (numbersEl) {
        numbersEl.innerHTML = '';
        
        let startPage = Math.max(1, paginaAtual - 2);
        let endPage = Math.min(totalPaginas, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `pagination-btn ${i === paginaAtual ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = () => mudarPagina(i);
            numbersEl.appendChild(btn);
        }
    }
}

function mudarPagina(pagina) {
    if (pagina < 1 || pagina > totalPaginas) return;
    paginaAtual = pagina;
    renderizarTabela();
    
    const table = document.querySelector('.table-responsive');
    if (table) {
        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function mudarItensPorPagina(valor) {
    itensPorPagina = parseInt(valor);
    paginaAtual = 1;
    renderizarTabela();
}

function filtrar(status, btn) {
    filtroAtual = status;
    paginaAtual = 1;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderizarTabela();
}

// ==================== CRUD ====================
async function salvarSolicitacao(e) {
    e.preventDefault();
    if (!appSupabase) return mostrarToast('Erro de conexão', 'error');

    const btn = document.getElementById('btnSubmit');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    try {
        const form = e.target;
        const formData = new FormData(form);
        const formatos = [];
        form.querySelectorAll('input[name="formato[]"]:checked').forEach(cb => formatos.push(cb.value));

        const payload = {
            solicitante_nome: formData.get('solicitante_nome'),
            solicitante_setor: formData.get('solicitante_setor'),
            solicitante_email: formData.get('solicitante_email'),
            solicitante_cliente: formData.get('solicitante_cliente') || null,
            prazo_ideal: formData.get('prazo_ideal'),
            prazo_limite: formData.get('prazo_limite'),
            urgente: formData.get('urgente') === 'sim',
            urgencia_justificativa: formData.get('urgencia_justificativa') || null,
            tipo_material: formData.get('tipo_material'),
            tipo_material_outro: formData.get('tipo_material') === 'outro' ? formData.get('tipo_material_outro') : null,
            objetivo: formData.get('objetivo'),
            conteudo: formData.get('conteudo'),
            info_obrigatorias: formData.get('info_obrigatorias'),
            formatos: formatos,
            formato_outros: formatos.includes('outros') ? formData.get('formato_outros') : null,
            dimensoes: formData.get('dimensoes') || null,
            paginas: formData.get('paginas') ? parseInt(formData.get('paginas')) : null,
            identidade_visual: formData.get('identidade_visual') === 'sim',
            identidade_diretorio: formData.get('identidade_diretorio') || null,
            referencias_diretorio: formData.get('referencias_diretorio') || null,
            materiais_diretorio: formData.get('materiais_diretorio') || null,
            observacoes: formData.get('observacoes') || null,
            status: 'na_fila',
            criado_em: new Date().toISOString()
        };

        const { data, error } = await appSupabase.from('solicitacoes').insert([payload]).select();
        if (error) throw error;

        document.getElementById('protocolNumber').textContent = data[0].protocolo || data[0].id;
        const msg = document.getElementById('successMessage');
        msg.classList.remove('hidden');
        msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        await carregarDados();
        
        setTimeout(() => {
            limparFormulario();
            if (!formAberto) toggleFormulario();
            mostrarToast('Solicitação salva!', 'success');
        }, 2500);

    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao salvar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

async function mudarStatus(id, novoStatus) {
    if (!usuarioLogado) return;
    
    const item = dadosTabela.find(d => d.id === id);
    if (item) {
        item.status = novoStatus;
        renderizarTabela();
        atualizarMetricas();
    }

    try {
        await appSupabase.from('solicitacoes')
            .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
            .eq('id', id);
    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao sincronizar status', 'error');
        carregarDados();
    }
}

async function excluirSolicitacao(id) {
    if (!usuarioLogado) return;
    if (!confirm('Excluir esta solicitação?')) return;

    const index = dadosTabela.findIndex(d => d.id === id);
    if (index !== -1) {
        dadosTabela.splice(index, 1);
        renderizarTabela();
        atualizarMetricas();
    }

    try {
        await appSupabase.from('solicitacoes').delete().eq('id', id);
        mostrarToast('Excluído com sucesso', 'success');
    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao excluir do servidor', 'error');
        carregarDados();
    }
}

function verDetalhes(id) {
    const item = dadosTabela.find(d => d.id === id || d.protocolo === id);
    if (!item) return;
    const d = item;
    let html = '';
    let statusText = {'na_fila':'Na Fila','em_andamento':'Processando','ajustes':'Aguardando','concluido':'Finalizado'}[d.status] || 'Na Fila';
    
    html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;padding:20px;background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(30,41,59,0.5));border-radius:var(--radius);border:1px solid var(--border);">
        <div><span style="color:var(--text-muted);font-size:0.8rem;text-transform:uppercase;font-weight:600;">Protocolo</span><div style="font-size:1.3rem;font-weight:700;color:var(--primary);font-family:monospace;margin-top:4px;">${d.protocolo || d.id}</div></div>
        <div><span style="color:var(--text-muted);font-size:0.8rem;text-transform:uppercase;font-weight:600;">Status</span><div style="margin-top:8px;"><span class="status-badge status-${d.status || 'na_fila'}">${statusText}</span></div></div>
        <div><span style="color:var(--text-muted);font-size:0.8rem;text-transform:uppercase;font-weight:600;">Data</span><div style="font-size:1.1rem;font-weight:600;margin-top:4px;">${d.criado_em ? new Date(d.criado_em).toLocaleDateString('pt-BR') : '-'}</div></div>
    </div>`;

    const section = (icon, title, content) => `
        <div style="margin-bottom:16px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
            <div style="padding:12px 16px;background:rgba(59,130,246,0.06);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
                <i class="fas fa-${icon}" style="color:var(--primary);"></i>
                <span style="font-weight:600;font-size:0.9rem;color:var(--text-primary);">${title}</span>
            </div>
            <div style="padding:16px;">${content}</div>
        </div>
    `;

    const field = (label, value) => {
        if (!value) return `<div style="margin-bottom:12px;"><strong style="color:var(--text-muted);font-size:0.8rem;">${label}</strong><div style="margin-top:4px;color:var(--text-muted);font-style:italic;font-size:0.9rem;">Não informado</div></div>`;
        return `<div style="margin-bottom:12px;"><strong style="color:var(--text-muted);font-size:0.8rem;">${label}</strong><div style="margin-top:4px;background:var(--bg-input);padding:10px 14px;border-radius:var(--radius-sm);font-size:0.9rem;word-break:break-word;">${value}</div></div>`;
    };

    html += section('user', '1. Solicitante', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">${field('Nome', d.solicitante_nome)}${field('Setor', d.solicitante_setor)}${field('E-mail', d.solicitante_email ? `<a href="mailto:${d.solicitante_email}" style="color:var(--primary);text-decoration:none;">${d.solicitante_email}</a>` : null)}${field('Cliente/Projeto', d.solicitante_cliente)}</div>`);
    html += section('calendar-alt', '2. Prazo', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">${field('Data Ideal', d.prazo_ideal ? new Date(d.prazo_ideal).toLocaleDateString('pt-BR') : null)}${field('Data Limite', d.prazo_limite ? new Date(d.prazo_limite).toLocaleDateString('pt-BR') : null)}</div>${d.urgente ? `<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:var(--radius-sm);border:1px solid rgba(239,68,68,0.3);margin-top:12px;"><p style="color:var(--danger);font-weight:700;margin-bottom:6px;"><i class="fas fa-exclamation-triangle"></i> URGENTE</p><p style="color:var(--text-primary);font-size:0.9rem;margin:0;">${d.urgencia_justificativa || 'Sem justificativa'}</p></div>` : ''}`);
    html += section('shapes', '3. Tipo', `<p style="font-size:0.9rem;"><strong>Tipo:</strong> <span style="background:var(--bg-input);padding:5px 12px;border-radius:var(--radius-sm);margin-left:8px;">${d.tipo_material_outro || d.tipo_material || '-'}</span></p>`);
    html += section('bullseye', '4. Objetivo', `<p style="background:var(--bg-input);padding:14px;border-radius:var(--radius-sm);font-size:0.9rem;white-space:pre-wrap;">${d.objetivo || '-'}</p>`);
    html += section('file-word', '5. Conteúdo', `<p style="background:var(--bg-input);padding:14px;border-radius:var(--radius-sm);font-size:0.9rem;white-space:pre-wrap;">${d.conteudo || '-'}</p>`);
    html += section('exclamation-circle', '6. Obrigatórias', `<p style="background:var(--bg-input);padding:14px;border-radius:var(--radius-sm);font-size:0.9rem;white-space:pre-wrap;">${d.info_obrigatorias || '-'}</p>`);
    
    let formatoContent = '';
    if (d.formatos && Array.isArray(d.formatos)) formatoContent = d.formatos.map(f => `<span style="display:inline-block;padding:4px 10px;background:rgba(100,116,139,0.2);border-radius:var(--radius-sm);font-size:0.8rem;margin:3px;">${f}</span>`).join('');
    html += section('expand', '7. Formato', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div>${field('Canais', formatoContent || '-')}</div>${d.dimensoes ? field('Dimensões', d.dimensoes) : ''}${d.paginas ? field('Páginas', d.paginas.toString()) : ''}</div>`);
    if (d.identidade_visual) html += section('palette', '8. Identidade', `${field('Diretório/Link', d.identidade_diretorio)}`);
    if (d.referencias_diretorio) html += section('images', '9. Referências', `${field('Diretório/Link', d.referencias_diretorio)}`);
    if (d.materiais_diretorio) html += section('folder-open', '10. Materiais', `${field('Diretório/Link', d.materiais_diretorio)}`);
    if (d.observacoes) html += section('sticky-note', '11. Observações', `<p style="background:var(--bg-input);padding:14px;border-radius:var(--radius-sm);font-size:0.9rem;white-space:pre-wrap;">${d.observacoes}</p>`);

    document.getElementById('modalViewContent').innerHTML = html;
    document.getElementById('modalViewOverlay').classList.add('show');
}

function atualizarMetricas() {
    document.getElementById('metricTotal').textContent = dadosTabela.length;
    document.getElementById('metricFila').textContent = dadosTabela.filter(d => d.status === 'na_fila').length;
    document.getElementById('metricProc').textContent = dadosTabela.filter(d => d.status === 'em_andamento').length;
    document.getElementById('metricDone').textContent = dadosTabela.filter(d => d.status === 'concluido').length;
}

function mostrarToast(mensagem, tipo = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    toast.innerHTML = `<i class="fas ${tipo==='success'?'fa-check-circle':tipo==='error'?'fa-exclamation-circle':'fa-info-circle'}"></i><span>${mensagem}</span>`;
    
    toast.style.cssText = `
        position: fixed; top: 24px; right: 24px; padding: 14px 20px; border-radius: 8px; color: white;
        font-weight: 600; z-index: 9999; display: flex; align-items: center; gap: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4); transform: translateX(400px);
        transition: transform 0.3s cubic-bezier(0.68,-0.55,0.265,1.55);
        background: ${tipo==='success'?'#10b981':tipo==='error'?'#ef4444':'#3b82f6'};
    `;
    
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.style.transform = 'translateX(0)');
    setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('click', (e) => {
    if (e.target.id === 'modalLoginOverlay') fecharModalLogin();
    if (e.target.id === 'modalViewOverlay') e.target.classList.remove('show');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fecharModalLogin();
        document.getElementById('modalViewOverlay').classList.remove('show');
    }
});