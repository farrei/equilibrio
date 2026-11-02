# Equilíbrio

O seu celular é a bandeja. Uma gota d'água fica na tela, e você inclina o aparelho pra mantê-la dentro do círculo central. O vento sopra de lados aleatórios, a tela treme, e com o tempo tudo fica mais difícil. Se a gota cair da bandeja, acabou.

## Modos
- **Solo:** cada segundo dentro do círculo vale 1 ponto. No centro exato vale o dobro.
- **Passa a Bandeja:** a cada 12 segundos aparece "Passe para o próximo!" e vocês têm 3 segundos pra passar o celular. Ganha quem fizer mais passes sem derrubar a gota.

## Controles
- Celular: inclinar o aparelho. No iPhone, a permissão do sensor é pedida quando você toca em "Começar".
- Sem sensor: arraste o dedo ou o mouse na tela, ou use as setas do teclado.

## Rodar localmente
```
python3 -m http.server 8000
```
Abra `http://localhost:8000`. Pra usar o sensor no celular, a página precisa estar em HTTPS (o GitHub Pages já resolve isso).

Feito em HTML, CSS e JavaScript puros, com canvas e Web Audio. Funciona offline e dá pra instalar na tela inicial.
