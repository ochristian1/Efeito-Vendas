# Efeito Vendas — guia do projeto

Sistema interno de agenda e vendas (calls, leads, clientes pagos, onboarding, comissões, metas).
Interface em português (pt-BR).

## Como o app funciona
- O app inteiro é **um arquivo só: `index.html`** (HTML + CSS + JS inline). Não há build nem dependências.
- Publicação: qualquer hospedagem estática serve (ex.: Netlify apontando para a raiz do repositório, sem comando de build).
- Os dados ficam em um banco **Supabase**, acessado direto pelo navegador. O endereço do projeto e a chave pública (anon) estão no começo do script, perto das linhas 1009–1011 (`SB_URL` / `SB_KEY`). As funções de acesso são `sbGet`, `sbUpsert` e `sbDelete`.
- Tabelas usadas: `avisos`, `calls`, `clientes`, `leads`, `metas`, `notas`, `pagos`, `propostas`, `usuarios`.
- Configurações guardadas na tabela `notas` com títulos especiais, por exemplo `__meta_mes_AAAA-MM__`, `__meta_sdr_<chave>__`, `__onb_inicio__`, `__onbhide_<id>__`.
- Para criar um sistema separado, com dados próprios: crie um projeto Supabase novo, recrie as tabelas acima e troque `SB_URL` e `SB_KEY` no `index.html`.

## Usuários e permissões
- Chaves fixas: `ADMIN` (vê tudo), `DONO` (Christian), `EDUARDA`, `PAULA` (histórico).
- Usuários criados pelo sistema ficam na tabela `usuarios` com id `USR_<número>` e um cargo (SDR, Closer...).
- Após o login, o nome fica em `sessionStorage` (`ev_user_nome`).
- `minhasChaves()` junta todas as chaves da mesma pessoa (ex.: a conta antiga fixa `EDUARDA` e a conta nova `USR_...` da Eduarda). `isMinhaChave()` usa essa lista para decidir o que cada pessoa vê. Se `usuariosCustom` ainda não carregou, o nome vem de `ev_user_nome`.
- `loadAll()` carrega `usuariosCustom` dentro do mesmo `Promise.all` dos demais dados. Mantenha assim: se a lista de usuários chegar depois, a comissão da Eduarda some do Painel ao vivo.
- `sincronizarSessao()` roda a cada 4s (e ao voltar para a aba): busca avisos novos e, para usuários da tabela `usuarios`, aplica na hora mudanças de permissões/nome/cargo e desconecta se o acesso foi desativado. Todos recebem avisos, menos o ADMIN (a permissão `aviso` é só para enviar).
- A Eduarda vê **todos** os clientes pagos. Outras SDRs/closers veem só os deles (filtro em `renderPagos()`).

## Comissões (quem fechou a venda)
- `<SDR> fechou` = 8%, `<SDR> - Recompra` = 4%, `DONO` ("Você fechou") = 2%.

## Planos (Clientes pagos)
- O objeto `PLANOS` guarda todos os planos. O cadastro e a edição usam só os sete atuais, nesta ordem:
  `MANUTENCAO_LOJA` (Manutenção semanal), `OTIMIZACAO_LOJA`, `GESTAO_ADS`, `CONSULTORIA`, `GESTAO_CONTAS`, `GESTAO_CONTABILIDADE`, `ACOMPANHAMENTO_INDIVIDUAL`.
- `E1` a `E5` continuam no `PLANOS` **só para clientes antigos** continuarem mostrando o plano que compraram. Não remova.
- O filtro por plano usa `PLANOS[pagoFiltro]`.
- O plano aparece como selo no card de Clientes pagos e ao lado do nome no Onboarding ("plano não informado" quando vazio), para a operação saber o que foi vendido.
- O Painel ao vivo tem o card "Planos mais vendidos" (ranking do mês por quantidade, com % e faturamento; vendas sem plano entram como "plano não informado"; `PLANO_EQUIV` soma planos antigos equivalentes, hoje E3 → Gestão de contas).
- Editar o plano: botão Editar em Clientes pagos, ou "✏️ editar" no Onboarding. Ambos usam `planoCardsEdit()` / `setPlanoEdit()` e gravam em `pagos.plano`.

## Como validar uma mudança
- Sintaxe do script: extrair o conteúdo das tags `<script>` do `index.html` para um arquivo `.js` e rodar `node --check` nele.
- Testes: `node test_regressao.js` (precisa do pacote `jsdom`: `npm i jsdom`). Ele navega por todas as abas e confere que não há erro.
- Depois de publicar, recarregar com Ctrl+F5 para não ver versão em cache.

## Convenções
- Mudanças pequenas e focadas; sem dependências novas.
- Não colocar chaves secretas no código. A chave `anon` do Supabase é pública por natureza, e o acesso deve ser protegido por regras (RLS) no próprio Supabase.
