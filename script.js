const SUPABASE_URL = 'https://melphsmbvknfcfqtnymo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aZDIn8B_gjv-x-IyWL8loQ_2Naml9ce';

let appSupabase = null;
let dadosTabela = [];
let usuarioLogado = false;
let filtroAtual = 'todos';
let formAberto = false;
let carregandoDados = false;
let paginaAtual = 1;
let itensPorPagina = 10;
let totalPaginas = 1;
let setorFiltro = '';

document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
        const logo = document.getElementById('headerLogo');
        if (logo) logo.src = 'images/logo-branco.png';
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

function toggleFormulario() {
    const container = document.getElementById('formContainer');
    const btn = document.getElementById('btnNovaSolicitacao');
    formAberto = !formAberto;
    if (formAberto) {
        container.classList.remove('hidden');
        container.classList.add('active');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-times"></i> Cancelar';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-ghost');
        }
        const body = document.querySelector('.form-body');
        if (body) body.scrollTop = 0;
    } else {
        container.classList.remove('active');
        container.classList.add('hidden');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-plus"></i> Nova Solicitação';
            btn.classList.remove('btn-ghost');
            btn.classList.add('btn-primary');
        }
        limparFormulario();
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
    const form = document.getElementById('requestForm');
    if (form) form.reset();
    document.querySelectorAll('.conditional').forEach(el => el.classList.add('hidden'));
    const clienteInput = document.getElementById('clienteInput');
    if (clienteInput) clienteInput.value = '';
}

function abrirModalLogin() {
    document.getElementById('modalLoginOverlay').classList.add('active');
    setTimeout(() => {
        const input = document.getElementById('codigoAcesso');
        if (input) input.focus();
    }, 50);
}

