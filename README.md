# EAFC26 Championship

Projeto segmentado para GitHub Pages.

## Como subir no GitHub

1. Extraia este ZIP.
2. No repositório `eafc26-championship`, envie:
   - `index.html`
   - pasta `css`
   - pasta `js`
3. Faça commit.
4. Aguarde o GitHub Pages publicar.

## Estrutura

```text
index.html
css/styles.css
js/config.js
js/data.js
js/utils.js
js/api.js
js/standings.js
js/calendar.js
js/cups.js
js/transfers.js
js/events.js
js/players.js
js/forms.js
js/main.js
```

## Observação

O app está apontando para o Apps Script versão 5 informado:

```text
https://script.google.com/macros/s/AKfycbxbm5pIAkY4VHcWECWBwMNrpSbnxJu85jY665CQJhF0WcmhDPChymHEU9KSBO_H5wlj/exec
```

Se você publicar uma nova versão do Apps Script e a URL mudar, altere `js/config.js`.


## Atualização v13

- Home da classificação redesenhada no estilo Mistura Managers League.
- Header com mascote em selo circular e frase personalizada.
- Cards principais com ícones.
- Classificação resumida com emblemas estilizados.
- Próximos jogos com emblemas dos times.
- Seção Copa Mistura no rodapé da home.


## Atualização v18

- Frontend apontando para a API v17 implantada na versão 9.
- Suporte a logos reais via aba `Clubes`.
- Visual refresh aplicado.
