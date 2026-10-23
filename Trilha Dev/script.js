/* =========================================================
   Trilha Dev — script.js
   Toda a lógica da aplicação: dados, telas, formulário,
   histórico e geração do prompt para a IA.
   ========================================================= */

/* ---------- 1. Constantes ---------- */

// Chaves usadas para salvar os dados no LocalStorage
const CHAVE_RESUMOS = 'trilhaDev.resumos';
const CHAVE_INTEGRANTES = 'trilhaDev.integrantes';

const TEXTO_NAO_INFORMADO = 'Não informado.';
const MARCADOR_RESUMO = '[INSERIR AQUI O RESUMO DO DESENVOLVEDOR]';

// Instruções fixas do prompt. O marcador da última linha é trocado pelo resumo.
const INSTRUCOES_PROMPT = `Você é um instrutor de programação responsável por avaliar os conhecimentos de um desenvolvedor em fase de aprendizagem.
Utilize exclusivamente o conteúdo do resumo apresentado para elaborar uma avaliação de conhecimentos.
Regras da avaliação:

1. Crie exatamente 10 questões de múltipla escolha.
2. Cada questão deve apresentar quatro alternativas: A, B, C e D.
3. Apenas uma alternativa deve estar correta em cada questão.
4. Distribua as perguntas entre os principais assuntos abordados no resumo.
5. Priorize a compreensão dos conceitos, a interpretação de código quando houver código no resumo e a aplicação prática do conhecimento.
6. Não cobre conteúdos que não estejam presentes no resumo.
7. Não invente informações nem crie perguntas que dependam de conhecimentos externos ao material fornecido.
8. Utilize uma dificuldade progressiva, começando por questões mais simples e avançando para questões que exijam maior raciocínio.
9. Não revele as respostas corretas nem inclua dicas que entreguem a solução antes de o aluno responder.
10. Apresente as questões numeradas de 1 a 10, com alternativas bem organizadas.
11. Ao final, solicite que o aluno envie as respostas no formato '1-A, 2-C, 3-B...'.
12. Depois que o aluno responder, corrija a avaliação, apresente a pontuação de 0 a 10 e explique os erros, priorizando as questões respondidas incorretamente.
13. Se o resumo for insuficiente para elaborar 10 questões válidas, informe quais informações estão faltando, em vez de inventar conteúdo.

Utilize o seguinte resumo como base para a avaliação:
[INSERIR AQUI O RESUMO DO DESENVOLVEDOR]`;

// Lista dos campos do formulário. Usada para ler, preencher e validar.
const CAMPOS_FORMULARIO = [
  { chave: 'desenvolvedor', idElemento: 'campo-desenvolvedor', rotulo: 'Nome do desenvolvedor', obrigatorio: true },
  { chave: 'data', idElemento: 'campo-data', rotulo: 'Data do estudo', obrigatorio: true },
  { chave: 'tema', idElemento: 'campo-tema', rotulo: 'Tema principal estudado', obrigatorio: true },
  { chave: 'conteudos', idElemento: 'campo-conteudos', rotulo: 'Conteúdos abordados', obrigatorio: true },
  { chave: 'aprendizado', idElemento: 'campo-aprendizado', rotulo: 'O que aprendi hoje?', obrigatorio: true },
  { chave: 'conceitos', idElemento: 'campo-conceitos', rotulo: 'Conceitos e definições importantes', obrigatorio: false },
  { chave: 'exemplos', idElemento: 'campo-exemplos', rotulo: 'Exemplos ou aplicações práticas', obrigatorio: false },
  { chave: 'dificuldades', idElemento: 'campo-dificuldades', rotulo: 'Dificuldades ou dúvidas encontradas', obrigatorio: false },
  { chave: 'proximosPassos', idElemento: 'campo-proximos-passos', rotulo: 'O que pretendo estudar no próximo dia?', obrigatorio: false },
];

/* ---------- 2. Estado da aplicação ---------- */

let resumos = [];
let integrantes = [];
let idResumoAberto = null;
let idResumoParaExcluir = null;
let temporizadorMensagem = null;
let temporizadorBotaoCopiar = null;

/* ---------- 3. Elementos da página ---------- */

