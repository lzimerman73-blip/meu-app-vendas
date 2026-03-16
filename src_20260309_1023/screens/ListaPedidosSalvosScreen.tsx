import React, { useState, useCallback } from "react";
import { View, FlatList, StyleSheet, Alert } from "react-native";
import { Card, Text, Button, Divider, List, Surface } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/api"; // Se for usar para sincronizar

const ListaPedidosSalvosScreen = ({ navigation }: any) => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  // Carrega os pedidos toda vez que a tela ganha foco
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

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor || 0);
  };

  const editarPedido = (pedido: any) => {
    // 1. Reconstruir o formato do carrinho que a SelecaoProdutosScreen espera
    const carrinhoReconstruido: any = {};

    pedido.itens.forEach((item: any) => {
      carrinhoReconstruido[item.codpro] = {
        qtd: item.qtd,
        precoTabela: item.precoTabela,
        precoVenda: String(item.precoVenda).replace(".", ","), // Voltando pro formato de input
        percDesconto: String(item.percDesconto || "0,00").replace(".", ","),
        valorDesconto: String(item.valorDesconto || "0,00").replace(".", ","),
        valorFlex: String(item.valorDesconto || "0,00").replace(".", ","), // Assumindo valorFlex
      };
    });

    // 2. Navegar para a tela de Seleção mandando o carrinho inicial
    navigation.navigate("SelecaoProdutos", {
      cliente: pedido.cliente,
      loja: pedido.loja,
      tabela: pedido.tabela,
      vendedorId: pedido.vendedor,
      carrinhoInicial: carrinhoReconstruido, // AVISO: Precisaremos ler isso na SelecaoProdutos
      pedidoIdEdicao: pedido.id, // Para saber que estamos editando um pedido já salvo
    });
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
            try {
              // EXEMPLO DE LÓGICA DE ENVIO (Adapte para a sua API)
              /*
              for (const pedido of pedidos) {
                await api.post("/api/salvarpedido", pedido);
              }
              */

              // Se deu certo, limpa os pedidos salvos
              await AsyncStorage.removeItem("@pedidos_offline");
              setPedidos([]);
              Alert.alert(
                "Sucesso",
                "Todos os pedidos foram sincronizados com sucesso!",
              );
            } catch (error) {
              Alert.alert(
                "Erro",
                "Falha ao sincronizar alguns pedidos. Tente novamente.",
              );
            } finally {
              setSincronizando(false);
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
                <Text style={styles.clienteText}>Cliente: {item.cliente}</Text>
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
                  {item.condicaoPagamento}
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
  clienteText: { fontSize: 16, fontWeight: "bold", color: "#005492", flex: 1 },
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
