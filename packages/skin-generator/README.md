# @globe-rtc/skin-generator

Monta skins (avatares em pixel art) empilhando as peças do pacote **Modern Interiors** (LimeZu), igual ao
"Character Generator 2.0": você escolhe ou sorteia corpo, olhos, roupa, cabelo e acessório e recebe o personagem
como PNG.

> As peças (a arte) **não ficam neste repositório**. Veja [Onde ficam as peças](#onde-ficam-as-pecas).

## Como usar

```ts
import { generateSkin } from "@globe-rtc/skin-generator";

// Sorteia só roupa e cabelo, mantendo o resto da skin atual, e devolve a spritesheet completa.
const skin = await generateSkin({
  parts: ["outfit", "hairstyle"], // o que sortear
  current: skinAtual, // o que manter (opcional)
  type: "adult", // ou "kid"
  animations: ["idle", "walk"], // folha só com essas animações (opcional)
});

skin.selection; // id de cada peça escolhida (é isto que vale a pena guardar)
skin.seed; // semente do sorteio
skin.preview; // PNG (Buffer) com as 4 poses paradas
skin.spritesheet; // PNG (Buffer) com as seis animações (ou as pedidas em `animations`)
skin.animationLayout; // como ler o spritesheet (tamanho do quadro, direções, linhas)
```

- `randomizeSkin(...)` só sorteia (devolve a `selection` e a `seed`).
- `renderSkin(selection, ...)` só desenha uma `selection` que você já tem.
- `generateSkin(...)` faz as duas coisas.
- Sem `current`, as partes que você não sorteia ficam na primeira peça (e sem acessório). Trocar o `type` sorteia tudo,
  porque adulto e criança não compartilham peças. Criança não tem acessório, e os pijamas (`..._pajama_...`) não usam cabelo.
- Mesma `seed` + mesmas opções = mesma skin. Para **guardar** a skin de alguém, guarde a `selection`, não a `seed`:
  a seed muda de resultado se o catálogo de peças mudar.
- `scale` (1 a 8) amplia só o `preview`, sem borrar os pixels. O `spritesheet` nunca é ampliado.
- `size`: `32` (padrão), `16` ou `48`. "32" é a variante 32x32 do pacote, em que cada quadro tem **32 x 64 px**.

A rota da API que usa este pacote é `GET /skin/generate` (em `apps/api`).

## O que é cada linha do spritesheet

A folha completa tem **56 colunas x 20 linhas** de quadros (1792 x 1280 px no tamanho 32). Cada quadro tem 32 x 64 px.
A linha `n` começa em `y = n * 64`, e o quadro da coluna `c` começa em `x = c * 32`.

| Linha | y (px) | O que é | Quadros do personagem |
|---|---|---|---|
| 0 | 0 | poses paradas | 4: direita, costas, esquerda, frente |
| **1** | 64 | **idle** (parado, respirando) | **24** (6 por direção) |
| **2** | 128 | **walk** (andando) | **24** (6 por direção) |
| 3 | 192 | sleep (dormindo, deitado) | 6, mais desenhos de cama |
| 4 | 256 | sit (sentado), variação 1 | 12 |
| 5 | 320 | sit (sentado), variação 2 | 12 |
| 6 | 384 | phone (celular), parte 1, tag "4-9 loop" | 12 |
| 7 | 448 | phone (celular), parte 2, tag "1-6 loop" | 12, mais sprites pequenos de celular |
| 8 | 512 | push cart (empurrar carrinho) | 24, mais 12 do carrinho |
| 9 | 576 | pick up (pegar do chão) | cerca de 48 |
| 10 | 640 | gift (dar presente) | cerca de 43, mais 2 caixas de presente |
| 11 | 704 | lift (levantar peso) | cerca de 54 |
| 12 | 768 | throw (arremessar) | cerca de 54 |
| 13 | 832 | hit (apanhar) | 24 |
| 14 | 896 | punch (soco) | 24 |
| 15 | 960 | stab (facada) | 24, mais efeitos de arma |
| 16 | 1024 | grab gun (sacar arma) | 16 |
| 17 | 1088 | gun idle (parado com arma) | 24 |
| 18 | 1152 | shoot (atirar) | cerca de 12, mais clarões do tiro |
| 19 | 1216 | hurt (machucado, pisca em vermelho) | cerca de 12 |

Em **idle** e **walk**, os 24 quadros são 4 direções com 6 quadros cada, sempre nesta ordem:

| Quadros da linha | Direção |
|---|---|
| 0 a 5 | direita |
| 6 a 11 | costas (para cima) |
| 12 a 17 | esquerda |
| 18 a 23 | frente (para baixo) |

Observações:

- Só **idle** e **walk** foram conferidos quadro a quadro. Nas outras linhas as contagens são aproximadas, porque etiquetas
  e adereços ficam misturados aos quadros, e a divisão por direção ainda não foi verificada. Confirme antes de extrair uma nova.
- A imagem do corpo (`Body`) traz **etiquetas de texto e desenhos de adereços** (cama, carrinho, efeitos de arma) à
  direita das animações. Por isso a folha completa (`includeSpritesheet: true`) não serve direto como sprite de jogo. Use
  `animations` para receber só as linhas que você precisa, sem essas etiquetas.
- A folha de **criança** tem só as linhas 0 a 3 (poses, idle, walk, sleep), com 24 colunas. O layout dessas linhas é o mesmo.
- Com `animations: ["idle", "walk"]` você recebe uma imagem de 768 x 128 px: `idle` na linha 0 e `walk` na linha 1,
  24 quadros cada. No Phaser: `load.spritesheet(key, url, { frameWidth: 32, frameHeight: 64 })`; o quadro `n` da linha `r`
  é `r * 24 + n` (por exemplo, o walk para a direita são os quadros 24 a 29).

Já extraídas (pedir em `animations`): **idle**, **walk**, **sit** (linha 4, só de lado: direita e esquerda, 6 quadros cada),
**throw** (linha 12, 4 direções x 14 quadros), **punch** (linha 14, 4 x 6) e **hurt** (linha 19, 4 x 3). A folha devolvida
fica tão larga quanto a maior animação pedida (throw tem 56 quadros). Cada animação traz em `animationLayout.animations` as
suas `directions` e `framesPerDirection`.

Para extrair outra animação, adicione a linha em `ANIMATIONS` (em `src/render.ts`) com a linha, as direções e os quadros
por direção, e confira o recorte antes de usar.

## Onde ficam as peças

As peças vêm do pacote **Modern Interiors** (LimeZu, limezu.itch.io). A licença permite usar a arte no projeto (com
crédito), mas **proíbe redistribuir o asset**. Por isso:

- Elas ficam em `private-assets/` dentro deste pacote, pasta que está no `.gitignore` do pacote.
- Não coloque essas peças em `apps/web/public`: tudo que está lá é servido como arquivo estático para qualquer visitante,
  então o pacote inteiro ficaria disponível para download por URL. Os tiles e sprites que o Phaser precisa baixar ficam em
  `apps/web/public/tiles` e `apps/web/public/sprites` (ignorados no git pelo `apps/web/.gitignore`), mas as peças de skin
  o navegador nunca precisa: a API devolve só imagens já montadas.
- Para criar a pasta:

  ```bash
  pnpm --filter @globe-rtc/skin-generator sync-assets -- --source "<pacote>/moderninteriors-win/2_Characters/Character_Generator"
  ```

  Use `--sizes 16,32,48` para outros tamanhos e `--target <pasta>` para outro destino.
- Para usar outra pasta (por exemplo em produção, com um volume), defina `SKIN_GENERATOR_ASSETS_DIR`.
- Estrutura esperada: `<pasta>/<tamanho>x<tamanho>/<Categoria>/<id>.png`, com as categorias `Bodies`, `Bodies_kids`, `Eyes`,
  `Eyes_kids`, `Outfits`, `Outfits_kids`, `Hairstyles`, `Hairstyles_kids` e `Accessories`.

## Desenvolvimento

- `pnpm --filter @globe-rtc/skin-generator build` compila para `dist/` (a API usa o `dist/`).
- `pnpm --filter @globe-rtc/skin-generator test` roda os testes. Eles usam peças sintéticas minúsculas (tamanho 16), então
  **não precisam** da arte licenciada.
- A única dependência é o `pngjs` (JavaScript puro, sem módulo nativo).
