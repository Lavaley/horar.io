# Horar.io

Jogo diário de descobrir o horário de uma fotografia real. Next.js mantém a interface estática; Convex é o backend autoritativo. Sem conta de jogador, pistas ou ranking.

## Executar localmente

```sh
npm install
npm run backend
```

Na primeira execução, escolha desenvolvimento local sem conta (agentes também podem usar `CONVEX_AGENT_MODE=anonymous`). O Convex grava `.env.local` e mantém o banco em `.convex/`, ambos ignorados pelo Git. Mantenha esse processo aberto. Em outro terminal:

```sh
npm run photos:import
npm run dev
```

Abra http://localhost:3000. O importador começa na data atual de Brasília e agenda as oito fotografias originais, uma por dia. Datas existentes são preservadas; executar novamente não as sobrescreve. O primeiro acervo foi importado localmente e em produção para 05–12/09/2026. Não existe repetição automática nem horário inventado se o calendário ficar vazio: a interface informa a indisponibilidade.

## Acervo e administração

- `convex/schema.ts`: fotografia, horário em minutos (0–1439), data `YYYY-MM-DD`, imagem e créditos/descrições opcionais.
- `convex/admin.ts`: funções internas de upload e agendamento, acessíveis apenas ao administrador via CLI/dashboard Convex. A interface pública não oferece escrita no acervo.
- `photo-library/`: originais e catálogo administrativo, fora de `public/` e de qualquer importação da interface. Os horários foram preservados do jogo anterior; precisam ser conferidos com o autor para confirmar a hora de captura das fotos.
- `scripts/import-photos.mjs`: aplica orientação, limita a largura a 2400px e reencoda em JPEG sem EXIF/XMP/IPTC/GPS antes de enviar ao Convex File Storage.
- `convex/images.ts`: único ponto que resolve o provedor de imagem. O modelo também aceita URL HTTPS para uma migração futura; nesse caso, a imagem deve ter sido higienizada previamente.

Para incluir fotografias, crie um JSON administrativo fora de `public/`:

```json
[
  {
    "file": "minha-fotografia.jpg",
    "correctTime": "14:32",
    "challengeDate": "2026-09-13",
    "credit": "Nome do fotógrafo",
    "creditUrl": "https://example.com/autor",
    "alt": { "pt": "Descrição neutra da cena", "en": "Neutral description of the scene" }
  }
]
```

O caminho da foto é relativo ao JSON. `alt`, créditos, posição e data são opcionais; sem data, o importador usa dias consecutivos a partir da data inicial. Evite pistas de horário em textos, créditos, nomes e URLs.

```sh
npm run photos:import -- caminho/catalogo.json 2026-09-13
```

Uma data aceita apenas uma fotografia. O importador não altera um desafio publicado. Para manutenção do calendário futuro, use o dashboard do Convex com acesso de administrador; preserve datas únicas e não altere desafios já iniciados.

## Regras e segurança

`challenges.current` usa o relógio do servidor e devolve apenas imagem, data, créditos e próxima liberação. É uma mutation de leitura para evitar cache temporal de queries. A seleção é feita por data de Brasília, sem depender de um cron. Meia-noite corresponde a 03:00 UTC; Brasília não usa horário de verão desde 2019.

`challenges.submit` valida data, fotografia e palpite inteiro no backend. A pontuação original é mantida: distância circular de 24h; 100 pontos no acerto; queda linear arredondada até zero a 120 minutos. Só após o envio é devolvido o horário real, com diferença e pontuação.

O navegador grava um identificador aleatório e `horario.daily.YYYY-MM-DD` com palpite pendente, resultado e sequência. O Convex guarda recibos anônimos por identificador/data para que chamadas repetidas ou abas concorrentes devolvam o primeiro resultado. Um palpite pendente fica bloqueado e pode ser reenviado com o mesmo valor caso a resposta se perca. Não há listagem pública de recibos. Limpar os dados do navegador permite jogar novamente, como previsto no produto.

A sequência mede dias consecutivos com um palpite, independentemente dos pontos. Recarregar não incrementa a sequência; deixar de jogar um dia a interrompe. Idioma, tema e visita às regras também são persistidos localmente. O navegador precisa permitir localStorage para enviar palpites.

A página se atualiza na meia-noite anunciada pelo servidor, ao voltar à aba e ao recuperar a conexão. Há uma reconciliação a cada 30 segundos para fotos cadastradas com a página aberta. O tema Interativo verifica as mudanças a cada virada de minuto e ao retornar à aba, sem alterar temas manuais. As transições respeitam `prefers-reduced-motion`.

## Produção global

O projeto **horar-io** está conectado à equipe **gustavo-barbosa-152fb**.

- Produção: `https://polite-sardine-705.convex.cloud`
- Desenvolvimento em nuvem: `https://outstanding-skunk-805.convex.cloud`
- Site: https://horar-io.stable-squid-4933.chatgpt.site
- Calendário inicial de produção: 05–12/09/2026, com as oito fotografias originais higienizadas.

A prévia e o build foram configurados com a URL de produção. A configuração local anterior foi preservada em `.env.convex-local` (ignorada pelo Git). Os recibos de teste do banco local não foram migrados.

Para publicar atualizações ou configurar outra máquina:

1. Execute `npx convex login` e associe este projeto à sua conta.
2. Execute `npx convex deploy` para publicar schema e funções.
3. Importe o calendário no destino de produção com `npm run photos:import -- caminho/catalogo.json 2026-09-13 --prod`.
4. Configure `NEXT_PUBLIC_CONVEX_URL` com a URL de **produção**, execute `npm run build` e publique o diretório `out/` no Sites existente.

O deployment local e o de produção têm dados separados. Nunca publique um build que aponte para `127.0.0.1:3210`. Não exponha chaves de administração em variáveis `NEXT_PUBLIC_*`, no repositório ou no frontend. O único endereço público necessário ao jogo é a URL do Convex. O conteúdo de `photo-library/`, scripts, `.env.local` e `.convex/` não deve ser servido publicamente. Caso o repositório seja público, mantenha o catálogo futuro em armazenamento privado.

## Verificação

```sh
npm test
npm run lint
npm run build
```

Os testes cobrem a fórmula original, distância pela meia-noite, limites de horário, fuso/data, temas, sequência, projeção sem resposta, recibos, isolamento entre jogadores, rejeição de desafios fora do dia, calendário único e ausência de fotos. As funções são exercitadas com `convex-test`; a prévia também deve ser verificada contra o Convex local e em desktop/celular.

Referências: [Convex local](https://docs.convex.dev/cli/local-deployments), [armazenamento de imagens](https://docs.convex.dev/file-storage/upload-files), [funções internas](https://docs.convex.dev/functions/internal-functions).