function fecharModalLogin() {
    document.getElementById('modalLoginOverlay').classList.remove('active');
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
    if (!actions) return;
    if (logado) {
        actions.innerHTML = `
            <span style="color: var(--green); font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                <i class="fas fa-shield-alt"></i> <strong>Gestor</strong>
            </span>
            <button class="btn btn-ghost" onclick="sair()">
                <i class="fas fa-sign-out-alt"></i> Sair
            </button>
        `;
    } else {
        actions.innerHTML = `
            <button class="btn btn-ghost" onclick="abrirModalLogin()">
                <i class="fas fa-shield-alt"></i> Gestor
            </button>
        `;
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

async function carregarDados() {
    if (!appSupabase || carregandoDados) return;
    carregandoDados = true;
    try {
        const { data, error } = await appSupabase.from('solicitacoes').select('*').order('criado_em', { ascending: false });
        if (error) throw error;
        dadosTabela = data || [];
        console.log('✅ Dados carregados:', dadosTabela.length);
        renderizarTabela();
        atualizarMetricas();
    } catch (e) {
        console.error('❌ Erro ao carregar:', e);
    } finally {
        carregandoDados = false;
    }
}

function renderizarTabela() {
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    if (!tbody) return;
    
    let filtrados = dadosTabela;
    if (filtroAtual !== 'todos') {
        if (filtroAtual === 'finalizado') {
            filtrados = filtrados.filter(r => r.status === 'concluido' || r.status === 'finalizado');
        } else {
            filtrados = filtrados.filter(r => r.status === filtroAtual);
        }
    }
    if (setorFiltro) {
        filtrados = filtrados.filter(r => r.solicitante_setor && r.solicitante_setor.toLowerCase().includes(setorFiltro.toLowerCase()));
    }

    if (filtrados.length === 0) {
        tbody.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';
        if (emptyState) { emptyState.classList.add('visible'); emptyState.style.display = 'block'; }
        atualizarPaginacao(0);
        return;
    }

    if (emptyState) { emptyState.classList.remove('visible'); emptyState.style.display = 'none'; }
    tbody.style.display = 'table-row-group';
    tbody.innerHTML = '';

    totalPaginas = Math.ceil(filtrados.length / itensPorPagina);
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensPagina = filtrados.slice(inicio, fim);
    const fragment = document.createDocumentFragment();
    
    itensPagina.forEach(item => {
        const tr = document.createElement('tr');
        const statusText = {
            'na_fila':'Na Fila',
            'em_andamento':'Em Andamento',
            'ajustes':'Ajuste Pendente',
            'concluido':'Finalizado',
            'finalizado':'Finalizado'
        }[item.status] || 'Na Fila';

        let tipoMaterial = item.tipo_material_outro || item.tipo_material || '-';
        tipoMaterial = tipoMaterial.charAt(0).toUpperCase() + tipoMaterial.slice(1);

        let formatoHTML = '-';
        if (item.formatos && Array.isArray(item.formatos) && item.formatos.length > 0) {
            const fmts = item.formatos.filter(f => f && f !== 'outros');
            if (fmts.length <= 2) {
                const icons = { 'instagram':'<i class="fab fa-instagram"></i>', 'whatsapp':'<i class="fab fa-whatsapp"></i>', 'email':'<i class="fas fa-envelope"></i>', 'impressao':'<i class="fas fa-print"></i>', 'site':'<i class="fas fa-globe"></i>' };
                formatoHTML = fmts.map(f => `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;background:rgba(100,116,139,0.2);border-radius:3px;font-size:0.68rem;margin:1px;color:#cbd5e1;">${icons[f]||''} ${f}</span>`).join('');
            } else {
                formatoHTML = `<span style="display:inline-block;padding:2px 6px;background:rgba(100,116,139,0.2);border-radius:3px;font-size:0.68rem;color:#cbd5e1;">${fmts.length} canais</span>`;
            }
            if (item.formato_outros) formatoHTML += `<span style="display:inline-block;padding:2px 6px;background:rgba(245,158,11,0.2);border-radius:3px;font-size:0.68rem;margin:1px;color:#fbbf24;">${item.formato_outros}</span>`;
        }

        let prazoDisplay = '-';
        if (item.prazo_ideal) {
            prazoDisplay = new Date(item.prazo_ideal).toLocaleDateString('pt-BR');
            if (item.urgente) prazoDisplay = `<span style="color:#e74c3c;font-weight:600;"><i class="fas fa-exclamation-circle"></i> ${prazoDisplay}</span>`;
        }

        let statusHTML = '';
        if (usuarioLogado) {
            // ✅ CORREÇÃO: value="concluido" para respeitar a constraint do banco, mas label="Finalizado"
            statusHTML = `<select class="form-control" style="padding:0.25rem 0.4rem;font-size:0.72rem;min-width:110px;" onchange="mudarStatus('${item.id}', this.value)">
                <option value="na_fila" ${item.status==='na_fila'?'selected':''}>Na Fila</option>
                <option value="em_andamento" ${item.status==='em_andamento'?'selected':''}>Em Andamento</option>
                <option value="ajustes" ${item.status==='ajustes'?'selected':''}>Ajuste Pendente</option>
                <option value="concluido" ${item.status==='concluido' || item.status==='finalizado'?'selected':''}>Finalizado</option>
            </select>`;
        } else {
            statusHTML = `<span class="status-badge status-${item.status === 'concluido' ? 'finalizado' : item.status}">${statusText}</span>`;
        }

        let acoesHTML = `<div class="table-actions">
            <button class="btn" data-action="ver" onclick="verDetalhes('${item.id}')" title="Ver"><i class="fas fa-eye"></i></button>`;
        if (usuarioLogado) acoesHTML += `<button class="btn" data-action="excluir" onclick="excluirSolicitacao('${item.id}')" title="Excluir"><i class="fas fa-trash"></i></button>`;
        acoesHTML += `</div>`;

        tr.innerHTML = `
            <td><strong style="color:var(--blue-light);font-family:monospace;font-size:0.78rem;">${item.protocolo || item.id}</strong></td>
            <td>${item.solicitante_nome || '-'}</td>
            <td>${item.solicitante_setor || '-'}</td>
            <td>${tipoMaterial}</td>
            <td>${formatoHTML}</td>
            <td>${prazoDisplay}</td>
            <td>${statusHTML}</td>
            <td>${acoesHTML}</td>
        `;
        fragment.appendChild(tr);
    });
    
    tbody.appendChild(fragment);
    if (paginationContainer) paginationContainer.style.display = 'flex';
    atualizarPaginacao(filtrados.length);
}

function filtrarPorSetor() {
    setorFiltro = document.getElementById('filtroSetor').value;
    paginaAtual = 1;
    renderizarTabela();
}

function atualizarPaginacao(totalItens) {
    const infoEl = document.getElementById('paginationInfo');
    const container = document.getElementById('paginationContainer');
    const numbersEl = document.getElementById('paginationNumbers');
    if (!container || totalItens === 0) { if (container) container.style.display = 'none'; return; }
    container.style.display = 'flex';
    const inicio = (paginaAtual - 1) * itensPorPagina + 1;
    const fim = Math.min(paginaAtual * itensPorPagina, totalItens);
    if (infoEl) infoEl.textContent = `${inicio}-${fim} de ${totalItens}`;
    
    ['btnFirst','btnPrev','btnNext','btnLast'].forEach((id, i) => {
        const btn = document.getElementById(id);
        if (btn) {
            if (i === 0 || i === 1) btn.disabled = paginaAtual === 1;
            else btn.disabled = paginaAtual === totalPaginas;
        }
    });
    
    if (numbersEl) {
        numbersEl.innerHTML = '';
        let startPage = Math.max(1, paginaAtual - 2);
        let endPage = Math.min(totalPaginas, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `page-number ${i === paginaAtual ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = () => mudarPagina(i);
            numbersEl.appendChild(btn);
        }
    }
}

function mudarPagina(p) { if (p < 1 || p > totalPaginas) return; paginaAtual = p; renderizarTabela(); }
function mudarItensPorPagina(v) { itensPorPagina = parseInt(v); paginaAtual = 1; renderizarTabela(); }
function filtrar(status, btn) { filtroAtual = status; paginaAtual = 1; document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderizarTabela(); }

function buscar() {
    const termo = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!termo) { renderizarTabela(); return; }
    const filtrados = dadosTabela.filter(item => 
        (item.solicitante_nome && item.solicitante_nome.toLowerCase().includes(termo)) ||
        (item.solicitante_cliente && item.solicitante_cliente.toLowerCase().includes(termo)) ||
        (item.protocolo && item.protocolo.toLowerCase().includes(termo)) ||
        (item.solicitante_setor && item.solicitante_setor.toLowerCase().includes(termo))
    );
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    if (filtrados.length === 0) {
        tbody.style.display = 'none'; if (paginationContainer) paginationContainer.style.display = 'none';
        if (emptyState) { emptyState.classList.add('visible'); emptyState.style.display = 'block'; }
        return;
    }
    if (emptyState) { emptyState.classList.remove('visible'); emptyState.style.display = 'none'; }
    tbody.style.display = 'table-row-group'; tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    filtrados.forEach(item => {
        const tr = document.createElement('tr');
        const statusText = {'na_fila':'Na Fila','em_andamento':'Em Andamento','ajustes':'Ajuste Pendente','concluido':'Finalizado','finalizado':'Finalizado'}[item.status] || 'Na Fila';
        let tipo = (item.tipo_material_outro || item.tipo_material || '-').charAt(0).toUpperCase() + (item.tipo_material_outro || item.tipo_material || '-').slice(1);
        tr.innerHTML = `
            <td><strong style="color:var(--blue-light);font-family:monospace;font-size:0.78rem;">${item.protocolo || item.id}</strong></td>
            <td>${item.solicitante_nome || '-'}</td><td>${item.solicitante_setor || '-'}</td><td>${tipo}</td><td>-</td>
            <td>${item.prazo_ideal ? new Date(item.prazo_ideal).toLocaleDateString('pt-BR') : '-'}</td>
            <td><span class="status-badge status-${item.status === 'concluido' ? 'finalizado' : item.status}">${statusText}</span></td>
            <td><div class="table-actions"><button class="btn" data-action="ver" onclick="verDetalhes('${item.id}')" title="Ver"><i class="fas fa-eye"></i></button></div></td>
        `;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment); if (paginationContainer) paginationContainer.style.display = 'none';
}

async function salvarSolicitacao(e) {
    e.preventDefault();
    if (!appSupabase) return mostrarToast('Erro de conexão', 'error');
    const form = e.target;
    let valido = true, primeiro = null;
    form.querySelectorAll('[required]').forEach(c => {
        if (!c.value.trim()) {
            if (c.type === 'radio') {
                const radios = form.querySelectorAll(`input[name="${c.name}"]`);
                if (!Array.from(radios).some(r => r.checked)) { valido = false; if (!primeiro) primeiro = radios[0]; }
            } else { valido = false; if (!primeiro) primeiro = c; }
        }
    });
    if (form.querySelectorAll('input[name="formato[]"]:checked').length === 0) {
        valido = false; if (!primeiro) primeiro = form.querySelector('input[name="formato[]"]');
    }
    if (!valido) {
        mostrarToast('Preencha todos os campos obrigatórios', 'error');
        if (primeiro) { primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' }); primeiro.focus(); }
        return;
    }

    const btn = document.getElementById('btnSubmit');
    const oldHTML = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    try {
        const fd = new FormData(form);
        const formatos = []; form.querySelectorAll('input[name="formato[]"]:checked').forEach(cb => formatos.push(cb.value));
        let cliente = document.getElementById('clienteInput').value.trim();
        if (cliente.startsWith('#')) cliente = cliente.substring(1);
        
        const payload = {
            solicitante_nome: fd.get('solicitante_nome'), solicitante_setor: fd.get('solicitante_setor'),
            solicitante_email: fd.get('solicitante_email'), solicitante_cliente: cliente || null,
            prazo_ideal: fd.get('prazo_ideal'), prazo_limite: fd.get('prazo_limite'),
            urgente: fd.get('urgente') === 'sim', urgencia_justificativa: fd.get('urgencia_justificativa') || null,
            tipo_material: fd.get('tipo_material'),
            tipo_material_outro: fd.get('tipo_material') === 'outro' ? fd.get('tipo_material_outro') : null,
            objetivo: fd.get('objetivo'), conteudo: fd.get('conteudo'), info_obrigatorias: fd.get('info_obrigatorias'),
            formatos, formato_outros: formatos.includes('outros') ? fd.get('formato_outros') : null,
            dimensoes: fd.get('dimensoes') || null, paginas: fd.get('paginas') ? parseInt(fd.get('paginas')) : null,
            identidade_visual: fd.get('identidade_visual') === 'sim', identidade_diretorio: fd.get('identidade_diretorio') || null,
            referencias_diretorio: fd.get('referencias_diretorio') || null, materiais_diretorio: fd.get('materiais_diretorio') || null,
            observacoes: fd.get('observacoes') || null, status: 'na_fila', criado_em: new Date().toISOString()
        };
        const { data, error } = await appSupabase.from('solicitacoes').insert([payload]).select();
        if (error) throw error;
        mostrarToast('Solicitação salva com sucesso!', 'success');
        toggleFormulario(); await carregarDados();
    } catch (err) { console.error(err); mostrarToast('Erro ao salvar: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = oldHTML; }
}

// ✅ CORREÇÃO CRÍTICA: Envia "concluido" para o banco, respeitando a constraint
async function mudarStatus(id, novoStatus) {
    if (!usuarioLogado) { mostrarToast('Faça login como gestor', 'error'); return; }
    console.log('🔄 Mudando status:', { id, novoStatus });
    try {
        const { data, error } = await appSupabase
            .from('solicitacoes')
            .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        
        const idx = dadosTabela.findIndex(d => d.id === id);
        if (idx !== -1) {
            dadosTabela[idx].status = novoStatus;
            if (data && data[0]) dadosTabela[idx] = { ...dadosTabela[idx], ...data[0] };
        }
        
        renderizarTabela(); atualizarMetricas();
        mostrarToast('Status atualizado!', 'success');
    } catch (err) {
        console.error('❌ Erro mudarStatus:', err);
        mostrarToast('Erro ao atualizar: ' + err.message, 'error');
        await carregarDados();
    }
}

async function excluirSolicitacao(id) {
    if (!usuarioLogado || !confirm('Excluir esta solicitação?')) return;
    try {
        const { error } = await appSupabase.from('solicitacoes').delete().eq('id', id);
        if (error) throw error;
        const idx = dadosTabela.findIndex(d => d.id === id);
        if (idx !== -1) { dadosTabela.splice(idx, 1); renderizarTabela(); atualizarMetricas(); }
        mostrarToast('Excluído com sucesso', 'success');
    } catch (err) { console.error(err); mostrarToast('Erro ao excluir', 'error'); await carregarDados(); }
}

function verDetalhes(id) {
    const item = dadosTabela.find(d => d.id === id || d.protocolo === id);
    if (!item) return;
    const d = item;
    const statusText = {'na_fila':'Na Fila','em_andamento':'Em Andamento','ajustes':'Ajuste Pendente','concluido':'Finalizado','finalizado':'Finalizado'}[d.status] || 'Na Fila';
    let html = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;padding:16px;background:linear-gradient(135deg,rgba(58,101,176,0.12),rgba(30,41,59,0.5));border-radius:var(--radius-lg);border:1px solid var(--border-color);">
        <div><span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;font-weight:600;">Protocolo</span><div style="font-size:1.2rem;font-weight:700;color:var(--blue-light);font-family:monospace;margin-top:3px;">${d.protocolo || d.id}</div></div>
        <div><span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;font-weight:600;">Status</span><div style="margin-top:6px;"><span class="status-badge status-${d.status === 'concluido' ? 'finalizado' : d.status}">${statusText}</span></div></div>
        <div><span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;font-weight:600;">Data</span><div style="font-size:1rem;font-weight:600;margin-top:3px;">${d.criado_em ? new Date(d.criado_em).toLocaleDateString('pt-BR') : '-'}</div></div>
    </div>`;
    const sec = (i,t,c) => `<div style="margin-bottom:12px;border:1px solid var(--border-color);border-radius:var(--radius-md);overflow:hidden;"><div style="padding:10px 14px;background:rgba(58,101,176,0.06);border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:8px;"><i class="fas fa-${i}" style="color:var(--blue);"></i><span style="font-weight:600;font-size:0.85rem;">${t}</span></div><div style="padding:12px;">${c}</div></div>`;
    const fld = (l,v) => !v ? `<div style="margin-bottom:10px;"><strong style="color:var(--text-muted);font-size:0.75rem;">${l}</strong><div style="color:var(--text-muted);font-style:italic;font-size:0.85rem;">Não informado</div></div>` : `<div style="margin-bottom:10px;"><strong style="color:var(--text-muted);font-size:0.75rem;">${l}</strong><div style="background:var(--bg-input);padding:8px 12px;border-radius:var(--radius-sm);font-size:0.85rem;word-break:break-word;white-space:pre-wrap;">${v}</div></div>`;
    
    html += sec('user','1. Solicitante',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${fld('Nome',d.solicitante_nome)}${fld('Setor',d.solicitante_setor)}${fld('E-mail',d.solicitante_email?`<a href="mailto:${d.solicitante_email}" style="color:var(--blue)">${d.solicitante_email}</a>`:null)}${fld('Cliente',d.solicitante_cliente?`#${d.solicitante_cliente}`:null)}</div>`);
    html += sec('calendar-alt','2. Prazo',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${fld('Data Ideal',d.prazo_ideal?new Date(d.prazo_ideal).toLocaleDateString('pt-BR'):null)}${fld('Data Limite',d.prazo_limite?new Date(d.prazo_limite).toLocaleDateString('pt-BR'):null)}</div>${d.urgente?`<div style="background:rgba(231,76,60,0.1);padding:12px;border-radius:var(--radius-sm);border:1px solid rgba(231,76,60,0.3);margin-top:10px;"><p style="color:#e74c3c;font-weight:700;margin-bottom:4px;">⚠️ URGENTE</p><p style="margin:0;">${d.urgencia_justificativa||'-'}</p></div>`:''}`);
    html += sec('shapes','3. Tipo',`<p><strong>Tipo:</strong> <span style="background:var(--bg-input);padding:4px 10px;border-radius:var(--radius-sm);margin-left:6px;">${d.tipo_material_outro||d.tipo_material||'-'}</span></p>`);
    html += sec('bullseye','4. Objetivo',`<p style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);white-space:pre-wrap;">${d.objetivo||'-'}</p>`);
    html += sec('file-word','5. Conteúdo',`<p style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);white-space:pre-wrap;">${d.conteudo||'-'}</p>`);
    html += sec('exclamation-circle','6. Obrigatórias',`<p style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);white-space:pre-wrap;">${d.info_obrigatorias||'-'}</p>`);
    let fmts = ''; if(d.formatos) fmts = d.formatos.map(f=>`<span style="display:inline-block;padding:3px 8px;background:rgba(100,116,139,0.2);border-radius:var(--radius-sm);font-size:0.75rem;margin:2px;">${f}</span>`).join('');
    html += sec('expand','7. Formato',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div>${fld('Canais',fmts||'-')}</div>${d.dimensoes?fld('Dimensões',d.dimensoes):''}${d.paginas?fld('Páginas',d.paginas.toString()):''}</div>`);
    if(d.identidade_visual) html += sec('palette','8. Identidade',`${fld('Diretório',d.identidade_diretorio)}`);
    if(d.referencias_diretorio) html += sec('images','9. Referências',`${fld('Diretório',d.referencias_diretorio)}`);
    if(d.materiais_diretorio) html += sec('folder-open','10. Materiais',`${fld('Diretório',d.materiais_diretorio)}`);
    if(d.observacoes) html += sec('sticky-note','11. Observações',`<p style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);white-space:pre-wrap;">${d.observacoes}</p>`);
    document.getElementById('modalViewContent').innerHTML = html;
    document.getElementById('modalViewOverlay').classList.add('active');
}

function atualizarMetricas() {
    document.getElementById('metricTotal').textContent = dadosTabela.length;
    document.getElementById('metricFila').textContent = dadosTabela.filter(d => d.status === 'na_fila').length;
    document.getElementById('metricProc').textContent = dadosTabela.filter(d => d.status === 'em_andamento').length;
    document.getElementById('metricAjuste').textContent = dadosTabela.filter(d => d.status === 'ajustes').length;
    // ✅ Conta tanto 'concluido' quanto 'finalizado' para o dashboard
    document.getElementById('metricDone').textContent = dadosTabela.filter(d => d.status === 'concluido' || d.status === 'finalizado').length;
}

function mostrarToast(msg, tipo='success') {
    const ex = document.querySelector('.toast-notification'); if(ex) ex.remove();
    const t = document.createElement('div'); t.className = `toast-notification ${tipo}`;
    t.innerHTML = `<i class="fas ${tipo==='success'?'fa-check-circle':tipo==='error'?'fa-exclamation-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    t.style.cssText = `position:fixed;top:70px;right:20px;padding:12px 18px;border-radius:8px;color:white;font-weight:600;z-index:9999;display:flex;align-items:center;gap:8px;font-size:0.85rem;box-shadow:0 8px 24px rgba(0,0,0,0.5);transform:translateX(400px);transition:transform 0.3s cubic-bezier(0.68,-0.55,0.265,1.55);background:${tipo==='success'?'#6CC24A':tipo==='error'?'#e74c3c':'#3A65B0'};`;
    document.body.appendChild(t); requestAnimationFrame(()=>t.style.transform='translateX(0)');
    setTimeout(()=>{ t.style.transform='translateX(400px)'; setTimeout(()=>t.remove(),300); },3000);
}

document.addEventListener('click', e => {
    if(e.target.id==='modalLoginOverlay') fecharModalLogin();
    if(e.target.id==='modalViewOverlay') e.target.classList.remove('active');
});
document.addEventListener('keydown', e => {
    if(e.key==='Escape') { if(formAberto) toggleFormulario(); else { fecharModalLogin(); document.getElementById('modalViewOverlay').classList.remove('active'); } }
});