const elementos = {
  mensagem: document.getElementById('mensagem'),
  telas: document.querySelectorAll('.tela'),
  botoesNavegacao: document.querySelectorAll('[data-tela]'),
  botaoNovoResumo: document.getElementById('botao-novo-resumo'),

  contadorResumos: document.getElementById('contador-resumos'),
  contadorRotulo: document.getElementById('contador-rotulo'),
  filtroDesenvolvedor: document.getElementById('filtro-desenvolvedor'),
  filtroData: document.getElementById('filtro-data'),
  filtroTema: document.getElementById('filtro-tema'),
  botaoLimparFiltros: document.getElementById('botao-limpar-filtros'),
  listaResumos: document.getElementById('lista-resumos'),
  listaVazia: document.getElementById('lista-vazia'),

  tituloFormulario: document.getElementById('titulo-formulario'),
  formularioResumo: document.getElementById('formulario-resumo'),
  campoResumoId: document.getElementById('resumo-id'),
  campoDesenvolvedor: document.getElementById('campo-desenvolvedor'),
  campoData: document.getElementById('campo-data'),
  botaoCancelarFormulario: document.getElementById('botao-cancelar-formulario'),

  detalheResumo: document.getElementById('detalhe-resumo'),
  botaoVoltarLista: document.getElementById('botao-voltar-lista'),
  botaoGerarProva: document.getElementById('botao-gerar-prova'),
  botaoEditarDetalhe: document.getElementById('botao-editar-detalhe'),
  botaoExcluirDetalhe: document.getElementById('botao-excluir-detalhe'),
  painelPrompt: document.getElementById('painel-prompt'),
  tituloPrompt: document.getElementById('titulo-prompt'),
  campoPrompt: document.getElementById('campo-prompt'),
  botaoCopiarPrompt: document.getElementById('botao-copiar-prompt'),
  feedbackCopia: document.getElementById('feedback-copia'),

  formularioIntegrantes: document.getElementById('formulario-integrantes'),
  camposIntegrantes: document.querySelectorAll('.campo-integrante'),
  erroIntegrantes: document.getElementById('erro-integrantes'),

  dialogoExclusao: document.getElementById('dialogo-exclusao'),
  textoConfirmacao: document.getElementById('texto-confirmacao'),
  botaoCancelarExclusao: document.getElementById('botao-cancelar-exclusao'),
  botaoConfirmarExclusao: document.getElementById('botao-confirmar-exclusao'),
};

/* ---------- 4. LocalStorage (com tratamento de erros) ---------- */

function lerDoArmazenamento(chave, valorPadrao) {
  try {
    const textoSalvo = localStorage.getItem(chave);
    if (textoSalvo === null) {
      return valorPadrao;
    }
    const dados = JSON.parse(textoSalvo);
    return Array.isArray(dados) ? dados : valorPadrao;
  } catch (erro) {
    console.error('Erro ao ler o LocalStorage:', erro);
    mostrarMensagem('Não foi possível ler os dados salvos neste navegador.', 'erro');
    return valorPadrao;
  }
}

function salvarNoArmazenamento(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (erro) {
    console.error('Erro ao salvar no LocalStorage:', erro);
    mostrarMensagem(
      'Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado (por exemplo, em janela anônima).',
      'erro'
    );
    return false;
  }
}

function carregarResumos() {
  resumos = lerDoArmazenamento(CHAVE_RESUMOS, []).filter(
    (resumo) => resumo && typeof resumo === 'object' && resumo.id
  );
}

function carregarIntegrantes() {
  integrantes = lerDoArmazenamento(CHAVE_INTEGRANTES, []).filter(
    (nome) => typeof nome === 'string' && nome.trim() !== ''
  );
}

/* ---------- 5. Funções utilitárias ---------- */

