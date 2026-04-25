import React, { useEffect, useState } from "react";
import { View, FlatList, StyleSheet, Alert } from "react-native";
import {
  Card,
  Text,
  ActivityIndicator,
  Searchbar,
  Badge,
  Divider,
} from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import api from "../api/api";
import { RootStackParamList } from "../types/navigation";

interface PedidoPendente {
  filial: string;
  cliente: string;
  pedido: string;
  item: string;
  produto: string;
  qtd_vendida: number;
  qtd_entregue: number;
  saldo: number;
  preco_total: number;
  valor_saldo: number;
}

type Props = NativeStackScreenProps<RootStackParamList, "PedidosPendentes">;

const PedidosPendentesScreen: React.FC<Props> = ({ route }) => {
  const { vendedorId } = route.params; // ✅ RECEBE vendedorId
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<PedidoPendente[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const carregarPedidos = async () => {
      // ✅ VALIDAÇÃO: Verifica se vendedorId existe
      if (!vendedorId) {
        console.log("Aguardando parâmetro vendedorId...");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // ✅ PASSA vendedorId NA QUERY STRING
        const url = `/api/getpedidosPendentes?vendedorId=${vendedorId}`;

        const response = await api.get(url);
        const resData = response.data;

        // Busca pela chave 'pedidosPendentes'
        if (resData && resData.pedidosPendentes) {
          setPedidos(resData.pedidosPendentes);
        } else {
          console.warn("API retornou sem 'pedidosPendentes' para:", url);
          setPedidos([]);
        }
      } catch (error) {
        console.error("Erro ao buscar pedidos pendentes:", error);
        Alert.alert("Erro", "Não foi possível carregar as pendências.");
      } finally {
        setLoading(false);
      }
    };

    carregarPedidos();
  }, [vendedorId]); // ✅ DEPENDENCY: vendedorId

  // Filtro de busca local
  const filtered = pedidos.filter(
    (p) =>
      p.pedido.includes(search) ||
      p.cliente.toLowerCase().includes(search.toLowerCase()) ||
      p.produto.includes(search),
  );

  const renderItem = ({ item }: { item: PedidoPendente }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.row}>
          <Text variant="titleMedium" style={styles.pedidoText}>
            Pedido: {item.pedido}
          </Text>
          <Badge size={25} style={styles.badgeSaldo}>
            {`Saldo: ${item.saldo}`}
          </Badge>
        </View>

        <Text variant="labelLarge" style={styles.clienteText}>
          {item.cliente}
        </Text>
        <Divider style={styles.divider} />

        <View style={styles.row}>
          <Text variant="bodyMedium">
            Prod: <Text style={{ fontWeight: "bold" }}>{item.produto}</Text>
          </Text>
          <Text variant="bodyMedium">Item: {item.item}</Text>
        </View>

        <View style={[styles.row, { marginTop: 12 }]}>
          <View>
            <Text variant="bodySmall">Preço Total Item</Text>
            <Text variant="bodyMedium" style={{ fontWeight: "bold" }}>
              {item.preco_total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text variant="labelSmall" style={{ color: "#666" }}>
              Valor em Aberto
            </Text>
            <Text variant="titleLarge" style={styles.valorText}>
              {item.valor_saldo.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 8, flexDirection: "row", gap: 10 }}>
          <Text variant="bodySmall">Vendida: {item.qtd_vendida}</Text>
          <Text variant="bodySmall">Entregue: {item.qtd_entregue}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Filtrar pedidos pendentes..."
        onChangeText={setSearch}
        value={search}
        style={styles.search}
      />

      {loading ? (
        <ActivityIndicator
          animating={true}
          style={{ flex: 1 }}
          color="#005492"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item.pedido + item.item + index}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Nenhum pedido pendente para este vendedor.
            </Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  search: { margin: 10, backgroundColor: "#fff", elevation: 2 },
  card: {
    marginHorizontal: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pedidoText: { color: "#005492", fontWeight: "bold" },
  clienteText: { color: "#444", marginBottom: 5 },
  badgeSaldo: { backgroundColor: "#FF9800", fontWeight: "bold" },
  valorText: { color: "#D32F2F", fontWeight: "bold" },
  divider: { marginVertical: 8 },
  empty: { textAlign: "center", marginTop: 50, color: "#999" },
});

export default PedidosPendentesScreen;
