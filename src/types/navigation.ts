export type RootStackParamList = {
  Login: undefined;
  SelecaoEmpresa: { vendedorId: string };
  Clientes: { vendedorId: string };
  DetalhesCliente: { cliente: string; loja: string };
  SelecaoTabela: { cliente: string; loja: string };
  SelecaoProdutos: { cliente: string; loja: string; tabela: string };
  PedidosOffline: undefined;
  RevisaoPedido: {
    carrinho: { [key: string]: number };
    cliente: string;
    loja: string;
    tabela: string;
    produtosOriginais: any[];
  };
};
