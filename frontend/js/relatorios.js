let cacheObras = [];
let cacheTarefas = [];

document.addEventListener("DOMContentLoaded", async () => {
    verificarSessao();

    await carregarRelatorios();

    document.getElementById("filtro-obra")
        .addEventListener("change", carregarRelatorios);

    const btnExportar = document.querySelector(".btn-exportar");
    if (btnExportar) {
        btnExportar.addEventListener("click", exportarParaPDF);
    }
});

// ==========================
// EXPORTAR PARA PDF (TEMPLATE EXECUTIVO A4)
// ==========================
async function exportarParaPDF() {
    const btn = document.querySelector(".btn-exportar");
    const textoOriginal = btn ? btn.innerHTML : "";

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = "⏳ Gerando PDF...";
        }

        if (cacheObras.length === 0 && cacheTarefas.length === 0) {
            await carregarRelatorios();
        }

        const obraSelecionadaId = document.getElementById("filtro-obra")?.value || "";
        const obraAtual = obraSelecionadaId
            ? cacheObras.find(o => String(o.id) === String(obraSelecionadaId))
            : null;

        let usuario = {};
        try {
            usuario = JSON.parse(sessionStorage.getItem("usuario") || "{}");
        } catch (_) {}

        const htmlRelatorio = montarHTMLRelatorioPDF(cacheObras, cacheTarefas, obraAtual, usuario);

        const dataHoje = new Date().toISOString().slice(0, 10);
        const sufixo = obraAtual ? slugificar(obraAtual.nome) : "geral";
        const nomeArquivo = `relatorio_gerobras_${sufixo}_${dataHoje}.pdf`;

        const opt = {
            margin: [8, 8, 10, 8],
            filename: nomeArquivo,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                windowWidth: 794
            },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["css", "legacy"] }
        };

        await html2pdf().set(opt).from(htmlRelatorio, "string").save();

        if (typeof toast === "function") {
            toast("Relatório PDF gerado com sucesso!", "sucesso");
        }
    } catch (err) {
        console.error("Erro ao gerar PDF:", err);
        if (typeof toast === "function") {
            toast("Erro ao gerar o PDF.", "erro");
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    }
}