function gerarId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Evita que textos digitados sejam interpretados como HTML
function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Converte "2026-10-23" em "23/10/2026"
function formatarData(dataIso) {
  if (!dataIso) {
    return TEXTO_NAO_INFORMADO;
  }
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function obterDataDeHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Deixa o texto em minúsculas e sem acentos, para facilitar a pesquisa
function normalizarTexto(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function valorOuNaoInformado(valor) {
  return valor && String(valor).trim() !== '' ? String(valor) : TEXTO_NAO_INFORMADO;
}

function buscarResumoPorId(id) {
  return resumos.find((resumo) => resumo.id === id);
}

function criarOpcao(valor, texto) {
  const opcao = document.createElement('option');
  opcao.value = valor;
  opcao.textContent = texto;
  return opcao;
}

/* ---------- 6. Mensagens e navegação ---------- */

function mostrarMensagem(texto, tipo = 'sucesso') {
  const caixa = elementos.mensagem;
  caixa.textContent = texto;
  caixa.className = `mensagem mensagem-${tipo}`;
  caixa.hidden = false;

  clearTimeout(temporizadorMensagem);
  temporizadorMensagem = setTimeout(() => {
    caixa.hidden = true;
  }, tipo === 'erro' ? 8000 : 5000);
}

function mostrarTela(idTela) {
  elementos.telas.forEach((tela) => {
    tela.hidden = tela.id !== idTela;
  });

  elementos.botoesNavegacao.forEach((botao) => {
    if (botao.dataset.tela === idTela) {
      botao.setAttribute('aria-current', 'page');
    } else {
      botao.removeAttribute('aria-current');
    }
  });

  window.scrollTo(0, 0);
}

/* ---------- 7. Integrantes ---------- */

function preencherFormularioIntegrantes() {
  elementos.camposIntegrantes.forEach((campo, indice) => {
    campo.value = integrantes[indice] || '';
  });
  elementos.erroIntegrantes.textContent = '';
}

function salvarIntegrantes(evento) {
  evento.preventDefault();
  elementos.erroIntegrantes.textContent = '';

  const nomes = Array.from(elementos.camposIntegrantes)
    .map((campo) => campo.value.trim())
    .filter((nome) => nome !== '');

  if (nomes.length === 0) {
    elementos.erroIntegrantes.textContent = 'Cadastre pelo menos um integrante.';
    elementos.camposIntegrantes[0].focus();
    return;
  }

  const nomesNormalizados = nomes.map(normalizarTexto);
  const existeNomeRepetido = nomesNormalizados.some(
    (nome, indice) => nomesNormalizados.indexOf(nome) !== indice
  );
  if (existeNomeRepetido) {
    elementos.erroIntegrantes.textContent = 'Há nomes repetidos. Cada integrante deve ter um nome diferente.';
    return;
  }

  if (!salvarNoArmazenamento(CHAVE_INTEGRANTES, nomes)) {
    return;
  }

  integrantes = nomes;
  atualizarTelaDeLista();
  mostrarTela('tela-lista');
  mostrarMensagem('Integrantes salvos com sucesso.');
}

/* ---------- 8. Formulário de resumo ---------- */

function preencherSelectDoFormulario(nomeSelecionado) {
  const select = elementos.campoDesenvolvedor;
  select.innerHTML = '';
  select.appendChild(criarOpcao('', 'Selecione...'));

  const nomes = [...integrantes];
  // Mantém o nome de um resumo antigo mesmo que o integrante tenha sido removido
  if (nomeSelecionado && !nomes.includes(nomeSelecionado)) {
    nomes.push(nomeSelecionado);
  }

  nomes.forEach((nome) => select.appendChild(criarOpcao(nome, nome)));
  select.value = nomeSelecionado || '';
}

function abrirFormulario(resumo = null) {
  if (!resumo && integrantes.length === 0) {
    preencherFormularioIntegrantes();
    mostrarTela('tela-integrantes');
    mostrarMensagem('Antes de criar um resumo, cadastre os integrantes do grupo.', 'aviso');
    return;
  }

  elementos.formularioResumo.reset();
  limparErrosDoFormulario();
  preencherSelectDoFormulario(resumo ? resumo.desenvolvedor : '');

  if (resumo) {
    elementos.tituloFormulario.textContent = 'Editar resumo';
    elementos.campoResumoId.value = resumo.id;
    CAMPOS_FORMULARIO.forEach((campo) => {
      document.getElementById(campo.idElemento).value = resumo[campo.chave] || '';
    });
  } else {
    elementos.tituloFormulario.textContent = 'Novo resumo';
    elementos.campoResumoId.value = '';
    elementos.campoData.value = obterDataDeHoje();
  }

  mostrarTela('tela-formulario');
  elementos.campoDesenvolvedor.focus();
}

function coletarDadosDoFormulario() {
  const dados = {};
  CAMPOS_FORMULARIO.forEach((campo) => {
    dados[campo.chave] = document.getElementById(campo.idElemento).value.trim();
  });
  return dados;
}

function marcarCampoComErro(elemento, texto) {
  const containerDoCampo = elemento.closest('.campo');
  containerDoCampo.classList.add('campo-invalido');
  elemento.setAttribute('aria-invalid', 'true');
  containerDoCampo.querySelector('.erro-campo').textContent = texto;
}

function limparErrosDoFormulario() {
  const formulario = elementos.formularioResumo;
  formulario.querySelectorAll('.campo-invalido').forEach((campo) => campo.classList.remove('campo-invalido'));
  formulario.querySelectorAll('[aria-invalid]').forEach((campo) => campo.removeAttribute('aria-invalid'));
  formulario.querySelectorAll('.erro-campo').forEach((erro) => {
    erro.textContent = '';
  });
}

function validarFormulario(dados) {
  limparErrosDoFormulario();
  let primeiroCampoInvalido = null;

  CAMPOS_FORMULARIO.forEach((campo) => {
    if (campo.obrigatorio && dados[campo.chave] === '') {
      const elemento = document.getElementById(campo.idElemento);
      marcarCampoComErro(elemento, `Preencha o campo "${campo.rotulo}".`);
      if (!primeiroCampoInvalido) {
        primeiroCampoInvalido = elemento;
      }
    }
  });

  if (primeiroCampoInvalido) {
    primeiroCampoInvalido.focus();
    mostrarMensagem('Existem campos obrigatórios sem preenchimento.', 'erro');
    return false;
  }
  return true;
}

function salvarResumo(evento) {
  evento.preventDefault();

  const dados = coletarDadosDoFormulario();
  if (!validarFormulario(dados)) {
    return;
  }

  const idEmEdicao = elementos.campoResumoId.value;
  const agora = new Date().toISOString();
  let novaListaDeResumos;
  let idSalvo;

  if (idEmEdicao) {
    // Edição: substitui o registro existente, sem criar outro
    const resumoOriginal = buscarResumoPorId(idEmEdicao);
    if (!resumoOriginal) {
      mostrarMensagem('Este resumo não foi encontrado. Ele pode ter sido excluído.', 'erro');
      return;
    }
    novaListaDeResumos = resumos.map((resumo) =>
      resumo.id === idEmEdicao ? { ...resumoOriginal, ...dados, atualizadoEm: agora } : resumo
    );
    idSalvo = idEmEdicao;
  } else {
    // Cadastro novo: cria um identificador único
    idSalvo = gerarId();
    novaListaDeResumos = [...resumos, { id: idSalvo, ...dados, criadoEm: agora, atualizadoEm: agora }];
  }

  if (!salvarNoArmazenamento(CHAVE_RESUMOS, novaListaDeResumos)) {
    return;
  }

  resumos = novaListaDeResumos;
  atualizarTelaDeLista();
  abrirDetalhe(idSalvo);
  mostrarMensagem(
    idEmEdicao
      ? 'Resumo atualizado com sucesso.'
      : 'Resumo salvo com sucesso. Agora você já pode gerar a prova com IA.'
  );
}

// Abre a janela de confirmação. A exclusão só acontece em confirmarExclusao().
function excluirResumo(id) {
  const resumo = buscarResumoPorId(id);
  if (!resumo) {
    return;
  }

  idResumoParaExcluir = id;
  elementos.textoConfirmacao.textContent =
    `Deseja excluir o resumo "${resumo.tema}" de ${resumo.desenvolvedor} (${formatarData(resumo.data)})? ` +
    'Esta ação não pode ser desfeita.';
  elementos.dialogoExclusao.showModal();
  elementos.botaoCancelarExclusao.focus();
}

function cancelarExclusao() {
  idResumoParaExcluir = null;
  elementos.dialogoExclusao.close();
}

function confirmarExclusao() {
  const id = idResumoParaExcluir;
  elementos.dialogoExclusao.close();
  idResumoParaExcluir = null;

  const novaListaDeResumos = resumos.filter((item) => item.id !== id);
  if (!salvarNoArmazenamento(CHAVE_RESUMOS, novaListaDeResumos)) {
    return;
  }

  resumos = novaListaDeResumos;
  idResumoAberto = null;
  atualizarTelaDeLista();
  mostrarTela('tela-lista');
  mostrarMensagem('Resumo excluído.');
}

/* ---------- 9. Lista, filtros e contador ---------- */

function atualizarFiltroDeDesenvolvedor() {
  const select = elementos.filtroDesenvolvedor;
  const valorAtual = select.value;

  const nomesDosResumos = resumos.map((resumo) => resumo.desenvolvedor);
  const todosOsNomes = [...new Set([...integrantes, ...nomesDosResumos])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  select.innerHTML = '';
  select.appendChild(criarOpcao('', 'Todos'));
  todosOsNomes.forEach((nome) => select.appendChild(criarOpcao(nome, nome)));
  select.value = todosOsNomes.includes(valorAtual) ? valorAtual : '';
}

function ordenarPorDataMaisRecente(a, b) {
  if (a.data !== b.data) {
    return a.data < b.data ? 1 : -1;
  }
  return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
}

function filtrarResumos() {
  const desenvolvedor = elementos.filtroDesenvolvedor.value;
  const data = elementos.filtroData.value;
  const termoPesquisado = normalizarTexto(elementos.filtroTema.value.trim());

  return resumos
    .filter((resumo) => !desenvolvedor || resumo.desenvolvedor === desenvolvedor)
    .filter((resumo) => !data || resumo.data === data)
    .filter((resumo) => !termoPesquisado || normalizarTexto(resumo.tema).includes(termoPesquisado))
    .sort(ordenarPorDataMaisRecente);
}

function atualizarContador() {
  const total = resumos.length;
  elementos.contadorResumos.textContent = total;
  elementos.contadorRotulo.textContent = total === 1 ? 'resumo registrado' : 'resumos registrados';
}

function criarHtmlDoCartao(resumo) {
  const conteudos = String(resumo.conteudos || '');
  const previa = conteudos.length > 160 ? conteudos.slice(0, 160).trim() + '…' : conteudos;
  const id = escaparHtml(resumo.id);
  const tema = escaparHtml(resumo.tema);

  return `
    <li class="cartao cartao-resumo">
      <h3>${tema}</h3>
      <p class="meta">${escaparHtml(resumo.desenvolvedor)} · ${formatarData(resumo.data)}</p>
      <p class="previa">${escaparHtml(previa)}</p>
      <div class="acoes">
        <button type="button" class="botao botao-primario botao-pequeno" data-acao="abrir" data-id="${id}" aria-label="Abrir resumo: ${tema}">Abrir</button>
        <button type="button" class="botao botao-secundario botao-pequeno" data-acao="editar" data-id="${id}" aria-label="Editar resumo: ${tema}">Editar</button>
        <button type="button" class="botao botao-perigo botao-pequeno" data-acao="excluir" data-id="${id}" aria-label="Excluir resumo: ${tema}">Excluir</button>
      </div>
    </li>`;
}

function renderizarLista() {
  const resumosFiltrados = filtrarResumos();
  elementos.listaResumos.innerHTML = resumosFiltrados.map(criarHtmlDoCartao).join('');

  if (resumos.length === 0) {
    elementos.listaVazia.textContent =
      'Nenhum resumo cadastrado ainda. Clique em "+ Novo resumo" para registrar seu primeiro dia de estudo.';
    elementos.listaVazia.hidden = false;
  } else if (resumosFiltrados.length === 0) {
    elementos.listaVazia.textContent = 'Nenhum resumo encontrado com os filtros selecionados.';
    elementos.listaVazia.hidden = false;
  } else {
    elementos.listaVazia.hidden = true;
  }
}

function atualizarTelaDeLista() {
  atualizarContador();
  atualizarFiltroDeDesenvolvedor();
  renderizarLista();
}

function limparFiltros() {
  elementos.filtroDesenvolvedor.value = '';
  elementos.filtroData.value = '';
  elementos.filtroTema.value = '';
  renderizarLista();
}

function tratarCliqueNaLista(evento) {
  const botao = evento.target.closest('button[data-acao]');
  if (!botao) {
    return;
  }

  const id = botao.dataset.id;
  const acao = botao.dataset.acao;

  if (acao === 'abrir') {
    abrirDetalhe(id);
  } else if (acao === 'editar') {
    const resumo = buscarResumoPorId(id);
    if (resumo) {
      abrirFormulario(resumo);
    }
  } else if (acao === 'excluir') {
    excluirResumo(id);
  }
}

/* ---------- 10. Padronização do resumo ---------- */

// Estrutura única usada tanto na tela quanto no texto do prompt
function montarSecoesDoResumo(resumo) {
  return [
    {
      titulo: 'Identificação do estudo',
      itens: [
        { rotulo: 'Desenvolvedor', valor: valorOuNaoInformado(resumo.desenvolvedor) },
        { rotulo: 'Data do estudo', valor: formatarData(resumo.data) },
        { rotulo: 'Tema principal', valor: valorOuNaoInformado(resumo.tema) },
      ],
    },
    {
      titulo: 'Conteúdos estudados',
      itens: [{ rotulo: 'Conteúdos abordados', valor: valorOuNaoInformado(resumo.conteudos) }],
    },
    {
      titulo: 'Conhecimentos adquiridos',
      itens: [
        { rotulo: 'O que aprendi hoje', valor: valorOuNaoInformado(resumo.aprendizado) },
        { rotulo: 'Conceitos e definições importantes', valor: valorOuNaoInformado(resumo.conceitos) },
      ],
    },
    {
      titulo: 'Aplicações práticas',
      itens: [{ rotulo: 'Exemplos ou aplicações práticas', valor: valorOuNaoInformado(resumo.exemplos) }],
    },
    {
      titulo: 'Dificuldades encontradas',
      itens: [{ rotulo: 'Dificuldades ou dúvidas', valor: valorOuNaoInformado(resumo.dificuldades) }],
    },
    {
      titulo: 'Próximos passos',
      itens: [{ rotulo: 'O que pretendo estudar no próximo dia', valor: valorOuNaoInformado(resumo.proximosPassos) }],
    },
  ];
}

function criarHtmlDoResumoPadronizado(resumo) {
  const htmlDasSecoes = montarSecoesDoResumo(resumo)
    .map((secao) => {
      const htmlDosItens = secao.itens
        .map((item) => {
          const classe = item.valor === TEXTO_NAO_INFORMADO ? ' class="nao-informado"' : '';
          return `<dt>${item.rotulo}</dt><dd${classe}>${escaparHtml(item.valor)}</dd>`;
        })
        .join('');

      return `
        <section class="secao-resumo">
          <h3>${secao.titulo}</h3>
          <dl>${htmlDosItens}</dl>
        </section>`;
    })
    .join('');

  return `
    <header class="resumo-cabecalho">
      <p class="meta">Resumo de estudo</p>
      <h2 id="titulo-detalhe">${escaparHtml(resumo.tema)}</h2>
      <p class="meta">${escaparHtml(resumo.desenvolvedor)} · ${formatarData(resumo.data)}</p>
    </header>
    ${htmlDasSecoes}`;
}

function formatarResumoComoTexto(resumo) {
  const linhas = ['RESUMO DE ESTUDO — TRILHA DEV'];

  montarSecoesDoResumo(resumo).forEach((secao, indice) => {
    linhas.push('', `${indice + 1}. ${secao.titulo.toUpperCase()}`);
    secao.itens.forEach((item) => {
      if (item.valor.includes('\n')) {
        linhas.push(`${item.rotulo}:`, item.valor);
      } else {
        linhas.push(`${item.rotulo}: ${item.valor}`);
      }
    });
  });

  return linhas.join('\n');
}

/* ---------- 11. Tela de detalhe e prompt ---------- */

function esconderPainelPrompt() {
  elementos.painelPrompt.hidden = true;
  elementos.campoPrompt.value = '';
  elementos.feedbackCopia.textContent = '';
  elementos.feedbackCopia.className = 'feedback-copia';
}

function abrirDetalhe(id) {
  const resumo = buscarResumoPorId(id);
  if (!resumo) {
    mostrarMensagem('Resumo não encontrado.', 'erro');
    mostrarTela('tela-lista');
    return;
  }

  idResumoAberto = id;
  elementos.detalheResumo.innerHTML = criarHtmlDoResumoPadronizado(resumo);
  esconderPainelPrompt();
  mostrarTela('tela-detalhe');
}

function gerarPrompt(resumo) {
  const textoDoResumo = formatarResumoComoTexto(resumo);
  // Usamos uma função no replace para que caracteres como "$" do resumo sejam mantidos
  return INSTRUCOES_PROMPT.replace(MARCADOR_RESUMO, () => textoDoResumo);
}

function mostrarPromptGerado() {
  const resumo = buscarResumoPorId(idResumoAberto);
  if (!resumo) {
    mostrarMensagem('Resumo não encontrado.', 'erro');
    return;
  }

  esconderPainelPrompt();
  elementos.campoPrompt.value = gerarPrompt(resumo);
  elementos.painelPrompt.hidden = false;
  elementos.painelPrompt.scrollIntoView({ block: 'start' });
  elementos.tituloPrompt.focus();
}

async function copiarParaAreaDeTransferencia(texto) {
  // 1ª tentativa: API moderna da área de transferência
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (erro) {
      console.warn('Clipboard API falhou, tentando método alternativo:', erro);
    }
  }

  // 2ª tentativa: método antigo, compatível com mais navegadores
  try {
    elementos.campoPrompt.select();
    return document.execCommand('copy');
  } catch (erro) {
    console.error('Não foi possível copiar:', erro);
    return false;
  }
}

async function copiarPrompt() {
  const texto = elementos.campoPrompt.value;
  if (!texto) {
    return;
  }

  const copiou = await copiarParaAreaDeTransferencia(texto);
  const feedback = elementos.feedbackCopia;

  if (copiou) {
    feedback.textContent = 'Prompt copiado! Agora é só colar na IA de sua preferência.';
    feedback.className = 'feedback-copia feedback-sucesso';
    elementos.botaoCopiarPrompt.textContent = 'Copiado ✓';
    clearTimeout(temporizadorBotaoCopiar);
    temporizadorBotaoCopiar = setTimeout(() => {
      elementos.botaoCopiarPrompt.textContent = 'Copiar prompt';
    }, 2500);
  } else {
    // Se falhar, deixa o texto selecionado para o usuário copiar manualmente
    elementos.campoPrompt.focus();
    elementos.campoPrompt.select();
    feedback.textContent =
      'Não foi possível copiar automaticamente. O texto já está selecionado: use Ctrl+C (ou Cmd+C no Mac).';
    feedback.className = 'feedback-copia feedback-erro';
  }
}

/* ---------- 12. Eventos e inicialização ---------- */

function registrarEventos() {
  elementos.botoesNavegacao.forEach((botao) => {
    botao.addEventListener('click', () => {
      if (botao.dataset.tela === 'tela-integrantes') {
        preencherFormularioIntegrantes();
      }
      mostrarTela(botao.dataset.tela);
    });
  });

  elementos.botaoNovoResumo.addEventListener('click', () => abrirFormulario());

  elementos.filtroDesenvolvedor.addEventListener('change', renderizarLista);
  elementos.filtroData.addEventListener('change', renderizarLista);
  elementos.filtroTema.addEventListener('input', renderizarLista);
  elementos.botaoLimparFiltros.addEventListener('click', limparFiltros);
  elementos.listaResumos.addEventListener('click', tratarCliqueNaLista);

  elementos.formularioResumo.addEventListener('submit', salvarResumo);
  elementos.botaoCancelarFormulario.addEventListener('click', () => mostrarTela('tela-lista'));

  elementos.botaoVoltarLista.addEventListener('click', () => mostrarTela('tela-lista'));
  elementos.botaoGerarProva.addEventListener('click', mostrarPromptGerado);
  elementos.botaoEditarDetalhe.addEventListener('click', () => {
    const resumo = buscarResumoPorId(idResumoAberto);
    if (resumo) {
      abrirFormulario(resumo);
    }
  });
  elementos.botaoExcluirDetalhe.addEventListener('click', () => excluirResumo(idResumoAberto));
  elementos.botaoCopiarPrompt.addEventListener('click', copiarPrompt);

  elementos.formularioIntegrantes.addEventListener('submit', salvarIntegrantes);

  elementos.botaoCancelarExclusao.addEventListener('click', cancelarExclusao);
  elementos.botaoConfirmarExclusao.addEventListener('click', confirmarExclusao);
  // A tecla Esc também fecha a janela; garantimos que nada fique marcado para exclusão
  elementos.dialogoExclusao.addEventListener('close', () => {
    idResumoParaExcluir = null;
  });
}

function iniciarAplicacao() {
  carregarIntegrantes();
  carregarResumos();
  registrarEventos();
  atualizarTelaDeLista();
  mostrarTela('tela-lista');

  if (integrantes.length === 0) {
    mostrarMensagem('Bem-vindo! Comece cadastrando os integrantes do grupo em "Integrantes".', 'aviso');
  }
}

iniciarAplicacao();
