import {
  test,
  expect,
  type APIRequestContext,
} from "@playwright/test";

const loja = "https://serverest.dev";

/*
 * Partes da API envolvidas:
 * POST /usuarios, POST /login, POST /produtos,
 * POST /carrinhos e GET /produtos/{id}.
 *
 * Confere se adicionar 1 unidade ao carrinho reduz
 * o estoque inicial de 10 para 9.
 */

/** Cria um administrador e retorna o token de autenticação. */
async function criarUsuarioELogar(
  request: APIRequestContext
): Promise<string> {
  const identificador = `${Date.now()}${Math.random()
    .toString(36)
    .slice(2)}`;

  const email = `teste${identificador}@teste.com`;
  const senha = "1234";

  const cadastro = await request.post(`${loja}/usuarios`, {
    data: {
      nome: "Teste Playwright",
      email,
      password: senha,
      administrador: "true",
    },
  });

  expect(
    cadastro.status(),
    `Falha ao criar usuário: ${await cadastro.text()}`
  ).toBe(201);

  const login = await request.post(`${loja}/login`, {
    data: {
      email,
      password: senha,
    },
  });

  expect(
    login.status(),
    `Falha no login: ${await login.text()}`
  ).toBe(200);

  const dadosLogin = (await login.json()) as {
    authorization: string;
  };

  expect(dadosLogin.authorization).toBeTruthy();

  return dadosLogin.authorization;
}

/** Cadastra um produto com estoque inicial de 10 unidades. */
async function criarProduto(
  request: APIRequestContext,
  token: string
): Promise<string> {
  const identificador = `${Date.now()}${Math.random()
    .toString(36)
    .slice(2)}`;

  const resposta = await request.post(`${loja}/produtos`, {
    headers: {
      Authorization: token,
    },
    data: {
      nome: `Produto ${identificador}`,
      preco: 100,
      descricao: "Produto de teste Playwright",
      quantidade: 10,
    },
  });

  expect(
    resposta.status(),
    `Falha ao cadastrar produto: ${await resposta.text()}`
  ).toBe(201);

  const dadosProduto = (await resposta.json()) as {
    _id: string;
  };

  expect(dadosProduto._id).toBeTruthy();

  return dadosProduto._id;
}

/** Adiciona uma unidade do produto ao carrinho. */
async function adicionarAoCarrinho(
  request: APIRequestContext,
  token: string,
  idProduto: string
): Promise<void> {
  const carrinho = await request.post(`${loja}/carrinhos`, {
    headers: {
      Authorization: token,
    },
    data: {
      produtos: [
        {
          idProduto,
          quantidade: 1,
        },
      ],
    },
  });

  expect(
    carrinho.status(),
    `Falha ao criar carrinho: ${await carrinho.text()}`
  ).toBe(201);
}

// DEGRAU 1
test(
  "adicionar produto ao carrinho diminui o estoque para 9",
  async ({ request }) => {
    const token = await criarUsuarioELogar(request);
    const idProduto = await criarProduto(request, token);

    await adicionarAoCarrinho(request, token, idProduto);

    const consulta = await request.get(
      `${loja}/produtos/${idProduto}`
    );

    expect(consulta.status()).toBe(200);

    const produto = (await consulta.json()) as {
      quantidade: number;
    };

    expect(produto.quantidade).toBe(9);
  }
);

// DEGRAU 2
/*
 * Partes da API envolvidas:
 * POST /usuarios, POST /login, POST /produtos,
 * POST /carrinhos, DELETE /carrinhos/cancelar-compra
 * e GET /produtos/{id}.
 *
 * Confere se cancelar a compra devolve a unidade ao estoque,
 * restaurando a quantidade de 9 para 10.
 */
test(
  "cancelar compra devolve o produto ao estoque",
  async ({ request }) => {
    const token = await criarUsuarioELogar(request);
    const idProduto = await criarProduto(request, token);

    await adicionarAoCarrinho(request, token, idProduto);

    // Confirma o estoque reduzido antes do cancelamento.
    const consultaAntes = await request.get(
      `${loja}/produtos/${idProduto}`
    );

    expect(consultaAntes.status()).toBe(200);

    const produtoAntes = (await consultaAntes.json()) as {
      quantidade: number;
    };

    expect(produtoAntes.quantidade).toBe(9);

    // Cancela a compra.
    const cancelamento = await request.delete(
      `${loja}/carrinhos/cancelar-compra`,
      {
        headers: {
          Authorization: token,
        },
      }
    );

    expect(
      cancelamento.status(),
      `Falha ao cancelar compra: ${await cancelamento.text()}`
    ).toBe(200);

    // Confere se o estoque voltou para 10.
    const consultaDepois = await request.get(
      `${loja}/produtos/${idProduto}`
    );

    expect(consultaDepois.status()).toBe(200);

    const produtoDepois = (await consultaDepois.json()) as {
      quantidade: number;
    };

    expect(produtoDepois.quantidade).toBe(10);
  }
);

// DESAFIO
/*
 * Partes da API envolvidas:
 * POST /usuarios, POST /login, POST /produtos,
 * POST /carrinhos e DELETE /produtos/{id}.
 *
 * Confere se a API recusa excluir um produto associado
 * a um carrinho, retornando o status HTTP 400.
 */
test(
  "API recusa excluir produto que está no carrinho",
  async ({ request }) => {
    const token = await criarUsuarioELogar(request);
    const idProduto = await criarProduto(request, token);

    await adicionarAoCarrinho(request, token, idProduto);

    const exclusao = await request.delete(
      `${loja}/produtos/${idProduto}`,
      {
        headers: {
          Authorization: token,
        },
      }
    );

    expect(
      exclusao.status(),
      `A exclusão retornou: ${await exclusao.text()}`
    ).toBe(400);
  }
);