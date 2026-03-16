import React, { useState, useCallback } from "react";
import { View, FlatList, StyleSheet, Alert } from "react-native";
import { Card, Text, Button, Divider, List, Surface } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/api";

const ListaPedidosSalvosScreen = ({ navigation }: any) => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregarPedidos();
    }, []),
  );

  const carregarPedidos = async () => {
    try {
      const data = await AsyncStorage.getItem("@pedidos_offline");
      if (data) {
        setPedidos(JSON.parse(data));
      } else {
        setPedidos([]);
      }
    } catch (error) {
      console.error("Erro ao carregar pedidos", error);
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

  const editarPedido = (pedido: any) => {
    const carrinhoReconstruido: any = {};

    pedido.itens.forEach((item: any) => {
      carrinhoReconstruido[item.codpro] = {
        qtd: item.qtd,
        precoTabela: item.precoTabela,
        precoVenda: String(item.precoVenda).replace(".", ","),
        percDesconto: String(item.percDesconto || "0,00").replace(".", ","),
        valorDesconto: String(item.valorDesconto || "0,00").replace(".", ","),
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
    });
  };

  // --- LÓGICA DE ENVIO PADRONIZADA COM A API ADVPL ---
  const enviarParaProtheus = async (pedido: any) => {
    try {
      const payloadProtheus = {
        cliente:
          pedido.cliente?.A1_COD || pedido.cliente?.codigo || pedido.cliente,
        loja: pedido.cliente?.A1_LOJA || pedido.loja || "01",
        vendedor: pedido.vendedor,
        tabela: pedido.tabela,
        condicaoPagamento: pedido.condicaoPagamento || "001",
        formaPagto: pedido.formaPagto || "BOLETO",
        valorFlex: pedido.valorFlexTotal || 0,

        // Mapeando itens e garantindo o valorFlex
        itens: pedido.itens.map((item: any) => ({
          codpro: item.codpro,
          qtd: Number(item.qtd),
          preco: parseFloat(
            String(item.precoVenda).replace(/\./g, "").replace(",", "."),
          ),
          valorFlex: parseFloat(
            String(item.valorFlex || item.valorDesconto || "0")
              .replace(/\./g, "")
              .replace(",", "."),
          ),
        })),
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

  const sincronizarTodos = async () => {
    if (pedidos.length === 0)
      return Alert.alert("Aviso", "Nenhum pedido para sincronizar.");

    Alert.alert(
      "Sincronizar Pedidos",
      `Deseja enviar ${pedidos.length} pedido(s) para o servidor?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sincronizar",
          onPress: async () => {
            setSincronizando(true);
            const pedidosRestantes = [...pedidos];
            let sucessos = 0;
            const falhas: string[] = [];

            for (const pedido of pedidos) {
              const res = await enviarParaProtheus(pedido);

              if (res.sucesso) {
                sucessos++;
                // Remove apenas o que foi com sucesso
                const index = pedidosRestantes.findIndex(
                  (p) => p.id === pedido.id,
                );
                if (index !== -1) pedidosRestantes.splice(index, 1);
              } else {
                falhas.push(`${getNomeCliente(pedido.cliente)}: ${res.erro}`);
              }
            }

            // Atualiza o storage com os pedidos que falharam (se houver)
            await AsyncStorage.setItem(
              "@pedidos_offline",
              JSON.stringify(pedidosRestantes),
            );
            setPedidos(pedidosRestantes);
            setSincronizando(false);

            if (falhas.length === 0) {
              Alert.alert(
                "Sucesso",
                "Todos os pedidos foram sincronizados com sucesso!",
              );
            } else {
              Alert.alert(
                "Sincronização Parcial",
                `${sucessos} enviados com sucesso.\n\nErros:\n${falhas.join("\n")}`,
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Não há pedidos salvos offline.</Text>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => editarPedido(item)}>
            <Card.Content>
              <View style={styles.headerCard}>
                <Text style={styles.clienteText} numberOfLines={1}>
                  Cliente: {getNomeCliente(item.cliente)}
                </Text>
                <Text style={styles.dataText}>
                  {new Date(item.dataCriacao).toLocaleDateString("pt-BR")}
                </Text>
              </View>

              <Divider style={{ marginVertical: 8 }} />

              <Text style={styles.infoText}>
                Itens:{" "}
                <Text style={{ fontWeight: "bold" }}>{item.itens.length}</Text>
              </Text>
              <Text style={styles.infoText}>
                Condição:{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {item.condicaoPagamento || "N/A"}
                </Text>
              </Text>

              <View style={styles.footerCard}>
                <Text style={styles.valorTotal}>
                  {formatarMoeda(item.valorTotal)}
                </Text>
                <List.Icon icon="pencil-circle" color="#005492" />
              </View>
            </Card.Content>
          </Card>
        )}
      />

      {pedidos.length > 0 && (
        <Surface style={styles.footerContainer} elevation={4}>
          <Button
            mode="contained"
            icon="cloud-upload"
            buttonColor="#2e7d32"
            loading={sincronizando}
            disabled={sincronizando}
            onPress={sincronizarTodos}
            contentStyle={{ height: 50 }}
          >
            Sincronizar Todos
          </Button>
        </Surface>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  listContainer: { padding: 15, paddingBottom: 100 },
  card: { marginBottom: 15, backgroundColor: "#fff", elevation: 3 },
  headerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clienteText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#005492",
    flex: 1,
    paddingRight: 8,
  },
  dataText: { fontSize: 12, color: "#888" },
  infoText: { fontSize: 14, color: "#444", marginBottom: 4 },
  footerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  valorTotal: { fontSize: 18, fontWeight: "bold", color: "#2e7d32" },
  emptyText: {
    textAlign: "center",
    color: "#777",
    marginTop: 40,
    fontSize: 16,
  },
  footerContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 15,
    backgroundColor: "#fff",
  },
});

export default ListaPedidosSalvosScreen;
