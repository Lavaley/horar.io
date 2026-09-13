<div align="center">

# Horar.io

**Observe. Sinta. Confie na sua intuição.**

</div>

## Intuição e sorte

Horar.io é um jogo diário de adivinhação. Observe atentamente a fotografia, interprete os detalhes da cena e tente descobrir em que horário ela foi registrada.

Uma fotografia é disponibilizada por dia. O catálogo de 50 fotos reais se repete automaticamente ao terminar, mantendo o desafio diário sem necessidade de reposição manual. As fontes, licenças e horários registrados pelas câmeras estão no [catálogo de fotografias](photo-library/sky/CATALOGO.md).

<div align="center">
  <img src="docs/readme-assets/palpite-exato.gif" alt="Jogador ajustando o relógio e acertando exatamente o horário da fotografia" width="620">
</div>

## Sobre o projeto

Horar.io nasceu de uma ideia original e foi desenvolvido para proporcionar um momento simples e divertido ao longo do dia.

Observe, confie na sua intuição e tente alcançar a melhor colocação no ranking diário!

<div align="center">
  <img src="docs/readme-assets/sobre-o-projeto.png" alt="Visão geral do desafio diário do Horar.io" width="900">
</div>

## Características de jogabilidade

O jogador pode definir seu palpite utilizando um relógio analógico interativo, ajustando diretamente os ponteiros de horas e minutos.

<div align="center">
  <img src="docs/readme-assets/ajuste-ponteiros.gif" alt="Ajuste dos ponteiros do relógio analógico" width="620">
</div>

Para quem prefere maior precisão, também é possível informar o horário por meio dos controles numéricos.

<div align="center">
  <img src="docs/readme-assets/controles-numericos.png" alt="Controles numéricos de hora, minuto e período" width="440">
</div>

A seção **Como jogar**, acessível pelo botão **?** no canto superior direito da tela, apresenta um tutorial interativo sobre o funcionamento do relógio e explica as principais regras do jogo.

<div align="center">
  <img src="docs/readme-assets/como-jogar.gif" alt="Abertura do tutorial Como jogar" width="900">
</div>

## Visual

O site conta com quatro temas visuais inspirados nos diferentes períodos do dia: **Manhã**, **Tarde**, **Noite** e **Madrugada**. No modo **Interativo**, a aparência é alterada automaticamente de acordo com o horário real; também é possível manter qualquer um dos temas de forma permanente.

<div align="center">
  <img src="docs/readme-assets/temas.gif" alt="Alternância entre os quatro temas visuais do Horar.io" width="900">
</div>

A interface está disponível em **Português do Brasil (PT-BR)** e **Inglês (EN)**.

## Demais mecânicas

Após o envio do palpite, o horário exato da fotografia é revelado e a pontuação é calculada com base na diferença entre os dois horários. Um acerto exato vale **100 pontos**. A pontuação diminui gradualmente conforme a distância aumenta e chega a zero quando o palpite está a duas horas ou mais do horário correto. O cálculo sempre considera o menor intervalo dentro de um ciclo de 24 horas, inclusive quando a diferença atravessa a meia-noite.

<div align="center">
  <img src="docs/readme-assets/resultado-pontuacao.png" alt="Relógio de resultado com arco de precisão e pontuação" width="460">
</div>

O resultado também apresenta a colocação do jogador no ranking diário. Empates compartilham a mesma posição, e o ranking é atualizado ao longo do dia.

A interface informa quanto tempo falta para a próxima fotografia, liberada à meia-noite no horário de Brasília, e mantém uma sequência com o número de dias consecutivos em que o jogador participou do desafio.

## Programação

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111111)
![Convex](https://img.shields.io/badge/Convex-Backend-EE342F?logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

</div>

O Horar.io foi desenvolvido principalmente em **TypeScript**, utilizando **Next.js** e **React** na construção da interface. A apresentação visual combina **CSS** e **Tailwind CSS**, enquanto o **Convex** oferece a infraestrutura de backend, armazenamento e atualização dos dados em tempo real.

O projeto também utiliza **JavaScript** em ferramentas auxiliares, como o processo de preparação e importação das fotografias.

---

<div align="center">

Desenvolvido por **Lavaley**

</div>
