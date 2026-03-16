import React, { useState, useCallback } from "react";
import { View, FlatList, StyleSheet, Alert } from "react-native";
import {
  Card,
  Text,
  Button,
  Divider,
  Surface,
  IconButton,
} from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const PedidosOfflineScreen = ({ navigation }: any) => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregarPedidos();
    }, []),
  );

  const carregarPedidos = async () => {
    const data = await AsyncStorage.getItem("@pedidos_offline");
    setPedidos(data ? JSON.parse(data) : []);
  };

  // Função para tentar encontrar o nome do cliente em diferentes propriedades
  const getNomeCliente = (cliente: any) => {
    if (!cliente) return "Cliente não identificado";
    return (
      cliente.nome ||
      cliente.razao_social ||
      cliente.RAZAO ||
      cliente.NOME ||
      cliente.nome_cliente ||
      "Cliente " + (cliente.codigo || "")
    );
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
        valorFlex: String(item.valorDesconto || "0,00").replace(".", ","),
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
    });
  };

  const excluirPedido = (id: string) => {
    Alert.alert("Excluir", "Deseja remover este pedido?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          const data = await AsyncStorage.getItem("@pedidos_offline");
          if (data) {
            const novaLista = JSON.parse(data).filter((p: any) => p.id !== id);
            await AsyncStorage.setItem(
              "@pedidos_offline",
              JSON.stringify(novaLista),
            );
            setPedidos(novaLista);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => editarPedido(item)}>
            <Card.Content style={styles.cardInner}>
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clienteNome} numberOfLines={2}>
                    {getNomeCliente(item.cliente)}
                  </Text>
                  <Text style={styles.data}>
                    Criado em: {new Date(item.dataCriacao).toLocaleDateString()}
                  </Text>
                </View>
                <IconButton
                  icon="trash-can-outline"
                  iconColor="#d32f2f"
                  size={24}
                  onPress={() => excluirPedido(item.id)}
                />
              </View>

              <Divider style={{ marginVertical: 8 }} />

              <View style={styles.footerRow}>
                <View>
                  <Text style={styles.infoText}>Tabela: {item.tabela}</Text>
                  <Text style={styles.infoText}>
                    Itens: {item.itens.length}
                  </Text>
                </View>
                <Text style={styles.total}>
                  R$ {item.valorTotal.toFixed(2)}
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
            onPress={() => {}} // Sua lógica de sincronização
            style={styles.btnSincronizar}
          >
            Sincronizar Todos
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
  cardInner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
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
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  infoText: { fontSize: 13, color: "#555" },
  total: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2e7d32",
  },
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
});

export default PedidosOfflineScreen;
