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

                <View style={styles.acoesContainer}>
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