function montarHTMLRelatorioPDF(obras, tarefas, obraAtual, usuario) {
    const agora = new Date();
    const dataEmissao = agora.toLocaleDateString("pt-BR");
    const horaEmissao = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const nomeUsuario = escapeHtml(usuario?.nome || "Administrador");
    const cargoUsuario = escapeHtml(formatCargo(usuario?.cargo || usuario?.perfil || "admin"));

    const tarefasEscopo = obraAtual
        ? tarefas.filter(t => String(t.obra?.id) === String(obraAtual.id))
        : tarefas;

    const totalTarefas = tarefasEscopo.length;
    const tarefasConcluidas = tarefasEscopo.filter(t => t.status === "concluida").length;
    const tarefasPendentes = tarefasEscopo.filter(t => t.status === "pendente").length;
    const taxaConclusao = totalTarefas > 0 ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;

    // KPIs adaptados ao escopo (Geral vs Obra específica)
    let kpisHtml = "";
    if (obraAtual) {
        kpisHtml = `
            ${criarCardKPI(formatarMoedaSegura(obraAtual.orcamento), "Orçamento Previsto", true)}
            ${criarCardKPI(`${taxaConclusao}%`, "Progresso Tarefas")}
            ${criarCardKPI(String(totalTarefas), "Total de Tarefas")}
            ${criarCardKPI(String(tarefasPendentes), "Tarefas Pendentes")}
        `;
    } else {
        const obrasAndamento = obras.filter(o => o.status === "em_andamento").length;
        const obrasConcluidas = obras.filter(o => o.status === "concluida").length;
        const orcamentoTotal = obras.reduce((acc, o) => acc + (Number(o.orcamento) || 0), 0);

        kpisHtml = `
            ${criarCardKPI(String(obras.length), "Total de Obras")}
            ${criarCardKPI(String(obrasAndamento), "Em Andamento")}
            ${criarCardKPI(String(obrasConcluidas), "Obras Concluídas")}
            ${criarCardKPI(formatarMoedaSegura(orcamentoTotal), "Orçamento Total", true)}
        `;
    }

    // Bloco esquerdo dos gráficos (Distribuição de Obras OU Ficha Técnica da Obra)
    let blocoEsquerdoHtml = "";
    if (obraAtual) {
        blocoEsquerdoHtml = `
            <div class="pdf-card">
                <div class="pdf-card-title">Dados da Obra</div>
                <div class="pdf-info-list">
                    <div class="pdf-info-row">
                        <span class="pdf-info-key">Status Atual</span>
                        <span>${badgeStatusPDF(obraAtual.status)}</span>
                    </div>
                    <div class="pdf-info-row">
                        <span class="pdf-info-key">Endereço</span>
                        <span class="pdf-info-val">${escapeHtml(obraAtual.endereco || "—")}</span>
                    </div>
                    <div class="pdf-info-row">
                        <span class="pdf-info-key">Data de Início</span>
                        <span class="pdf-info-val">${formatarData(obraAtual.data_inicio)}</span>
                    </div>
                    <div class="pdf-info-row">
                        <span class="pdf-info-key">Previsão de Entrega</span>
                        <span class="pdf-info-val">${formatarData(obraAtual.data_prevista_fim)}</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        const contagemObras = {
            planejamento: 0,
            em_andamento: 0,
            pausada: 0,
            concluida: 0,
            cancelada: 0
        };
        obras.forEach(o => {
            if (contagemObras[o.status] !== undefined) contagemObras[o.status]++;
        });

        blocoEsquerdoHtml = `
            <div class="pdf-card">
                <div class="pdf-card-title">Obras por Status (${obras.length})</div>
                ${gerarBarrasHorizontaisPDF(contagemObras, obras.length)}
            </div>
        `;
    }

    // Bloco direito dos gráficos (Distribuição de Tarefas)
    const contagemTarefas = {
        pendente: 0,
        em_andamento: 0,
        concluida: 0,
        cancelada: 0
    };
    tarefasEscopo.forEach(t => {
        if (contagemTarefas[t.status] !== undefined) contagemTarefas[t.status]++;
    });

    const blocoDireitoHtml = `
        <div class="pdf-card">
            <div class="pdf-card-title">Tarefas por Status (${totalTarefas})</div>
            ${gerarBarrasHorizontaisPDF(contagemTarefas, totalTarefas)}
        </div>
    `;

    // Tabela principal (Portfólio de Obras no modo Geral OU Tarefas da Obra no modo Filtrado)
    let tabelaHtml = "";
    if (obraAtual) {
        const linhas = tarefasEscopo.length > 0
            ? tarefasEscopo.map(t => `
                <tr>
                    <td class="pdf-td-bold">${escapeHtml(t.titulo || "—")}</td>
                    <td>${badgeStatusPDF(t.status)}</td>
                    <td>${badgePrioridadePDF(t.prioridade)}</td>
                    <td>${escapeHtml(t.responsavel || "—")}</td>
                    <td>${formatarData(t.prazo)}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="5" class="pdf-empty">Nenhuma tarefa registrada para esta obra.</td></tr>`;

        tabelaHtml = `
            <div class="pdf-section-title">Detalhamento de Tarefas — ${escapeHtml(obraAtual.nome)}</div>
            <table class="pdf-table">
                <thead>
                    <tr>
                        <th style="width:32%">Tarefa</th>
                        <th style="width:18%">Status</th>
                        <th style="width:15%">Prioridade</th>
                        <th style="width:20%">Responsável</th>
                        <th style="width:15%">Prazo</th>
                    </tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>
        `;
    } else {
        const linhas = obras.length > 0
            ? obras.map(o => {
                const qtdTarefas = tarefas.filter(t => String(t.obra?.id) === String(o.id)).length;
                return `
                    <tr>
                        <td class="pdf-td-bold">${escapeHtml(o.nome || "—")}</td>
                        <td>${badgeStatusPDF(o.status)}</td>
                        <td class="pdf-td-num">${formatarMoedaSegura(o.orcamento)}</td>
                        <td>${formatarData(o.data_inicio)}</td>
                        <td>${formatarData(o.data_prevista_fim)}</td>
                        <td class="pdf-td-center">${qtdTarefas}</td>
                    </tr>
                `;
            }).join("")
            : `<tr><td colspan="6" class="pdf-empty">Nenhuma obra cadastrada.</td></tr>`;

        tabelaHtml = `
            <div class="pdf-section-title">Portfólio Consolidado de Obras (${obras.length})</div>
            <table class="pdf-table">
                <thead>
                    <tr>
                        <th style="width:28%">Obra</th>
                        <th style="width:18%">Status</th>
                        <th style="width:19%">Orçamento</th>
                        <th style="width:12%">Início</th>
                        <th style="width:13%">Prev. Fim</th>
                        <th style="width:10%;text-align:center">Tarefas</th>
                    </tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>
        `;
    }

    return `
        <div class="gerobras-pdf">
            <style>
                .gerobras-pdf {
                    width: 720px;
                    margin: 0 auto;
                    background: #ffffff !important;
                    color: #1f2937 !important;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    font-size: 11px;
                    line-height: 1.45;
                    box-sizing: border-box;
                }
                .gerobras-pdf * {
                    box-sizing: border-box;
                }
                .pdf-header {
                    background: #141414;
                    color: #ffffff;
                    padding: 20px 24px;
                    border-radius: 10px;
                    border-bottom: 4px solid #c9a050;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 18px;
                }
                .pdf-brand-eyebrow {
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 1.6px;
                    text-transform: uppercase;
                    color: #c9a050;
                    margin-bottom: 4px;
                }
                .pdf-brand-title {
                    font-size: 20px;
                    font-weight: 800;
                    color: #ffffff;
                    margin: 0 0 3px 0;
                }
                .pdf-brand-sub {
                    font-size: 11px;
                    color: #d1d5db;
                }
                .pdf-meta {
                    text-align: right;
                    font-size: 10px;
                    color: #d1d5db;
                    line-height: 1.6;
                }
                .pdf-meta strong {
                    color: #f3f4f6;
                }
                .pdf-kpi-row {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 16px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .pdf-kpi {
                    flex: 1;
                    background: #fafafa;
                    border: 1px solid #e5e7eb;
                    border-top: 3px solid #c9a050;
                    border-radius: 8px;
                    padding: 12px 10px;
                    text-align: center;
                }
                .pdf-kpi-val {
                    font-size: 18px;
                    font-weight: 800;
                    color: #111827;
                    margin-bottom: 3px;
                }
                .pdf-kpi-val.money {
                    font-size: 13px;
                    color: #936f24;
                    padding-top: 4px;
                }
                .pdf-kpi-label {
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    color: #6b7280;
                }
                .pdf-charts-row {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 18px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .pdf-card {
                    flex: 1;
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 14px 16px;
                }
                .pdf-card-title {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #141414;
                    border-bottom: 1px solid #ececec;
                    padding-bottom: 8px;
                    margin-bottom: 12px;
                }
                .pdf-bar-item {
                    margin-bottom: 9px;
                }
                .pdf-bar-item:last-child {
                    margin-bottom: 0;
                }
                .pdf-bar-head {
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    margin-bottom: 4px;
                    color: #374151;
                }
                .pdf-bar-head strong {
                    color: #111827;
                }
                .pdf-bar-track {
                    width: 100%;
                    height: 8px;
                    background: #f3f4f6;
                    border-radius: 999px;
                    overflow: hidden;
                }
                .pdf-bar-fill {
                    height: 100%;
                    border-radius: 999px;
                }
                .pdf-info-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .pdf-info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                    padding-bottom: 6px;
                    border-bottom: 1px dashed #e5e7eb;
                    font-size: 10px;
                }
                .pdf-info-row:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }
                .pdf-info-key {
                    color: #6b7280;
                    font-weight: 600;
                }
                .pdf-info-val {
                    color: #111827;
                    font-weight: 600;
                    text-align: right;
                }
                .pdf-section-title {
                    font-size: 12px;
                    font-weight: 700;
                    color: #141414;
                    border-left: 4px solid #c9a050;
                    padding-left: 10px;
                    margin: 6px 0 10px 0;
                }
                .gerobras-pdf table.pdf-table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    margin-top: 0 !important;
                    background: #ffffff !important;
                }
                .gerobras-pdf table.pdf-table thead {
                    background: #1a1a1a !important;
                }
                .gerobras-pdf table.pdf-table th {
                    background: #1a1a1a !important;
                    color: #e5c170 !important;
                    font-size: 9.5px !important;
                    font-weight: 700 !important;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    padding: 9px 10px !important;
                    border-bottom: 2px solid #c9a050 !important;
                    text-align: left;
                }
                .gerobras-pdf table.pdf-table td {
                    padding: 8px 10px !important;
                    color: #374151 !important;
                    font-size: 10px !important;
                    border-bottom: 1px solid #e5e7eb !important;
                    vertical-align: middle;
                }
                .gerobras-pdf table.pdf-table tbody tr {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .gerobras-pdf table.pdf-table tbody tr:nth-child(even) {
                    background: #f9fafb !important;
                }
                .pdf-td-bold {
                    font-weight: 600;
                    color: #111827 !important;
                }
                .pdf-td-num {
                    font-weight: 600;
                    color: #111827 !important;
                    white-space: nowrap;
                }
                .pdf-td-center {
                    text-align: center;
                    font-weight: 700;
                }
                .pdf-empty {
                    text-align: center;
                    padding: 18px !important;
                    color: #6b7280 !important;
                }
                .pdf-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 999px;
                    font-size: 9px;
                    font-weight: 700;
                    white-space: nowrap;
                }
                .pdf-footer {
                    margin-top: 18px;
                    padding-top: 10px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    font-size: 9px;
                    color: #6b7280;
                }
            </style>

            <div class="pdf-header">
                <div>
                    <div class="pdf-brand-eyebrow">Relatório Gerencial de Obras</div>
                    <div class="pdf-brand-title">GerObras</div>
                    <div class="pdf-brand-sub">
                        Escopo: ${obraAtual ? escapeHtml(obraAtual.nome) : "Consolidado Geral (Todas as Obras)"}
                    </div>
                </div>
                <div class="pdf-meta">
                    <div><strong>Emitido em:</strong> ${dataEmissao} às ${horaEmissao}</div>
                    <div><strong>Responsável:</strong> ${nomeUsuario} (${cargoUsuario})</div>
                    <div><strong>Sistema:</strong> GerObras MVP • PWA Offline-First</div>
                </div>
            </div>

            <div class="pdf-kpi-row">${kpisHtml}</div>
            <div class="pdf-charts-row">${blocoEsquerdoHtml}${blocoDireitoHtml}</div>
            ${tabelaHtml}

            <div class="pdf-footer">
                <span>GerObras — Sistema Híbrido de Gestão de Obras</span>
                <span>Documento gerado automaticamente em ${dataEmissao} às ${horaEmissao}</span>
            </div>
        </div>
    `;
}

function criarCardKPI(valor, label, isMoney = false) {
    return `
        <div class="pdf-kpi">
            <div class="pdf-kpi-val ${isMoney ? "money" : ""}">${valor}</div>
            <div class="pdf-kpi-label">${label}</div>
        </div>
    `;
}

function gerarBarrasHorizontaisPDF(dados, total) {
    const coresHex = {
        planejamento: "#f59e0b",
        pendente: "#f59e0b",
        em_andamento: "#2563eb",
        pausada: "#6b7280",
        concluida: "#16a34a",
        cancelada: "#dc2626"
    };

    const labels = {
        planejamento: "Planejamento",
        pendente: "Pendente",
        em_andamento: "Em Andamento",
        pausada: "Pausada",
        concluida: "Concluída",
        cancelada: "Cancelada"
    };

    return Object.entries(dados).map(([status, valor]) => {
        const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
        return `
            <div class="pdf-bar-item">
                <div class="pdf-bar-head">
                    <span>${labels[status] || status}</span>
                    <strong>${valor} (${pct}%)</strong>
                </div>
                <div class="pdf-bar-track">
                    <div class="pdf-bar-fill" style="width:${pct}%;background:${coresHex[status] || "#6b7280"}"></div>
                </div>
            </div>
        `;
    }).join("");
}

function badgeStatusPDF(status) {
    const estilos = {
        planejamento: { bg: "#fef3c7", fg: "#92400e", label: "Planejamento" },
        pendente:     { bg: "#fef3c7", fg: "#92400e", label: "Pendente" },
        em_andamento: { bg: "#dbeafe", fg: "#1e40af", label: "Em Andamento" },
        pausada:      { bg: "#f3f4f6", fg: "#374151", label: "Pausada" },
        concluida:    { bg: "#dcfce7", fg: "#166534", label: "Concluída" },
        cancelada:    { bg: "#fee2e2", fg: "#991b1b", label: "Cancelada" }
    };
    const cfg = estilos[status] || { bg: "#f3f4f6", fg: "#374151", label: status || "—" };
    return `<span class="pdf-badge" style="background:${cfg.bg};color:${cfg.fg}">${cfg.label}</span>`;
}

function badgePrioridadePDF(prioridade) {
    const estilos = {
        urgente: { bg: "#fee2e2", fg: "#991b1b", label: "Urgente" },
        alta:    { bg: "#ffedd5", fg: "#9a3412", label: "Alta" },
        media:   { bg: "#fef3c7", fg: "#92400e", label: "Média" },
        baixa:   { bg: "#dcfce7", fg: "#166534", label: "Baixa" }
    };
    const cfg = estilos[prioridade] || { bg: "#f3f4f6", fg: "#374151", label: capitalizar(prioridade) };
    return `<span class="pdf-badge" style="background:${cfg.bg};color:${cfg.fg}">${cfg.label}</span>`;
}

// ==========================
// CARREGAR RELATÓRIOS (TELA)
// ==========================
async function carregarRelatorios() {
    try {
        const obrasRes = await ObrasAPI.listar();
        const tarefasRes = await TarefasAPI.listar();

        if (!obrasRes.sucesso || !tarefasRes.sucesso) {
            console.error("Erro ao carregar dados");
            return;
        }

        const obras = Array.isArray(obrasRes.dados) ? obrasRes.dados : [];
        const tarefas = Array.isArray(tarefasRes.dados) ? tarefasRes.dados : [];

        cacheObras = obras;
        cacheTarefas = tarefas;

        preencherFiltro(obras);

        const obraSelecionada = document.getElementById("filtro-obra").value;

        atualizarKPIs(obras, tarefas);

        renderGraficoObras(obras);
        renderGraficoTarefas(tarefas);

        if (obraSelecionada) {
            renderTabelaObra(Number(obraSelecionada), tarefas);
        }

    } catch (err) {
        console.error("Erro:", err);
    }
}

// ==========================
// FILTRO
// ==========================
function preencherFiltro(obras) {
    const select = document.getElementById("filtro-obra");

    if (select.options.length > 1) return;

    obras.forEach(obra => {
        const option = document.createElement("option");
        option.value = obra.id;
        option.textContent = obra.nome;
        select.appendChild(option);
    });
}

// ==========================
// KPI
// ==========================
function atualizarKPIs(obras, tarefas) {
    document.getElementById("kpi-total-obras").textContent = obras.length;

    document.getElementById("kpi-andamento").textContent =
        obras.filter(o => o.status === "em_andamento").length;

    document.getElementById("kpi-concluidas").textContent =
        obras.filter(o => o.status === "concluida").length;

    document.getElementById("kpi-total-tarefas").textContent =
        tarefas.length;
}

// ==========================
// GRÁFICO OBRAS
// ==========================
function renderGraficoObras(obras) {
    const area = document.getElementById("grafico-obras");

    const contagem = {
        planejamento: 0,
        em_andamento: 0,
        pausada: 0,
        concluida: 0,
        cancelada: 0
    };

    obras.forEach(o => {
        if (contagem[o.status] !== undefined) {
            contagem[o.status]++;
        }
    });

    area.innerHTML = gerarBarras(contagem);
}

// ==========================
// GRÁFICO TAREFAS
// ==========================
function renderGraficoTarefas(tarefas) {
    const area = document.getElementById("grafico-tarefas");

    const contagem = {
        pendente: 0,
        em_andamento: 0,
        concluida: 0,
        cancelada: 0
    };

    tarefas.forEach(t => {
        if (contagem[t.status] !== undefined) {
            contagem[t.status]++;
        }
    });

    area.innerHTML = gerarBarras(contagem);
}

// ==========================
// GERAR BARRAS (TELA)
// ==========================
function gerarBarras(dados) {
    const max = Math.max(...Object.values(dados), 1);

    const cores = {
        planejamento: "laranja",
        em_andamento: "azul",
        pausada: "cinza",
        concluida: "verde",
        cancelada: "vermelho",
        pendente: "laranja"
    };

    const labels = {
        planejamento: "Planejamento",
        em_andamento: "Andamento",
        pausada: "Pausada",
        concluida: "Concluída",
        cancelada: "Cancelada",
        pendente: "Pendente"
    };

    return Object.entries(dados).map(([status, valor]) => `
        <div class="barra-grupo">
            <div class="barra ${cores[status] || "cinza"}"
                 style="height:${(valor / max) * 180}px"></div>
            <div class="barra-valor">${valor}</div>
            <div class="barra-label">${labels[status] || status}</div>
        </div>
    `).join("");
}

// ==========================
// TABELA POR OBRA (TELA)
// ==========================
function renderTabelaObra(obraId, tarefas) {
    const tbody = document.getElementById("tabela-tarefas-body");

    const tarefasObra = tarefas.filter(t => t.obra?.id === obraId);

    tbody.innerHTML = "";

    tarefasObra.forEach(t => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHtml(t.titulo)}</td>
            <td>${formatStatus(t.status)}</td>
            <td>${capitalizar(t.prioridade)}</td>
            <td>${escapeHtml(t.responsavel || "—")}</td>
            <td>${formatarData(t.prazo)}</td>
        `;

        tbody.appendChild(tr);
    });

    if (tarefasObra.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;padding:20px">
                    Nenhuma tarefa encontrada
                </td>
            </tr>
        `;
    }
}

// ==========================
// FORMATOS E UTILITÁRIOS
// ==========================
function formatStatus(status) {
    const map = {
        planejamento: "Planejamento",
        pendente: "Pendente",
        em_andamento: "Em andamento",
        pausada: "Pausada",
        concluida: "Concluída",
        cancelada: "Cancelada"
    };

    return map[status] || status || "—";
}

function formatCargo(cargo) {
    const map = {
        admin: "Administrador",
        engenheiro: "Engenheiro Civil",
        mestre_de_obras: "Mestre de Obras",
        operario: "Operário"
    };
    return map[cargo] || cargo || "Usuário";
}

function formatarData(data) {
    if (!data) return "—";
    const texto = String(data).split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        const [ano, mes, dia] = texto.split("-");
        return `${dia}/${mes}/${ano}`;
    }
    const parsed = new Date(data);
    return Number.isNaN(parsed.getTime()) ? String(data) : parsed.toLocaleDateString("pt-BR");
}

function formatarMoedaSegura(valor) {
    const numero = Number(valor) || 0;
    return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function capitalizar(texto) {
    if (!texto) return "—";
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function escapeHtml(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function slugificar(texto) {
    return String(texto || "obra")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
}
