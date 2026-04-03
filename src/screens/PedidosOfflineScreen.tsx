import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  Card,
  Text,
  Button,
  Divider,
  Surface,
  IconButton,
  List,
} from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/api";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const PedidosOfflineScreen = ({ navigation }: any) => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      carregarPedidos();
    }, []),
  );

  const carregarPedidos = async () => {
    setLoading(true);
    try {
      const data = await AsyncStorage.getItem("@pedidos_offline");
      setPedidos(data ? JSON.parse(data) : []);
    } catch (error) {
      console.error("Erro ao carregar storage", error);
    } finally {
      setLoading(false);
    }
  };

  const getNomeCliente = (cliente: any) => {
    if (!cliente) return "Cliente não identificado";
    return (
      cliente.nome ||
      cliente.razao_social ||
      cliente.NOME ||
      "Cliente " + (cliente.codigo || "")
    );
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor || 0);
  };

  // --- FUNÇÃO DE EDIÇÃO RESTAURADA ---
  const editarPedido = (pedido: any) => {
    const carrinhoReconstruido: any = {};

    pedido.itens.forEach((item: any) => {
      carrinhoReconstruido[item.codpro] = {
        qtd: item.qtd,
        precoTabela: item.precoTabela || item.preco,
        precoVenda: String(item.precoVenda || item.preco).replace(".", ","),
        percDesconto: String(item.percDesconto || "0,00").replace(".", ","),
        valorDesconto: String(item.valorDesconto || "0,00").replace(".", ","),
        // Garante que o Flex volte formatado para a tela de produtos
        valorFlex: String(
          item.valorFlex || item.valorDesconto || "0,00",
        ).replace(".", ","),
      };
    });

    console.log("CONTEÚDO DO PEDIDO:", JSON.stringify(pedido, null, 2));

    navigation.navigate("SelecaoProdutos", {
      cliente: pedido.cliente,
      loja: pedido.loja,
      tabela: pedido.tabela,
      vendedorId: pedido.vendedor,
      carrinhoInicial: carrinhoReconstruido,
      pedidoIdEdicao: pedido.id,
      dadosPedidoSalvo: pedido,
      saldoFlex: pedido.saldoFlex || 0, // Devolve o saldo flex para a tela
    });
  };

  {
    /* GERAR PDF */
  }
  const gerarPDFPedidoSalvo = async (pedido: any) => {
    if (!pedido) {
      Alert.alert("Erro", "O pedido selecionado está corrompido ou vazio.");
      return;
    }

    try {
      const dataPedido = pedido.data || new Date().toLocaleDateString("pt-BR");

      // FUNÇÃO PARA CALCULAR +1 DIA ÚTIL
      const calcularDataEntregaUtil = (dataStr: string) => {
        let data = new Date();
        // Tenta interpretar a data no formato DD/MM/YYYY
        if (dataStr && dataStr.includes("/")) {
          const [dia, mes, ano] = dataStr.split("/");
          data = new Date(Number(ano), Number(mes) - 1, Number(dia));
        } else if (dataStr) {
          data = new Date(dataStr);
        }

        if (isNaN(data.getTime())) data = new Date();

        data.setDate(data.getDate() + 1); // Adiciona 1 dia

        // Pula final de semana
        if (data.getDay() === 6) {
          // Sábado
          data.setDate(data.getDate() + 2);
        } else if (data.getDay() === 0) {
          // Domingo
          data.setDate(data.getDate() + 1);
        }
        return data.toLocaleDateString("pt-BR");
      };

      const dataEntrega = calcularDataEntregaUtil(dataPedido);

      // 1. Dados do Cliente
      const cliente = pedido.cliente || {};
      const codCliente = cliente.CODIGO || cliente.codigo || "";
      const lojaCliente = cliente.LOJA || cliente.loja || "01";
      const nomeCliente =
        cliente.NOME || cliente.nome || "Cliente não identificado";
      const clienteCompleto = codCliente
        ? `${codCliente}-${lojaCliente}-${nomeCliente}`
        : nomeCliente;

      // Endereço do Cliente
      const logradouro = cliente.END || cliente.endereco || "";
      const bairro = cliente.BAIRRO || cliente.bairro || "";
      // Adicionamos redundância para captar cidade e estado de qualquer origem
      const municipio = pedido.cliente?.cidade || "";
      const estado = cliente.EST || cliente.uf || cliente.estado || "";

      const enderecoCompleto =
        `${logradouro}${bairro ? ", " + bairro : ""} - ${municipio} - ${estado}`.trim() ||
        "Endereço não informado";

      // 2. Dados Gerais do Pedido
      const filialAtiva = await AsyncStorage.getItem("@filial_ativa");

      // BUSCANDO AS DESCRIÇÕES (Priorizando os campos de "Desc" que devemos salvar)
      const nomeVendedor =
        pedido.vendedorNome ||
        pedido.vendedor ||
        pedido.vendedorId ||
        "Vendedor não identificado";

      // Concatena código e descrição da filial se houver
      const filialVenda = pedido.filialDesc
        ? `${pedido.filial} - ${pedido.filialDesc}`
        : pedido.filial || filialAtiva || "Não informada";

      const codTabela = pedido.tabela || "";
      const descTabela = pedido.tabelaDesc || "";

      const tabelaPreco =
        codTabela && descTabela
          ? `${codTabela} - ${descTabela}`
          : codTabela || descTabela || "Não informada";

      const condicaoPagto =
        pedido.condicaoDesc ||
        pedido.condicaoPagamentoDesc ||
        pedido.condicaoSel ||
        pedido.configuracao?.condicao ||
        "A combinar";

      const formaPagto =
        pedido.formaPagto ||
        (pedido.configuracao?.pagamento === "BOL"
          ? "BOLETO BANCARIO"
          : pedido.configuracao?.pagamento === "PIX"
            ? "PIX"
            : "A combinar");

      // 3. Itens e Cálculos
      const listaItens = Array.isArray(pedido.itens)
        ? pedido.itens
        : Array.isArray(pedido.produtos)
          ? pedido.produtos
          : [];
      const carrinho = pedido.carrinho || {};

      const qtdProdutos = listaItens.length;
      const qtdItensTotal = Object.values(carrinho).reduce(
        (acc: number, curr: any) => acc + (Number(curr?.qtd) || 0),
        0,
      );

      const valorTotal =
        pedido.valorTotal || pedido.total || pedido.totais?.totalGeral || 0;

      let somaQtdTotal = 0;
      let somaValorTotal = 0;

      const formatCur = (val: any) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(num);
      };

      // 4. Montagem da Tabela de Itens
      const itensHtml =
        listaItens.length > 0
          ? listaItens
              .map((item: any, index: number) => {
                if (!item) return "";
                const id = item.codpro || item.CODPRO || "";
                const dadosCarrinho = carrinho[id] || {};
                const qtd = Number(dadosCarrinho.qtd || item.qtd || 0);

                const pVenda =
                  dadosCarrinho.precoVenda ||
                  item.precoVenda ||
                  item.preco ||
                  0;
                const precoLimpo =
                  typeof pVenda === "string"
                    ? parseFloat(pVenda.replace(",", "."))
                    : pVenda;
                const subtotal = precoLimpo * qtd;

                somaQtdTotal += qtd;
                somaValorTotal += subtotal;

                return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${String(index + 1).padStart(2, "0")}</td>
          <td style="font-weight: bold;">${item.desc || item.DESC || "Produto sem descrição"}</td>
          <td style="text-align: center;">${qtd}</td>
          <td style="text-align: right;">${formatCur(precoLimpo)}</td>
          <td style="text-align: right; font-weight: bold;">${formatCur(precoLimpo * qtd)}</td>
        </tr>
      `;
              })
              .join("")
          : '<tr><td colspan="5" style="text-align:center">Nenhum item encontrado</td></tr>';

      // 5. Layout HTML Modernizado
      const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; color: #000; font-size: 11px; line-height: 1.3; }
            .main-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 25px; color: #005492; }
            
            .section-title {
              background-color: #005492;
              color: white;
              font-weight: bold;
              padding: 6px 10px;
              margin-top: 20px;
              margin-bottom: 8px;
              font-size: 13px;
              border-radius: 3px;
              text-transform: uppercase;
              border: 1px solid #003d6b;
            }
            
            .row { display: flex; padding: 3px 10px; }
            .label { width: 30%; font-weight: bold; color: #555; }
            .value { width: 70%; font-weight: bold; }
            
            table.grid-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; border: 2px solid #000; }
            table.grid-table th { background-color: #e0e0e0; color: #000; border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; text-transform: uppercase; }
            table.grid-table td { border: 1px solid #000; padding: 8px; }
            .col-ordem { width: 45px; text-align: center; }
            .col-qtde { width: 45px; text-align: center; }
            .col-preco { width: 85px; text-align: right; }
            .col-total { width: 95px; text-align: right; }
            
            .assinatura { margin-top: 60px; text-align: center; font-size: 12px; }
            .footer { margin-top: 50px; font-size: 10px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="main-title">Automação da Força de Vendas (SFA)</div>
          <div style="font-size: 14px; text-align: center; margin-top: -15px; margin-bottom: 20px;">Cotação / Orçamento</div>
          
          <div class="section-title">Cabeçalho</div>
          <div class="row"><div class="label">Data pedido:</div><div class="value">${dataPedido}</div></div>
          <div class="row"><div class="label">Profissional:</div><div class="value">${nomeVendedor}</div></div>
          <div class="row"><div class="label">Cliente:</div><div class="value">${clienteCompleto}</div></div>
          <div class="row"><div class="label">Local:</div><div class="value">${enderecoCompleto}</div></div>
          <div class="row"><div class="label">Filial venda:</div><div class="value">${filialVenda}</div></div>
          <div class="row"><div class="label">Tipo pedido:</div><div class="value">VENDA DE MERCADORIA</div></div>
          <div class="row"><div class="label">Tabela de preço:</div><div class="value">${tabelaPreco}</div></div>
          <div class="row"><div class="label">Condição de pagamento:</div><div class="value">${condicaoPagto}</div></div>
          <div class="row"><div class="label">Tipo de cobrança:</div><div class="value">${formaPagto}</div></div>
          <div class="row"><div class="label">Data entrega:</div><div class="value">${dataEntrega}</div></div>
          <div class="row"><div class="label">Tipo frete:</div><div class="value">CIF</div></div>

          <div class="section-title">Resumo</div>
          <div class="row"><div class="label">Quantidade de produtos:</div><div class="value">${qtdProdutos}</div></div>
          <div class="row"><div class="label">Quantidade de itens:</div><div class="value">${somaQtdTotal}</div></div>
          <div class="row"><div class="label">Valor total liquido:</div><div class="value">${formatCur(valorTotal)}</div></div>

          <div class="section-title">Entrega</div>
          <div class="row"><div class="label">Data entrega:</div><div class="value">${dataEntrega}</div></div>
          <div class="row"><div class="label">Tipo de frete:</div><div class="value">CIF</div></div>
          <div class="row"><div class="label">Transportadora:</div><div class="value">T00139 - RISSO TRANSPORTES LTDA</div></div>

          <div class="section-title">Itens do Orçamento</div>
          <table class="grid-table">
            <thead>
              <tr>
                <th class="col-ordem">Ordem</th>
                <th>Produto / Descrição</th>
                <th class="col-qtde">Qtde</th>
                <th class="col-preco">Preço Venda</th>
                <th class="col-total">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              ${itensHtml}
              <tr class="row-total-grid">
                <td colspan="2" style="text-align: right; padding-right: 15px; font-weight: bold;">TOTAL GERAL:</td>
                <td style="text-align: center; font-weight: bold;">${somaQtdTotal}</td>
                <td></td>
                <td style="text-align: right; font-weight: bold;">${formatCur(somaValorTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div class="assinatura">
            <p>_______________________________________________________</p>
            <p><strong>${nomeCliente}</strong></p>
            <p style="font-size: 10px; color: #666;">Assinatura do Cliente</p>
          </div>

          <div class="footer">
            ESTE DOCUMENTO NÃO POSSUI VALIDADE FISCAL. GENERATED BY TOTVS SFA APP.
          </div>
        </body>
      </html>
    `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
      });
    } catch (error: any) {
      console.error("Erro PDF:", error);
      Alert.alert("Erro", "Falha ao processar dados do pedido para o PDF.");
    }
  };

  const enviarParaProtheus = async (pedido: any) => {
    try {
      // Função auxiliar para garantir que o valor seja um número puro
      const tratarValor = (valor: any) => {
        if (typeof valor === "number") return valor;
        const str = String(valor || "0");
        const limpo = str.replace(/\./g, "").replace(",", ".");
        return parseFloat(limpo) || 0;
      };

      const payloadProtheus = {
        cliente:
          pedido.cliente?.A1_COD || pedido.cliente?.codigo || pedido.cliente,
        loja: pedido.cliente?.A1_LOJA || pedido.loja || "01",
        vendedor: pedido.vendedor,
        tabela: pedido.tabela,
        condicaoPagamento: pedido.condicaoPagamento || "001",
        formaPagto: pedido.formaPagto || "BOLETO",
        // Tratando também o valor total do cabeçalho por segurança
        valorFlex: Number(tratarValor(pedido.valorFlexTotal || 0).toFixed(2)),
        dataini: pedido.dataini || "",
        horaini: pedido.horaini || "",
        datafim: pedido.datafim || "",
        horafim: pedido.horafim || "",
        tipoAten: pedido.tipoAten || "APP",

        itens: pedido.itens.map((item: any) => {
          const nPreco = tratarValor(item.precoVenda || item.preco);
          const nFlexItem = tratarValor(item.valorFlex || item.valorDesconto);

          return {
            codpro: item.codpro,
            qtd: Number(item.qtd),
            // Força o formato numérico com 2 casas decimais para o Protheus
            preco: Number(nPreco.toFixed(2)),
            valorFlex: Number(nFlexItem.toFixed(2)),
          };
        }),
      };

      const response = await api.post(
        "/api/incluipedidovenda",
        payloadProtheus,
      );

      if (response.status === 200 || response.status === 201) {
        return { sucesso: true };
      }
      return { sucesso: false, erro: `Erro no servidor: ${response.status}` };
    } catch (error: any) {
      const msg =
        error.response?.data?.message || "Erro de conexão com o servidor";
      return { sucesso: false, erro: msg };
    }
  };

  const sincronizarIndividual = (pedido: any) => {
    Alert.alert(
      "Sincronizar Pedido",
      `Deseja enviar o pedido de ${getNomeCliente(pedido.cliente)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: async () => {
            setSincronizando(true);
            // LOG 3: Ver o que está saindo do App rumo ao Protheus
            console.log(
              "DEBUG - Enviando este JSON para o Protheus:",
              JSON.stringify(pedido, null, 2),
            );
            const res = await enviarParaProtheus(pedido);
            setSincronizando(false);

            if (res.sucesso) {
              const novaLista = pedidos.filter((p) => p.id !== pedido.id);
              await AsyncStorage.setItem(
                "@pedidos_offline",
                JSON.stringify(novaLista),
              );
              setPedidos(novaLista);
              Alert.alert("Sucesso", "Pedido gravado no Protheus!");
            } else {
              Alert.alert("Erro ao enviar", res.erro);
            }
          },
        },
      ],
    );
  };

  const sincronizarTodos = async () => {
    if (pedidos.length === 0) return;
    setSincronizando(true);

    const pedidosRestantes = [...pedidos];
    let sucessos = 0;
    const falhas: string[] = [];

    for (const pedido of pedidos) {
      const res = await enviarParaProtheus(pedido);
      if (res.sucesso) {
        sucessos++;
        const index = pedidosRestantes.findIndex((p) => p.id === pedido.id);
        if (index !== -1) pedidosRestantes.splice(index, 1);
      } else {
        falhas.push(`${getNomeCliente(pedido.cliente)}: ${res.erro}`);
      }
    }

    await AsyncStorage.setItem(
      "@pedidos_offline",
      JSON.stringify(pedidosRestantes),
    );
    setPedidos(pedidosRestantes);
    setSincronizando(false);

    if (falhas.length === 0) {
      Alert.alert("Concluído", "Todos os pedidos foram gravados no Protheus!");
    } else {
      Alert.alert(
        "Sincronização Parcial",
        `${sucessos} enviados com sucesso.\n\nErros:\n${falhas.join("\n")}`,
      );
    }
  };

  const excluirPedido = (id: string) => {
    Alert.alert("Excluir", "Deseja remover este pedido do aparelho?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          const novaLista = pedidos.filter((p: any) => p.id !== id);
          await AsyncStorage.setItem(
            "@pedidos_offline",
            JSON.stringify(novaLista),
          );
          setPedidos(novaLista);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ActivityIndicator
        style={{ flex: 1, justifyContent: "center" }}
        color="#005492"
        size="large"
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <List.Icon icon="check-all" color="#ccc" />
            <Text style={{ color: "#999", fontSize: 16 }}>
              Nenhum pedido pendente de envio.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => editarPedido(item)}>
            <Card.Content style={styles.cardInner}>
              <View style={styles.header}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.clienteNome} numberOfLines={2}>
                    {getNomeCliente(item.cliente)}
                  </Text>
                  <Text style={styles.data}>
                    Criado em: {new Date(item.dataCriacao).toLocaleDateString()}
                  </Text>
                </View>

                {/* BOTÃO PDF AQUI */}
                <View style={styles.acoesContainer}>
                  <IconButton
                    icon="file-pdf-box"
                    iconColor="#005492"
                    size={24}
                    onPress={() => gerarPDFPedidoSalvo(item)} // 'item' é o pedido da linha atual
                  />

                  {/* BOTÃO LÁPIS - EDIÇÃO */}
                  <IconButton
                    icon="pencil"
                    iconColor="#005492"
                    size={22}
                    disabled={sincronizando}
                    onPress={() => editarPedido(item)}
                    style={styles.btnAcao}
                  />
                  {/* BOTÃO NUVEM - SINCRONIZAR INDIVIDUAL */}
                  <IconButton
                    icon="cloud-upload"
                    iconColor="#2e7d32"
                    size={22}
                    disabled={sincronizando}
                    onPress={() => sincronizarIndividual(item)}
                    style={styles.btnAcao}
                  />
                  {/* BOTÃO LIXEIRA - EXCLUIR */}
                  <IconButton
                    icon="trash-can-outline"
                    iconColor="#d32f2f"
                    size={22}
                    disabled={sincronizando}
                    onPress={() => excluirPedido(item.id)}
                    style={styles.btnAcao}
                  />
                </View>
              </View>

              <Divider style={{ marginVertical: 8 }} />

              <View style={styles.footerRow}>
                <View>
                  <Text style={styles.infoText}>
                    Cond. Pgto: {item.condicaoPagamento || "N/A"}
                  </Text>
                  <Text style={styles.infoText}>
                    Itens: {item.itens.length}
                  </Text>
                </View>
                <Text style={styles.total}>
                  {formatarMoeda(item.valorTotal)}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}
      />

      {pedidos.length > 0 && (
        <Surface style={styles.footerSticky} elevation={4}>
          <Button
            mode="contained"
            icon="sync"
            loading={sincronizando}
            disabled={sincronizando}
            onPress={sincronizarTodos}
            style={styles.btnSincronizar}
          >
            {sincronizando
              ? "SINCRONIZANDO..."
              : `SINCRONIZAR TODOS (${pedidos.length})`}
          </Button>
        </Surface>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  card: {
    marginBottom: 12,
    backgroundColor: "#fff",
    elevation: 2,
    borderRadius: 10,
  },
  cardInner: { paddingVertical: 12, paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  clienteNome: {
    fontWeight: "bold",
    color: "#005492",
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  data: { fontSize: 12, color: "#777" },
  acoesContainer: { flexDirection: "row", marginTop: -8, marginRight: -8 },
  btnAcao: { margin: 0 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  infoText: { fontSize: 13, color: "#555" },
  total: { fontSize: 18, fontWeight: "bold", color: "#2e7d32" },
  footerSticky: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 16,
    backgroundColor: "#fff",
  },
  btnSincronizar: {
    backgroundColor: "#005492",
    borderRadius: 8,
    paddingVertical: 4,
  },
  empty: { alignItems: "center", marginTop: 100 },
});

export default PedidosOfflineScreen;
