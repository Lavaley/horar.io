# Rotação permanente

50 fotos reais, selecionadas visualmente na Wikimedia Commons, com predominância do céu. O [catálogo](CATALOGO.md) registra fontes, créditos, licenças e horários. `catalog.json` guarda também o EXIF publicado pela fonte.

O horário de resposta é o campo `DateTimeOriginal` da câmera, truncado para hora e minuto. Não usamos data de upload nem inferimos o horário pela aparência da cena. O EXIF documenta o relógio da câmera; não certifica independentemente sua precisão nem o fuso horário. Fotos com inconsistências aparentes foram excluídas.

As cópias em `images/` foram redimensionadas para até 1600 pixels e convertidas em JPEG sem EXIF, GPS ou outros metadados. Cada foto conserva sua licença original, indicada no catálogo e no crédito do jogo. Os originais e seus metadados permanecem acessíveis nas páginas das fontes.

## Funcionamento

A rotação de produção começa em **2026-09-13**, à meia-noite de Brasília. A posição é o número de dias desde o início, módulo 50. Assim, a foto 50 aparece em **2026-11-01**, e a primeira volta em **2026-11-02**, repetindo indefinidamente. Não há cron, API externa de fotos ou novos agendamentos necessários a cada ciclo. A hospedagem e o armazenamento Convex precisam continuar ativos.

`photoRotations` guarda os 50 IDs em ordem. O backend usa a mesma seleção para mostrar a foto e validar o palpite. Palpites e rankings continuam separados pela data, inclusive quando a fotografia reaparece. Os desafios e resultados anteriores são preservados.

## Instalação em outro ambiente

1. Publique o schema e as funções Convex.
2. Importe: `node scripts/import-photos.mjs photo-library/sky/catalog.json YYYY-MM-DD` (acrescente `--prod` para produção).
3. Ative: `node scripts/activate-sky-rotation.mjs YYYY-MM-DD` (mesmo ambiente e data).

A ativação verifica os 50 registros, horários, créditos e arquivos antes de publicar o ciclo em uma única transação. Uma repetição idêntica é segura; substituir uma rotação ativa exige uma migração deliberada.

Os scripts `collect-sky-photos.mjs`, `prepare-sky-photos.mjs` e `catalog-sky-photos.mjs` registram a coleta e seleção inicial. Não são necessários para manter o site funcionando e uma nova busca pode retornar candidatos diferentes. Use o catálogo revisado e as cópias preservadas para reproduzir esta seleção.
